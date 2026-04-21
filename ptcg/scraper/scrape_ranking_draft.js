#!/usr/bin/env node

/**
 * ranking 草稿轉換工具
 *
 * 目前判斷邏輯：
 * 1) 先讀取原始檔，移除所有空白行。
 * 2) 前 4 行為欄位名稱（排名/用戶名/區域/得分），直接忽略。
 * 3) 從第 5 行開始，每 5 行視為 1 位玩家資料，依序對應：
 *    rank / username / ptcg_id / area / points
 * 4) 將結果輸出為標準 CSV（含表頭）。
 *
 * 使用方式：
 * node ptcg/scraper/convert_ranking_draft.js \
 *   --input ptcg/data/ranking_20260323_master_draft.csv
 *
 * 或掃描整個資料夾：
 * node ptcg/scraper/convert_ranking_draft.js --scan --dir ptcg/data
 */

const fs = require('fs');
const path = require('path');
const { buildRankingTrends } = require('./build_ranking_trends');

const DEFAULT_INPUT = path.join(__dirname, '..', 'data', 'ranking_20260323_master_draft.csv');
const DATA_DIR = path.join(__dirname, '..', 'data');
const PLAYERS_MANIFEST_PATH = path.join(DATA_DIR, 'ranking.json');
const DRAFT_FILE_PATTERN = /^ranking_(\d{8})_(master|senior|junior)_draft\.csv$/i;
const WORLD_PLAYER_LIMITS = {
  master: 32,
};
const LEVEL_LABELS = {
  master: '大師組',
  senior: '少年組',
  junior: '孩童組',
};

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: null,
    scan: false,
    dir: DATA_DIR,
    force: false,
    latestOnly: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if ((token === '--input' || token === '-i') && argv[i + 1]) {
      args.input = argv[i + 1];
      i += 1;
      continue;
    }
    if ((token === '--output' || token === '-o') && argv[i + 1]) {
      args.output = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--scan' || token === '-s') {
      args.scan = true;
      continue;
    }
    if (token === '--force' || token === '-f') {
      args.force = true;
      continue;
    }
    if (token === '--latest-only') {
      args.latestOnly = true;
      continue;
    }
    if ((token === '--dir' || token === '-d') && argv[i + 1]) {
      args.dir = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function parseDraftFileMeta(inputPath) {
  const fileName = path.basename(inputPath);
  const match = fileName.match(DRAFT_FILE_PATTERN);
  if (!match) {
    throw new Error(`Input filename must match ranking_[date]_[level]_draft.csv: ${fileName}`);
  }

  const [, date, rawLevel] = match;
  const level = rawLevel.toLowerCase();
  return { date, level };
}

function resolveOutputPath(inputPath, explicitOutputPath, draftMeta) {
  if (explicitOutputPath) {
    return path.resolve(explicitOutputPath);
  }

  const outputFile = `ranking_${draftMeta.date}_${draftMeta.level}_result.csv`;
  const rankingOldDir = path.join(DATA_DIR, 'ranking_old');
  if (path.resolve(path.dirname(inputPath)) === path.resolve(rankingOldDir)) {
    return path.join(DATA_DIR, outputFile);
  }

  return path.join(path.dirname(inputPath), outputFile);
}

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function readNonEmptyLines(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function convertDraftLines(lines) {
  if (lines.length <= 4) {
    return [];
  }

  const payload = lines.slice(4); // 忽略前 4 行欄位名稱
  const players = [];

  for (let i = 0; i + 4 < payload.length; i += 5) {
    const rank = payload[i];
    const username = payload[i + 1];
    const ptcg_id = payload[i + 2];
    const area = payload[i + 3];
    const points = payload[i + 4];

    players.push({ rank, username, ptcg_id, area, points });
  }

  return players;
}

function toCsv(rows) {
  const headers = ['rank', 'username', 'ptcg_id', 'area', 'points'];
  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push([
      csvEscape(row.rank),
      csvEscape(row.username),
      csvEscape(row.ptcg_id),
      csvEscape(row.area),
      csvEscape(row.points),
    ].join(','));
  }

  return lines.join('\n');
}

function createEmptyManifest() {
  return {
    updated_at: new Date().toISOString(),
    latest: {
      master: null,
      senior: null,
      junior: null,
    },
  };
}

function loadPlayersManifest() {
  if (!fs.existsSync(PLAYERS_MANIFEST_PATH)) {
    return createEmptyManifest();
  }

  const text = fs.readFileSync(PLAYERS_MANIFEST_PATH, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(text);
  const manifest = parsed && typeof parsed === 'object' ? parsed : createEmptyManifest();
  if (!manifest.latest || typeof manifest.latest !== 'object') {
    manifest.latest = createEmptyManifest().latest;
  }

  for (const level of Object.keys(LEVEL_LABELS)) {
    if (!(level in manifest.latest)) {
      manifest.latest[level] = null;
    }
  }

  return manifest;
}

function writePlayersManifest(manifest) {
  fs.writeFileSync(PLAYERS_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function rebuildRankingTrends() {
  buildRankingTrends({
    dataDir: DATA_DIR,
    oldDir: path.join(DATA_DIR, 'ranking_old'),
    output: path.join(DATA_DIR, 'ranking_trends.json'),
  });
}

function shouldProcessDraft(manifest, level, date) {
  const currentDate = manifest?.latest?.[level]?.date;
  if (!currentDate) return true;
  return date > String(currentDate);
}

function updateManifestForLevel(manifest, level, date, outputFileName, totalPlayers) {
  const current = manifest.latest[level] || {};
  const worldPlayers = current.world_players ?? WORLD_PLAYER_LIMITS[level];
  const updatedAt = new Date().toISOString();

  manifest.latest[level] = {
    level,
    label: LEVEL_LABELS[level],
    date,
    updated_at: updatedAt,
    file: outputFileName,
    total_players: totalPlayers,
    ...(worldPlayers ? { world_players: worldPlayers } : {}),
  };
  manifest.updated_at = updatedAt;
}

function listDraftFilesInDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath)
    .filter((fileName) => DRAFT_FILE_PATTERN.test(fileName))
    .map((fileName) => {
      const match = fileName.match(DRAFT_FILE_PATTERN);
      const date = match[1];
      const level = match[2].toLowerCase();
      return {
        fileName,
        filePath: path.join(dirPath, fileName),
        date,
        level,
      };
    });
}

function listDraftFiles(dirPath) {
  const primaryFiles = listDraftFilesInDir(dirPath);
  const archivedFiles = listDraftFilesInDir(path.join(dirPath, 'ranking_old'));
  const filesByKey = new Map();

  archivedFiles.forEach((file) => {
    filesByKey.set(`${file.level}:${file.date}`, file);
  });
  primaryFiles.forEach((file) => {
    filesByKey.set(`${file.level}:${file.date}`, file);
  });

  const files = Array.from(filesByKey.values());

  // 先依日期再依組別排序，確保流程可預期。
  files.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.level.localeCompare(b.level);
  });

  return files;
}

function selectLatestDraftsByLevel(files) {
  const latestByLevel = new Map();

  for (const file of files) {
    const current = latestByLevel.get(file.level);
    if (!current || file.date > current.date) {
      latestByLevel.set(file.level, file);
    }
  }

  return Array.from(latestByLevel.values()).sort((a, b) => a.level.localeCompare(b.level));
}

function processSingleDraft({ inputPath, output, manifest, force = false }) {
  const draftMeta = parseDraftFileMeta(inputPath);
  if (!force && !shouldProcessDraft(manifest, draftMeta.level, draftMeta.date)) {
    console.log(`[convert] skip: ${draftMeta.level} draft date ${draftMeta.date} is not newer than ranking.json`);
    console.log(`[convert] current ${draftMeta.level} date: ${manifest?.latest?.[draftMeta.level]?.date || 'none'}`);
    return { status: 'skipped', draftMeta };
  }

  const outputPath = resolveOutputPath(inputPath, output, draftMeta);
  const lines = readNonEmptyLines(inputPath);
  const players = convertDraftLines(lines);
  const csv = toCsv(players);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${csv}\n`, 'utf8');
  updateManifestForLevel(manifest, draftMeta.level, draftMeta.date, path.basename(outputPath), players.length);

  console.log(`[convert] input: ${inputPath}`);
  console.log(`[convert] parsed date: ${draftMeta.date}`);
  console.log(`[convert] parsed level: ${draftMeta.level} (${LEVEL_LABELS[draftMeta.level]})`);
  console.log(`[convert] non-empty lines: ${lines.length}`);
  console.log(`[convert] players parsed: ${players.length}`);
  console.log(`[convert] output: ${outputPath}`);
  console.log(`[convert] updated level entry: ${JSON.stringify(manifest.latest[draftMeta.level])}`);

  return { status: 'processed', draftMeta };
}

function main() {
  const { input, output, scan, dir, force, latestOnly } = parseArgs(process.argv);
  const manifest = loadPlayersManifest();

  if (scan) {
    const dirPath = path.resolve(dir);
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Scan directory not found: ${dirPath}`);
    }

    if (output) {
      console.log('[convert] warning: --output is ignored in --scan mode');
    }

    const drafts = listDraftFiles(dirPath);
    if (!drafts.length) {
      console.log(`[convert] no draft files found in: ${dirPath}`);
      console.log(`[convert] checked fallback directory: ${path.join(dirPath, 'ranking_old')}`);
      return;
    }

    const targets = latestOnly ? selectLatestDraftsByLevel(drafts) : drafts;

    let processedCount = 0;
    let skippedCount = 0;
    for (const draft of targets) {
      const result = processSingleDraft({
        inputPath: draft.filePath,
        output: null,
        manifest,
        force,
      });
      if (result.status === 'processed') processedCount += 1;
      if (result.status === 'skipped') skippedCount += 1;
    }

    writePlayersManifest(manifest);
    rebuildRankingTrends();
    console.log(`[convert] scan summary: processed=${processedCount}, skipped=${skippedCount}, total=${targets.length}`);
    console.log(`[convert] players manifest: ${PLAYERS_MANIFEST_PATH}`);
    return;
  }

  const inputPath = path.resolve(input);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  processSingleDraft({ inputPath, output, manifest, force });
  writePlayersManifest(manifest);
  rebuildRankingTrends();
  console.log(`[convert] players manifest: ${PLAYERS_MANIFEST_PATH}`);
}

try {
  main();
} catch (err) {
  console.error('[convert] Error:', err.message);
  process.exitCode = 1;
}
