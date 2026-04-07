const path = require('path');
const { spawn } = require('child_process');

// =====================================================================
// === 抓取任務設定區 (請在這裡將需要自動執行的功能設為 true) ===
// =====================================================================
const CONFIG = {
  // ── 玩家資料 ──
  scrapeMissingPlayersAll: false,    // 1. 抓取缺漏玩家 json（全部組別）
  forceScrapeAllPlayers: false,      // 2. 強制重新抓取所有玩家 json（全部組別）
  scrapeMissingPlayersMaster: false, // a. 抓取大師組缺漏 / 更新玩家 json
  scrapeMissingPlayersSenior: false, // b. 抓取少年組缺漏 / 更新玩家 json
  scrapeMissingPlayersJunior: false, // c. 抓取孩童組缺漏 / 更新玩家 json

  // ── Ranking Draft ──
  updateRankingDraft: false,          // 3. 更新 ranking draft → result CSV

  // ── 官方 Top 128 ──
  scrapeOfficialTop128New: false,     // 4. 抓取官方 Top 128（新場次）
  forceScrapeOfficialTop128All: false, // 5. 強制重新抓取所有官方 Top 128

  // ── GBL 超級球 ──
  scrapeGblFull: true,              // 6. GBL 單一賽季完整排程（清單 + 詳細 + Top128）
  scrapeGblUrlsOnly: false,          // 7. GBL 只更新賽事清單（分頁 URL）

  // ── UBL 高級球 ──
  scrapeUblFull: true,              // 8. UBL 完整排程（清單 + 標題回填 + Top128）
  scrapeUblUrlsOnly: false,          // 9. UBL 只更新賽事清單（URL + 標題）

  // ── MasterBall 大師球 ──
  scrapeMasterballFull: true,       // m. MasterBall 完整排程（清單 + 標題回填 + Top128）
  scrapeMasterballUrlsOnly: false,   // n. MasterBall 只更新賽事清單（URL + 標題）
};

// =====================================================================
// === 程式執行區 (以下通常不需要修改) ===
// =====================================================================
const SCRAPER_DIR = path.join(__dirname, 'ptcg', 'scraper');
const DATA_DIR = path.join(__dirname, 'ptcg', 'data');

const TASKS_MAPPING = [
  { key: 'scrapeMissingPlayersAll', label: '抓取缺漏玩家 json（全部組別）', args: ['./scrape_players.js', '--only-missing'] },
  { key: 'forceScrapeAllPlayers', label: '強制重新抓取所有玩家 json', args: ['./scrape_players.js', '--all', '--include-404'] },
  { key: 'scrapeMissingPlayersMaster', label: '抓取大師組缺漏', args: ['./scrape_players.js', '--level', 'master'] },
  { key: 'scrapeMissingPlayersSenior', label: '抓取少年組缺漏', args: ['./scrape_players.js', '--level', 'senior'] },
  { key: 'scrapeMissingPlayersJunior', label: '抓取孩童組缺漏', args: ['./scrape_players.js', '--level', 'junior'] },

  { key: 'updateRankingDraft', label: '更新 ranking draft → result CSV', args: ['./scrape_ranking_draft.js', '--scan', '--latest-only', '--force', '--dir', DATA_DIR] },

  { key: 'scrapeOfficialTop128New', label: '抓取官方 Top 128（新場次）', args: ['./scrape_official_top128.js'] },
  { key: 'forceScrapeOfficialTop128All', label: '強制重新抓取所有官方 Top 128', args: ['./scrape_official_top128.js', '--force'] },

  { key: 'scrapeGblFull', label: 'GBL 單一賽季完整排程', args: ['./scrape_gbl_season.js'] },
  { key: 'scrapeGblUrlsOnly', label: 'GBL 只更新賽事清單', args: ['./scrape_gbl_season.js', '--step', 'urls'] },

  { key: 'scrapeUblFull', label: 'UBL 完整排程', args: ['./scrape_ubl_urls.js', '--step', 'all'] },
  { key: 'scrapeUblUrlsOnly', label: 'UBL 只更新賽事清單', args: ['./scrape_ubl_urls.js', '--step', 'urls'] },

  { key: 'scrapeMasterballFull', label: 'MasterBall 完整排程', args: ['./scrape_masterball_urls.js', '--step', 'all'] },
  { key: 'scrapeMasterballUrlsOnly', label: 'MasterBall 只更新賽事清單', args: ['./scrape_masterball_urls.js', '--step', 'urls'] }
];

// 用包裝好的 Promise 依序執行 child_process
function runScript({ label, args }) {
  return new Promise((resolve, reject) => {
    console.log(`\n=============================================`);
    console.log(`[自動排程] 準備執行: ${label}`);
    console.log(`[自動排程] 指令: node ${args.join(' ')}`);
    console.log(`=============================================\n`);

    const proc = spawn('node', args, {
      cwd: SCRAPER_DIR, // 設定工作目錄到 ptcg/scraper 才能正確執行
      stdio: 'inherit',
      shell: false,
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`執行失敗，程式結束代碼（Exit code）為 ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

// 主程式依序檢查設定並執行
async function autoRun() {
  console.log(`開始執行自動化收集流程...（時間：${new Date().toLocaleString()}）`);

  for (const task of TASKS_MAPPING) {
    // 透過 CONFIG 的 boolean 值來判斷是否需要執行
    if (CONFIG[task.key] === true) {
      try {
        await runScript(task);
        console.log(`\n[自動排程] ✅ ${task.label} 執行成功。`);
      } catch (error) {
        console.error(`\n[自動排程] ❌ 執行 ${task.label} 時發生錯誤:`);
        console.error(error);
        // 若你希望中間出現錯誤就停止整個流程，保留以下一行；
        // 若希望某個失敗了繼續嘗試下一個任務，請將 `process.exit(1)` 註解掉
        process.exit(1);
      }
    }
  }

  console.log(`\n所有自動化收集任務已完成！`);
}

autoRun();
