#!/usr/bin/env node
/**
 * scrape_tournament_pairings.js
 *
 * 抓取 SFC 賽事頁的 round pairing + final/interim result，輸出統一 CSV：
 * ptcg/data/tournaments/{tid}.csv
 *
 * 用法：
 *   node scrape_tournament_pairings.js --tid 6682363
 *   node scrape_tournament_pairings.js --tid 6682363 --tid 6617577 --tid 7361615
 *   node scrape_tournament_pairings.js --tid 6682363,6617577,7361615
 *   node scrape_tournament_pairings.js --dry-run
 */

'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TOURNAMENTS_DIR = path.join(DATA_DIR, 'tournaments');
const UBL_JSON = path.join(DATA_DIR, 'tournaments_ubl.json');

function parseArgs(argv) {
  const args = {
    tids: [],
    delayMs: 120,
    dryRun: false,
    force: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--tid' && argv[i + 1]) {
      const parts = String(argv[i + 1]).split(',').map((s) => s.trim()).filter(Boolean);
      args.tids.push(...parts);
      i += 1;
      continue;
    }
    if (token === '--delay-ms' && argv[i + 1]) {
      const parsed = parseInt(argv[i + 1], 10);
      if (Number.isFinite(parsed) && parsed >= 0) args.delayMs = parsed;
      i += 1;
      continue;
    }
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--force') {
      args.force = true;
      continue;
    }
  }

  args.tids = Array.from(new Set(args.tids.filter((tid) => /^\d+$/.test(String(tid)))));
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsvLine(fields) {
  return fields.map(csvEscape).join(',');
}

function parseLinkParams(href) {
  try {
    const full = href.startsWith('http') ? href : `https://tcg.sfc-jpn.jp${href}`;
    const url = new URL(full);
    return {
      tid: url.searchParams.get('tid') || '',
      kno: url.searchParams.get('kno') || '',
      znt: url.searchParams.get('znt') || '',
      page: url.searchParams.get('Page') || '',
      href: full,
    };
  } catch {
    return null;
  }
}

async function fetchHtml(url) {
  const resp = await axios.get(url, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });
  return String(resp.data || '');
}

function findRoundAndFinalTargets(html, tid) {
  const $ = cheerio.load(html);
  const roundMap = new Map();
  const finalCandidates = [];

  $('a[href]').each((_, a) => {
    const href = String($(a).attr('href') || '').trim();
    const text = String($(a).text() || '').replace(/\s+/g, ' ').trim();
    const params = parseLinkParams(href);
    if (!params) return;
    if (String(params.tid) !== String(tid)) return;
    if (!/^\d+$/.test(params.kno)) return;

    if (params.znt === '0' && params.kno !== '9999999') {
      const roundNo = parseInt(params.kno, 10);
      if (!roundMap.has(roundNo)) {
        roundMap.set(roundNo, {
          kno: params.kno,
          // 不信任頁面 anchor 文字（可能包含 NextRnd），以 kno 做唯一 round label。
          label: `Round ${roundNo}`,
        });
      }
      return;
    }

    if (params.znt === '1') {
      const interimMatch = text.match(/End of Round\s*(\d+)\s*interim result/i);
      finalCandidates.push({
        kno: params.kno,
        text,
        score: /Final\s*rank/i.test(text)
          ? 300
          : (interimMatch ? (200 + parseInt(interimMatch[1], 10)) : (params.kno === '9999999' ? 150 : 100)),
      });
    }
  });

  const rounds = Array.from(roundMap.values()).sort((a, b) => Number(a.kno) - Number(b.kno));
  const finalTarget = finalCandidates.sort((a, b) => b.score - a.score)[0] || null;

  return { rounds, finalTarget };
}

function extractCandidatePagesFromHtml(html, tid, kno, znt) {
  const pages = new Set();
  const text = String(html || '');
  const urlMatches = text.match(/(?:https?:\/\/[^"'\s]+\/tour\.asp\?[^"'\s]+|\/tour\.asp\?[^"'\s]+)/g) || [];

  for (const raw of urlMatches) {
    const parsed = parseLinkParams(raw);
    if (!parsed) continue;
    if (String(parsed.tid) !== String(tid)) continue;
    if (String(parsed.kno) !== String(kno)) continue;
    if (String(parsed.znt) !== String(znt)) continue;
    const page = parsed.page ? parseInt(parsed.page, 10) : 1;
    if (Number.isFinite(page) && page >= 1) pages.add(page);
  }

  pages.add(1);
  return Array.from(pages).sort((a, b) => a - b);
}

function findDataTable($, mode) {
  const tables = $('table').toArray();
  for (const table of tables) {
    const head = $(table).find('tr').first().find('td,th').map((_, c) => $(c).text().replace(/\s+/g, ' ').trim()).get();
    if (mode === 'round') {
      const headLower = head.map((h) => String(h || '').toLowerCase());
      const hasTable = headLower.some((h) => h.includes('table'));
      const hasNo = headLower.some((h) => /^no\.?$/.test(h));
      const hasPlayer = headLower.some((h) => h.includes('your name'));
      const hasOpponent = headLower.some((h) => h.includes('opponent'));
      if (
        head.length >= 4
        && hasTable
        && hasNo
        && hasPlayer
        && hasOpponent
      ) {
        return $(table);
      }
      continue;
    }

    if (
      mode === 'final'
      && head.length >= 7
      && /Rank/i.test(head[0])
      && /^No\.?$/i.test(head[1])
      && /Your name/i.test(head[2])
    ) {
      return $(table);
    }
  }

  return null;
}

function extractRoundRowsFromHtml(html, roundLabel, pageIndex) {
  const $ = cheerio.load(html);
  const table = findDataTable($, 'round');
  if (!table) return [];

  const head = table.find('tr').first().find('td,th').map((_, c) => $(c).text().replace(/\s+/g, ' ').trim()).get();
  const headLower = head.map((h) => String(h || '').toLowerCase());
  const idxTable = headLower.findIndex((h) => h.includes('table'));
  const idxPlayerNo = headLower.findIndex((h) => /^no\.?$/.test(h));
  const idxPlayerId = headLower.findIndex((h) => h.includes('your name'));
  const idxOpponentId = headLower.findIndex((h) => h.includes('opponent'));

  if ([idxTable, idxPlayerNo, idxPlayerId, idxOpponentId].some((i) => i < 0)) {
    return [];
  }

  // Round 2+ 常見表頭為: Your name,TtlScore,Opponent,TtlScore
  const idxPlayerScore = idxPlayerId + 1;
  const idxOpponentScore = idxOpponentId + 1;

  const rows = [];
  table.find('tr').slice(1).each((_, tr) => {
    const cols = $(tr).find('td,th').map((__, c) => $(c).text().replace(/\s+/g, ' ').trim()).get();
    const tableNo = cols[idxTable] || '';
    const playerNo = cols[idxPlayerNo] || '';
    const playerId = cols[idxPlayerId] || '';
    const opponentId = cols[idxOpponentId] || '';
    const playerScoreRaw = cols[idxPlayerScore] || '';
    const opponentScoreRaw = cols[idxOpponentScore] || '';
    if (!/^\d+$/.test(tableNo) || !/^\d+$/.test(playerNo)) return;
    if (!/^tw\d+$/i.test(playerId) || !/^tw\d+$/i.test(opponentId)) return;

    const playerScore = /^\d+$/.test(playerScoreRaw) ? playerScoreRaw : '';
    const opponentScore = /^\d+$/.test(opponentScoreRaw) ? opponentScoreRaw : '';

    rows.push({
      record_type: 'round_pairing',
      round: roundLabel,
      page_index: String(pageIndex),
      table_no: tableNo,
      player_no: playerNo,
      player_id: playerId,
      player_score: playerScore,
      opponent_id: opponentId,
      opponent_score: opponentScore,
      rank: '',
      total_score: '',
      omw_pct: '',
      wo_score: '',
      avomw_pct: '',
    });
  });

  return rows;
}

function extractFinalRowsFromHtml(html, pageIndex) {
  const $ = cheerio.load(html);
  const table = findDataTable($, 'final');
  if (!table) return [];

  const rows = [];
  table.find('tr').slice(1).each((_, tr) => {
    const cols = $(tr).find('td,th').map((__, c) => $(c).text().replace(/\s+/g, ' ').trim()).get();
    if (cols.length < 7) return;

    const rank = cols[0];
    const playerNo = cols[1];
    const playerId = cols[2];
    const totalScore = cols[3];
    const omw = cols[4];
    const wo = cols[5];
    const avomw = cols[6];

    if (!/^\d+$/.test(rank) || !/^\d+$/.test(playerNo) || !/^tw\d+$/i.test(playerId)) return;

    rows.push({
      record_type: 'final_rank',
      round: '',
      page_index: String(pageIndex),
      table_no: '',
      player_no: playerNo,
      player_id: playerId,
      player_score: '',
      opponent_id: '',
      opponent_score: '',
      rank,
      total_score: totalScore,
      omw_pct: omw,
      wo_score: wo,
      avomw_pct: avomw,
    });
  });

  return rows;
}

async function scrapePagesByTarget(tid, kno, znt, rowExtractor, label, delayMs) {
  const firstUrl = `https://tcg.sfc-jpn.jp/tour.asp?tid=${tid}&kno=${kno}&znt=${znt}&MMP=&flu=&Exclusive=0&Sort=Table&Order=`;
  const allRows = [];

  let currentPage = 1;
  const visitedPages = new Set();

  while (!visitedPages.has(currentPage)) {
    visitedPages.add(currentPage);
    const url = currentPage === 1
      ? firstUrl
      : `https://tcg.sfc-jpn.jp/tour.asp?tid=${tid}&kno=${kno}&znt=${znt}&MMP=&flu=&Exclusive=0&Sort=Table&Order=&Page=${currentPage}`;
    const html = await fetchHtml(url);
    const rows = rowExtractor(html, label, currentPage);
    allRows.push(...rows);

    const pages = extractCandidatePagesFromHtml(html, tid, kno, znt);
    const nextPage = pages.find((p) => p > currentPage && !visitedPages.has(p));
    if (!nextPage) break;
    currentPage = nextPage;

    if (delayMs > 0) await sleep(delayMs);

    // 防止網站異常導致無窮迴圈。
    if (visitedPages.size > 300) break;
  }

  return allRows;
}

function buildCsv(rows) {
  const header = [
    'record_type',
    'round',
    'page_index',
    'table_no',
    'player_no',
    'player_id',
    'player_score',
    'opponent_id',
    'opponent_score',
    'rank',
    'total_score',
    'omw_pct',
    'wo_score',
    'avomw_pct',
  ];

  const lines = [buildCsvLine(header)];
  for (const row of rows) {
    lines.push(buildCsvLine(header.map((key) => row[key] || '')));
  }
  return `${lines.join('\n')}\n`;
}

function analyzeRows(rows) {
  const pairingRows = rows.filter((row) => row.record_type === 'round_pairing');
  const finalRows = rows.filter((row) => row.record_type === 'final_rank');
  const roundCount = new Set(pairingRows.map((row) => row.round)).size;
  return {
    pairingCount: pairingRows.length,
    finalCount: finalRows.length,
    roundCount,
  };
}

function parseCsvRows(csvText) {
  const lines = String(csvText || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    header.forEach((key, index) => {
      row[key] = (cols[index] || '').trim();
    });
    return row;
  });
}

function updateUblJson(tid, stats) {
  if (!fs.existsSync(UBL_JSON)) return;
  const data = JSON.parse(fs.readFileSync(UBL_JSON, 'utf8'));
  if (!Array.isArray(data.UBL)) return;

  const idx = data.UBL.findIndex((item) => String(item.id) === String(tid));
  if (idx < 0) return;

  const now = new Date().toISOString();
  const prev = data.UBL[idx];
  const history = Array.isArray(prev.history) ? [...prev.history] : [];
  history.push({
    crawledAt: now,
    level: prev.level || '',
    series: prev.series || '',
    round1Max: stats.round1Max,
    finalRankCount: stats.finalRankCount,
    roundCount: stats.roundCount,
    csvFile: `${tid}.csv`,
    csvVersion: 'unified_rounds_v2',
    finalSourceLabel: stats.finalSourceLabel,
  });

  data.UBL[idx] = {
    ...prev,
    lastCrawledAt: now,
    round1Max: stats.round1Max,
    finalRankCount: stats.finalRankCount,
    roundCount: stats.roundCount,
    csvFile: `${tid}.csv`,
    csvVersion: 'unified_rounds_v2',
    finalSourceLabel: stats.finalSourceLabel,
    history,
  };

  fs.writeFileSync(UBL_JSON, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function getRound1Max(rows) {
  const round1 = rows.filter((r) => String(r.record_type) === 'round_pairing' && String(r.round).toLowerCase() === 'round 1');
  const tableNos = new Set(
    round1
      .map((row) => String(row.table_no || '').trim())
      .filter((tableNo) => /^\d+$/.test(tableNo)),
  );
  return tableNos.size;
}

async function scrapeSingleTid(tid, args) {
  console.log(`\n[pairing] 開始 tid=${tid}`);
  const listUrl = `https://tcg.sfc-jpn.jp/tour.asp?tid=${tid}`;
  const listHtml = await fetchHtml(listUrl);

  const { rounds, finalTarget } = findRoundAndFinalTargets(listHtml, tid);
  if (!rounds.length) {
    throw new Error(`找不到 round 連結 (tid=${tid})`);
  }

  console.log(`[pairing] tid=${tid} rounds=${rounds.length} | final=${finalTarget ? `${finalTarget.kno}:${finalTarget.text || 'znt=1'}` : 'none'}`);

  const allRows = [];
  for (const round of rounds) {
    const roundRows = await scrapePagesByTarget(
      tid,
      round.kno,
      '0',
      (html, label, page) => extractRoundRowsFromHtml(html, label, page),
      round.label,
      args.delayMs,
    );
    allRows.push(...roundRows);
  }

  let finalRows = [];
  let finalSourceLabel = '';
  if (finalTarget) {
    finalRows = await scrapePagesByTarget(
      tid,
      finalTarget.kno,
      '1',
      (html, _label, page) => extractFinalRowsFromHtml(html, page),
      '',
      args.delayMs,
    );
    finalSourceLabel = finalTarget.text || `kno=${finalTarget.kno}`;
  }

  allRows.push(...finalRows);
  const newAnalysis = analyzeRows(allRows);
  const stats = {
    round1Max: getRound1Max(allRows),
    roundCount: newAnalysis.roundCount,
    finalRankCount: finalRows.length,
    finalSourceLabel,
  };

  if (args.dryRun) {
    console.log(`[pairing] dry-run tid=${tid} | roundRows=${newAnalysis.pairingCount} | finalRows=${newAnalysis.finalCount} | roundCount=${newAnalysis.roundCount}`);
    return;
  }

  fs.mkdirSync(TOURNAMENTS_DIR, { recursive: true });
  const outFile = path.join(TOURNAMENTS_DIR, `${tid}.csv`);

  if (!args.force && fs.existsSync(outFile)) {
    const oldRows = parseCsvRows(fs.readFileSync(outFile, 'utf8'));
    const oldAnalysis = analyzeRows(oldRows);
    const wouldDowngrade =
      oldAnalysis.roundCount > newAnalysis.roundCount
      || oldAnalysis.pairingCount > newAnalysis.pairingCount
      || oldAnalysis.finalCount > newAnalysis.finalCount;

    if (wouldDowngrade) {
      console.log(
        `[pairing] 跳過覆蓋 tid=${tid}（避免資料降級） old={round:${oldAnalysis.roundCount},pair:${oldAnalysis.pairingCount},final:${oldAnalysis.finalCount}} new={round:${newAnalysis.roundCount},pair:${newAnalysis.pairingCount},final:${newAnalysis.finalCount}}`,
      );
      return;
    }
  }

  fs.writeFileSync(outFile, buildCsv(allRows), 'utf8');
  updateUblJson(tid, stats);

  console.log(`[pairing] 完成 tid=${tid} -> ${path.basename(outFile)} | roundCount=${stats.roundCount} | round1Max=${stats.round1Max} | finalRows=${stats.finalRankCount}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.tids.length) {
    console.error('用法: node scrape_tournament_pairings.js --tid <id>[,<id2>] [--tid <id3>] [--dry-run]');
    process.exitCode = 1;
    return;
  }

  for (const tid of args.tids) {
    await scrapeSingleTid(tid, args);
  }

  console.log('\n[pairing] 全部完成');
}

main().catch((err) => {
  console.error('[fatal]', err.message);
  process.exitCode = 1;
});
