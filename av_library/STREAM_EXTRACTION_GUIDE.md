# 流媒體連結提取測試工具使用指南

## 目的
此工具用於測試和驗證從 jable.tv 等視頻網站提取流媒體連結（M3U8/MP4）的能力。

## 功能

### 1. 直接 Fetch 測試
- 直接從目標網址獲取 HTML（適用於 CORS 允許的情況）
- 如果失敗則自動退回到 Jina API 代理

### 2. Jina API 代理測試
- 使用 Jina 提供的代理服務來規避 CORS 限制
- 將網頁轉換為 Markdown 或 HTML 格式

### 3. 多層級提取方法
程式嘗試使用以下方法提取流媒體連結：

#### 方法 1: Video 標籤
尋找 `<video>` 標籤中的 `src` 或 `<source>` 標籤

#### 方法 2: M3U8 連結
使用激進的正則表達式模式尋找 `.m3u8` 檔案 URL（包括參數）

#### 方法 3: MP4 連結
尋找 `.mp4` 檔案 URL

#### 方法 4: JavaScript 配置
在 JavaScript 代碼中尋找播放器配置，例如：
```javascript
player: { url: "https://example.com/video.m3u8" }
stream = "https://example.com/video.mp4"
playUrl: "https://example.com/stream.m3u8"
```

#### 方法 5: JSON 配置
尋找 JSON 格式的播放器配置

#### 方法 6: IFrame
尋找嵌入式 IFrame 來源

## 使用步驟

1. **打開工具**
   - 在瀏覽器中打開 `test-stream-extraction.html`

2. **輸入影片 URL**
   - 預設為 `https://jable.tv/s0/videos/ssni-865/`
   - 可修改為其他影片 URL

3. **選擇測試方式**
   - **開始測試**: 使用 Jina API 代理
   - **使用直接 Fetch 測試**: 嘗試直接連接（如果 CORS 允許）

4. **查看結果**
   - 日誌會顯示每個提取步驟
   - 找到的連結會按 M3U8 和其他格式分類
   - M3U8 連結標記為推薦用於播放

5. **測試連結**
   - 點擊「測試播放」按鈕以驗證連結
   - 播放器會顯示連接狀態和播放控制

## 從 Console 測試

你也可以在瀏覽器的開發者工具 Console 中進行測試：

```javascript
// 範例 1: 直接提取 M3U8 URL
const url = "https://jable.tv/s0/videos/ssni-865/";
const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
});
const html = await response.text();
const m3u8 = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/)?.[0];
console.log('M3U8 URL:', m3u8);

// 範例 2: 測試 M3U8 連結是否可訪問
const m3u8Url = "https://ap-drop-monst.mushroomtrack.com/bcdn_token=...";
const testResponse = await fetch(m3u8Url);
console.log('M3U8 可訪問:', testResponse.ok);

// 範例 3: 在播放器中播放
const video = document.createElement('video');
video.src = m3u8Url;
video.controls = true;
document.body.appendChild(video);
```

## 常見問題

### Q: 為什麼找不到任何流媒體連結？
A: 
- 該網站可能使用動態加載或其他反爬蟲技術
- 連結可能是通過 JavaScript 動態生成的
- 可能需要登錄才能訪問

### Q: M3U8 URL 包含奇怪的字元或參數？
A: 
- 這是正常的，可能包含驗證令牌、過期時間等
- 這些參數通常由 CDN 或認證系統提供
- URL 仍可在有效期內使用

### Q: 如何在我的應用中集成此功能？
A:
- 參考 `av-library.js` 中的 `fetchRawHtml()` 和 `findMetaFromHtml()` 函數
- 根據需要調整正則表達式模式
- 考慮添加錯誤處理和重試邏輯

## 技術細節

### 使用的正則表達式

**M3U8 基本模式:**
```regex
https?:\/\/[^\s"'<>]+\.m3u8(?:[^\s"'<>]*)?
```

**M3U8 在字符串中:**
```regex
["']?(https?:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*)["']?
```

**JavaScript 播放器配置:**
```regex
(?:player|video|stream|src|url)[\s]*[:=][\s]*["']([^"']*(?:\.m3u8|\.mp4|blob:)[^"']*)["']
```

## 浏览器兼容性

- Chrome/Chromium: ✅ 完全支持
- Firefox: ✅ 完全支持
- Safari: ✅ 完全支持
- Edge: ✅ 完全支持

## 法律聲明

此工具僅用於教育和研究目的。使用此工具下載或傳播受著作權保護的內容是違法的。用户需自行承擔使用此工具的所有法律責任。

## 更新記錄

### v1.0 (2026-02-13)
- 初始版本
- 支持 6 種提取方法
- 集成測試播放器
- 添加詳細日誌記錄
