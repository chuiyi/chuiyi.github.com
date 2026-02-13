// room-socket.js - 使用 Socket.IO 的遊戲房間功能
const socket = io();
let roomId = '';
let roomData = null;
let availableNumbers = [];

document.addEventListener('DOMContentLoaded', () => {
    // 從 URL 取得房間 ID
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('id');
    
    if (!roomId) {
        alert('無效的房間 ID');
        window.location.href = 'index-online.html';
        return;
    }
    
    // 加入房間
    socket.emit('joinRoom', roomId, (response) => {
        if (!response.success) {
            alert('找不到房間，請確認房間 ID 是否正確');
            window.location.href = 'index-online.html';
            return;
        }
        
        roomData = response.roomData;
        initializeAvailableNumbers();
        setupQRCode();
        updateRoomDisplay();
    });
    
    // 綁定事件
    document.getElementById('drawBtn').addEventListener('click', drawNumber);
    document.getElementById('resetBtn').addEventListener('click', resetGame);
    document.getElementById('copyLinkBtn').addEventListener('click', copyLink);
    
    // 監聽 Socket 事件
    setupSocketListeners();
});

function setupSocketListeners() {
    // 當有玩家加入時
    socket.on('playerJoined', (data) => {
        roomData.players = data.players;
        updatePlayersList();
        document.getElementById('playerCount').textContent = roomData.players.length;
    });
    
    // 當有數字被抽出時
    socket.on('numberDrawn', (data) => {
        roomData.drawnNumbers = data.drawnNumbers;
        document.getElementById('currentNumber').textContent = data.number;
        updateDrawnNumbersDisplay();
        
        // 從可用數字中移除
        const index = availableNumbers.indexOf(data.number);
        if (index > -1) {
            availableNumbers.splice(index, 1);
        }
    });
    
    // 當玩家賓果狀態更新時
    socket.on('bingoUpdated', (data) => {
        roomData.players = data.players;
        updatePlayersList();
    });
    
    // 當遊戲重置時
    socket.on('gameReset', (data) => {
        roomData = data.roomData;
        initializeAvailableNumbers();
        document.getElementById('currentNumber').textContent = '--';
        updateRoomDisplay();
    });
    
    // 錯誤處理
    socket.on('error', (message) => {
        alert(message);
    });
}

function updateRoomDisplay() {
    document.getElementById('roomId').textContent = roomId;
    document.getElementById('playerCount').textContent = roomData.players.length;
    updateDrawnNumbersDisplay();
    updatePlayersList();
}

function initializeAvailableNumbers() {
    availableNumbers = [];
    for (let i = 1; i <= 99; i++) {
        if (!roomData.drawnNumbers.includes(i)) {
            availableNumbers.push(i);
        }
    }
}

function setupQRCode() {
    const ticketUrl = `${window.location.origin}/ticket-online.html?room=${roomId}`;
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

function drawNumber() {
    if (availableNumbers.length === 0) {
        alert('所有數字都已抽完！');
        return;
    }
    
    // 隨機抽取一個數字
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const drawnNumber = availableNumbers[randomIndex];
    
    // 發送到伺服器
    socket.emit('drawNumber', { roomId, number: drawnNumber });
}

function updateDrawnNumbersDisplay() {
    const container = document.getElementById('drawnNumbersList');
    container.innerHTML = '';
    
    const reversedNumbers = [...roomData.drawnNumbers].reverse();
    reversedNumbers.forEach(num => {
        const badge = document.createElement('div');
        badge.className = 'number-badge';
        badge.textContent = num;
        container.appendChild(badge);
    });
}

function updatePlayersList() {
    const container = document.getElementById('playersList');
    
    if (roomData.players.length === 0) {
        container.innerHTML = '<p class="empty-message">尚無玩家加入...</p>';
        return;
    }
    
    container.innerHTML = '';
    roomData.players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        nameSpan.textContent = player.nickname;
        
        playerDiv.appendChild(nameSpan);
        
        if (player.bingoLines && player.bingoLines > 0) {
            const bingoBadge = document.createElement('span');
            bingoBadge.className = 'bingo-badge';
            bingoBadge.textContent = `🎉 BINGO x${player.bingoLines}`;
            playerDiv.appendChild(bingoBadge);
        }
        
        container.appendChild(playerDiv);
    });
}

function resetGame() {
    if (!confirm('確定要重新開始遊戲嗎？這將清除所有已抽出的數字。')) {
        return;
    }
    
    socket.emit('resetGame', roomId);
}
