#!/usr/bin/env node

/**
 * finalize_season_ranking.js
 *
 * 賽季結算 + 歸零重置：
 *
 * 1) 讀取 ranking.json 目前指向的「latest」榜單（大師/少年/孩童組），對每位
 *    玩家用 players/{ptcg_id}.json 的賽事紀錄重新計算「賽季內前 8 場最高積分
 *    加總」——規則跟玩家詳情頁（ptcg.js _openPlayerDetailModal）一致：
 *    eventDateTime 需晚於 --season-start（不含），且不晚於 --season-end（含），
 *    lp 需為正整數；取分數最高的 8 場加總。若重算結果比目前榜單上的積分高，
 *    就採用較高值。結果另存為 --snapshot-date 的封存榜單（放進 ranking_old/），
 *    代表這個賽季的最終結算版本。
 *
 * 2) 把「目前」榜單重置為新賽季的歸零版本：同一批玩家名單，積分全部歸零，
 *    存成 --reset-date 的新榜單，取代 ranking.json 的 latest，並把
 *    season_start_from 更新為 --new-season-start。
 *
 * 3) 若有提供 --season-label / --new-season-label，同時把這兩個賽季的
 *    latest 榜單各自存進 ranking.json 的 manifest.seasons[label]，並把
 *    manifest.current_season 設成新賽季——這是玩家排行頁「賽季」下拉選單
 *    的資料來源，讓使用者可以切換回上一賽季（2026/08/31 結算版）或目前
 *    賽季（歸零版）的榜單。
 *
 * 4) 重新產生 ranking_trends.json（沿用 build_ranking_trends.js）。
 *
 * 只更新「已經在榜單上」的玩家分數，不會新增或移除任何玩家列。
 *
 * 用法：
 *   node ptcg/scraper/finalize_season_ranking.js \
 *     --season-end 2026-08-31 \
 *     --snapshot-date 20260831 \
 *     --reset-date 20260908 \
 *     --new-season-start 2026-09-01 \
 *     --season-label 2025-26 \
 *     --new-season-label 2026-27
 *
 *   加 --dry-run 只印出重算結果，不寫檔。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildRankingTrends } = require('./build_ranking_trends');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PLAYERS_DIR = path.join(DATA_DIR, 'players');
const RANKING_OLD_DIR = path.join(DATA_DIR, 'ranking_old');
const MANIFEST_PATH = path.join(DATA_DIR, 'ranking.json');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');

const LEVELS = ['master', 'senior', 'junior'];
const LEVEL_LABELS = { master: '大師組', senior: '少年組', junior: '孩童組' };
const TOP_N = 8;

function parseArgs(argv) {
  const args = {
    seasonStart: '',
    seasonEnd: '',
    snapshotDate: '',
    resetDate: '',
    newSeasonStart: '',
    seasonLabel: '',
    newSeasonLabel: '',
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--season-start' && argv[i + 1]) { args.seasonStart = argv[++i]; continue; }
    if (token === '--season-end' && argv[i + 1]) { args.seasonEnd = argv[++i]; continue; }
    if (token === '--snapshot-date' && argv[i + 1]) { args.snapshotDate = argv[++i]; continue; }
    if (token === '--reset-date' && argv[i + 1]) { args.resetDate = argv[++i]; continue; }
    if (token === '--new-season-start' && argv[i + 1]) { args.newSeasonStart = argv[++i]; continue; }
    if (token === '--season-label' && argv[i + 1]) { args.seasonLabel = argv[++i]; continue; }
    if (token === '--new-season-label' && argv[i + 1]) { args.newSeasonLabel = argv[++i]; continue; }
    if (token === '--dry-run') { args.dryRun = true; continue; }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

// ─── 與 build_ranking_trends.js 相同規則的簡易 CSV parser（支援引號） ──────

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') { cell += '"'; i += 1; } else { inQuotes = !inQuotes; }
      continue;
    }
    if (ch === ',' && !inQuotes) { row.push(cell); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((v) => v.length > 0)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((v) => v.length > 0)) rows.push(row);
  }
  return rows;
}

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function readRankingCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(text);
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((cols) => {
    const obj = {};
    header.forEach((key, idx) => { obj[key] = (cols[idx] || '').trim(); });
    return obj;
  });
}

function writeRankingCsv(filePath, rows) {
  const header = ['rank', 'username', 'ptcg_id', 'area', 'points'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map((key) => csvEscape(row[key])).join(','));
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function parsePoints(pointsStr) {
  const match = String(pointsStr || '').match(/-?\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// 與 ptcg.js parseDateTimeValue 相同的日期解析規則
function parseDateTimeValue(dateStr) {
  const normalized = String(dateStr || '').trim();
  if (!normalized) return null;
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  }
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function loadPlayerProfile(ptcgId) {
  const filePath = path.join(PLAYERS_DIR, `${ptcgId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

// 規則同 ptcg.js 玩家詳情頁：seasonStart < eventDate <= seasonEnd 且 lp > 0，
// 取分數最高 8 場加總。
function computeTop8Sum(profile, seasonStart, seasonEnd) {
  if (!profile || !Array.isArray(profile.participatedTournaments)) return null;

  const qualifyingLps = profile.participatedTournaments
    .map((event) => {
      const eventDate = parseDateTimeValue(event.eventDateTime);
      const lp = parseInt(event.lp, 10);
      if (!eventDate || !Number.isFinite(lp) || lp <= 0) return null;
      if (!(eventDate > seasonStart && eventDate <= seasonEnd)) return null;
      return lp;
    })
    .filter((lp) => lp != null)
    .sort((a, b) => b - a)
    .slice(0, TOP_N);

  if (qualifyingLps.length === 0) return null;
  return qualifyingLps.reduce((sum, v) => sum + v, 0);
}

// 標準競賽排名（並列同名次、下一名次往後跳），輸入需已依 points 由大到小排序。
function assignCompetitionRank(rows) {
  let lastPoints = null;
  let lastRank = 0;
  rows.forEach((row, idx) => {
    if (row.points !== lastPoints) {
      lastRank = idx + 1;
      lastPoints = row.points;
    }
    row.rank = String(lastRank);
  });
}

function finalizeLevel(level, manifest, args) {
  const entry = manifest.latest[level];
  if (!entry || !entry.file) {
    console.log(`[finalize] ${level}: ranking.json 沒有 latest 資料，略過`);
    return null;
  }

  const currentPath = path.join(DATA_DIR, entry.file);
  if (!fs.existsSync(currentPath)) {
    console.log(`[finalize] ${level}: 找不到 ${entry.file}，略過`);
    return null;
  }

  const rows = readRankingCsv(currentPath);
  const seasonStart = parseDateTimeValue(args.seasonStart);
  const seasonEnd = parseDateTimeValue(`${args.seasonEnd} 23:59:59`);

  let bumpedCount = 0;
  let noProfileCount = 0;
  const bumpedSamples = [];

  const finalRows = rows.map((row) => {
    const existingPoints = parsePoints(row.points);
    const profile = loadPlayerProfile(row.ptcg_id);
    if (!profile) noProfileCount += 1;

    const recomputed = computeTop8Sum(profile, seasonStart, seasonEnd);
    const newPoints = recomputed != null ? Math.max(existingPoints, recomputed) : existingPoints;

    if (recomputed != null && recomputed > existingPoints) {
      bumpedCount += 1;
      if (bumpedSamples.length < 30) {
        bumpedSamples.push({
          username: row.username,
          ptcg_id: row.ptcg_id,
          before: existingPoints,
          after: newPoints,
        });
      }
    }

    return {
      username: row.username,
      ptcg_id: row.ptcg_id,
      area: row.area,
      points: newPoints,
    };
  });

  // 依新積分重新排序、重算名次（標準競賽排名，同分並列）
  finalRows.sort((a, b) => b.points - a.points);
  assignCompetitionRank(finalRows);
  const snapshotRows = finalRows.map((row) => ({ ...row, points: `${row.points}pt` }));

  // 歸零重置版本：沿用原本名單順序，全部歸零。
  // 注意：不能用 assignCompetitionRank 讓所有人並列第 1 名——下游
  // build_ranking_trends.js 是用「rank <= 排行榜前 N 名門檻」去挑選要
  // 追蹤哪些玩家，若全部並列第 1 會讓每一位玩家都符合門檻，把原本只追蹤
  // 前 64/32/32 名的積分趨勢資料炸成全體玩家。改用沿用原順序的序號當
  // rank，只是穩定排序、不代表真實名次。
  const resetRows = rows.map((row, idx) => ({
    username: row.username,
    ptcg_id: row.ptcg_id,
    area: row.area,
    points: 0,
    rank: String(idx + 1),
  }));
  const resetSnapshotRows = resetRows.map((row) => ({ ...row, points: `${row.points}pt` }));

  return {
    level,
    totalPlayers: rows.length,
    bumpedCount,
    noProfileCount,
    bumpedSamples,
    snapshotRows,
    resetSnapshotRows,
  };
}

function main() {
  const args = parseArgs(process.argv);
  const manifest = readJson(MANIFEST_PATH);

  if (!args.seasonEnd || !args.snapshotDate || !args.resetDate || !args.newSeasonStart) {
    console.error('[finalize] 需要 --season-end --snapshot-date --reset-date --new-season-start');
    process.exitCode = 1;
    return;
  }
  if (!args.seasonStart) args.seasonStart = manifest.season_start_from;
  if (!args.seasonStart) {
    console.error('[finalize] ranking.json 沒有 season_start_from，需另外傳 --season-start');
    process.exitCode = 1;
    return;
  }

  console.log(`[finalize] 賽季區間：${args.seasonStart}（不含）～ ${args.seasonEnd}（含）`);
  console.log(`[finalize] 封存版本日期：${args.snapshotDate}　歸零版本日期：${args.resetDate}`);
  console.log(`[finalize] 新賽季起算日：${args.newSeasonStart}`);
  if (args.dryRun) console.log('[finalize] --dry-run：只計算不寫檔');

  const results = [];
  for (const level of LEVELS) {
    const result = finalizeLevel(level, manifest, args);
    if (result) results.push(result);
  }

  for (const result of results) {
    console.log(
      `[finalize] ${LEVEL_LABELS[result.level]}：共 ${result.totalPlayers} 人，`
      + `${result.bumpedCount} 人積分因補算而提高，`
      + `${result.noProfileCount} 人無歷史資料可核對（維持原積分）`
    );
  }

  if (args.dryRun) {
    for (const result of results) {
      if (result.bumpedSamples.length) {
        console.log(`\n[finalize] ${LEVEL_LABELS[result.level]} 提高範例（最多列 30 筆）：`);
        result.bumpedSamples.forEach((s) => {
          console.log(`  ${s.username} (${s.ptcg_id})：${s.before}pt -> ${s.after}pt`);
        });
      }
    }
    return;
  }

  const reportLines = [
    `# 賽季結算報告`,
    ``,
    `- 賽季區間：${args.seasonStart}（不含）～ ${args.seasonEnd}（含）`,
    `- 封存版本：ranking_${args.snapshotDate}_{level}_result.csv（存於 ranking_old/）`,
    `- 歸零版本：ranking_${args.resetDate}_{level}_result.csv（新賽季起算日 ${args.newSeasonStart}）`,
    `- 產生時間：${new Date().toISOString()}`,
    ``,
  ];

  const archiveManifestLatest = {};
  const resetManifestLatest = {};

  for (const result of results) {
    const snapshotFile = `ranking_${args.snapshotDate}_${result.level}_result.csv`;
    const resetFile = `ranking_${args.resetDate}_${result.level}_result.csv`;
    const worldPlayers = manifest.latest[result.level]?.world_players;

    writeRankingCsv(path.join(RANKING_OLD_DIR, snapshotFile), result.snapshotRows);
    writeRankingCsv(path.join(DATA_DIR, resetFile), result.resetSnapshotRows);

    const resetEntry = {
      level: result.level,
      label: LEVEL_LABELS[result.level],
      date: args.resetDate,
      updated_at: new Date().toISOString(),
      file: resetFile,
      total_players: result.totalPlayers,
      ...(worldPlayers ? { world_players: worldPlayers } : {}),
    };
    manifest.latest[result.level] = resetEntry;
    resetManifestLatest[result.level] = resetEntry;

    archiveManifestLatest[result.level] = {
      level: result.level,
      label: LEVEL_LABELS[result.level],
      date: args.snapshotDate,
      updated_at: resetEntry.updated_at,
      file: `ranking_old/${snapshotFile}`,
      total_players: result.totalPlayers,
      ...(worldPlayers ? { world_players: worldPlayers } : {}),
    };

    reportLines.push(`## ${LEVEL_LABELS[result.level]}`);
    reportLines.push('');
    reportLines.push(`- 總人數：${result.totalPlayers}`);
    reportLines.push(`- 積分因補算而提高：${result.bumpedCount} 人`);
    reportLines.push(`- 無歷史資料可核對（維持原積分）：${result.noProfileCount} 人`);
    if (result.bumpedSamples.length) {
      reportLines.push('');
      reportLines.push('| 玩家 | PTCG ID | 原積分 | 補算後積分 |');
      reportLines.push('| --- | --- | --- | --- |');
      result.bumpedSamples.forEach((s) => {
        reportLines.push(`| ${s.username} | ${s.ptcg_id} | ${s.before} | ${s.after} |`);
      });
      if (result.bumpedCount > result.bumpedSamples.length) {
        reportLines.push('');
        reportLines.push(`（僅列前 ${result.bumpedSamples.length} 筆，實際共 ${result.bumpedCount} 人提高）`);
      }
    }
    reportLines.push('');
  }

  manifest.season_start_from = args.newSeasonStart;
  manifest.updated_at = new Date().toISOString();

  if (args.seasonLabel && args.newSeasonLabel) {
    manifest.current_season = args.newSeasonLabel;
    manifest.seasons = manifest.seasons || {};
    manifest.seasons[args.seasonLabel] = {
      label: `${args.seasonLabel} 賽季`,
      season_start_from: args.seasonStart,
      season_end: args.seasonEnd,
      latest: archiveManifestLatest,
    };
    manifest.seasons[args.newSeasonLabel] = {
      label: `${args.newSeasonLabel} 賽季`,
      season_start_from: args.newSeasonStart,
      latest: resetManifestLatest,
    };
  } else {
    console.log('[finalize] 未提供 --season-label / --new-season-label，略過寫入 manifest.seasons（前端賽季切換選單需要這個欄位）');
  }

  writeJson(MANIFEST_PATH, manifest);

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `season-finalize-${args.snapshotDate}.md`);
  fs.writeFileSync(reportPath, `${reportLines.join('\n')}\n`, 'utf8');
  console.log(`[finalize] 報告已寫入：${reportPath}`);

  buildRankingTrends({
    dataDir: DATA_DIR,
    oldDir: RANKING_OLD_DIR,
    output: path.join(DATA_DIR, 'ranking_trends.json'),
  });

  console.log('[finalize] 完成');
}

main();
