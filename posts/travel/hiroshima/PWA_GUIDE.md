# 廣島旅行 PWA 離線功能使用說明

## 功能概述

這個廣島旅行頁面已經升級為 Progressive Web App (PWA)，支援離線瀏覽和自動更新檢測。

## 主要特性

### 1. 離線使用
- **首次訪問**：在有網路的環境下第一次開啟頁面，所有資源會自動下載並緩存
- **離線瀏覽**：之後即使沒有網路，也可以完整瀏覽所有行程內容
- **緩存內容**：
  - 所有頁面檔案（HTML, CSS, JavaScript）
  - 旅程資料（trip-data.json, overview.md, others.md）
  - Bootstrap 框架和圖示庫
  - 字型檔案

### 2. 自動更新檢測
- **即時更新**：每 5 分鐘自動檢查線上版本
- **可見性檢查**：當你回到頁面（從其他分頁或 App 切換回來）時自動檢查更新
- **更新提示**：發現新版本時，畫面下方會彈出通知按鈕
- **一鍵更新**：點擊「立即更新」按鈕，頁面會自動重新載入最新內容

### 3. 版本控制
- 目前版本格式：`YYYY.MM.DD.XXX`（年.月.日.編號）
- 每次更新會自動清理舊版本快取，不佔用額外空間

## 使用方式

### 手機端（推薦）

#### iOS (Safari)
1. 用 Safari 開啟頁面
2. 點選下方的「分享」按鈕（方框中有向上箭頭）
3. 向下滑動，選擇「加入主畫面」
4. 輸入名稱（預設為「廣島之旅」）
5. 點選「新增」
6. 主畫面會出現 App 圖示，點選即可使用

#### Android (Chrome)
1. 用 Chrome 開啟頁面
2. 點選右上角選單（三個點）
3. 選擇「安裝應用程式」或「加到主畫面」
4. 確認安裝
5. 主畫面會出現 App 圖示，點選即可使用

### 電腦端

#### Chrome / Edge
1. 開啟頁面後，網址列右側會出現「安裝」圖示（⊕）
2. 點選圖示
3. 確認安裝
4. 應用程式會出現在工具列或應用程式列表中

## 效益

1. **旅行中便利**：
   - 即使在飛機上、地鐵中、或網路訊號不佳的地方，都能查看完整行程
   - 不用擔心流量消耗
   - 開啟速度極快（直接從快取讀取）

2. **自動保持最新**：
   - 行程有任何更新，下次開啟時會自動提示
   - 可選擇立即更新或稍後再說
   - 不錯過任何重要資訊

3. **類原生體驗**：
   - 獨立的應用程式圖示
   - 全螢幕顯示（沒有瀏覽器網址列）
   - 啟動畫面（splash screen）
   - 像使用一般 App 一樣的操作體驗

## 技術規格

- **Service Worker**: `hiroshima-sw.js`
- **Manifest**: `assets/config/hiroshima-manifest.json`
- **快取策略**: Cache-First with Background Update
- **更新策略**: Automatic check on visibility change + 5-minute interval
- **離線支援**: 完整的頁面和資源緩存

## 故障排除

### 無法安裝 PWA
- 確認使用支援的瀏覽器（Chrome, Edge, Safari）
- 檢查是否使用 HTTPS（localhost 也可以）
- 嘗試重新整理頁面

### 沒有收到更新通知
- 確認網路連線正常
- 嘗試關閉並重新開啟頁面
- 清除瀏覽器快取後重新訪問

### 內容沒有更新
- 點擊更新通知中的「立即更新」按鈕
- 如果沒有看到通知，嘗試完全關閉頁面並重新開啟
- 最壞情況：清除網站資料並重新訪問

## 開發者注意事項

### 更新版本號
每次修改內容時，記得更新 `hiroshima-sw.js` 中的版本號：

```javascript
const VERSION = '2026.05.XX.XXX'; // 更新日期和編號
```

### 檢視快取狀態
開啟 Chrome DevTools：
1. Application → Service Workers（查看 SW 狀態）
2. Application → Cache Storage（查看快取內容）
3. Console（查看 SW 日誌）

### 強制更新
開發時可以使用：
- Chrome DevTools: Application → Service Workers → Update
- 或勾選「Update on reload」選項
