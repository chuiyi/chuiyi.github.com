# 卡片新功能使用指南

## 功能1：複數圖片支援

卡片現在支援顯示多張圖片，會自動顯示為輪播模式。

### 使用方式

在 `trip-data.json` 中，可以使用兩種方式添加圖片：

#### 方式1：單張圖片（向下兼容）
```json
{
  "name": "朱華園",
  "area": "尾道本通り商店街",
  "category": "尾道拉麵",
  "image": "/posts/travel/hiroshima/images/shukaen-ramen.jpg",
  "imageCaption": "朱華園的經典尾道拉麵"
}
```

#### 方式2：多張圖片（新功能）
```json
{
  "name": "朱華園",
  "area": "尾道本通り商店街",
  "category": "尾道拉麵",
  "images": [
    {
      "image": "/posts/travel/hiroshima/images/shukaen-ramen.jpg",
      "imageCaption": "朱華園的經典尾道拉麵"
    },
    {
      "image": "/posts/travel/hiroshima/images/shukaen-exterior.jpg",
      "imageCaption": "店面外觀"
    },
    {
      "image": "/posts/travel/hiroshima/images/shukaen-menu.jpg",
      "imageCaption": "菜單"
    }
  ]
}
```

### 支援的卡片類型

- ✅ 交通資訊 (transport)
- ✅ 餐飲資訊 (dining)
- ✅ 景點資訊 (sightseeing)
- ✅ 伴手禮資訊 (souvenirs)
- ✅ 其他資訊 (otherInfo)

### 輪播功能

- 點擊左右箭頭切換圖片
- 點擊底部指示器跳轉到特定圖片
- 支援循環播放（最後一張後回到第一張）

---

## 功能2：卡片完成勾選

每張卡片都有一個勾選框，可以標記為「已完成」。

### 功能特點

1. **持久化儲存**
   - 勾選狀態會自動儲存到瀏覽器的 localStorage
   - 關閉頁面後再開啟，狀態仍會保留

2. **視覺反饋**
   - 已完成的卡片會：
     - 變半透明 (opacity: 0.7)
     - 標題加上刪除線
     - 背景色改變

3. **慶祝動畫**
   - 勾選時會顯示「完成了！」的慶祝動畫
   - 動畫會自動消失

### 使用方式

1. 點擊卡片標題左側的勾選框
2. 勾選後會：
   - 顯示慶祝動畫
   - 卡片變為完成狀態
   - 狀態自動儲存

3. 再次點擊可取消完成狀態

### 儲存位置

完成狀態儲存在：
```
localStorage key: "hiroshima-cards-completion-v1"
```

格式：
```json
{
  "transport-flight-ci112-outbound": true,
  "dining-朱華園": true,
  "sightseeing-嚴島神社": false,
  "souvenir-揚げもみじ": true,
  "otherInfo-yakuza6-onomichi": true
}
```

### 清除完成狀態

如果需要重置所有完成狀態，可以在瀏覽器開發者工具的 Console 中執行：
```javascript
localStorage.removeItem('hiroshima-cards-completion-v1');
location.reload();
```

---

## 資料結構範例

### 完整範例：包含多張圖片的餐飲卡片

```json
{
  "name": "朱華園",
  "area": "尾道本通り商店街",
  "category": "尾道拉麵",
  "reservationStatus": "推薦造訪",
  "note": "尾道拉麵老舖，清爽鰹魚高湯搭配背脂浮油，麵條平坦Q彈。《人中之龍6》遊戲中的經典場景之一。",
  "websiteUrl": "http://shukaen.com/",
  "mapsUrl": "https://www.google.com/maps/search/?q=%E6%9C%B1%E8%8F%AF%E5%9C%92+%E5%B0%BE%E9%81%93",
  "images": [
    {
      "image": "/posts/travel/hiroshima/images/shukaen-ramen.jpg",
      "imageCaption": "朱華園的經典尾道拉麵 - 清爽鰹魚高湯搭配背脂浮油"
    },
    {
      "image": "/posts/travel/hiroshima/images/shukaen-exterior.jpg",
      "imageCaption": "店面外觀 - 尾道本通り商店街上的老舖"
    },
    {
      "image": "/posts/travel/hiroshima/images/shukaen-interior.jpg",
      "imageCaption": "店內環境"
    }
  ]
}
```

### 完整範例：包含多張圖片的交通卡片

```json
{
  "id": "bus-airport-mihara",
  "dayId": "day1",
  "type": "機場巴士",
  "title": "廣島機場 → 三原站",
  "route": "廣島機場 → 三原站東口",
  "depart": "10:35 機場出發",
  "arrive": "11:10 三原站",
  "cost": "JPY 1,000",
  "status": "已確認",
  "note": "機場1樓7號站牌搭乘，車程約35分鐘。",
  "websiteUrl": "https://www.chugoku-jrbus.co.jp/",
  "mapsUrl": "https://www.google.com/maps/search/?q=Mihara+Station",
  "images": [
    {
      "image": "/posts/travel/hiroshima/images/hiroshima_airport_bus_map.jpg",
      "imageCaption": "廣島機場巴士路線圖"
    },
    {
      "image": "/posts/travel/hiroshima/images/mihara_station.jpg",
      "imageCaption": "三原站東口"
    }
  ],
  "linkedTimelineIds": ["jr-mihara-onomichi"]
}
```

---

## 技術細節

### localStorage 架構

```javascript
// 卡片完成狀態
const CARD_COMPLETION_KEY = "hiroshima-cards-completion-v1";

// 儲存格式
{
  "{cardType}-{cardId}": boolean
}

// cardType 可能的值：
// - transport
// - dining
// - sightseeing
// - souvenir
// - otherInfo
```

### 函數 API

```javascript
// 切換卡片完成狀態
toggleCardCompletion(cardType, cardId)

// 檢查卡片是否已完成
isCardCompleted(cardType, cardId)

// 圖片輪播導航
navigateGallery(galleryId, direction)  // direction: -1 (上一張) 或 1 (下一張)

// 跳轉到特定圖片
goToSlide(galleryId, index)
```

---

## 注意事項

1. **圖片路徑**
   - 建議使用相對於網站根目錄的絕對路徑
   - 範例：`/posts/travel/hiroshima/images/photo.jpg`

2. **圖片尺寸**
   - 建議寬度：至少 800px
   - 高度會自動調整（max-height: 300px）
   - 使用 object-fit: cover 確保圖片不變形

3. **性能考慮**
   - 避免單張卡片放置過多圖片（建議 2-5 張）
   - 圖片應該經過壓縮優化

4. **勾選狀態**
   - 狀態僅存於本地瀏覽器
   - 清除瀏覽器資料會導致狀態丟失
   - 不同裝置/瀏覽器的狀態不會同步
