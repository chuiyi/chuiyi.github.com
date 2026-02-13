// room.js - 遊戲房間功能（主持人介面）
let roomId = '';
let roomData = null;
let availableNumbers = [];
let updateInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    // 從 URL 取得房間 ID
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('id');
    
    if (!roomId) {
        alert('無效的房間 ID');
        window.location.href = 'index.html';
        return;
    }
    
    // 載入房間資料
    loadRoomData();
    
    // 初始化可用數字
    initializeAvailableNumbers();
    
    // 設置 QR Code
    setupQRCode();
    
    // 綁定事件
    document.getElementById('drawBtn').addEventListener('click', drawNumber);
    document.getElementById('resetBtn').addEventListener('click', resetGame);
    document.getElementById('copyLinkBtn').addEventListener('click', copyLink);
    
    // 開始定期更新
    updateInterval = setInterval(updateRoom, 1000);
});

function loadRoomData() {
    const data = localStorage.getItem(`lottery_room_${roomId}`);
    if (!data) {
        alert('找不到房間資料');
        window.location.href = 'index.html';
        return;
    }
    
    roomData = JSON.parse(data);
    updateRoomDisplay();
}

function updateRoomDisplay() {
    document.getElementById('roomId').textContent = roomId;
    document.getElementById('playerCount').textContent = roomData.players.length;
    
    // 更新已抽出的號碼
    updateDrawnNumbersDisplay();
    
    // 更新玩家列表
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
    // 將房間資料編碼到 URL 中，這樣可以跨裝置使用
    const roomDataEncoded = encodeURIComponent(JSON.stringify({
        id: roomId,
        created: roomData.created
    }));
    const ticketUrl = `${window.location.origin}${window.location.pathname.replace('room.html', 'ticket.html')}?room=${roomId}&data=${roomDataEncoded}`;
    
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
    
    // 從可用數字中移除
    availableNumbers.splice(randomIndex, 1);
    
    // 加入已抽出數字
    roomData.drawnNumbers.push(drawnNumber);
    
    // 更新顯示
    document.getElementById('currentNumber').textContent = drawnNumber;
    
    // 儲存到 localStorage
    saveRoomData();
    
    // 更新顯示
    updateDrawnNumbersDisplay();
    
    // 檢查玩家賓果狀態
    checkAllPlayersBingo();
}

function updateDrawnNumbersDisplay() {
    const container = document.getElementById('drawnNumbersList');
    container.innerHTML = '';
    
    // 按照抽取順序顯示（最新的在前面）
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

function checkAllPlayersBingo() {
    roomData.players.forEach(player => {
        const bingoLines = countBingoLines(player.numbers, roomData.drawnNumbers);
        player.bingoLines = bingoLines;
    });
    
    saveRoomData();
    updatePlayersList();
}

function countBingoLines(playerNumbers, drawnNumbers) {
    let count = 0;
    
    // 檢查橫向
    for (let row = 0; row < 5; row++) {
        let matched = 0;
        for (let col = 0; col < 5; col++) {
            const index = row * 5 + col;
            if (playerNumbers[index] === 0 || drawnNumbers.includes(playerNumbers[index])) {
                matched++;
            }
        }
        if (matched === 5) count++;
    }
    
    // 檢查縱向
    for (let col = 0; col < 5; col++) {
        let matched = 0;
        for (let row = 0; row < 5; row++) {
            const index = row * 5 + col;
            if (playerNumbers[index] === 0 || drawnNumbers.includes(playerNumbers[index])) {
                matched++;
            }
        }
        if (matched === 5) count++;
    }
    
    // 檢查左上到右下對角線
    let diagonal1 = 0;
    for (let i = 0; i < 5; i++) {
        const index = i * 5 + i;
        if (playerNumbers[index] === 0 || drawnNumbers.includes(playerNumbers[index])) {
            diagonal1++;
        }
    }
    if (diagonal1 === 5) count++;
    
    // 檢查右上到左下對角線
    let diagonal2 = 0;
    for (let i = 0; i < 5; i++) {
        const index = i * 5 + (4 - i);
        if (playerNumbers[index] === 0 || drawnNumbers.includes(playerNumbers[index])) {
            diagonal2++;
        }
    }
    if (diagonal2 === 5) count++;
    
    return count;
}

function resetGame() {
    if (!confirm('確定要重新開始遊戲嗎？這將清除所有已抽出的數字。')) {
        return;
    }
    
    roomData.drawnNumbers = [];
    roomData.players.forEach(player => {
        player.bingoLines = 0;
    });
    
    availableNumbers = [];
    for (let i = 1; i <= 99; i++) {
        availableNumbers.push(i);
    }
    
    document.getElementById('currentNumber').textContent = '--';
    
    saveRoomData();
    updateRoomDisplay();
}

function updateRoom() {
    // 重新載入房間資料以同步玩家列表
    const data = localStorage.getItem(`lottery_room_${roomId}`);
    if (data) {
        const latestData = JSON.parse(data);
        
        // 只更新玩家列表，不覆蓋整個 roomData
        if (JSON.stringify(latestData.players) !== JSON.stringify(roomData.players)) {
            roomData.players = latestData.players;
            updatePlayersList();
            document.getElementById('playerCount').textContent = roomData.players.length;
        }
    }
    
    // 同時也將最新資料存入 sessionStorage 供跨分頁使用
    sessionStorage.setItem(`lottery_room_${roomId}_sync`, JSON.stringify(roomData));
}

function saveRoomData() {
    localStorage.setItem(`lottery_room_${roomId}`, JSON.stringify(roomData));
}

// 頁面關閉時清理
window.addEventListener('beforeunload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});
