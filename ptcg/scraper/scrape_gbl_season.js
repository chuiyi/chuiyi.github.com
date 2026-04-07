#!/usr/bin/env node
/**
 * schedule_scrape_gbl_season.js
 *
 * 針對單一賽季執行 Great Ball League (GBL) 官方資料抓取流程：
 * 1) 從活動搜尋分頁抓出所有賽事官方 URL，輸出 CSV
 * 2) 逐場抓取詳細資訊與 Top128，更新 tournaments_gbl.json 與 CSV
 *
 * 用法：
 *   node schedule_scrape_gbl_season.js
 *   node schedule_scrape_gbl_season.js --season-label "2025-26" --start-date "09-01-2025"
 *   node schedule_scrape_gbl_season.js --step urls      # 只做步驟 1
 *   node schedule_scrape_gbl_season.js --step details   # 只做步驟 2
 *   node schedule_scrape_gbl_season.js --delay-ms 500
 *   node schedule_scrape_gbl_season.js --limit 20       # 只處理前 20 場（測試用）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { resolveSeasonDefaults } = require('./season_config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TOURNAMENTS_DIR = path.join(DATA_DIR, 'tournaments');
const GBL_JSON = path.join(DATA_DIR, 'tournaments_gbl.json');

const DEFAULTS = {
  seasonLabel: '',
  startDate: '',
  step: 'all',
  delayMs: 500,
  limit: 0,
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--season-label' && argv[i + 1]) {
      args.seasonLabel = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }

    if (token === '--start-date' && argv[i + 1]) {
      args.startDate = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }

    if (token === '--step' && argv[i + 1]) {
      const step = String(argv[i + 1]).trim().toLowerCase();
      if (['all', 'urls', 'details'].includes(step)) {
        args.step = step;
      }
      i += 1;
      continue;
    }

    if ((token === '--delay-ms' || token === '-d') && argv[i + 1]) {
      const n = parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n >= 0) {
        args.delayMs = n;
      }
      i += 1;
      continue;
    }

    if ((token === '--limit' || token === '-m') && argv[i + 1]) {
      const n = parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n > 0) {
        args.limit = n;
      }
      i += 1;
      continue;
    }
  }

  const seasonDefaults = resolveSeasonDefaults(args.seasonLabel);
  args.seasonLabel = seasonDefaults.seasonLabel;
  if (!args.startDate) {
    args.startDate = seasonDefaults.startDate;
  }

  args.csvPath = path.join(DATA_DIR, `${args.seasonLabel}超級球賽事.csv`);
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

function parseSimpleCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((x) => x.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const obj = {};
    header.forEach((key, index) => {
      obj[key] = (cols[index] || '').trim();
    });
    return obj;
  });
}

function writeCsvRows(filePath, rows) {
  const header = buildCsvLine([
    'season',
    'type',
    'level',
    'url_official',
    'title',
    'organizer',
    'capacity',
    'official_date',
    'top128_file',
    'top128_count',
  ]);

  const lines = [header];
  for (const row of rows) {
    lines.push(buildCsvLine([
      row.season || '',
      row.type || 'gbl',
      row.level || '',
      row.url_official || '',
      row.title || '',
      row.organizer || '',
      row.capacity || '',
      row.official_date || '',
      row.top128_file || '',
      row.top128_count == null ? '' : row.top128_count,
    ]));
  }

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });
  return String(response.data || '');
}

function buildSearchUrl(pageNo, startDate) {
  const url = new URL('https://asia.pokemon-card.com/tw/event-search/search/');
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('keyword', '');
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', '');
  url.searchParams.append('csps[0]', '5');
  return url.toString();
}

function extractTotalPages(html) {
  const bodyText = cheerio.load(html)('body').text().replace(/\s+/g, ' ');
  const matched = bodyText.match(/共\s*(\d+)\s*頁/);
  return matched ? parseInt(matched[1], 10) : 1;
}

function extractOfficialUrls(html) {
  const urls = new Set();
  const $ = cheerio.load(html);

  $('a[href]').each((_, node) => {
    const href = String($(node).attr('href') || '').trim();
    const match = href.match(/^(?:https:\/\/asia\.pokemon-card\.com)?\/tw\/event-search\/(\d+)\/?$/);
    if (match) {
      urls.add(`https://asia.pokemon-card.com/tw/event-search/${match[1]}/`);
    }
  });

  return Array.from(urls);
}

function extractOfficialId(url) {
  const match = String(url || '').match(/\/event-search\/(\d+)\/?$/);
  return match ? match[1] : '';
}

function parseSeasonAndLevelFromTitle(title) {
  const t = String(title || '');
  const seasonMatch = t.match(/Season\s*(\d+)/i);
  const season = seasonMatch ? seasonMatch[1] : '';

  let level = 'all';
  if (/大師組|master/i.test(t)) level = 'master';
  if (/高級組|senior/i.test(t)) level = 'senior';
  if (/初級組|junior/i.test(t)) level = 'junior';

  return { season, level };
}

function parseDateFromBodyText(bodyText) {
  const zhDate = bodyText.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (zhDate) {
    const [, y, m, d] = zhDate;
    return `${y}-${String(parseInt(m, 10)).padStart(2, '0')}-${String(parseInt(d, 10)).padStart(2, '0')}`;
  }

  const slashDate = bodyText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashDate) {
    const [, y, m, d] = slashDate;
    return `${y}-${String(parseInt(m, 10)).padStart(2, '0')}-${String(parseInt(d, 10)).padStart(2, '0')}`;
  }

  return '';
}

function parseOrganizerFromBodyText(bodyText) {
  const block = bodyText.match(/主辦方情報\s*([\s\S]{0,240}?)(活動負責人|基本情報|訪問|Additional Links)/);
  if (!block) return '';

  const lines = block[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return lines.length ? lines[0] : '';
}

function parseCapacityFromBodyText(bodyText) {
  const matched = bodyText.match(/人數限制\s*([0-9]+\s*人)/);
  return matched ? matched[1].replace(/\s+/g, ' ').trim() : '';
}

function scrapeTop128FromHtml(html) {
  const $ = cheerio.load(html);
  const rows = [];

  $('div.tableRow.tableData').each((_, el) => {
    const rank = $(el).find('div.rank').text().trim();
    const pointsRaw = $(el).find('div.point').text().trim();
    const pointsMatch = pointsRaw.match(/(\d+)/);
    const points = pointsMatch ? pointsMatch[1] : '';

    const userName = $(el).find('p.userName').text().trim();
    const userId = $(el).find('p.userId').text().trim();
    const area = $(el).find('div.area').text().trim();

    const deckLinkEl = $(el).find('div.deck a[href]');
    const deckUrl = deckLinkEl.length ? String(deckLinkEl.attr('href') || '').trim() : '';

    if (rank && userName) {
      rows.push({ rank, points, userName, userId, area, deckUrl });
    }
  });

  return rows;
}

function writeTop128Csv(fileName, rows) {
  fs.mkdirSync(TOURNAMENTS_DIR, { recursive: true });
  const filePath = path.join(TOURNAMENTS_DIR, fileName);

  const header = buildCsvLine(['rank', 'points', 'username', 'player_id', 'region', 'deck_url']);
  const lines = [header];
  for (const row of rows) {
    lines.push(buildCsvLine([row.rank, row.points, row.userName, row.userId, row.area, row.deckUrl]));
  }

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function upsertGblTournament(payload) {
  const current = readJson(GBL_JSON);
  const data = current && Array.isArray(current.GBL) ? current : { GBL: [] };

  const idx = data.GBL.findIndex((item) => String(item.id) === String(payload.id));
  const now = new Date().toISOString();

  if (idx < 0) {
    data.GBL.push({
      type: 'gbl',
      id: String(payload.id),
      url: '',
      title: payload.title || '',
      level: payload.level || 'all',
      series: payload.season || '',
      season: payload.season || '',
      createdAt: now,
      officialUrl: payload.officialUrl || '',
      top128File: payload.top128File || '',
      top128Count: payload.top128Count || 0,
      officialDate: payload.officialDate || '',
      organizer: payload.organizer || '',
      capacity: payload.capacity || '',
      history: [
        {
          crawledAt: now,
          season: payload.season || '',
          level: payload.level || 'all',
          top128Count: payload.top128Count || 0,
          top128File: payload.top128File || '',
        },
      ],
    });
    writeJson(GBL_JSON, data);
    return;
  }

  const prev = data.GBL[idx];
  const history = Array.isArray(prev.history) ? prev.history : [];
  history.push({
    crawledAt: now,
    season: payload.season || prev.season || '',
    level: payload.level || prev.level || 'all',
    top128Count: payload.top128Count || prev.top128Count || 0,
    top128File: payload.top128File || prev.top128File || '',
  });

  data.GBL[idx] = {
    ...prev,
    type: 'gbl',
    title: payload.title || prev.title || '',
    level: payload.level || prev.level || 'all',
    series: payload.season || prev.series || '',
    season: payload.season || prev.season || '',
    officialUrl: payload.officialUrl || prev.officialUrl || '',
    top128File: payload.top128File || prev.top128File || '',
    top128Count: payload.top128Count != null ? payload.top128Count : (prev.top128Count || 0),
    officialDate: payload.officialDate || prev.officialDate || '',
    organizer: payload.organizer || prev.organizer || '',
    capacity: payload.capacity || prev.capacity || '',
    history,
  };

  writeJson(GBL_JSON, data);
}

async function buildGblUrlCsv(args) {
  console.log(`[gbl] 步驟 1/2：抓取賽事清單（startDate=${args.startDate}）`);

  const firstUrl = buildSearchUrl(1, args.startDate);
  const firstHtml = await fetchHtml(firstUrl);
  const totalPages = Math.max(1, extractTotalPages(firstHtml));

  const allUrls = new Set(extractOfficialUrls(firstHtml));
  console.log(`[gbl] page 1/${totalPages}，累積 ${allUrls.size} 筆`);

  for (let pageNo = 2; pageNo <= totalPages; pageNo += 1) {
    const url = buildSearchUrl(pageNo, args.startDate);
    const html = await fetchHtml(url);
    const pageUrls = extractOfficialUrls(html);
    for (const item of pageUrls) allUrls.add(item);

    console.log(`[gbl] page ${pageNo}/${totalPages}，累積 ${allUrls.size} 筆`);
    if (args.delayMs > 0) await sleep(args.delayMs);
  }

  const rows = Array.from(allUrls)
    .sort((a, b) => Number(extractOfficialId(a)) - Number(extractOfficialId(b)))
    .map((url) => ({
      season: '',
      type: 'gbl',
      level: '',
      url_official: url,
      title: '',
      organizer: '',
      capacity: '',
      official_date: '',
      top128_file: '',
      top128_count: '',
    }));

  writeCsvRows(args.csvPath, rows);
  console.log(`[gbl] 已輸出清單：${args.csvPath}（共 ${rows.length} 筆）`);

  return rows;
}

async function enrichGblDetails(args) {
  if (!fs.existsSync(args.csvPath)) {
    throw new Error(`找不到 CSV：${args.csvPath}`);
  }

  console.log(`[gbl] 步驟 2/2：抓取賽事詳細資訊與 Top128`);

  const csvRows = parseSimpleCsv(fs.readFileSync(args.csvPath, 'utf8'));
  const tasks = csvRows.filter((row) => row.url_official && extractOfficialId(row.url_official));
  const total = args.limit > 0 ? Math.min(args.limit, tasks.length) : tasks.length;

  let success = 0;
  let fail = 0;
  const updatedRows = [];

  for (let i = 0; i < total; i += 1) {
    const row = tasks[i];
    const officialUrl = row.url_official;
    const officialId = extractOfficialId(officialUrl);

    process.stdout.write(`[gbl] (${i + 1}/${total}) ${officialId} ... `);

    try {
      const html = await fetchHtml(officialUrl);
      const $ = cheerio.load(html);

      const title = $('h1').first().text().replace(/\s+/g, ' ').trim();
      const bodyText = $('body').text().replace(/\u00a0/g, ' ').replace(/[\t\r]+/g, ' ');

      const { season, level } = parseSeasonAndLevelFromTitle(title);
      const organizer = parseOrganizerFromBodyText(bodyText);
      const capacity = parseCapacityFromBodyText(bodyText);
      const officialDate = parseDateFromBodyText(bodyText);

      const top128Rows = scrapeTop128FromHtml(html);
      const top128File = `top128_gbl_${officialId}.csv`;
      if (top128Rows.length > 0) {
        writeTop128Csv(top128File, top128Rows);
      }

      updatedRows.push({
        season,
        type: 'gbl',
        level,
        url_official: officialUrl,
        title,
        organizer,
        capacity,
        official_date: officialDate,
        top128_file: top128Rows.length > 0 ? top128File : '',
        top128_count: top128Rows.length,
      });

      upsertGblTournament({
        id: officialId,
        title,
        season,
        level,
        officialUrl,
        officialDate,
        organizer,
        capacity,
        top128File: top128Rows.length > 0 ? top128File : '',
        top128Count: top128Rows.length,
      });

      success += 1;
      console.log(`OK (top128=${top128Rows.length})`);
    } catch (error) {
      fail += 1;
      console.log(`FAIL: ${error.message}`);

      updatedRows.push({
        season: row.season || '',
        type: row.type || 'gbl',
        level: row.level || '',
        url_official: officialUrl,
        title: row.title || '',
        organizer: row.organizer || '',
        capacity: row.capacity || '',
        official_date: row.official_date || '',
        top128_file: row.top128_file || '',
        top128_count: row.top128_count || '',
      });
    }

    if (args.delayMs > 0) await sleep(args.delayMs);
  }

  // 保留未處理尾段資料（例如 --limit）
  if (total < tasks.length) {
    for (let i = total; i < tasks.length; i += 1) {
      const row = tasks[i];
      updatedRows.push({
        season: row.season || '',
        type: row.type || 'gbl',
        level: row.level || '',
        url_official: row.url_official,
        title: row.title || '',
        organizer: row.organizer || '',
        capacity: row.capacity || '',
        official_date: row.official_date || '',
        top128_file: row.top128_file || '',
        top128_count: row.top128_count || '',
      });
    }
  }

  // 若 CSV 原本存在不完整 URL 的資料，也原樣補回
  const invalidRows = csvRows.filter((row) => !(row.url_official && extractOfficialId(row.url_official))).map((row) => ({
    season: row.season || '',
    type: row.type || 'gbl',
    level: row.level || '',
    url_official: row.url_official || '',
    title: row.title || '',
    organizer: row.organizer || '',
    capacity: row.capacity || '',
    official_date: row.official_date || '',
    top128_file: row.top128_file || '',
    top128_count: row.top128_count || '',
  }));

  const merged = updatedRows.concat(invalidRows).sort((a, b) => {
    const aid = Number(extractOfficialId(a.url_official));
    const bid = Number(extractOfficialId(b.url_official));
    return aid - bid;
  });

  writeCsvRows(args.csvPath, merged);

  console.log(`[gbl] 已更新 CSV：${args.csvPath}`);
  console.log(`[gbl] 完成：成功 ${success}，失敗 ${fail}，總處理 ${total}`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (args.step === 'all' || args.step === 'urls') {
    await buildGblUrlCsv(args);
  }

  if (args.step === 'all' || args.step === 'details') {
    await enrichGblDetails(args);
  }
}

main().catch((error) => {
  console.error('[gbl] fatal:', error.message);
  process.exitCode = 1;
});
