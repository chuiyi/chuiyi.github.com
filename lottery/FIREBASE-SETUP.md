# 🔥 Firebase 靜態網站版設定教學

## 為什麼選擇 Firebase？

✅ **完全免費**（有免費額度，一般使用綽綽有餘）
✅ **無需後端伺服器**（只需靜態 HTML/JS）
✅ **支援跨裝置即時同步**
✅ **手機掃 QR Code 可正常使用**
✅ **可部署到 GitHub Pages、Vercel 等靜態網站**

---

## 📋 設定步驟

### 步驟 1：建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 點擊「新增專案」或「Add project」
3. 輸入專案名稱，例如：`lottery-bingo-game`
4. 選擇是否啟用 Google Analytics（可選）
5. 點擊「建立專案」

### 步驟 2：註冊網頁應用程式

1. 在 Firebase 專案首頁，點擊 **Web** 圖示（`</>`）
2. 輸入應用程式暱稱，例如：`Lottery Bingo`
3. **不需要**勾選「Firebase Hosting」
4. 點擊「註冊應用程式」
5. 複製顯示的 Firebase 配置代碼

配置代碼範例：
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "lottery-bingo-xxxxx.firebaseapp.com",
  databaseURL: "https://lottery-bingo-xxxxx-default-rtdb.firebaseio.com",
  projectId: "lottery-bingo-xxxxx",
  storageBucket: "lottery-bingo-xxxxx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:xxxxxxxxxxxxx"
};
```

### 步驟 3：啟用 Realtime Database

1. 在左側選單點擊「Build」→「Realtime Database」
2. 點擊「建立資料庫」
3. 選擇資料庫位置（建議選擇 **asia-southeast1**（新加坡）最接近台灣）
4. 安全性規則選擇「**測試模式**」（之後可以改）
5. 點擊「啟用」

### 步驟 4：設定安全性規則（重要！）

預設的測試模式規則會在 30 天後過期。建議修改為：

在 Realtime Database 頁面，點擊「規則」標籤，將規則改為：

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

**說明**：
- 這允許任何人讀寫房間資料
- 適合小型、非敏感資料的應用
- 如需更嚴格的安全性，可參考 [Firebase 安全性文件](https://firebase.google.com/docs/database/security)

### 步驟 5：更新 JavaScript 檔案

將 Firebase 配置代碼替換到以下三個檔案中：

#### 📄 `js/lottery-firebase.js`

找到第 5-12 行的 `firebaseConfig`，替換為您的配置：

```javascript
const firebaseConfig = {
    apiKey: "您的 API Key",
    authDomain: "您的 Auth Domain",
    databaseURL: "您的 Database URL",  // 重要！
    projectId: "您的 Project ID",
    storageBucket: "您的 Storage Bucket",
    messagingSenderId: "您的 Messaging Sender ID",
    appId: "您的 App ID"
};
```

#### 📄 `js/room-firebase.js`

同樣替換第 5-12 行的配置。

#### 📄 `js/ticket-firebase.js`

同樣替換第 5-12 行的配置。

---

## 🚀 部署方式

### 方式一：本地測試

直接用瀏覽器開啟 `index-firebase.html` 即可！

**注意**：由於使用 ES6 模組，某些瀏覽器可能需要透過 HTTP 伺服器運行：

```bash
# Python 3
python -m http.server 8000

# Node.js (需先安裝 http-server)
npx http-server
```

然後訪問 `http://localhost:8000/index-firebase.html`

### 方式二：GitHub Pages

1. 將整個 `lottery` 資料夾推送到 GitHub
2. 在 Repository Settings → Pages
3. 選擇分支和資料夾
4. 啟用 GitHub Pages
5. 訪問 `https://您的用戶名.github.io/專案名稱/lottery/index-firebase.html`

### 方式三：Vercel

1. 前往 [Vercel](https://vercel.com/)
2. 匯入您的 GitHub Repository
3. 設定根目錄為 `lottery`
4. 部署完成！

### 方式四：Netlify

1. 前往 [Netlify](https://www.netlify.com/)
2. 拖曳 `lottery` 資料夾到 Netlify
3. 部署完成！

---

## 📱 使用方式

### 主持人（電腦）

1. 開啟 `index-firebase.html`
2. 點擊「開啟新遊戲」
3. 分享螢幕上的 QR Code 或連結

### 玩家（手機）

1. 掃描 QR Code 或開啟連結
2. 輸入暱稱
3. 開始遊戲！

**重要**：手機和電腦**不需要在同一個 WiFi**，因為資料存在 Firebase 雲端！

---

## 🔧 常見問題

### Q1: 顯示「Failed to load resource」錯誤？
**A**: 確認：
1. Firebase 配置是否正確
2. Realtime Database 是否已啟用
3. 安全性規則是否正確設定

### Q2: 資料沒有即時更新？
**A**: 
1. 檢查瀏覽器控制台是否有錯誤
2. 確認網路連線正常
3. 檢查 Firebase Console 的使用量配額

### Q3: 手機掃描後仍然找不到房間？
**A**: 
1. 確認使用的是 Firebase 版本（`*-firebase.html`）
2. 檢查 databaseURL 是否正確
3. 清除瀏覽器快取後重試

### Q4: Firebase 免費額度夠用嗎？
**A**: 
- **Spark 免費方案**：
  - 同時連線數：100
  - 資料傳輸：10 GB/月
  - 儲存空間：1 GB
- 一般小型遊戲使用綽綽有餘！

### Q5: 安全性問題？
**A**: 
- 當前配置適合非敏感資料
- 如需更高安全性，可以：
  1. 啟用 Firebase Authentication
  2. 設定更嚴格的安全性規則
  3. 限制特定 domain 存取

---

## 📊 資料結構

Firebase 中的資料結構：

```
rooms/
  ├── ABC123/
  │   ├── id: "ABC123"
  │   ├── created: 1234567890
  │   ├── status: "active"
  │   ├── drawnNumbers: [1, 5, 23, 67, ...]
  │   └── players/
  │       ├── player_xxx/
  │       │   ├── id: "player_xxx"
  │       │   ├── nickname: "小明"
  │       │   ├── numbers: [3, 7, 12, ...]
  │       │   ├── bingoLines: 2
  │       │   └── joinedAt: 1234567890
  │       └── player_yyy/
  │           └── ...
  └── DEF456/
      └── ...
```

---

## 🎉 完成！

現在您有一個**完全免費、支援跨裝置、即時同步**的樂透賓果遊戲系統，而且不需要自己的後端伺服器！

## 📚 進階功能建議

- 新增歷史記錄功能
- 支援多場遊戲同時進行
- 新增遊戲統計資料
- 實作更複雜的賓果模式
- 新增音效和動畫

---

## 📞 需要幫助？

- [Firebase 文件](https://firebase.google.com/docs)
- [Firebase Realtime Database 教學](https://firebase.google.com/docs/database)
- [Firebase 安全性規則](https://firebase.google.com/docs/database/security)
