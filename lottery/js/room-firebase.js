// room-firebase.js - 使用 Firebase 的遊戲房間功能
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, onValue, set, update, push } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

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

let roomId = '';
let roomData = null;
let availableNumbers = [];

document.addEventListener('DOMContentLoaded', () => {
    // 從 URL 取得房間 ID
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('id');
    
    if (!roomId) {
        alert('無效的房間 ID');
        window.location.href = 'index-firebase.html';
        return;
    }
    
    // 監聽房間資料變化
    const roomRef = ref(database, `rooms/${roomId}`);
    onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            alert('找不到房間資料');
            window.location.href = 'index-firebase.html';
            return;
        }
        
        roomData = data;
        initializeAvailableNumbers();
        updateRoomDisplay();
        
        // 首次載入時設置 QR Code
        if (!document.getElementById('qrcode').innerHTML) {
            setupQRCode();
        }
    });
    
    // 綁定事件
    document.getElementById('drawBtn').addEventListener('click', drawNumber);
    document.getElementById('resetBtn').addEventListener('click', resetGame);
    document.getElementById('copyLinkBtn').addEventListener('click', copyLink);
});

function updateRoomDisplay() {
    document.getElementById('roomId').textContent = roomId;
    
    // 計算玩家數量
    const playerCount = roomData.players ? Object.keys(roomData.players).length : 0;
    document.getElementById('playerCount').textContent = playerCount;
    
    // 更新已抽出的號碼
    updateDrawnNumbersDisplay();
    
    // 更新玩家列表
    updatePlayersList();
}

function initializeAvailableNumbers() {
    availableNumbers = [];
    for (let i = 1; i <= 99; i++) {
        if (!roomData.drawnNumbers || !roomData.drawnNumbers.includes(i)) {
            availableNumbers.push(i);
        }
    }
}

function setupQRCode() {
    const ticketUrl = `${window.location.origin}${window.location.pathname.replace('room-firebase.html', 'ticket-firebase.html')}?room=${roomId}`;
    
    document.getElementById('ticketLink').textContent = ticketUrl;
    
    // 生成 QR Code
    new QRCode(document.getElementById('qrcode'), {
        text: ticketUrl,
        width: 200,
        height: 200,
        colorDark: "#667eea",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

function copyLink() {
    const link = document.getElementById('ticketLink').textContent;
    navigator.clipboard.writeText(link).then(() => {
        const btn = document.getElementById('copyLinkBtn');
        const originalText = btn.textContent;
        btn.textContent = '✓ 已複製！';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
}

async function drawNumber() {
    if (availableNumbers.length === 0) {
        alert('所有數字都已抽完！');
        return;
    }
    
    // 隨機抽取一個數字
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const drawnNumber = availableNumbers[randomIndex];
    
    // 更新到 Firebase
    const newDrawnNumbers = [...(roomData.drawnNumbers || []), drawnNumber];
    await update(ref(database, `rooms/${roomId}`), {
        drawnNumbers: newDrawnNumbers
    });
    
    // 更新顯示
    document.getElementById('currentNumber').textContent = drawnNumber;
}

function updateDrawnNumbersDisplay() {
    const container = document.getElementById('drawnNumbersList');
    container.innerHTML = '';
    
    if (!roomData.drawnNumbers || roomData.drawnNumbers.length === 0) {
        return;
    }
    
    // 按照抽取順序顯示（最新的在前面）
    const reversedNumbers = [...roomData.drawnNumbers].reverse();
    reversedNumbers.forEach(num => {
        const badge = document.createElement('div');
        badge.className = 'number-badge';
        badge.textContent = num;
        container.appendChild(badge);
    });
    
    // 更新當前號碼
    if (roomData.drawnNumbers.length > 0) {
        const lastNumber = roomData.drawnNumbers[roomData.drawnNumbers.length - 1];
        document.getElementById('currentNumber').textContent = lastNumber;
    }
}

function updatePlayersList() {
    const container = document.getElementById('playersList');
    
    if (!roomData.players || Object.keys(roomData.players).length === 0) {
        container.innerHTML = '<p class="empty-message">尚無玩家加入...</p>';
        return;
    }
    
    container.innerHTML = '';
    Object.entries(roomData.players).forEach(([playerId, player]) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        nameSpan.textContent = player.nickname;
        
        playerDiv.appendChild(nameSpan);
        
        // 如果玩家有賓果，顯示徽章
        if (player.bingoLines && player.bingoLines > 0) {
            const bingoBadge = document.createElement('span');
            bingoBadge.className = 'bingo-badge';
            bingoBadge.textContent = `🎉 BINGO x${player.bingoLines}`;
            playerDiv.appendChild(bingoBadge);
        }
        
        container.appendChild(playerDiv);
    });
}

async function resetGame() {
    if (!confirm('確定要重新開始遊戲嗎？這將清除所有已抽出的數字。')) {
        return;
    }
    
    // 重置遊戲狀態
    const updates = {
        drawnNumbers: []
    };
    
    // 重置所有玩家的賓果狀態
    if (roomData.players) {
        Object.keys(roomData.players).forEach(playerId => {
            updates[`players/${playerId}/bingoLines`] = 0;
        });
    }
    
    await update(ref(database, `rooms/${roomId}`), updates);
    
    document.getElementById('currentNumber').textContent = '--';
}
