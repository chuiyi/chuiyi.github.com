// ticket-socket.js - 使用 Socket.IO 的樂透券功能
const socket = io();
let roomId = '';
let playerId = '';
let playerNickname = '';
let playerNumbers = [];
let roomData = null;
let lastBingoCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('room');
    
    if (!roomId) {
        alert('無效的房間 ID');
        window.location.href = 'index-online.html';
        return;
    }
    
    playerId = generatePlayerId();
    
    document.getElementById('nicknameForm').addEventListener('submit', handleNicknameSubmit);
    
    // 監聽 Socket 事件
    setupSocketListeners();
});

function setupSocketListeners() {
    // 當有數字被抽出時
    socket.on('numberDrawn', (data) => {
        if (!roomData) return;
        
        roomData.drawnNumbers = data.drawnNumbers;
        
        if (data.number) {
            document.getElementById('currentDrawNumber').textContent = data.number;
        }
        
        generateBingoGrid();
        updateDrawnHistory();
        updateBingoStatus();
    });
    
    // 當遊戲重置時
    socket.on('gameReset', (data) => {
        if (!roomData) return;
        
        roomData = data.roomData;
        lastBingoCount = 0;
        
        document.getElementById('currentDrawNumber').textContent = '--';
        generateBingoGrid();
        updateDrawnHistory();
        updateBingoStatus();
    });
    
    // 錯誤處理
    socket.on('error', (message) => {
        alert(message);
    });
}

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
    
    // 加入房間
    socket.emit('joinRoom', roomId, (response) => {
        if (!response.success) {
            alert('找不到房間資料，請確認：\n1. 房間連結是否正確\n2. 是否使用正確的 QR Code\n3. 主持人是否已開啟房間');
            return;
        }
        
        roomData = response.roomData;
        
        // 生成樂透券數字
        generateLotteryNumbers();
        
        // 加入玩家到房間
        const player = {
            id: playerId,
            nickname: playerNickname,
            numbers: playerNumbers,
            joinedAt: Date.now(),
            bingoLines: 0
        };
        
        socket.emit('addPlayer', { roomId, player });
        
        // 隱藏暱稱輸入區，顯示樂透券
        document.getElementById('nicknameSection').style.display = 'none';
        document.getElementById('ticketSection').style.display = 'block';
        
        // 更新顯示
        updateTicketDisplay();
    });
}

function generateLotteryNumbers() {
    const numbers = [];
    for (let i = 1; i <= 99; i++) {
        numbers.push(i);
    }
    
    // Fisher-Yates 洗牌演算法
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    
    const selected = numbers.slice(0, 24);
    
    playerNumbers = [];
    let selectedIndex = 0;
    
    for (let i = 0; i < 25; i++) {
        if (i === 12) {
            playerNumbers.push(0);
        } else {
            playerNumbers.push(selected[selectedIndex++]);
        }
    }
}

function updateTicketDisplay() {
    document.getElementById('playerNickname').textContent = playerNickname;
    document.getElementById('roomIdDisplay').textContent = roomId;
    
    generateBingoGrid();
    
    if (roomData.drawnNumbers.length > 0) {
        const lastNumber = roomData.drawnNumbers[roomData.drawnNumbers.length - 1];
        document.getElementById('currentDrawNumber').textContent = lastNumber;
    }
    
    updateDrawnHistory();
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
            cell.classList.add('free');
            cell.classList.add('marked');
            cell.textContent = 'FREE';
        } else {
            cell.textContent = num;
            
            if (roomData.drawnNumbers.includes(num)) {
                cell.classList.add('marked');
            }
        }
        
        grid.appendChild(cell);
    });
}

function updateDrawnHistory() {
    const container = document.getElementById('drawnHistory');
    container.innerHTML = '';
    
    if (roomData.drawnNumbers.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">尚未抽出任何號碼</p>';
        return;
    }
    
    const reversedNumbers = [...roomData.drawnNumbers].reverse();
    reversedNumbers.forEach(num => {
        const badge = document.createElement('div');
        badge.className = 'history-number';
        
        if (playerNumbers.includes(num)) {
            badge.classList.add('matched');
        }
        
        badge.textContent = num;
        container.appendChild(badge);
    });
}

function updateBingoStatus() {
    const bingoLines = countBingoLines();
    document.getElementById('lineCount').textContent = bingoLines;
    
    if (bingoLines > lastBingoCount) {
        showBingoEffect();
        lastBingoCount = bingoLines;
        
        // 通知伺服器
        socket.emit('updateBingo', { roomId, playerId, bingoLines });
    }
}

function countBingoLines() {
    let count = 0;
    const drawnNumbers = roomData.drawnNumbers;
    
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

function showBingoEffect() {
    const effect = document.getElementById('bingoEffect');
    effect.style.display = 'flex';
    
    setTimeout(() => {
        effect.style.display = 'none';
    }, 3000);
}
