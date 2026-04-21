#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_OLD_DIR = path.join(DEFAULT_DATA_DIR, 'ranking_old');
const DEFAULT_OUTPUT = path.join(DEFAULT_DATA_DIR, 'ranking_trends.json');
const MANIFEST_PATH = path.join(DEFAULT_DATA_DIR, 'ranking.json');
const RESULT_FILE_PATTERN = /^ranking_(\d{8})_(master|senior|junior)_result\.csv$/i;

const LEVEL_CONFIG = {
  master: { label: '大師組', topLimit: 64, bandLimit: 32 },
  senior: { label: '少年組', topLimit: 32, bandLimit: 16 },
  junior: { label: '孩童組', topLimit: 32, bandLimit: 16 },
};

function parseArgs(argv) {
  const args = {
    dataDir: DEFAULT_DATA_DIR,
    oldDir: DEFAULT_OLD_DIR,
    output: DEFAULT_OUTPUT,
    quiet: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if ((token === '--data-dir' || token === '--dir') && argv[i + 1]) {
      args.dataDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--old-dir' && argv[i + 1]) {
      args.oldDir = argv[i + 1];
      i += 1;
      continue;
    }
    if ((token === '--output' || token === '-o') && argv[i + 1]) {
      args.output = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--quiet') {
      args.quiet = true;
    }
  }

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

function parsePointsValue(points) {
  const match = String(points || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function toDateLabel(rawDate) {
  const normalized = String(rawDate || '');
  const match = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return normalized;
  return `${match[1]}/${match[2]}/${match[3]}`;
}

function readJson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

function parseLegacyDraftLines(lines) {
  if (lines.length <= 4) {
    return [];
  }

  const payload = lines.slice(4);
  const rows = [];

  for (let i = 0; i + 4 < payload.length; i += 5) {
    const rank = String(payload[i] || '').trim();
    const username = String(payload[i + 1] || '').trim();
    const ptcgId = String(payload[i + 2] || '').trim();
    const area = String(payload[i + 3] || '').trim();
    const points = String(payload[i + 4] || '').trim();
    rows.push({
      rank: parseInt(rank, 10) || 0,
      username,
      ptcg_id: ptcgId,
      area,
      points,
      pointsValue: parsePointsValue(points),
    });
  }

  return rows;
}

function readRankingCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsvText(text);
  if (!rows.length) {
    return [];
  }

  const header = rows[0].map((value) => String(value || '').trim());
  const rankIndex = header.indexOf('rank');
  const nameIndex = header.indexOf('username');
  const idIndex = header.indexOf('ptcg_id');
  const areaIndex = header.indexOf('area');
  const pointsIndex = header.indexOf('points');

  if (rankIndex >= 0 && nameIndex >= 0 && idIndex >= 0 && areaIndex >= 0 && pointsIndex >= 0) {
    return rows.slice(1)
      .filter((cols) => cols.length >= 5)
      .map((cols) => ({
        rank: parseInt(cols[rankIndex], 10) || 0,
        username: String(cols[nameIndex] || '').trim(),
        ptcg_id: String(cols[idIndex] || '').trim(),
        area: String(cols[areaIndex] || '').trim(),
        points: String(cols[pointsIndex] || '').trim(),
        pointsValue: parsePointsValue(cols[pointsIndex]),
      }));
  }

  const nonEmptyLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return parseLegacyDraftLines(nonEmptyLines);
}

function scanResultFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs.readdirSync(dirPath)
    .filter((fileName) => RESULT_FILE_PATTERN.test(fileName))
    .map((fileName) => {
      const match = fileName.match(RESULT_FILE_PATTERN);
      return {
        fileName,
        filePath: path.join(dirPath, fileName),
        relativePath: path.relative(DEFAULT_DATA_DIR, path.join(dirPath, fileName)).replace(/\\/g, '/'),
        date: match[1],
        level: match[2].toLowerCase(),
      };
    });
}

function collectSourceFiles({ dataDir, oldDir }) {
  const filesByKey = new Map();
  const dataFiles = scanResultFiles(dataDir);
  const oldFiles = scanResultFiles(oldDir);

  oldFiles.forEach((file) => {
    filesByKey.set(`${file.level}:${file.date}`, file);
  });

  dataFiles.forEach((file) => {
    filesByKey.set(`${file.level}:${file.date}`, file);
  });

  if (fs.existsSync(path.join(dataDir, 'ranking.json'))) {
    const manifest = readJson(path.join(dataDir, 'ranking.json'));
    Object.keys(LEVEL_CONFIG).forEach((level) => {
      const entry = manifest?.latest?.[level];
      if (!entry?.file || !entry?.date) {
        return;
      }

      const filePath = path.join(dataDir, entry.file);
      if (!fs.existsSync(filePath)) {
        return;
      }

      filesByKey.set(`${level}:${entry.date}`, {
        fileName: entry.file,
        filePath,
        relativePath: path.relative(dataDir, filePath).replace(/\\/g, '/'),
        date: String(entry.date),
        level,
      });
    });
  }

  return Array.from(filesByKey.values()).sort((a, b) => {
    if (a.level !== b.level) return a.level.localeCompare(b.level);
    return a.date.localeCompare(b.date);
  });
}

function buildLevelTrend(level, files) {
  const config = LEVEL_CONFIG[level];
  const snapshots = [];
  const playersById = new Map();
  const snapshotRowsByDate = new Map();

  files.forEach((file) => {
    const rows = readRankingCsv(file.filePath);
    const includedRows = rows.filter((row) => row.rank > 0 && row.rank <= config.topLimit);
    const bandRows = rows.filter((row) => row.rank > 0 && row.rank <= config.bandLimit);
    if (!includedRows.length) {
      return;
    }

    const rowsByKey = new Map();
    rows.forEach((row) => {
      const rowKey = String(row.ptcg_id || '').trim().toLowerCase() || `name:${row.username}`;
      if (!rowKey) return;
      const existing = rowsByKey.get(rowKey);
      if (!existing || row.rank < existing.rank) {
        rowsByKey.set(rowKey, row);
      }
    });

    snapshotRowsByDate.set(file.date, {
      date: file.date,
      label: toDateLabel(file.date),
      rowsByKey,
    });

    const bandPoints = bandRows.map((row) => row.pointsValue);
    const bandMax = bandPoints.length ? Math.max(...bandPoints) : null;
    const bandMin = bandPoints.length ? Math.min(...bandPoints) : null;

    snapshots.push({
      date: file.date,
      label: toDateLabel(file.date),
      file: file.relativePath,
      total_players: rows.length,
      included_players: includedRows.length,
      cutoff_rank: config.topLimit,
      band_rank_limit: config.bandLimit,
      band_players: bandRows.length,
      band_max_points: bandMax,
      band_min_points: bandMin,
    });

    includedRows.forEach((row) => {
      const playerKey = String(row.ptcg_id || '').trim().toLowerCase() || `name:${row.username}`;
      if (!playersById.has(playerKey)) {
        playersById.set(playerKey, {
          key: playerKey,
          ptcg_id: row.ptcg_id,
          name: row.username,
          area: row.area,
          appearances: 0,
          latest_rank: 0,
          latest_points: 0,
          latest_points_text: '',
          series: [],
        });
      }

      const player = playersById.get(playerKey);
      player.name = row.username || player.name;
      player.area = row.area || player.area;
      player.appearances += 1;
      player.latest_rank = row.rank;
      player.latest_points = row.pointsValue;
      player.latest_points_text = row.points;
      player.series.push({
        date: file.date,
        label: toDateLabel(file.date),
        rank: row.rank,
        points: row.pointsValue,
        points_text: row.points,
        area: row.area,
        username: row.username,
        in_cutoff: true,
      });
    });
  });

  const orderedDates = snapshots.map((snapshot) => snapshot.date);
  playersById.forEach((player) => {
    const firstSeriesDate = player.series.length ? player.series[0].date : '';
    const firstIndex = orderedDates.indexOf(firstSeriesDate);
    if (firstIndex <= 0) {
      return;
    }

    for (let i = 0; i < firstIndex; i += 1) {
      const date = orderedDates[i];
      const snapshotRows = snapshotRowsByDate.get(date);
      if (!snapshotRows) continue;

      const row = snapshotRows.rowsByKey.get(player.key);
      if (!row) continue;

      player.series.push({
        date,
        label: snapshotRows.label,
        rank: row.rank,
        points: row.pointsValue,
        points_text: row.points,
        area: row.area,
        username: row.username,
        in_cutoff: row.rank > 0 && row.rank <= config.topLimit,
      });
    }
  });

  const players = Array.from(playersById.values())
    .map((player) => ({
      ptcg_id: player.ptcg_id,
      name: player.name,
      area: player.area,
      appearances: player.appearances,
      latest_rank: player.latest_rank,
      latest_points: player.latest_points,
      latest_points_text: player.latest_points_text,
      series: player.series.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => {
      if (b.latest_points !== a.latest_points) return b.latest_points - a.latest_points;
      if (a.latest_rank !== b.latest_rank) return a.latest_rank - b.latest_rank;
      return a.name.localeCompare(b.name, 'zh-Hant');
    });

  return {
    level,
    label: config.label,
    top_limit: config.topLimit,
    snapshots,
    latest_date: snapshots.length ? snapshots[snapshots.length - 1].date : '',
    latest_date_label: snapshots.length ? snapshots[snapshots.length - 1].label : '',
    players,
  };
}

function buildRankingTrends(options = {}) {
  const dataDir = path.resolve(options.dataDir || DEFAULT_DATA_DIR);
  const oldDir = path.resolve(options.oldDir || path.join(dataDir, 'ranking_old'));
  const outputPath = path.resolve(options.output || path.join(dataDir, 'ranking_trends.json'));
  const quiet = options.quiet === true;

  if (!fs.existsSync(path.join(dataDir, 'ranking.json'))) {
    throw new Error(`ranking.json not found: ${path.join(dataDir, 'ranking.json')}`);
  }

  const sourceFiles = collectSourceFiles({ dataDir, oldDir });
  const levels = {};

  Object.keys(LEVEL_CONFIG).forEach((level) => {
    const files = sourceFiles.filter((file) => file.level === level);
    levels[level] = buildLevelTrend(level, files);
  });

  const payload = {
    generated_at: new Date().toISOString(),
    source: {
      data_dir: path.relative(dataDir, dataDir).replace(/\\/g, '/') || '.',
      ranking_old_dir: path.relative(dataDir, oldDir).replace(/\\/g, '/'),
      manifest: path.basename(MANIFEST_PATH),
    },
    levels,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  if (!quiet) {
    Object.values(levels).forEach((entry) => {
      console.log(`[trend] ${entry.label}: snapshots=${entry.snapshots.length}, players=${entry.players.length}, cutoff=${entry.top_limit}`);
    });
    console.log(`[trend] output: ${outputPath}`);
  }

  return payload;
}

function main() {
  const args = parseArgs(process.argv);
  buildRankingTrends(args);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('[trend] Error:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildRankingTrends,
};