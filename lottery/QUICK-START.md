# 🚀 快速啟動指南

## 問題：為什麼手機掃描 QR Code 會顯示「找不到房間資料」？

**原因**：原版本使用 `localStorage`，這是瀏覽器本地儲存，**完全無法跨裝置共享資料**。

## 解決方案：使用線上版（支援真正的跨裝置遊戲）

### 步驟 1：安裝依賴

在 lottery 資料夾中執行：

```bash
npm install
```

### 步驟 2：啟動伺服器

```bash
npm start
```

您會看到：
```
樂透賓果伺服器運行在 http://localhost:3000
按 Ctrl+C 停止伺服器
```

### 步驟 3：開始遊戲

1. **電腦上**開啟瀏覽器，訪問：`http://localhost:3000`
2. 點擊「開啟新遊戲」
3. **手機連接同一個 WiFi**，掃描螢幕上的 QR Code
4. 或在手機瀏覽器輸入：`http://[你的電腦IP]:3000/ticket-online.html?room=XXXXXX`

### 步驟 4：查詢電腦 IP 地址

**Windows (PowerShell)**:
```powershell
ipconfig | Select-String "IPv4"
```

**查找類似這樣的 IP**：`192.168.x.x`

## 📁 檔案說明

### 線上版（需要伺服器）
- `index-online.html` - 主頁（線上版）
- `room-online.html` - 遊戲房間（線上版）
- `ticket-online.html` - 樂透券（線上版）
- `js/*-socket.js` - Socket.IO 版本的 JavaScript

### 本地版（僅供同裝置測試）
- `index.html` - 主頁（本地版）
- `room.html` - 遊戲房間（本地版）
- `ticket.html` - 樂透券（本地版）
- `js/lottery.js`, `js/room.js`, `js/ticket.js` - localStorage 版本

## ⚠️ 注意事項

### 線上版
✅ 支援跨裝置多人遊戲
✅ 真正的即時同步
✅ 手機可以掃描 QR Code 加入
❌ 需要啟動 Node.js 伺服器

### 本地版
✅ 無需安裝任何東西
✅ 可在同一台電腦多個分頁測試
❌ **無法跨裝置使用**
❌ 手機掃描會失敗

## 🔥 推薦使用線上版

如果您想讓朋友用手機掃 QR Code 加入遊戲，**必須使用線上版**。

## 🆘 常見問題

### Q: 手機無法連線？
A: 確認：
1. 手機和電腦連接同一個 WiFi
2. 防火牆沒有阻擋 3000 端口
3. 使用電腦的實際 IP（不是 localhost）

### Q: 如何讓外網也能訪問？
A: 使用以下任一方案：
- **ngrok**：`npx ngrok http 3000`
- **Vercel/Railway**：部署到雲端平台
- **內網穿透**：frp、花生殼等工具

### Q: 伺服器關閉後資料會消失嗎？
A: 是的。目前資料儲存在記憶體中。如需持久化，請使用 Redis 或資料庫。

## 📞 技術支援

如有問題，請檢查：
1. Node.js 是否已安裝（`node --version`）
2. 依賴是否已安裝（`npm install`）
3. 端口 3000 是否被占用
4. 瀏覽器控制台是否有錯誤訊息
