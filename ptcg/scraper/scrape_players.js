#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PLAYERS_DIR = path.join(DATA_DIR, 'players');
const PLAYERS_MANIFEST_PATH = path.join(DATA_DIR, 'ranking.json');
const PLAYER_HISTORY_INDEX_PATH = path.join(PLAYERS_DIR, 'players.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = {
    delayMs: 1200,
    onlyMissing: false,
    all: false,
    include404: false,
    dryRun: false,
    max: 0,
    forcedIds: [],
    level: '', // '' = all levels; 'master' | 'senior' | 'junior' = specific level only
  };

  const forcedIdSet = new Set();

  function appendForcedIds(rawValue) {
    const tokens = String(rawValue || '')
      .split(/[\s,]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    for (const token of tokens) {
      if (!/^tw\d+$/i.test(token)) {
        console.warn(`[schedule] warning: ignore invalid id: ${token}`);
        continue;
      }
      forcedIdSet.add(token);
    }
  }

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

    if ((token === '--delay-ms' || token === '-d') && argv[i + 1]) {
      const n = parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n >= 0) {
        args.delayMs = n;
      }
      i += 1;
      continue;
    }

    // --only-missing: only scrape players with NO entry in players.json index
    if (token === '--only-missing' || token === '--enable-only-missing') {
      args.onlyMissing = true;
      continue;
    }

    if (token === '--all' || token === '--rescrape-all') {
      args.all = true;
      continue;
    }

    // --include-404: also retry players previously returning 404
    if (token === '--include-404' || token === '--retry-404') {
      args.include404 = true;
      continue;
    }

    if ((token === '--max' || token === '-m') && argv[i + 1]) {
      const n = parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n > 0) {
        args.max = n;
      }
      i += 1;
      continue;
    }

    // --id / --ids: scrape specific player ids only
    if ((token === '--id' || token === '-i' || token === '--ids') && argv[i + 1]) {
      appendForcedIds(argv[i + 1]);
      i += 1;
      continue;
    }

    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    // --level: restrict scraping to a specific division
    if ((token === '--level' || token === '-l') && argv[i + 1]) {
      const lv = argv[i + 1].trim().toLowerCase();
      if (['master', 'senior', 'junior'].includes(lv)) {
        args.level = lv;
      } else {
        console.warn(`[schedule] warning: unknown level "${argv[i + 1]}", ignoring (valid: master, senior, junior)`);
      }
      i += 1;
      continue;
    }
  }

  args.forcedIds = Array.from(forcedIdSet);

  return args;
}

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') {
        i += 1;
      }
      row.push(cell);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function loadManifest() {
  if (!fs.existsSync(PLAYERS_MANIFEST_PATH)) {
    throw new Error(`ranking.json not found: ${PLAYERS_MANIFEST_PATH}`);
  }

  const manifest = JSON.parse(fs.readFileSync(PLAYERS_MANIFEST_PATH, 'utf8'));
  if (!manifest || typeof manifest !== 'object' || !manifest.latest) {
    throw new Error('ranking.json 格式不正確，缺少 latest');
  }

  return manifest;
}

function getLatestCsvFilesFromManifest(manifest) {
  const levels = ['master', 'senior', 'junior'];
  const files = [];

  for (const level of levels) {
    const file = manifest?.latest?.[level]?.file;
    if (!file) continue;
    files.push({ level, file });
  }

  if (!files.length) {
    throw new Error('ranking.json 中沒有可用的最新 CSV 檔案');
  }

  return files;
}

function loadPlayerIdsFromCsv(csvFile) {
  const fullPath = path.join(DATA_DIR, csvFile);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`CSV not found: ${fullPath}`);
  }

  const text = fs.readFileSync(fullPath, 'utf8');
  const rows = parseCsvText(text);
  if (!rows.length) return [];

  const header = rows[0].map((v) => String(v || '').trim());
  const idIndex = header.indexOf('ptcg_id');
  if (idIndex < 0) {
    throw new Error(`ptcg_id 欄位不存在：${csvFile}`);
  }

  return rows
    .slice(1)
    .map((cols) => String(cols[idIndex] || '').trim())
    .filter((id) => /^tw\d+$/i.test(id));
}

function getExistingPlayerJsonIds() {
  if (!fs.existsSync(PLAYERS_DIR)) {
    return new Set();
  }

  const ids = fs.readdirSync(PLAYERS_DIR)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .filter((name) => name.toLowerCase() !== 'players.json')
    .map((name) => name.replace(/\.json$/i, ''))
    .filter(Boolean);

  return new Set(ids);
}

function loadExistingPlayerHistoryIndex() {
  if (!fs.existsSync(PLAYER_HISTORY_INDEX_PATH)) {
    return new Map();
  }

  try {
    const raw = JSON.parse(fs.readFileSync(PLAYER_HISTORY_INDEX_PATH, 'utf8'));
    const players = Array.isArray(raw?.players) ? raw.players : [];
    const map = new Map();
    for (const item of players) {
      const id = String(item?.ptcg_id || '').trim().toLowerCase();
      if (!id) continue;
      map.set(id, item);
    }
    return map;
  } catch (err) {
    console.warn(`[schedule] warning: failed to parse players index, will rebuild. ${err.message}`);
    return new Map();
  }
}

function readPlayerFetchedAt(playerId) {
  const id = String(playerId || '').trim();
  if (!id) return '';
  const filePath = path.join(PLAYERS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return '';

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return String(data?.fetchedAt || '').trim();
  } catch (err) {
    return '';
  }
}

function writePlayerHistoryIndex({ levelById, runResultsById, existingIndexById }) {
  const allIds = new Set([...levelById.keys(), ...existingIndexById.keys()]);
  const players = [];
  const levelPriority = ['master', 'senior', 'junior'];

  for (const idKey of allIds) {
    const id = String(idKey || '').trim().toLowerCase();
    if (!id) continue;

    const existing = existingIndexById.get(id) || null;
    const derivedLevels = Array.from(levelById.get(id) || []);
    const existingLevel = String(
      existing?.level
      || (Array.isArray(existing?.levels) ? existing.levels[0] : '')
      || ''
    ).trim().toLowerCase();
    const level = levelPriority.find((lv) => derivedLevels.includes(lv)) || existingLevel || 'master';
    const runResult = runResultsById.get(id) || null;
    const fileFetchedAt = readPlayerFetchedAt(id);

    let status = existing?.status || (fileFetchedAt ? 'ok' : 'missing');
    let lastScrapedAt = String(existing?.last_scraped_at || '').trim();
    let note = String(existing?.note || '').trim();

    if (runResult) {
      status = runResult.status;
      lastScrapedAt = runResult.scrapedAt;
      note = runResult.note || '';
    } else if (fileFetchedAt) {
      status = 'ok';
    }

    if (!lastScrapedAt && fileFetchedAt) {
      lastScrapedAt = fileFetchedAt;
    }

    players.push({
      ptcg_id: id,
      level,
      status,
      has_history: status === 'ok',
      last_scraped_at: lastScrapedAt || '',
      source_file: status === 'ok' ? `${id}.json` : '',
      note,
    });
  }

  players.sort((a, b) => String(a.ptcg_id).localeCompare(String(b.ptcg_id), 'en'));

  const payload = {
    generated_at: new Date().toISOString(),
    generated_by: 'scrape_players.js',
    total_players: players.length,
    players,
  };

  if (!fs.existsSync(PLAYERS_DIR)) {
    fs.mkdirSync(PLAYERS_DIR, { recursive: true });
  }
  fs.writeFileSync(PLAYER_HISTORY_INDEX_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return players.length;
}

function writePlayerHistoryIndexQuiet(opts) {
  writePlayerHistoryIndex(opts);
}

function writePlayerHistoryIndexVerbose(opts) {
  const count = writePlayerHistoryIndex(opts);
  console.log(`[schedule] wrote player history index: ${PLAYER_HISTORY_INDEX_PATH} (${count} players)`);
}

async function scrapePlayer(playerId) {
  return new Promise((resolve) => {
    const proc = spawn('node', ['./scrape_player_history.js', '--id', playerId], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
      const combined = `${stdout}\n${stderr}`;
      const is404 = /status code\s*404|404\s*Not\s*Found/i.test(combined);
      resolve({
        id: playerId,
        ok: code === 0,
        code,
        is404,
      });
    });

    proc.on('error', (err) => {
      resolve({
        id: playerId,
        ok: false,
        code: -1,
        is404: false,
        error: err.message,
      });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const manifest = loadManifest();
  let csvFiles = getLatestCsvFilesFromManifest(manifest);

  if (args.level) {
    csvFiles = csvFiles.filter((f) => f.level === args.level);
    if (!csvFiles.length) {
      throw new Error(`ranking.json 中找不到 ${args.level} 的最新 CSV 檔案`);
    }
    console.log(`[schedule] level filter: ${args.level}`);
  }

  const existingIndexById = loadExistingPlayerHistoryIndex();

  const levelById = new Map();
  for (const { level, file } of csvFiles) {
    const ids = loadPlayerIdsFromCsv(file);
    console.log(`[schedule] ${level}: ${file} -> ${ids.length} ids`);
    for (const id of ids) {
      const key = String(id || '').trim().toLowerCase();
      if (!key) continue;
      if (!levelById.has(key)) {
        levelById.set(key, new Set());
      }
      levelById.get(key).add(level);
    }
  }

  if (args.forcedIds.length > 0) {
    for (const id of args.forcedIds) {
      if (!levelById.has(id)) {
        levelById.set(id, new Set());
      }
    }
  }

  const uniqueIds = Array.from(levelById.keys());
  const existingFileIds = getExistingPlayerJsonIds();

  // Filter target IDs based on players.json index (primary) and filesystem (fallback)
  let targetIds = uniqueIds.filter((id) => {
    const entry = existingIndexById.get(id);

    if (args.all) {
      return true;
    }

    if (args.onlyMissing) {
      // Strictest: only scrape players with NO entry in the index at all
      return !entry;
    }

    if (!entry) {
      // Not in index → never attempted, scrape
      return true;
    }

    if (entry.status === 'ok') {
      // Already scraped successfully → skip
      return false;
    }

    if (entry.status === 'not_found') {
      // 404 before → only retry when --include-404
      return args.include404;
    }

    // status: 'missing' | 'failed' | anything else → retry
    return true;
  });

  if (args.forcedIds.length > 0) {
    const forcedSet = new Set(args.forcedIds);
    targetIds = uniqueIds.filter((id) => forcedSet.has(id));
  }

  if (args.max > 0) {
    targetIds = targetIds.slice(0, args.max);
  }

  const indexOkCount = uniqueIds.filter((id) => existingIndexById.get(id)?.status === 'ok').length;
  const index404Count = uniqueIds.filter((id) => existingIndexById.get(id)?.status === 'not_found').length;

  console.log('');
  console.log(`[schedule] latest csv count: ${csvFiles.length}`);
  console.log(`[schedule] csv unique ids: ${uniqueIds.length}`);
  console.log(`[schedule] index ok: ${indexOkCount}  |  index 404: ${index404Count}  |  existing files: ${existingFileIds.size}`);
  console.log(`[schedule] level: ${args.level || 'all'}  |  onlyMissing: ${args.onlyMissing}  |  all: ${args.all}  |  include404: ${args.include404}`);
  if (args.forcedIds.length > 0) {
    console.log(`[schedule] forced ids: ${args.forcedIds.join(', ')}`);
  }
  console.log(`[schedule] target ids: ${targetIds.length}`);
  console.log(`[schedule] delay ms: ${args.delayMs}`);

  if (!targetIds.length) {
    console.log('[schedule] nothing to scrape');
    writePlayerHistoryIndexVerbose({
      levelById,
      runResultsById: new Map(),
      existingIndexById,
    });
    return;
  }

  if (args.dryRun) {
    console.log('[schedule] dry-run mode. first 30 ids:');
    console.log(targetIds.slice(0, 30).join(', '));
    return;
  }

  let success = 0;
  let failed404 = 0;
  let failedOther = 0;
  const runResultsById = new Map();

  for (let i = 0; i < targetIds.length; i += 1) {
    const id = targetIds[i];
    console.log('');
    console.log(`[schedule] (${i + 1}/${targetIds.length}) scraping ${id}`);

    // eslint-disable-next-line no-await-in-loop
    const result = await scrapePlayer(id);

    if (result.ok) {
      success += 1;
      runResultsById.set(String(id).toLowerCase(), {
        status: 'ok',
        scrapedAt: new Date().toISOString(),
        note: '',
      });
    } else if (result.is404) {
      failed404 += 1;
      runResultsById.set(String(id).toLowerCase(), {
        status: 'not_found',
        scrapedAt: new Date().toISOString(),
        note: '404 not found',
      });
    } else {
      failedOther += 1;
      runResultsById.set(String(id).toLowerCase(), {
        status: 'failed',
        scrapedAt: new Date().toISOString(),
        note: result.error || `exit code ${result.code}`,
      });
    }

    writePlayerHistoryIndexQuiet({ levelById, runResultsById, existingIndexById });

    if (i < targetIds.length - 1 && args.delayMs > 0) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(args.delayMs);
    }
  }

  console.log('');
  console.log('[schedule] ---- Done ----');
  console.log(`[schedule] success: ${success}`);
  console.log(`[schedule] 404 not found: ${failed404}`);
  console.log(`[schedule] failed (non-404): ${failedOther}`);

  writePlayerHistoryIndexVerbose({
    levelById,
    runResultsById,
    existingIndexById,
  });
}

main().catch((err) => {
  console.error('[schedule] Fatal error:', err.message);
  process.exit(1);
});
