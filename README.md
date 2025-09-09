# Chuiyi's Github Page - 生活札記

一個基於現代 Web 技術打造的個人網站，用來分享旅行筆記、影劇鑑賞心得和攝影作品。

## 🌟 主要功能

### 🏠 首頁 (index.html)
- 現代化響應式設計
- 統一化 CSS Grid 流式布局系統
- 動態內容載入和主題切換
- 精選內容展示（旅行、電影、攝影）

### 🌍 旅行筆記
- **獨立頁面系統**: 每篇旅行筆記都有獨立的 URL (`travel.html?file=xxx`)
- **Markdown 支援**: 使用 Markdown 格式撰寫和解析內容
- **智慧圖片處理**: 自動檢測圖片比例（直式/橫式）並適當調整顯示
- **旅行資訊結構化**: 日期、地點、交通、住宿等資訊自動解析
- **響應式圖片**: 支援多種路徑格式和自動路徑轉換

### 🎬 電影鑑賞
- **獨立評論頁面**: 每部電影都有獨立的詳細頁面 (`movie.html?file=xxx`)
- **Markdown 評論**: 支援豐富的文本格式和圖片
- **評分系統**: 支援星級評分和推薦指數
- **電影資訊解析**: 自動提取電影基本資訊（導演、年份、類型等）
- **海報展示**: 智慧海報載入和錯誤處理

### 📸 攝影札記
- **Flickr 整合**: 可直接嵌入 Flickr 相冊
- **作品集展示**: 分類展示不同主題的攝影作品
- **響應式相冊**: 適配各種螢幕尺寸的相冊瀏覽
- **預計支援**: 更多社群軟體的嵌入式文章格式

## 🛠️ 技術架構

### 前端技術
- **Bootstrap 5**: 現代化 UI 框架
- **CSS Grid**: 統一的流式布局系統，替代傳統 Bootstrap 格線
- **原生 JavaScript ES6+**: 無外部框架依賴
- **Marked.js**: Markdown 解析和渲染
- **響應式設計**: 完美適配桌面、平板、手機

### 後端服務（僅單機測試用）
- **Express.js**: 輕量級 Web 伺服器
- **靜態檔案服務**: 支援所有資源的本地服務
- **RESTful API**: 支援內容的動態載入

### 內容管理
- **Markdown 檔案系統**: 所有內容以 Markdown 格式儲存並動態反應至網站
- **配置化管理**: 使用 `content-config.js` 統一管理內容索引
- **設定管理**: 使用 `site-config.js` 統一管理首頁預設文字
- **版本控制**: Git 版本控制，支援內容歷史追蹤

## 📁 專案結構

```text
chuiyi.github.com/
├── index.html                  # 主頁面
├── movie.html                  # 電影評論獨立頁面
├── travel.html                 # 旅行筆記獨立頁面
├── server.js                   # Express 伺服器
├── package.json                # 專案依賴配置
├── assets/                     
│   ├── config/                 
│   │   ├── site-config.js      # 內容索引管理
│   │   └── content-config.js   # 內容配置管理
│   ├── css/                    
│   │   └── custom.css          # 統一樣式系統
│   ├── js/                     
│   │   └── main.js             # 主要前端邏輯
│   ├── images/                 # 網站資源圖片
│   └── svg/                    # SVG 圖示資源
├── posts/                      
│   ├── travel/                 
│   │   ├── *.md                # 旅行筆記 Markdown 檔案
│   │   └── imgs/               # 旅行照片資源
│   └── movies/                 
│       ├── *.md                # 電影評論 Markdown 檔案
│       └── imgs/               # 電影海報資源
└── docs/                       # 文檔和說明

## 🚀 快速開始

### 環境需求

- Node.js 14.0.0 或更高版本
- 現代化瀏覽器（Chrome, Firefox, Safari, Edge）
- Git（用於版本控制）

### 安裝與執行

1. **複製專案**

   ```bash
   git clone https://github.com/chuiyi/chuiyi.github.com.git
   cd chuiyi.github.com
   ```

1. **安裝依賴**

   ```bash
   npm install
   ```

1. **啟動伺服器**

   ```bash
   # 生產環境
   npm start

   # 開發環境（自動重啟）
   npm run dev
   ```

1. **瀏覽網站**

   打開瀏覽器訪問 `http://localhost:13145`

### 內容編輯管理

#### 新增旅行筆記

1. 在 `posts/travel/` 目錄下創建新的 Markdown 檔案
2. 在 `assets/config/content-config.js` 中添加相應配置
3. 使用以下格式撰寫內容：

```markdown
# 旅行標題

## 旅行資訊
- **日期**: 2025年6月17日 - 6月22日
- **地點**: 日本大阪
- **主要移動範圍路線**: 關西機場、心齋橋、中之島美術館

旅行內容...
```

#### 新增電影評論

1. 在 `posts/movies/` 目錄下創建新的 Markdown 檔案
2. 在 `assets/config/content-config.js` 中添加相應配置
3. 使用以下格式撰寫內容：

```markdown
# 電影標題

## 電影資訊
- **原名**: 電影原始名稱
- **導演**: 導演姓名
- **年份**: 2025年
- **我的評分**: 4.5/5
- **推薦指數**: 4

電影評論內容...
```

## ✨ 核心特色

### 統一化布局系統

- **CSS Grid Flow Layout**: 替代傳統 Bootstrap 格線系統
- **自動適應式卡片**: 統一高度（450px 桌面版，400px 手機版）
- **動態內容調整**: 根據內容長度自動調整布局
- **響應式斷點**: 完美適配各種螢幕尺寸

### 智慧圖片處理

- **比例自動檢測**: 自動識別直式/橫式圖片
- **適應性顯示**:
  - 橫式圖片：降低容器高度，使用 `cover` 模式
  - 直式圖片：增加容器高度，使用 `contain` 模式
  - 方形圖片：標準顯示模式
- **錯誤處理**: 載入失敗時自動顯示預設圖示

### 獨立頁面系統

- **深度連結**: 每個內容都有獨立 URL，支援直接分享
- **SEO 友好**: 動態更新頁面標題和 meta 資訊
- **快速導航**: 支援新分頁開啟，不影響主頁瀏覽
- **返回機制**: 便捷的返回主頁導航

## 🔧 開發指南

### 專案架構說明

- **模組化設計**: 每個功能區域都有獨立的 CSS 和 JS 邏輯
- **配置化管理**: 所有內容索引統一在 `content-config.js` 管理
- **漸進式增強**: 基本功能不依賴 JavaScript，增強功能逐步載入

### 自訂主題

網站支援淺色和深色兩種主題，可透過右下角按鈕切換：

```css
/* 淺色主題變數 */
:root {
  --primary-beige: #f5f5dc;
  --deep-brown: #8b4513;
  --muted-brown: #a0522d;
  --accent-gold: #daa520;
}

/* 深色主題變數 */
[data-theme="dark"] {
  --primary-beige: #2c2c2c;
  --deep-brown: #e6ddd4;
  --text-dark: #ffffff;
  --bg-primary: #1a1a1a;
}
```

### API 說明

伺服器提供以下靜態檔案服務：

- `GET /`: 主頁面
- `GET /movie.html?file=<filename>`: 電影評論頁面
- `GET /travel.html?file=<filename>`: 旅行筆記頁面
- `GET /posts/**`: Markdown 內容檔案
- `GET /assets/**`: 靜態資源（CSS, JS, 圖片）

## 📋 待辦事項

### 近期計畫

- [ ] 新增搜尋和篩選功能
- [ ] 實作標籤系統
- [ ] 加入評論互動功能
- [ ] 優化 SEO 和社群分享

### 長期規劃

- [ ] 整合 CMS 系統
- [ ] 多語言支援
- [ ] PWA 功能
- [ ] 效能監控和分析

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request！

1. Fork 專案
2. 創建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 📄 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案

## 📞 聯絡資訊

- **作者**: Chuiy
- **GitHub**: [https://github.com/chuiyi](https://github.com/chuiyi)
- **網站**: [https://chuiyi.github.io](https://chuiyi.github.io)

---

**✨ Chuiyi's Github Page** - 記錄生活中的美好時光
