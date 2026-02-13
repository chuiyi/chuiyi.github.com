// ticket.js - 樂透券功能（玩家介面）
let roomId = '';
let playerId = '';
let playerNickname = '';
let playerNumbers = [];
let markedIndices = [];
let ticketWord = '';
let ticketId = '';
let hasTicket = false;
let roomData = null;
let updateInterval = null;
let lastBingoCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    // 從 URL 取得房間 ID
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('room');
    
    if (!roomId) {
        alert('無效的房間 ID');
        window.location.href = 'index.html';
        return;
    }
    
    // 生成玩家 ID
    playerId = generatePlayerId();
    
    // 綁定暱稱表單
    document.getElementById('nicknameForm').addEventListener('submit', handleNicknameSubmit);

    // 綁定抽取樂透券按鈕
    document.getElementById('drawTicketBtn').addEventListener('click', drawTicket);
    
    // 開始定期更新
    updateInterval = setInterval(updateTicket, 1000);
});

function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function handleNicknameSubmit(e) {
    e.preventDefault();
    
    const nicknameInput = document.getElementById('nicknameInput');
    playerNickname = nicknameInput.value.trim();
    
    if (!playerNickname) {
        alert('請輸入暱稱');
        return;
    }
    
    // 載入房間資料
    loadRoomData();
    
    // 隱藏暱稱輸入區，顯示樂透券
    document.getElementById('nicknameSection').style.display = 'none';
    document.getElementById('ticketSection').style.display = 'block';
    
    // 更新顯示
    updateTicketDisplay();
}

function loadRoomData() {
    const data = localStorage.getItem(`lottery_room_${roomId}`);
    if (!data) {
        alert('找不到房間資料。請確認：\n1. 房間連結是否正確\n2. 是否使用正確的 QR Code');
        return;
    }
    
    roomData = JSON.parse(data);
}

function drawTicket() {
    if (!roomData || !roomData.tickets) {
        alert('房間未建立票券資料，請重新建立房間。');
        return;
    }

    if (hasTicket) {
        return;
    }

    const availableTickets = roomData.tickets.filter(ticket => !ticket.claimedBy);
    if (availableTickets.length === 0) {
        alert('票券已被抽完，無法再抽取。');
        return;
    }

    const randomIndex = Math.floor(Math.random() * availableTickets.length);
    const ticket = availableTickets[randomIndex];

    ticketId = ticket.id;
    ticketWord = ticket.word;
    playerNumbers = ticket.numbers;
    markedIndices = Array(25).fill(false);
    markedIndices[12] = true;
    hasTicket = true;

    ticket.claimedBy = playerId;

    const player = {
        id: playerId,
        nickname: playerNickname,
        numbers: playerNumbers,
        ticketId,
        ticketWord,
        markedIndices,
        joinedAt: Date.now(),
        bingoLines: 0
    };

    roomData.players.push(player);
    saveRoomData();

    document.getElementById('ticketWordDisplay').textContent = ticketWord;
    const drawBtn = document.getElementById('drawTicketBtn');
    drawBtn.textContent = '✅ 已抽取';
    drawBtn.disabled = true;

    updateTicketDisplay();
}

function updateTicketDisplay() {
    // 更新玩家資訊
    document.getElementById('playerNickname').textContent = playerNickname;
    document.getElementById('roomIdDisplay').textContent = roomId;

    if (ticketWord) {
        document.getElementById('ticketWordDisplay').textContent = ticketWord;
    }
    
    // 生成賓果格子
    if (hasTicket) {
        generateBingoGrid();
    }
    
    // 更新當前號碼
    const drawnNumbers = roomData.drawnNumbers || [];
    if (drawnNumbers.length > 0) {
        const lastNumber = drawnNumbers[drawnNumbers.length - 1];
        document.getElementById('currentDrawNumber').textContent = lastNumber;
    } else {
        document.getElementById('currentDrawNumber').textContent = '--';
    }
    
    // 更新已抽出號碼歷史
    updateDrawnHistory();
    
    // 更新賓果狀態
    updateBingoStatus();
}

function generateBingoGrid() {
    const grid = document.getElementById('bingoGrid');
    grid.innerHTML = '';
    
    playerNumbers.forEach((num, index) => {
        const cell = document.createElement('div');
        cell.className = 'bingo-cell';
        cell.dataset.index = index;
        
        if (num === 0) {
            // 萬用格
            cell.classList.add('free');
            cell.classList.add('marked');
            cell.textContent = 'FREE';
        } else {
            cell.textContent = num;
            cell.classList.add('clickable');

            if (markedIndices[index]) {
                cell.classList.add('marked');
            }

            cell.addEventListener('click', () => {
                toggleCellMark(index, cell);
            });
        }
        
        grid.appendChild(cell);
    });
}

function toggleCellMark(index, cell) {
    markedIndices[index] = !markedIndices[index];
    cell.classList.toggle('marked', markedIndices[index]);

    updateBingoStatus();
    persistPlayerState();
}

function updateDrawnHistory() {
    const container = document.getElementById('drawnHistory');
    container.innerHTML = '';
    const drawnNumbers = roomData.drawnNumbers || [];
    
    if (drawnNumbers.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">尚未抽出任何號碼</p>';
        return;
    }
    
    // 按照抽取順序顯示（最新的在前面）
    const reversedNumbers = [...drawnNumbers].reverse();
    reversedNumbers.forEach(num => {
        const badge = document.createElement('div');
        badge.className = 'history-number';
        
        // 如果這個號碼在玩家的樂透券上，標記為 matched
        if (playerNumbers.includes(num)) {
            badge.classList.add('matched');
        }
        
        badge.textContent = num;
        container.appendChild(badge);
    });
}

function updateBingoStatus() {
    if (!hasTicket) {
        return;
    }

    const bingoLines = countBingoLines();
    document.getElementById('lineCount').textContent = bingoLines;
    
    // 如果有新的賓果，顯示特效
    if (bingoLines > lastBingoCount) {
        showBingoEffect();
        lastBingoCount = bingoLines;
        
        // 更新玩家在房間中的賓果狀態
        updatePlayerBingoInRoom(bingoLines);
    }
}

function countBingoLines() {
    let count = 0;
    const marks = markedIndices;
    
    // 檢查橫向
    for (let row = 0; row < 5; row++) {
        let matched = 0;
        for (let col = 0; col < 5; col++) {
            const index = row * 5 + col;
            if (playerNumbers[index] === 0 || marks[index]) {
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
            if (playerNumbers[index] === 0 || marks[index]) {
                matched++;
            }
        }
        if (matched === 5) count++;
    }
    
    // 檢查左上到右下對角線
    let diagonal1 = 0;
    for (let i = 0; i < 5; i++) {
        const index = i * 5 + i;
        if (playerNumbers[index] === 0 || marks[index]) {
            diagonal1++;
        }
    }
    if (diagonal1 === 5) count++;
    
    // 檢查右上到左下對角線
    let diagonal2 = 0;
    for (let i = 0; i < 5; i++) {
        const index = i * 5 + (4 - i);
        if (playerNumbers[index] === 0 || marks[index]) {
            diagonal2++;
        }
    }
    if (diagonal2 === 5) count++;
    
    return count;
}

function showBingoEffect() {
    const effect = document.getElementById('bingoEffect');
    effect.style.display = 'flex';
    
    // 3 秒後自動隱藏
    setTimeout(() => {
        effect.style.display = 'none';
    }, 3000);
}

function updatePlayerBingoInRoom(bingoLines) {
    const player = roomData.players.find(p => p.id === playerId);
    if (player) {
        player.bingoLines = bingoLines;
        player.markedIndices = markedIndices;
        saveRoomData();
    }
}

function persistPlayerState() {
    const player = roomData.players.find(p => p.id === playerId);
    if (player) {
        player.markedIndices = markedIndices;
        saveRoomData();
    }
}

function updateTicket() {
    // 重新載入房間資料以同步抽出的數字
    const data = localStorage.getItem(`lottery_room_${roomId}`);
    if (!data) {
        return;
    }
    
    const latestData = JSON.parse(data);
    
    if (!roomData) {
        roomData = latestData;
    }
    
    // 檢查是否有新的抽出數字
    if (JSON.stringify(latestData.drawnNumbers) !== JSON.stringify(roomData.drawnNumbers)) {
        roomData.drawnNumbers = latestData.drawnNumbers || [];
        
        // 更新顯示
        if (roomData.drawnNumbers.length > 0) {
            const lastNumber = roomData.drawnNumbers[roomData.drawnNumbers.length - 1];
            document.getElementById('currentDrawNumber').textContent = lastNumber;
        }
        
        // 更新歷史記錄
        updateDrawnHistory();
    }
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
