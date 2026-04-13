#!/usr/bin/env node
/**
 * 檢查大師球 / 紀念球 / 高級球賽事 URL 的場次資訊是否變更
 *
 * 比對項目：
 * - roundCount（可用 rounds 數量）
 * - maxRoundNo（最大 round 編號）
 * - hasFinalRank（是否出現 Final rank）
 * - finalSourceLabel（Final/Interim 來源文字）
 *
 * 用法：
 *   node ptcg/scraper/check_tournament_stage_changes.js
 *   node ptcg/scraper/check_tournament_stage_changes.js --update-snapshot
 *   node ptcg/scraper/check_tournament_stage_changes.js --fail-on-change
 */

'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'tournament_stage_snapshot.json');
const REPORT_FILE = path.join(REPORTS_DIR, 'tournament-stage-check-report.md');

const TARGETS = [
  {
    type: 'masterball',
    jsonPath: path.join(DATA_DIR, 'tournaments_masterball.json'),
    rootKey: 'MASTERBALL',
  },
  {
    type: 'premiere',
    jsonPath: path.join(DATA_DIR, 'tournaments_premiere.json'),
    rootKey: 'PREMIERE',
  },
  {
    type: 'ubl',
    jsonPath: path.join(DATA_DIR, 'tournaments_ubl.json'),
    rootKey: 'UBL',
  },
];

function parseArgs(argv) {
  return {
    updateSnapshot: argv.includes('--update-snapshot'),
    failOnChange: argv.includes('--fail-on-change'),
  };
}

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function saveJson(filePath, payload) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function saveText(filePath, text) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
}

function extractTidFromUrl(urlValue) {
  try {
    const url = new URL(String(urlValue || '').trim());
    const tid = url.searchParams.get('tid') || '';
    return /^\d+$/.test(tid) ? tid : '';
  } catch {
    return '';
  }
}

function parseLinkParams(href) {
  try {
    const full = href.startsWith('http') ? href : `https://tcg.sfc-jpn.jp${href}`;
    const url = new URL(full);
    return {
      tid: url.searchParams.get('tid') || '',
      kno: url.searchParams.get('kno') || '',
      znt: url.searchParams.get('znt') || '',
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
          roundNo,
          kno: params.kno,
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

  const rounds = Array.from(roundMap.values()).sort((a, b) => a.roundNo - b.roundNo);
  const finalTarget = finalCandidates.sort((a, b) => b.score - a.score)[0] || null;

  return { rounds, finalTarget };
}

function buildTournamentList() {
  const items = [];

  for (const target of TARGETS) {
    const payload = loadJson(target.jsonPath, {});
    const list = Array.isArray(payload[target.rootKey]) ? payload[target.rootKey] : [];

    for (const entry of list) {
      const rawUrl = String(entry.url || '').trim();
      const tid = extractTidFromUrl(rawUrl);
      if (!tid) continue;

      items.push({
        category: target.type,
        key: `${target.type}:${tid}`,
        tid,
        id: String(entry.id || tid),
        url: rawUrl,
        title: String(entry.title || '').trim(),
        level: String(entry.level || '').trim(),
        series: String(entry.series || '').trim(),
      });
    }
  }

  return items;
}

function analyzeChange(previous, current) {
  if (!previous) {
    return {
      status: 'new',
      changedFields: ['(new baseline)'],
    };
  }

  const changedFields = [];
  const fields = ['roundCount', 'maxRoundNo', 'hasFinalRank', 'finalSourceLabel'];

  for (const field of fields) {
    if ((previous[field] ?? null) !== (current[field] ?? null)) {
      changedFields.push(field);
    }
  }

  return {
    status: changedFields.length ? 'changed' : 'unchanged',
    changedFields,
  };
}

function toSnapshotItem(meta, inspectedAt) {
  return {
    category: meta.category,
    id: meta.id,
    tid: meta.tid,
    title: meta.title,
    url: meta.url,
    level: meta.level,
    series: meta.series,
    roundCount: meta.roundCount,
    maxRoundNo: meta.maxRoundNo,
    hasFinalRank: meta.hasFinalRank,
    finalSourceLabel: meta.finalSourceLabel,
    inspectedAt,
  };
}

function buildReportMarkdown(result) {
  const lines = [];
  lines.push('# Tournament Stage Change Report');
  lines.push('');
  lines.push(`- Generated at: ${result.generatedAt}`);
  lines.push(`- Total checked: ${result.total}`);
  lines.push(`- Changed: ${result.changed}`);
  lines.push(`- New baseline: ${result.newBaseline}`);
  lines.push(`- Unchanged: ${result.unchanged}`);
  lines.push('');

  if (!result.rows.length) {
    lines.push('No valid tournament URLs found.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('| Category | TID | Status | roundCount | maxRoundNo | hasFinalRank | finalSourceLabel | Changed Fields |');
  lines.push('| --- | --- | --- | ---: | ---: | --- | --- | --- |');

  for (const row of result.rows) {
    lines.push(
      `| ${row.category} | ${row.tid} | ${row.status} | ${row.roundCount} | ${row.maxRoundNo} | ${row.hasFinalRank} | ${row.finalSourceLabel || '-'} | ${row.changedFields.join(', ') || '-'} |`
    );
  }

  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const snapshot = loadJson(SNAPSHOT_FILE, {});
  const tournaments = buildTournamentList();

  if (!tournaments.length) {
    console.log('[info] 找不到可檢查的賽事 URL（可能尚未有 tid 連結）。');
    saveText(REPORT_FILE, '# Tournament Stage Change Report\n\nNo valid tournament URLs found.\n');
    return;
  }

  const rows = [];
  let changed = 0;
  let newBaseline = 0;
  let unchanged = 0;

  for (const tournament of tournaments) {
    let status = 'error';
    let changedFields = [];
    let roundCount = 0;
    let maxRoundNo = 0;
    let hasFinalRank = false;
    let finalSourceLabel = '';

    try {
      const html = await fetchHtml(tournament.url);
      const { rounds, finalTarget } = findRoundAndFinalTargets(html, tournament.tid);

      roundCount = rounds.length;
      maxRoundNo = rounds.length ? Math.max(...rounds.map((r) => r.roundNo)) : 0;
      hasFinalRank = /Final\s*rank/i.test(String(finalTarget?.text || ''));
      finalSourceLabel = String(finalTarget?.text || '').trim();

      const current = {
        roundCount,
        maxRoundNo,
        hasFinalRank,
        finalSourceLabel,
      };
      const previous = snapshot[tournament.key] || null;
      const diff = analyzeChange(previous, current);
      status = diff.status;
      changedFields = diff.changedFields;

      if (status === 'changed') changed += 1;
      else if (status === 'new') newBaseline += 1;
      else unchanged += 1;

      snapshot[tournament.key] = toSnapshotItem({
        ...tournament,
        ...current,
      }, new Date().toISOString());
    } catch (error) {
      changedFields = [String(error?.message || 'unknown error')];
    }

    rows.push({
      category: tournament.category,
      tid: tournament.tid,
      id: tournament.id,
      title: tournament.title,
      status,
      roundCount,
      maxRoundNo,
      hasFinalRank,
      finalSourceLabel,
      changedFields,
    });
  }

  rows.sort((a, b) => `${a.category}:${a.tid}`.localeCompare(`${b.category}:${b.tid}`, 'en'));

  const result = {
    generatedAt: new Date().toISOString(),
    total: rows.length,
    changed,
    newBaseline,
    unchanged,
    rows,
  };

  const report = buildReportMarkdown(result);
  saveText(REPORT_FILE, report);

  if (args.updateSnapshot) {
    saveJson(SNAPSHOT_FILE, snapshot);
    console.log(`[write] snapshot updated: ${SNAPSHOT_FILE}`);
  } else {
    console.log('[info] snapshot not updated (use --update-snapshot to persist baseline).');
  }

  console.log(`[report] ${REPORT_FILE}`);
  console.log(`[summary] total=${result.total} changed=${changed} new=${newBaseline} unchanged=${unchanged}`);

  if (args.failOnChange && changed > 0) {
    console.error('[fail] 偵測到場次資訊變更。');
    process.exit(2);
  }
}

main().catch((error) => {
  console.error('[fatal]', error?.stack || error?.message || error);
  process.exit(1);
});
