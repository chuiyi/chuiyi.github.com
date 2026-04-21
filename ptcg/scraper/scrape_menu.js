#!/usr/bin/env node

const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const SCRAPER_DIR = __dirname;
const DATA_DIR = path.join(__dirname, '..', 'data');

const MENU_OPTIONS = [
  // ── 玩家資料 ──────────────────────────────────────────────────
  {
    key: '1',
    label: '抓取缺漏玩家 json（全部組別）',
    description: '只抓 players.json 尚未建立索引的玩家',
    command: 'node',
    args: ['./scrape_players.js', '--only-missing'],
  },
  {
    key: '2',
    label: '強制重新抓取所有玩家 json（全部組別）',
    description: '依 ranking.json 最新 result CSV，整批重抓所有玩家並更新 players.json',
    command: 'node',
    args: ['./scrape_players.js', '--all', '--include-404'],
    confirm: '這會重新抓取所有玩家 json，可能需要很長時間。確定要繼續嗎？ (y/N): ',
  },
  {
    key: 'a',
    label: '抓取大師組缺漏 / 更新玩家 json',
    description: '僅處理大師組（--level master），跳過已成功的玩家',
    command: 'node',
    args: ['./scrape_players.js', '--level', 'master'],
  },
  {
    key: 'b',
    label: '抓取少年組缺漏 / 更新玩家 json',
    description: '僅處理少年組（--level senior），跳過已成功的玩家',
    command: 'node',
    args: ['./scrape_players.js', '--level', 'senior'],
  },
  {
    key: 'c',
    label: '抓取孩童組缺漏 / 更新玩家 json',
    description: '僅處理孩童組（--level junior），跳過已成功的玩家',
    command: 'node',
    args: ['./scrape_players.js', '--level', 'junior'],
  },
  // ── Ranking Draft ─────────────────────────────────────────────
  {
    key: '3',
    label: '更新 ranking draft → result CSV',
    description: '掃描 ptcg/data 中各組最新 draft.csv 並轉成 result.csv，更新 ranking.json 與 ranking_trends.json',
    command: 'node',
    args: ['./scrape_ranking_draft.js', '--scan', '--latest-only', '--force', '--dir', DATA_DIR],
  },
  // ── 官方 Top 128 ───────────────────────────────────────────────
  {
    key: '4',
    label: '抓取官方 Top 128（新場次）',
    description: '從高級球/紀念球賽事 CSV 的 url_official 欄位抓取各場次官方排名（新場次）',
    command: 'node',
    args: ['./scrape_official_top128.js'],
  },
  {
    key: '5',
    label: '強制重新抓取所有官方 Top 128',
    description: '強制重抓所有 url_official 場次的排名，覆蓋已有檔案',
    command: 'node',
    args: ['./scrape_official_top128.js', '--force'],
    confirm: '這會重新抓取所有官方 Top 128，確定要繼續嗎？ (y/N): ',
  },
  {
    key: 'p',
    label: '抓取指定賽事 Pairing / Final rank',
    description: '抓取 SFC 賽事頁 round pairing + final/interim result，更新 tournaments/{tid}.csv 與 tournaments_ubl.json',
    command: 'node',
    args: ['./scrape_tournament_pairings.js', '--tid', '6682363,6617577,7361615'],
  },
  // ── GBL 超級球 ────────────────────────────────────────────────
  {
    key: '6',
    label: 'GBL 單一賽季完整排程（清單 + 詳細 + Top128）',
    description: '抓取指定賽季起始日後所有超級球官方賽事，更新 CSV 與 tournaments_gbl.json',
    command: 'node',
    args: ['./scrape_gbl_season.js'],
  },
  {
    key: '7',
    label: 'GBL 只更新賽事清單（分頁 URL）',
    description: '僅抓活動搜尋分頁並輸出 2025-26超級球賽事.csv',
    command: 'node',
    args: ['./scrape_gbl_season.js', '--step', 'urls'],
  },
  // ── UBL 高級球 ────────────────────────────────────────────────
  {
    key: '8',
    label: 'UBL 完整排程（清單 + 標題回填 + Top128）',
    description: '從官方搜尋頁發現新高級球賽事 URL，補入 CSV、回填標題，再執行 Top128 抓取',
    command: 'node',
    args: ['./scrape_ubl_urls.js', '--step', 'all'],
  },
  {
    key: '9',
    label: 'UBL 只更新賽事清單（URL + 標題）',
    description: '僅從 csps[0]=6 搜尋頁補入新 URL 並回填 title 欄位，不執行 Top128',
    command: 'node',
    args: ['./scrape_ubl_urls.js', '--step', 'urls'],
  },
  // ── MasterBall 大師球 ───────────────────────────────────────
  {
    key: 'm',
    label: 'MasterBall 完整排程（清單 + 標題回填 + Top128）',
    description: '從 csps[0]=8 搜尋頁補入新 URL、回填標題，並檢查官方 Top 表',
    command: 'node',
    args: ['./scrape_masterball_urls.js', '--step', 'all'],
  },
  {
    key: 'n',
    label: 'MasterBall 只更新賽事清單（URL + 標題）',
    description: '僅從 csps[0]=8 搜尋頁補入新 URL 並回填 title 欄位，不執行 Top128',
    command: 'node',
    args: ['./scrape_masterball_urls.js', '--step', 'urls'],
  },
];

function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(String(answer || '').trim()));
  });
}

async function selectOption() {
  const rl = createPrompt();

  try {
    console.log('請選擇要執行的抓取動作：');
    for (const option of MENU_OPTIONS) {
      console.log(`${option.key}. ${option.label}`);
      console.log(`   ${option.description}`);
    }
    console.log('q. 離開');
    console.log('');

    while (true) {
      const answer = (await ask(rl, '輸入選項: ')).toLowerCase();
      if (answer === 'q' || answer === 'quit' || answer === 'exit') {
        return null;
      }

      const selected = MENU_OPTIONS.find((option) => option.key === answer);
      if (!selected) {
        console.log('無效選項，請重新輸入。');
        continue;
      }

      if (selected.confirm) {
        const confirm = (await ask(rl, selected.confirm)).toLowerCase();
        if (confirm !== 'y' && confirm !== 'yes') {
          console.log('已取消執行。');
          return null;
        }
      }

      return selected;
    }
  } finally {
    rl.close();
  }
}

function runSelectedOption(option) {
  return new Promise((resolve, reject) => {
    console.log('');
    console.log(`[menu] 執行: ${option.label}`);
    console.log(`[menu] 指令: ${option.command} ${option.args.join(' ')}`);
    console.log('');

    const proc = spawn(option.command, option.args, {
      cwd: SCRAPER_DIR,
      stdio: 'inherit',
      shell: false,
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`子程序結束代碼 ${code}`));
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  const selected = await selectOption();
  if (!selected) {
    console.log('[menu] 未執行任何動作。');
    return;
  }

  await runSelectedOption(selected);
  console.log('');
  console.log('[menu] 執行完成。');
}

main().catch((error) => {
  console.error('[menu] Error:', error.message);
  process.exit(1);
});