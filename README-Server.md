# Chuiyi's Website Server

一個簡單的 Express.js 服務器，用於本地開發和測試 Chuiyi 的個人網站。

## 🚀 快速開始

### 方法一：使用啟動腳本（推薦）

**Windows:**
```bash
# 雙擊運行
start-server.bat
```

**Linux/macOS:**
```bash
# 給腳本執行權限
chmod +x start-server.sh

# 執行腳本
./start-server.sh
```

### 方法二：手動啟動

1. **安裝依賴**
```bash
npm install
```

2. **啟動服務器**
```bash
npm start
```

## 📋 服務器信息

- **端口**: 13145
- **本地網址**: http://localhost:13145
- **網路網址**: http://127.0.0.1:13145

## 🌟 功能特點

- ✅ 靜態文件服務
- ✅ 正確的 MIME 類型設置
- ✅ SPA 路由支援
- ✅ 錯誤處理
- ✅ 優雅關閉
- ✅ 詳細的啟動日誌

## 📂 支援的文件類型

- HTML 文件 (`.html`)
- JavaScript 文件 (`.js`)
- CSS 樣式文件 (`.css`)
- Markdown 文件 (`.md`)
- 圖片文件 (`.jpg`, `.png`, `.svg` 等)

## 🛠️ 開發模式

如果需要自動重啟功能，可以使用：

```bash
npm run dev
```

## 🔧 系統需求

- Node.js >= 14.0.0
- npm (通常與 Node.js 一起安裝)

## 📝 使用說明

1. 啟動服務器後，在瀏覽器中訪問 http://localhost:13145
2. 所有靜態資源（CSS、JS、圖片等）都會被正確服務
3. 可以測試所有的網站功能，包括主題切換、模態框等
4. 使用 Ctrl+C 來停止服務器

## 🎯 適用場景

- 本地開發測試
- 功能驗證
- 演示展示
- 部署前測試

享受開發體驗！ 🎉
