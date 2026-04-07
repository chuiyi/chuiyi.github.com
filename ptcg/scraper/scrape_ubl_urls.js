#!/usr/bin/env node
/**
 * schedule_scrape_ubl_urls.js
 *
 * 針對 2025-26 賽季 UBL（高級球）執行官方資料抓取流程：
 * 1) 從活動搜尋分頁（csps[0]=6）抓出所有賽事官方 URL，
 *    補入 2025-26大型賽事 - 工作表1.csv（新增欄位 title），
 *    並忽略「二次抽選」賽事
 * 2) 針對所有 url_official 條目回填標題（title 欄位）
 * 3) 依照 UBL 邏輯執行 scrape_official_top128.js
 *
 * 用法：
 *   node schedule_scrape_ubl_urls.js
 *   node schedule_scrape_ubl_urls.js --step urls     # 只做步驟 1+2（清單 + 標題）
 *   node schedule_scrape_ubl_urls.js --step top128   # 只做步驟 3（Top128 抓取）
 *   node schedule_scrape_ubl_urls.js --step all      # 全部（預設）
 *   node schedule_scrape_ubl_urls.js --start-date "09-01-2025"
 *   node schedule_scrape_ubl_urls.js --delay-ms 500
 *   node schedule_scrape_ubl_urls.js --limit 5       # 測試：只處理前 5 筆新條目
 *   node schedule_scrape_ubl_urls.js --dry-run       # 只列出要做什麼，不實際寫入/抓取
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const cheerio = require('cheerio');
const { resolveSeasonDefaults } = require('./season_config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const UBL_JSON = path.join(DATA_DIR, 'tournaments_ubl.json');
const PREMIERE_JSON = path.join(DATA_DIR, 'tournaments_premiere.json');

const DEFAULTS = {
  seasonLabel: '',
  startDate: '',
  step: 'all',
  delayMs: 500,
  limit: 0,
  dryRun: false,
};

// ─── 引數解析 ─────────────────────────────────────────────────

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
  args.csvPath = path.join(DATA_DIR, `${args.seasonLabel}大型賽事 - 工作表1.csv`);

  return args;
}

// ─── 工具函式 ─────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsvLine(fields) {
  return fields.map(csvEscape).join(',');
}

/**
 * 解析 CSV 為物件陣列，回傳 { header, rows }。
 * header 保留原始欄位順序；rows 為 { [key]: value } 陣列。
 */
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
  const content = [headerLine, ...dataLines].join('\n') + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ─── HTTP ─────────────────────────────────────────────────────

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

// ─── 搜尋頁解析 ───────────────────────────────────────────────

function buildSearchUrl(pageNo, startDate) {
  const url = new URL('https://asia.pokemon-card.com/tw/event-search/search/');
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('keyword', '');
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', '');
  url.searchParams.append('csps[0]', '6');
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

// ─── 詳細頁解析 ───────────────────────────────────────────────

function extractOfficialId(url) {
  const m = String(url || '').match(/\/event-search\/(\d+)\/?$/);
  return m ? m[1] : '';
}

function extractTitleFromHtml(html) {
  return cheerio.load(html)('h1').first().text().trim();
}

/**
 * 從 UBL 官方標題解析 series 與 level。
 * 範例標題：
 *   "2025-26 Taiwan Ultra Ball League Season 1-1 Masters Category"
 *   "2025-26 Taiwan Ultra Ball League Season 2-3 Juniors Category"
 */
function parseSeriesAndLevelFromTitle(title) {
  const t = String(title || '');

  // series: "Season 1-1" → "1-1"; 可能的格式也包含 "Season 3 Leg 2" 等
  let series = '';
  const seasonDash = t.match(/Season\s+(\d+-\d+)/i);
  if (seasonDash) {
    series = seasonDash[1];
  } else {
    const zhSeason = t.match(/賽季\s*(\d+-\d+)/);
    if (zhSeason) {
      series = zhSeason[1];
    }

    // 嘗試 "Season X Leg Y" 格式
    const seasonLeg = t.match(/Season\s+(\d+)\s+Leg\s+(\d+)/i);
    if (seasonLeg) series = `${seasonLeg[1]}-${seasonLeg[2]}`;
  }

  let level = '';
  if (/Masters?\s+Category|大師組/i.test(t)) level = 'master';
  else if (/Seniors?\s+Category|高級組|少年組/i.test(t)) level = 'senior';
  else if (/Juniors?\s+Category|初級組|孩童組/i.test(t)) level = 'junior';

  return { series, level };
}

// ─── 步驟 1+2：URL 發現 + 標題回填 ──────────────────────────

async function runUrlsStep(args) {
  console.log('[ubl] 步驟 1：抓取高級球賽事清單（csps[0]=6）');

  // 1a. 取得所有搜尋分頁上的 URL
  const firstUrl = buildSearchUrl(1, args.startDate);
  const firstHtml = await fetchHtml(firstUrl);
  const totalPages = Math.max(1, extractTotalPages(firstHtml));
  const foundUrls = new Set(extractOfficialUrls(firstHtml));
  console.log(`[ubl] page 1/${totalPages}，累積 ${foundUrls.size} 筆`);

  for (let p = 2; p <= totalPages; p += 1) {
    const html = await fetchHtml(buildSearchUrl(p, args.startDate));
    for (const u of extractOfficialUrls(html)) foundUrls.add(u);
    console.log(`[ubl] page ${p}/${totalPages}，累積 ${foundUrls.size} 筆`);
    if (args.delayMs > 0) await sleep(args.delayMs);
  }

  const sortedUrls = Array.from(foundUrls).sort(
    (a, b) => Number(extractOfficialId(a)) - Number(extractOfficialId(b))
  );
  console.log(`[ubl] 搜尋共找到 ${sortedUrls.length} 筆唯一 URL\n`);

  // 1b. 讀取現有 CSV
  if (!fs.existsSync(args.csvPath)) {
    console.error(`[error] 找不到 CSV：${args.csvPath}`);
    process.exitCode = 1;
    return;
  }

  const csvText = fs.readFileSync(args.csvPath, 'utf8');
  const { header: origHeader, rows } = parseCsv(csvText);

  // 確保 title 欄位存在（若原無則加入）
  const header = origHeader.includes('title') ? origHeader : [...origHeader, 'title'];
  const titleAdded = !origHeader.includes('title');
  if (titleAdded) console.log('[ubl] CSV 尚無 title 欄位，已自動新增');

  // 建立現有 url_official → row 的對照 Map（以便更新標題）
  const existingByUrl = new Map();
  for (const row of rows) {
    if (row.url_official) existingByUrl.set(row.url_official.replace(/\/$/, '') + '/', row);
  }

  // 識別需要抓取詳細頁的 URL（新增的 + 欠缺 title 的）
  const newUrls = sortedUrls.filter((u) => !existingByUrl.has(u));
  const missingMetaUrls = sortedUrls.filter(
    (u) => existingByUrl.has(u) && (
      !existingByUrl.get(u).title ||
      !existingByUrl.get(u).series ||
      !existingByUrl.get(u).level
    )
  );

  console.log(`[ubl] 新增 URL：${newUrls.length} 筆`);
  console.log(`[ubl] 待補欄位（title/series/level）：${missingMetaUrls.length} 筆\n`);

  // 限制處理數量（測試用）
  let urlsToFetch = [...newUrls, ...missingMetaUrls];
  if (args.limit > 0) {
    urlsToFetch = urlsToFetch.slice(0, args.limit);
    console.log(`[ubl] 測試模式：最多處理 ${args.limit} 筆\n`);
  }

  // 抓取詳細頁：建立 id → {title, series, level} 快取
  const detailCache = new Map();
  let fetchCount = 0;

  for (const url of urlsToFetch) {
    const id = extractOfficialId(url);
    if (detailCache.has(id)) continue;

    if (args.dryRun) {
      console.log(`[dry-run] 將抓取 ${url}`);
      detailCache.set(id, { title: '(dry-run)', series: '', level: '' });
      continue;
    }

    try {
      const html = await fetchHtml(url);
      const title = extractTitleFromHtml(html);

      // 過濾二次抽選
      if (/二次抽選/.test(title)) {
        console.log(`[ubl] ⏭  略過二次抽選：${title} (${url})`);
        detailCache.set(id, { skip: true, title });
      } else {
        const { series, level } = parseSeriesAndLevelFromTitle(title);
        detailCache.set(id, { title, series, level });
        console.log(`[ubl] ✅ ${id} | ${series || '?'} ${level || '?'} | ${title}`);
        fetchCount += 1;
      }

      if (args.delayMs > 0) await sleep(args.delayMs);
    } catch (err) {
      console.error(`[ubl] ❌ 抓取失敗 ${url}：${err.message}`);
      detailCache.set(id, { error: true, title: '' });
    }
  }

  // 1c. 更新現有列的 title
  let titleUpdateCount = 0;
  let levelUpdateCount = 0;
  let seriesUpdateCount = 0;
  for (const row of rows) {
    if (row.url_official) {
      const id = extractOfficialId(row.url_official);
      const cached = detailCache.get(id);
      if (cached && !cached.skip && !cached.error) {
        if (!row.title && cached.title) {
          row.title = cached.title;
          titleUpdateCount += 1;
        }
        if (!row.level && cached.level) {
          row.level = cached.level;
          levelUpdateCount += 1;
        }
        if (!row.series && cached.series) {
          row.series = cached.series;
          seriesUpdateCount += 1;
        }
      }
    }
  }

  // 1d. 加入新列（新增的 URL）
  let addedCount = 0;
  for (const url of newUrls) {
    const id = extractOfficialId(url);
    const cached = detailCache.get(id);

    if (!cached || cached.skip || cached.error) continue;
    if (!cached.title) continue;

    const { title, series, level } = cached;

    const newRow = {};
    header.forEach((key) => {
      newRow[key] = '';
    });
    newRow.series = series || '';
    newRow.type = 'ubl';
    newRow.level = level || '';
    newRow.url = '';
    newRow.url_official = url;
    newRow.title = title;

    rows.push(newRow);
    addedCount += 1;
  }

  // 1e. 寫回 CSV
  if (args.dryRun) {
    console.log(`\n[dry-run] 將新增 ${addedCount} 列，更新 ${titleUpdateCount} 筆標題，補齊 ${seriesUpdateCount} 筆 series、${levelUpdateCount} 筆 level`);
  } else {
    writeCsv(args.csvPath, header, rows);
    console.log(`\n[ubl] CSV 已更新：新增 ${addedCount} 列，補齊 ${titleUpdateCount} 筆標題、${seriesUpdateCount} 筆 series、${levelUpdateCount} 筆 level`);
    console.log(`[ubl] 總計 ${rows.length} 列 -> ${args.csvPath}`);

    // 1f. 回填 tournaments_ubl.json 空白標題
    syncTitlesToJson(rows);
  }
}

// ─── 同步標題至 tournaments JSON ─────────────────────────────

/**
 * 對 tournaments_ubl.json / tournaments_premiere.json 中
 * 有 officialUrl 但 title 為空的條目，以 CSV title 欄位回填。
 */
function syncTitlesToJson(rows) {
  // 建立 officialUrl → title 對照表
  const titleByUrl = new Map();
  for (const row of rows) {
    if (row.url_official && row.title) {
      const normalised = row.url_official.replace(/\/$/, '') + '/';
      titleByUrl.set(normalised, row.title);
    }
  }

  for (const [jsonFile, rootKey] of [[UBL_JSON, 'UBL'], [PREMIERE_JSON, 'PREMIERE']]) {
    const data = readJson(jsonFile);
    if (!data || !Array.isArray(data[rootKey])) continue;

    let updated = 0;
    for (const entry of data[rootKey]) {
      if (entry.title) continue; // 已有標題，不覆蓋
      const official = (entry.officialUrl || '').replace(/\/$/, '') + '/';
      if (titleByUrl.has(official)) {
        entry.title = titleByUrl.get(official);
        updated += 1;
      }
    }

    if (updated > 0) {
      writeJson(jsonFile, data);
      console.log(`[ubl] 已回填 ${updated} 筆標題 -> ${path.basename(jsonFile)}`);
    }
  }
}

// ─── 步驟 3：執行 scrape_official_top128.js ───────────────────

function runTop128Scraper(csvPath) {
  return new Promise((resolve, reject) => {
    const scraperPath = path.join(__dirname, 'scrape_official_top128.js');
    console.log('\n[ubl] 步驟 3：執行 scrape_official_top128.js...\n');

    const child = spawn('node', [scraperPath, '--csv', csvPath], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..', '..'),
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('\n[ubl] scrape_official_top128.js 完成');
        resolve();
      } else {
        reject(new Error(`scrape_official_top128.js 退出碼 ${code}`));
      }
    });

    child.on('error', reject);
  });
}

// ─── 主流程 ───────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  console.log('='.repeat(50));
  console.log(`[ubl] UBL URL 更新排程`);
  console.log(`[ubl] season=${args.seasonLabel} | step=${args.step} | startDate=${args.startDate} | delayMs=${args.delayMs}ms | limit=${args.limit || '無限制'}`);
  if (args.dryRun) console.log('[ubl] ⚠  dry-run 模式，不會實際寫入');
  console.log('='.repeat(50) + '\n');

  if (args.step === 'urls' || args.step === 'all') {
    await runUrlsStep(args);
  }

  if (args.step === 'top128' || args.step === 'all') {
    if (!args.dryRun) {
      await runTop128Scraper(args.csvPath);
    } else {
      console.log('\n[dry-run] 將執行 scrape_official_top128.js');
    }
  }

  console.log('\n[ubl] 全部完成');
}

main().catch((err) => {
  console.error('[fatal]', err.message);
  process.exitCode = 1;
});
