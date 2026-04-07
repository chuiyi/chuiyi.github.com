#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE = 'https://asia.pokemon-card.com';
const DEFAULT_ID = 'tw27568465';
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'players');

function parseArgs(argv) {
  const args = { id: DEFAULT_ID, url: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if ((token === '--id' || token === '-i') && argv[i + 1]) {
      args.id = argv[i + 1].trim();
      i += 1;
      continue;
    }
    if ((token === '--url' || token === '-u') && argv[i + 1]) {
      args.url = argv[i + 1].trim();
      i += 1;
    }
  }
  return args;
}

function extractIdFromUrl(url) {
  const m = String(url || '').match(/\/tw\/users\/([^/?#]+)\/?/i);
  return m ? m[1] : '';
}

function normalizeText(text) {
  return String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseEventDateTime(eventTime) {
  const normalized = normalizeText(eventTime);
  const m = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) {
    return { datetimeText: '', timestamp: Number.NEGATIVE_INFINITY };
  }

  const month = String(parseInt(m[1], 10)).padStart(2, '0');
  const day = String(parseInt(m[2], 10)).padStart(2, '0');
  const year = m[3];
  const hour = String(parseInt(m[4], 10)).padStart(2, '0');
  const minute = m[5];
  const datetimeText = `${year}-${month}-${day} ${hour}:${minute}`;
  const timestamp = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:00`);

  return {
    datetimeText,
    timestamp: Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp,
  };
}

function normalizeLp(rawLp) {
  const normalized = normalizeText(rawLp);
  if (!normalized) return '-';
  return normalized.replace(/點|pt/gi, '').trim() || '-';
}

function buildUserUrl(id, pageNo) {
  const base = `${BASE}/tw/users/${encodeURIComponent(id)}/`;
  const pageParam = pageNo && pageNo > 1 ? `pageNo=${pageNo}&` : '';
  return `${base}?${pageParam}eventFilter=4&eventGivingCSPPointsFlg=1`;
}

async function fetchHtml(url) {
  const resp = await axios.get(url, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });
  return resp.data;
}

function parsePagingPageNos($, playerId) {
  const pageNos = new Set([1]);
  const pattern = new RegExp(`/tw/users/${playerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\?pageNo=(\\d+)`, 'i');

  $('a').each((_, a) => {
    const href = $(a).attr('href') || '';
    const m = href.match(pattern);
    if (!m) return;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) {
      pageNos.add(n);
    }
  });

  return Array.from(pageNos).sort((a, b) => a - b);
}

function parseEventRows($, pageNo) {
  const rows = [];
  $('div.events > div.event').each((idx, el) => {
    const $el = $(el);

    const activityName = normalizeText($el.find('.information .eventName').first().text());
    const eventTime = normalizeText($el.find('.information .eventDate').first().text());
    const location = normalizeText($el.find('.information .organizer').first().text());
    const address = normalizeText($el.find('.information .place').first().text());

    const rankValue = normalizeText($el.find('.rank .historyTableData .value').first().text());
    const rankText = normalizeText($el.find('.rank .historyTableData').first().text());
    const rank = rankValue || rankText || '-';

    const lpRaw = $el.find('.point .historyTableData').first().text();
    const lp = normalizeLp(lpRaw);
    const { datetimeText, timestamp } = parseEventDateTime(eventTime);

    if (!activityName && !eventTime && !location && !address && !rank && !lp) {
      return;
    }

    rows.push({
      pageNo,
      rowIndex: idx + 1,
      activityName,
      eventTime,
      eventDateTime: datetimeText,
      location,
      address,
      rank,
      lp,
      _eventTimestamp: timestamp,
    });
  });

  return rows;
}

async function scrapePlayerHistory(playerId) {
  const allEvents = [];
  const visitedPages = new Set();
  const queue = [1];

  while (queue.length > 0) {
    const pageNo = queue.shift();
    if (visitedPages.has(pageNo)) continue;
    visitedPages.add(pageNo);

    const pageUrl = buildUserUrl(playerId, pageNo);
    console.log(`[player] Fetch page ${pageNo}: ${pageUrl}`);
    const html = await fetchHtml(pageUrl);
    const $ = cheerio.load(html);

    const events = parseEventRows($, pageNo);
    allEvents.push(...events);

    const discovered = parsePagingPageNos($, playerId);
    for (const n of discovered) {
      if (!visitedPages.has(n) && !queue.includes(n)) {
        queue.push(n);
      }
    }
    queue.sort((a, b) => a - b);
  }

  allEvents.sort((a, b) => {
    if (b._eventTimestamp !== a._eventTimestamp) {
      return b._eventTimestamp - a._eventTimestamp;
    }
    return (a.pageNo - b.pageNo) || (a.rowIndex - b.rowIndex);
  });

  const finalEvents = allEvents.map(({ _eventTimestamp, ...rest }) => rest);

  return {
    id: playerId,
    url: buildUserUrl(playerId, 1),
    fetchedAt: new Date().toISOString(),
    totalEvents: finalEvents.length,
    participatedTournaments: finalEvents,
  };
}

async function main() {
  const { id, url } = parseArgs(process.argv);
  const playerId = extractIdFromUrl(url) || id;
  if (!playerId) {
    throw new Error('缺少玩家 id，請使用 --id tw27568465 或 --url https://asia.pokemon-card.com/tw/users/tw27568465/');
  }

  const result = await scrapePlayerHistory(playerId);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${playerId}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log('[player] ---- Done ----');
  console.log(`[player] id: ${result.id}`);
  console.log(`[player] url: ${result.url}`);
  console.log(`[player] events: ${result.totalEvents}`);
  console.log(`[player] output: ${outputPath}`);
}

main().catch((err) => {
  console.error('[player] Error:', err.message);
  process.exitCode = 1;
});
