#!/usr/bin/env node
/**
 * scrape_official_top128.js
 *
 * 讀取 ptcg/data/2025-26大型賽事 - 工作表1.csv（含 url_official 欄位），
 * 對每個有 url_official 的條目，從官方 Pokemon 頁面抓取 Top 128 排名資料，
 * 儲存至 ptcg/data/tournaments/top128_{type}_{officialId}.csv，
 * 並更新對應的 tournaments_ubl.json / tournaments_premiere.json。
 *
 * 用法:
 *   node scrape_official_top128.js
 *   node scrape_official_top128.js --csv "path/to/events.csv"
 *   node scrape_official_top128.js --force          # 重新抓取已有的檔案
 *   node scrape_official_top128.js --dry-run        # 只顯示要抓取的 URL，不實際抓取
 */

'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TOURNAMENTS_DIR = path.join(DATA_DIR, 'tournaments');
const DEFAULT_CSV = path.join(DATA_DIR, '2025-26大型賽事 - 工作表1.csv');
const UBL_JSON = path.join(DATA_DIR, 'tournaments_ubl.json');
const PREMIERE_JSON = path.join(DATA_DIR, 'tournaments_premiere.json');
const MASTERBALL_JSON = path.join(DATA_DIR, 'tournaments_masterball.json');
const TOP128_MANIFEST_JSON = path.join(DATA_DIR, 'tournaments_top128.json');

// ─── 引數解析 ────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { csv: DEFAULT_CSV, force: false, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--csv' && argv[i + 1]) { args.csv = argv[i + 1]; i += 1; }
    if (argv[i] === '--force') args.force = true;
    if (argv[i] === '--dry-run') args.dryRun = true;
  }
  return args;
}

// ─── CSV 工具 ─────────────────────────────────────────────────

function parseSimpleCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(x => x.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    header.forEach((k, i) => { obj[k] = (cols[i] || '').trim(); });
    return obj;
  });
}

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsvLine(fields) {
  return fields.map(csvEscape).join(',');
}

// ─── URL 工具 ─────────────────────────────────────────────────

function extractOfficialId(url) {
  // https://asia.pokemon-card.com/tw/event-search/43644/  ->  43644
  const match = String(url || '').match(/\/event-search\/(\d+)\/?$/);
  return match ? match[1] : null;
}

function extractTid(url) {
  try {
    return new URL(url).searchParams.get('tid') || null;
  } catch {
    return null;
  }
}

// ─── JSON 讀寫 ────────────────────────────────────────────────

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function updateTournamentRecord(jsonFile, rootKey, payload) {
  const data = readJson(jsonFile);
  if (!data || !Array.isArray(data[rootKey])) return false;

  const {
    tid,
    sourceUrl,
    type,
    level,
    series,
    officialUrl,
    top128File,
    top128Count,
    officialDate,
    title,
    capacity,
    venue,
    address,
  } = payload;

  const idx = data[rootKey].findIndex(r => String(r.id) === String(tid));
  if (idx < 0) {
    data[rootKey].push({
      type,
      id: String(tid),
      url: sourceUrl || '',
      title: title || '',
      level,
      series,
      createdAt: new Date().toISOString(),
      officialUrl,
      top128File,
      top128Count,
      officialDate,
      capacity: capacity || '',
      venue: venue || '',
      address: address || '',
      history: [],
    });
    writeJson(jsonFile, data);
    return true;
  }

  data[rootKey][idx] = {
    ...data[rootKey][idx],
    title: title || data[rootKey][idx].title || '',
    officialUrl,
    top128File,
    top128Count,
    officialDate,
    capacity: capacity || data[rootKey][idx].capacity || '',
    venue: venue || data[rootKey][idx].venue || '',
    address: address || data[rootKey][idx].address || '',
  };

  writeJson(jsonFile, data);
  return true;
}

function upsertOfficialOnlyRecord(jsonFile, rootKey, recordType, payload) {
  const data = readJson(jsonFile);
  if (!data || !Array.isArray(data[rootKey])) return false;

  const {
    officialId,
    sourceUrl,
    level,
    series,
    officialUrl,
    top128File,
    top128Count,
    officialDate,
    title,
    capacity,
    venue,
    address,
  } = payload;

  const arr = data[rootKey];
  const idx = arr.findIndex((r) => String(r.officialUrl || '') === String(officialUrl || ''));
  const now = new Date().toISOString();

  if (idx < 0) {
    arr.push({
      type: recordType,
      id: `official-${officialId}`,
      url: sourceUrl || '',
      title: title || '',
      level,
      series,
      createdAt: now,
      officialUrl,
      top128File,
      top128Count,
      officialDate,
      capacity: capacity || '',
      venue: venue || '',
      address: address || '',
      history: [],
    });
    writeJson(jsonFile, data);
    return true;
  }

  arr[idx] = {
    ...arr[idx],
    title: title || arr[idx].title || '',
    level: level || arr[idx].level || '',
    series: series || arr[idx].series || '',
    officialUrl,
    top128File,
    top128Count,
    officialDate,
    capacity: capacity || arr[idx].capacity || '',
    venue: venue || arr[idx].venue || '',
    address: address || arr[idx].address || '',
  };

  writeJson(jsonFile, data);
  return true;
}

// 保留舊名作為向後相容
function upsertUblOfficialOnlyRecord(payload) {
  return upsertOfficialOnlyRecord(UBL_JSON, 'UBL', 'ubl', payload);
}

// ─── 爬蟲核心 ────────────────────────────────────────────────

async function fetchHtml(url) {
  const resp = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });
  return resp.data;
}

function scrapeTop128FromHtml(html) {
  const $ = cheerio.load(html);
  const rows = [];

  $('div.tableRow.tableData').each((_, el) => {
    const rank = $(el).find('div.rank').text().trim();
    const pointsRaw = $(el).find('div.point').text().trim();
    // 點數可能是 "100 pt"，提取數字
    const pointsMatch = pointsRaw.match(/(\d+)/);
    const points = pointsMatch ? pointsMatch[1] : '';

    const userName = $(el).find('p.userName').text().trim();
    const userId = $(el).find('p.userId').text().trim();
    const area = $(el).find('div.area').text().trim();

    // 牌組連結（部分玩家有連結，部分沒有）
    const deckLinkEl = $(el).find('div.deck a[href]');
    const deckUrl = deckLinkEl.length ? deckLinkEl.attr('href') : '';

    if (rank && userName) {
      rows.push({ rank, points, userName, userId, area, deckUrl });
    }
  });

  return rows;
}

function extractOfficialDateFromHtml(html) {
  const $ = cheerio.load(html);
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

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

function extractTitleFromHtml(html) {
  const $ = cheerio.load(html);
  return $('h1').first().text().trim();
}

function extractCapacityFromHtml(html) {
  const bodyText = cheerio.load(html)('body').text().replace(/\s+/g, ' ').trim();
  const matched = bodyText.match(/人數限制\s*([0-9]+\s*人)/);
  return matched ? matched[1].replace(/\s+/g, ' ').trim() : '';
}

function extractVenueAndAddressFromHtml(html) {
  const $ = cheerio.load(html);

  // 官方頁有獨立「會場」區塊，優先從這裡擷取，避免抓到整頁活動結果文字。
  const placeSection = $('section.mainSection.place').first();
  if (placeSection.length) {
    const lines = placeSection
      .find('div')
      .map((_, el) => String($(el).text() || '').replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean);

    if (lines.length >= 2) {
      const venueText = lines[lines.length - 1];
      const maybePostal = lines[0];
      const hasPostal = /^\d{3,5}$/.test(maybePostal);
      const cityText = lines.length >= 2 ? lines[lines.length - 2] : '';

      const addressParts = [];
      if (hasPostal) addressParts.push(maybePostal);
      if (cityText && !venueText.includes(cityText)) addressParts.push(cityText);
      addressParts.push(venueText);

      return {
        venue: venueText,
        address: addressParts.join(' ').trim(),
      };
    }

    if (lines.length === 1) {
      return {
        venue: lines[0],
        address: lines[0],
      };
    }
  }

  // 回退：若站方 DOM 結構改版，再使用純文字模式嘗試擷取。
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const venueMatch = bodyText.match(/會場\s+(.+?)\s+(?:報名|主辦方情報|活動概要|地址)/);
  const addressMatch = bodyText.match(/地址\s+(.+?)\s+(?:參加費|人數限制|同意事項|活動概要|報名|主辦方情報)/);

  return {
    venue: venueMatch ? String(venueMatch[1] || '').trim() : '',
    address: addressMatch ? String(addressMatch[1] || '').trim() : '',
  };
}

function rowsToCsv(rows) {
  const header = buildCsvLine(['rank', 'points', 'username', 'player_id', 'region', 'deck_url']);
  const lines = [header];
  for (const r of rows) {
    lines.push(buildCsvLine([r.rank, r.points, r.userName, r.userId, r.area, r.deckUrl]));
  }
  return lines.join('\n');
}

function countRowsFromTop128Csv(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.length > 1 ? (lines.length - 1) : 0;
}

// ─── 主流程 ──────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(args.csv)) {
    console.error(`[error] 找不到 CSV：${args.csv}`);
    process.exitCode = 1;
    return;
  }

  const csvText = fs.readFileSync(args.csv, 'utf8');
  const records = parseSimpleCsv(csvText);
  fs.mkdirSync(TOURNAMENTS_DIR, { recursive: true });

  // 過濾出有 url_official 的條目
  const tasks = records.filter(r => r.url_official && extractOfficialId(r.url_official));

  if (!tasks.length) {
    console.log('[info] CSV 中沒有包含 url_official 的條目。');
    return;
  }

  console.log(`[info] 發現 ${tasks.length} 筆有 url_official 的條目\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  let noTopCount = 0;
  const manifestEntries = [];

  for (const task of tasks) {
    const officialId = extractOfficialId(task.url_official);
    const type = String(task.type || 'ubl').toLowerCase();
    const tid = extractTid(task.url);
    const csvFileName = `top128_${type}_${officialId}.csv`;
    const csvFilePath = path.join(TOURNAMENTS_DIR, csvFileName);

    console.log(`[task] ${task.series || '?'} ${task.level} | 官方ID: ${officialId} | SFC TID: ${tid || 'N/A'}`);
    console.log(`       官方頁: ${task.url_official}`);

    // 若已有檔案且非強制重新抓取，仍預抓官方日期並補齊 JSON 欄位
    if (!args.force && fs.existsSync(csvFilePath)) {
      let officialDate = '';
      let title = String(task.title || '').trim();
      let capacity = '';
      let venue = '';
      let address = '';
      try {
        const html = await fetchHtml(task.url_official);
        officialDate = extractOfficialDateFromHtml(html);
        title = title || extractTitleFromHtml(html);
        capacity = extractCapacityFromHtml(html);
        const locationInfo = extractVenueAndAddressFromHtml(html);
        venue = locationInfo.venue;
        address = locationInfo.address;
      } catch {
        officialDate = '';
      }

      console.log(`       ⏭  已有 ${csvFileName}，略過 (使用 --force 強制重抓)\n`);
      skipCount += 1;
      const top128Count = countRowsFromTop128Csv(csvFilePath);
      manifestEntries.push({
        id: tid || `${type}-${officialId}-${task.level || 'unknown'}`,
        type,
        level: String(task.level || '').toLowerCase(),
        series: String(task.series || '').trim(),
        season: '2025-2026',
        date: officialDate,
        officialDate,
        officialUrl: task.url_official,
        sourceUrl: task.url || '',
        officialId,
        top128File: csvFileName,
        top128Count,
        title,
        capacity,
        venue,
        address,
        updatedAt: new Date().toISOString(),
      });

      // 仍更新 JSON（補上 officialUrl/top128File 若缺少）
      if (tid) {
        const jsonFile = type === 'premiere'
          ? PREMIERE_JSON
          : (type === 'masterball' ? MASTERBALL_JSON : UBL_JSON);
        const rootKey = type === 'premiere'
          ? 'PREMIERE'
          : (type === 'masterball' ? 'MASTERBALL' : 'UBL');
        updateTournamentRecord(jsonFile, rootKey, {
          tid,
          sourceUrl: task.url,
          type,
          level: String(task.level || '').toLowerCase(),
          series: String(task.series || '').trim(),
          officialUrl: task.url_official,
          top128File: csvFileName,
          top128Count,
          officialDate,
          title,
          capacity,
          venue,
          address,
        });
      } else if (type === 'ubl') {
        upsertUblOfficialOnlyRecord({
          officialId,
          sourceUrl: task.url,
          level: String(task.level || '').toLowerCase(),
          series: String(task.series || '').trim(),
          officialUrl: task.url_official,
          top128File: csvFileName,
          top128Count,
          officialDate,
          title,
          capacity,
          venue,
          address,
        });
      } else if (type === 'premiere') {
        upsertOfficialOnlyRecord(PREMIERE_JSON, 'PREMIERE', 'premiere', {
          officialId,
          sourceUrl: task.url,
          level: String(task.level || '').toLowerCase(),
          series: String(task.series || '').trim(),
          officialUrl: task.url_official,
          top128File: csvFileName,
          top128Count,
          officialDate,
          title,
          capacity,
          venue,
          address,
        });
      } else if (type === 'masterball') {
        upsertOfficialOnlyRecord(MASTERBALL_JSON, 'MASTERBALL', 'masterball', {
          officialId,
          sourceUrl: task.url,
          level: String(task.level || '').toLowerCase(),
          series: String(task.series || '').trim(),
          officialUrl: task.url_official,
          top128File: csvFileName,
          top128Count,
          officialDate,
          title,
          capacity,
          venue,
          address,
        });
      }
      continue;
    }

    if (args.dryRun) {
      console.log(`       [dry-run] 將爬取 -> ${csvFileName}\n`);
      continue;
    }

    try {
      const html = await fetchHtml(task.url_official);
      const officialDate = extractOfficialDateFromHtml(html);
      const title = String(task.title || '').trim() || extractTitleFromHtml(html);
      const capacity = extractCapacityFromHtml(html);
      const { venue, address } = extractVenueAndAddressFromHtml(html);
      const rows = scrapeTop128FromHtml(html);

      // 只有實際抓到排名資料時才設定 top128File；否則保持空字串讓前端不顯示按鈕
      const effectiveTop128File = rows.length ? csvFileName : '';

      const upsertPayload = {
        sourceUrl: task.url,
        type,
        level: String(task.level || '').toLowerCase(),
        series: String(task.series || '').trim(),
        officialUrl: task.url_official,
        top128File: effectiveTop128File,
        officialDate,
        title,
        capacity,
        venue,
        address,
      };

      if (tid) {
        updateTournamentRecord(
          type === 'premiere'
            ? PREMIERE_JSON
            : (type === 'masterball' ? MASTERBALL_JSON : UBL_JSON),
          type === 'premiere'
            ? 'PREMIERE'
            : (type === 'masterball' ? 'MASTERBALL' : 'UBL'),
          {
          tid,
          ...upsertPayload,
          top128Count: rows.length,
        });
      } else if (type === 'ubl') {
        upsertUblOfficialOnlyRecord({
          officialId,
          ...upsertPayload,
          top128Count: rows.length,
        });
      } else if (type === 'premiere') {
        upsertOfficialOnlyRecord(PREMIERE_JSON, 'PREMIERE', 'premiere', {
          officialId,
          ...upsertPayload,
          top128Count: rows.length,
        });
      } else if (type === 'masterball') {
        upsertOfficialOnlyRecord(MASTERBALL_JSON, 'MASTERBALL', 'masterball', {
          officialId,
          ...upsertPayload,
          top128Count: rows.length,
        });
      }

      manifestEntries.push({
        id: tid || `${type}-${officialId}-${task.level || 'unknown'}`,
        type,
        level: String(task.level || '').toLowerCase(),
        series: String(task.series || '').trim(),
        season: '2025-2026',
        date: officialDate,
        officialDate,
        officialUrl: task.url_official,
        sourceUrl: task.url || '',
        officialId,
        top128File: effectiveTop128File,
        top128Count: rows.length,
        title,
        capacity,
        venue,
        address,
        updatedAt: new Date().toISOString(),
      });

      if (!rows.length) {
        console.log(`       ⚠  未抓到任何排名資料（頁面可能尚未公佈結果），已回填標題/日期/地點/人數限制\n`);
        noTopCount += 1;
        continue;
      }

      const csvContent = rowsToCsv(rows);
      fs.writeFileSync(csvFilePath, csvContent, 'utf8');
      console.log(`       ✅ 已儲存 ${rows.length} 筆 -> ${csvFileName}`);
      if (tid) {
        console.log(`       📝 已更新 ${path.basename(type === 'premiere' ? PREMIERE_JSON : (type === 'masterball' ? MASTERBALL_JSON : UBL_JSON))} (tid=${tid})\n`);
      } else if (type === 'ubl') {
        console.log('       📝 已更新 tournaments_ubl.json（以 officialId 建立/更新）\n');
      } else if (type === 'masterball') {
        console.log('       📝 已更新 tournaments_masterball.json（以 officialId 建立/更新）\n');
      }

      successCount += 1;

      // 禮貌性延遲，避免過度請求
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.log(`       ❌ 抓取失敗：${err.message}\n`);
      failCount += 1;
    }
  }

  if (!args.dryRun) {
    const dedupMap = new Map();
    for (const entry of manifestEntries) {
      const key = `${entry.type}|${entry.officialId}|${entry.level}`;
      dedupMap.set(key, entry);
    }
    const manifest = {
      updatedAt: new Date().toISOString(),
      TOP128: Array.from(dedupMap.values()),
    };
    writeJson(TOP128_MANIFEST_JSON, manifest);
    console.log(`[info] 已更新 ${path.basename(TOP128_MANIFEST_JSON)}，共 ${manifest.TOP128.length} 筆`);
  }

  console.log('─'.repeat(40));
  console.log(`完成：成功 ${successCount}，略過 ${skipCount}，無 Top 表 ${noTopCount}，失敗 ${failCount}`);
}

main().catch(err => {
  console.error('[fatal]', err.message);
  process.exitCode = 1;
});
