#!/usr/bin/env node
/**
 * scrape_masterball_urls.js
 *
 * 針對指定賽季 Master Ball（大師球）執行官方資料抓取流程：
 * 1) 從活動搜尋分頁（csps[0]=8）抓出所有賽事官方 URL，
 *    補入 {seasonLabel}大師球賽事.csv（新增欄位 title）
 * 2) 針對所有 url_official 條目回填標題/series/level
 * 3) 執行 scrape_official_top128.js 檢查是否有官方 Top 表
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const cheerio = require('cheerio');
const { resolveSeasonDefaults } = require('./season_config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MASTERBALL_JSON = path.join(DATA_DIR, 'tournaments_masterball.json');

const DEFAULTS = {
  seasonLabel: '',
  startDate: '',
  step: 'all',
  delayMs: 500,
  limit: 0,
  dryRun: false,
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
      const s = String(argv[i + 1]).trim().toLowerCase();
      if (['all', 'urls', 'top128'].includes(s)) args.step = s;
      i += 1;
      continue;
    }

    if ((token === '--delay-ms' || token === '-d') && argv[i + 1]) {
      const n = parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n >= 0) args.delayMs = n;
      i += 1;
      continue;
    }

    if ((token === '--limit' || token === '-m') && argv[i + 1]) {
      const n = parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n > 0) args.limit = n;
      i += 1;
      continue;
    }

    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
  }

  const seasonDefaults = resolveSeasonDefaults(args.seasonLabel);
  args.seasonLabel = seasonDefaults.seasonLabel;
  if (!args.startDate) args.startDate = seasonDefaults.startDate;
  args.csvPath = path.join(DATA_DIR, `${args.seasonLabel}大師球賽事.csv`);

  return args;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return { header: [], rows: [] };

  const header = lines[0].split(',').map((x) => x.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(',');
    const obj = {};
    header.forEach((key, i) => {
      obj[key] = (cols[i] || '').trim();
    });
    return obj;
  });

  return { header, rows };
}

function writeCsv(filePath, header, rows) {
  const headerLine = header.map(csvEscape).join(',');
  const dataLines = rows.map((row) =>
    header.map((key) => csvEscape(row[key] || '')).join(',')
  );
  fs.writeFileSync(filePath, `${[headerLine, ...dataLines].join('\n')}\n`, 'utf8');
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
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

function buildSearchUrl(pageNo, startDate) {
  const url = new URL('https://asia.pokemon-card.com/tw/event-search/search/');
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('keyword', '');
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', '');
  url.searchParams.append('csps[0]', '8');
  return url.toString();
}

function extractTotalPages(html) {
  const text = cheerio.load(html)('body').text().replace(/\s+/g, ' ');
  const m = text.match(/共\s*(\d+)\s*頁/);
  return m ? parseInt(m[1], 10) : 1;
}

function extractOfficialUrls(html) {
  const urls = new Set();
  const $ = cheerio.load(html);

  $('a[href]').each((_, node) => {
    const href = String($(node).attr('href') || '').trim();
    const m = href.match(/^(?:https:\/\/asia\.pokemon-card\.com)?\/tw\/event-search\/(\d+)\/?$/);
    if (m) {
      urls.add(`https://asia.pokemon-card.com/tw/event-search/${m[1]}/`);
    }
  });

  return Array.from(urls);
}

function extractOfficialId(url) {
  const m = String(url || '').match(/\/event-search\/(\d+)\/?$/);
  return m ? m[1] : '';
}

function extractTitleFromHtml(html) {
  return cheerio.load(html)('h1').first().text().trim();
}

function parseSeriesAndLevelFromTitle(title) {
  const t = String(title || '');

  let series = '';
  const seasonDash = t.match(/Season\s+(\d+-\d+)/i);
  if (seasonDash) {
    series = seasonDash[1];
  } else {
    const zhSeason = t.match(/賽季\s*(\d+-\d+)/);
    if (zhSeason) series = zhSeason[1];

    const seasonLeg = t.match(/Season\s+(\d+)\s+Leg\s+(\d+)/i);
    if (seasonLeg) series = `${seasonLeg[1]}-${seasonLeg[2]}`;
  }

  let level = '';
  if (/Masters?\s+Category|大師組/i.test(t)) level = 'master';
  else if (/Seniors?\s+Category|高級組|少年組/i.test(t)) level = 'senior';
  else if (/Juniors?\s+Category|初級組|孩童組/i.test(t)) level = 'junior';

  return { series, level };
}

async function runUrlsStep(args) {
  console.log('[masterball] 步驟 1：抓取大師球賽事清單（csps[0]=8）');

  const firstHtml = await fetchHtml(buildSearchUrl(1, args.startDate));
  const totalPages = Math.max(1, extractTotalPages(firstHtml));
  const foundUrls = new Set(extractOfficialUrls(firstHtml));
  console.log(`[masterball] page 1/${totalPages}，累積 ${foundUrls.size} 筆`);

  for (let p = 2; p <= totalPages; p += 1) {
    const html = await fetchHtml(buildSearchUrl(p, args.startDate));
    for (const u of extractOfficialUrls(html)) foundUrls.add(u);
    console.log(`[masterball] page ${p}/${totalPages}，累積 ${foundUrls.size} 筆`);
    if (args.delayMs > 0) await sleep(args.delayMs);
  }

  const sortedUrls = Array.from(foundUrls).sort((a, b) => Number(extractOfficialId(a)) - Number(extractOfficialId(b)));

  if (!fs.existsSync(args.csvPath)) {
    const header = ['series', 'type', 'level', 'url', 'url_official', 'title'];
    writeCsv(args.csvPath, header, []);
  }

  const { header: origHeader, rows } = parseCsv(fs.readFileSync(args.csvPath, 'utf8'));
  const header = Array.from(new Set([...origHeader, 'series', 'type', 'level', 'url', 'url_official', 'title']));

  const existingByUrl = new Map();
  for (const row of rows) {
    if (row.url_official) existingByUrl.set(row.url_official.replace(/\/$/, '') + '/', row);
  }

  const newUrls = sortedUrls.filter((u) => !existingByUrl.has(u));
  const missingMetaUrls = sortedUrls.filter(
    (u) => existingByUrl.has(u) && (!existingByUrl.get(u).title || !existingByUrl.get(u).series || !existingByUrl.get(u).level)
  );

  let urlsToFetch = [...newUrls, ...missingMetaUrls];
  if (args.limit > 0) urlsToFetch = urlsToFetch.slice(0, args.limit);

  const detailCache = new Map();

  for (const url of urlsToFetch) {
    const id = extractOfficialId(url);
    if (detailCache.has(id)) continue;

    if (args.dryRun) {
      detailCache.set(id, { title: '(dry-run)', series: '', level: '' });
      console.log(`[dry-run] 將抓取 ${url}`);
      continue;
    }

    try {
      const html = await fetchHtml(url);
      const title = extractTitleFromHtml(html);
      const { series, level } = parseSeriesAndLevelFromTitle(title);
      detailCache.set(id, { title, series, level });
      console.log(`[masterball] ✅ ${id} | ${series || '?'} ${level || '?'} | ${title}`);
      if (args.delayMs > 0) await sleep(args.delayMs);
    } catch (err) {
      console.error(`[masterball] ❌ 抓取失敗 ${url}：${err.message}`);
      detailCache.set(id, { error: true, title: '' });
    }
  }

  for (const row of rows) {
    if (!row.url_official) continue;
    const cached = detailCache.get(extractOfficialId(row.url_official));
    if (!cached || cached.error) continue;
    if (!row.title && cached.title) row.title = cached.title;
    if (!row.level && cached.level) row.level = cached.level;
    if (!row.series && cached.series) row.series = cached.series;
    if (!row.type) row.type = 'masterball';
  }

  for (const url of newUrls) {
    const id = extractOfficialId(url);
    const cached = detailCache.get(id);
    if (!cached || cached.error || !cached.title) continue;

    const newRow = {};
    header.forEach((key) => { newRow[key] = ''; });
    newRow.series = cached.series || '';
    newRow.type = 'masterball';
    newRow.level = cached.level || '';
    newRow.url = '';
    newRow.url_official = url;
    newRow.title = cached.title;
    rows.push(newRow);
  }

  if (args.dryRun) {
    console.log(`[dry-run] CSV: ${args.csvPath}，新增候選 ${newUrls.length} 筆`);
  } else {
    writeCsv(args.csvPath, header, rows);
    syncTitlesToJson(rows);
    console.log(`[masterball] CSV 已更新：${args.csvPath}（共 ${rows.length} 列）`);
  }
}

function syncTitlesToJson(rows) {
  const titleByUrl = new Map();
  for (const row of rows) {
    if (row.url_official && row.title) {
      const normalised = row.url_official.replace(/\/$/, '') + '/';
      titleByUrl.set(normalised, row.title);
    }
  }

  const data = readJson(MASTERBALL_JSON);
  if (!data || !Array.isArray(data.MASTERBALL)) return;

  let updated = 0;
  for (const entry of data.MASTERBALL) {
    if (entry.title) continue;
    const official = (entry.officialUrl || '').replace(/\/$/, '') + '/';
    if (titleByUrl.has(official)) {
      entry.title = titleByUrl.get(official);
      updated += 1;
    }
  }

  if (updated > 0) {
    writeJson(MASTERBALL_JSON, data);
    console.log(`[masterball] 已回填 ${updated} 筆標題 -> tournaments_masterball.json`);
  }
}

function runTop128Scraper(csvPath) {
  return new Promise((resolve, reject) => {
    const scraperPath = path.join(__dirname, 'scrape_official_top128.js');
    console.log('\n[masterball] 步驟 2：執行 scrape_official_top128.js...\n');

    const child = spawn('node', [scraperPath, '--csv', csvPath], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..', '..'),
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`scrape_official_top128.js 退出碼 ${code}`));
    });

    child.on('error', reject);
  });
}

async function main() {
  const args = parseArgs(process.argv);

  console.log('='.repeat(50));
  console.log('[masterball] Master Ball URL 更新排程');
  console.log(`[masterball] season=${args.seasonLabel} | step=${args.step} | startDate=${args.startDate} | delayMs=${args.delayMs}ms | limit=${args.limit || '無限制'}`);
  if (args.dryRun) console.log('[masterball] ⚠  dry-run 模式，不會實際寫入');
  console.log('='.repeat(50) + '\n');

  if (args.step === 'urls' || args.step === 'all') {
    await runUrlsStep(args);
  }

  if (args.step === 'top128' || args.step === 'all') {
    if (!args.dryRun) await runTop128Scraper(args.csvPath);
    else console.log('[dry-run] 將執行 scrape_official_top128.js');
  }

  console.log('\n[masterball] 全部完成');
}

main().catch((err) => {
  console.error('[masterball] fatal:', err.message);
  process.exitCode = 1;
});
