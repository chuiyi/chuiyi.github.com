# PTCG 情報站

台灣寶可夢集換式卡牌（PTCG）競技情報彙整平台。

## 功能頁面

| 頁面 | 說明 |
| ---- | ---- |
| [index.html](index.html) | 首頁：統計概覽、最新賽事、環境牌型、積分前十 |
| [tournaments.html](tournaments.html) | 賽事資訊：UBL / Premiere 賽事彙整 |
| [decks.html](decks.html) | 牌組資料庫：入賞牌型完整 60 張牌表與統計 |
| [players.html](players.html) | 玩家排行：積分追蹤、賽事出場紀錄 |

## 目錄結構

```text
ptcg/
├── index.html            # 首頁
├── tournaments.html      # 賽事頁
├── decks.html            # 牌組頁
├── players.html          # 玩家排行頁
├── css/
│   └── ptcg.css          # 全站樣式
├── js/
│   └── ptcg.js           # 資料載入 / 渲染邏輯
├── data/                 # 前端讀取的 JSON 資料
│   ├── meta.json         # 整體統計 & 環境牌型快照
│   ├── tournaments_ubl.json          # UBL 爬蟲記錄
│   ├── tournaments_premiere.json     # Premiere 爬蟲記錄
│   ├── decks.json        # 牌組資料庫
│   └── ranking.json      # 玩家排行 manifest
└── scraper/              # 後端爬蟲
  ├── scraper.js        # Node.js 主程式
    └── players_manual.csv # 手動維護的玩家資料
```

## 資料更新流程

### 自動爬蟲（Node.js）

```bash
npm install

# 抓取賽事頁表格並輸出 CSV
npm run scrape:ptcg -- --url "https://tcg.sfc-jpn.jp/tour.asp?tid=8440095&kno=9999999&znt=1&MMP=&flu=&Exclusive=0"

# 可指定檔名（不含副檔名）
npm run scrape:ptcg -- --url "<網址>" --filename "2026-03-14-1 2025-26 UBL 3-1 大師組"
```

### 手動維護玩家資料

編輯 `scraper/players_manual.csv`，格式如下：

```csv
name,name_en,score,tournaments,division,region,top_decks
林小明,Lin Hsiao-Ming,480,6,Masters,北部,Dragapult ex|Lugia VSTAR
```

更新後執行：

```bash
# 目前 players_manual.csv 保留為手動資料來源
# 可由前端或其他同步流程讀取
```

## JSON 資料格式

### `data/meta.json`

```json
{
  "last_updated": "YYYY-MM-DD",
  "total_tournaments": 12,
  "total_decks": 28,
  "season": "2025-2026",
  "meta_decks": [
    { "name": "Dragapult ex", "usage_pct": 22, "winrate": 58 }
  ]
}
```

### `data/tournaments_ubl.json` / `data/tournaments_premiere.json`

```json
{
  "UBL": [
    {
      "id": "8225008",
      "title": "2025/9/20-1 2025-26 UBL 1-1 大師組",
      "finalRankCount": 312,
      "series": "1-1"
    }
  ]
}
```

### `data/decks.json`（陣列）

```json
[
  {
    "id": "deck-001",
    "name": "Dragapult ex / 幽靈龍",
    "archetype": "攻擊",     // 攻擊 | 控制 | 封鎖 | 擴散
    "winrate": 58,
    "usage_pct": 22,
    "top_finishes": 8,
    "card_list": {
      "pokemon": [{ "name": "Dragapult ex", "qty": 3 }],
      "trainer": [],
      "energy":  []
    }
  }
]
```

### `data/ranking.json`（manifest）

```json
{
  "latest": {
    "master": {
      "date": "20260323",
      "file": "ranking_20260323_master_result.csv",
      "total_players": 4518,
      "world_players": 32
    }
  }
}
```

## 注意事項

## Google Analytics（GA4）

`js/ptcg.js` 已內建 GA4 初始化。預設不送資料，需提供 Measurement ID 後才會啟用。

可用以下任一方式設定：

```js
// 方式 1：在任一 PTCG 頁面載入 ptcg.js 前設定
window.PTCG_GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';

// 方式 2：寫入 localStorage（同網域持久生效）
localStorage.setItem('ptcg_ga_measurement_id', 'G-XXXXXXXXXX');
```

目前內建事件：

- `view_tournament_detail`
- `view_tournament_top128`
- `view_player_detail`
- `nav_click`
- `home_feature_click`
- `footer_main_link_click`
- `tournament_filter_type_change`
- `tournament_filter_season_change`
- `tournament_search`
- `tournament_pagination_click`
- `player_level_change`
- `player_search`
- `player_only_detail_toggle`
- `player_page_size_change`
- `player_sort_click`
- `player_pagination_click`

- Node.js 爬蟲會抓取頁面中所有表格並輸出單一 CSV；若遇到網站防護機制，請調整 Header 或加入重試策略。
- 官方 Pokémon 積分系統若需登入，建議維持手動匯入流程。
- 所有資料僅供競技研究參考，不得用於商業用途。
