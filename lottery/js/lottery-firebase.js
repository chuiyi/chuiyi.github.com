// lottery-firebase.js - 使用 Firebase 的主頁面功能
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Firebase 配置（需要替換成您自己的配置）
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {
    const createGameBtn = document.getElementById('createGameBtn');
    createGameBtn.addEventListener('click', createNewGame);
});

async function createNewGame() {
    try {
        // 生成唯一的房間 ID
        const roomId = generateRoomId();
        
        // 初始化房間資料
        const roomData = {
            id: roomId,
            created: Date.now(),
            players: {},
            drawnNumbers: [],
            status: 'active'
        };
        
        // 儲存到 Firebase
        await set(ref(database, `rooms/${roomId}`), roomData);
        
        // 跳轉到房間頁面
        window.location.href = `room-firebase.html?id=${roomId}`;
    } catch (error) {
        console.error('建立房間失敗:', error);
        alert('建立房間失敗，請檢查網路連線或 Firebase 配置');
    }
}

function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let roomId = '';
    for (let i = 0; i < 6; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return roomId;
}
