// ticket-firebase.js - 使用 Firebase 的樂透券功能
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, onValue, set, update } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

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
let playerId = '';
let playerNickname = '';
let playerNumbers = [];
let roomData = null;
let lastBingoCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    // 從 URL 取得房間 ID
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('room');
    
    if (!roomId) {
        alert('無效的房間 ID');
        window.location.href = 'index-firebase.html';
        return;
    }
    
    // 生成玩家 ID
    playerId = generatePlayerId();
    
    // 綁定暱稱表單
    document.getElementById('nicknameForm').addEventListener('submit', handleNicknameSubmit);
});

function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function handleNicknameSubmit(e) {
    e.preventDefault();
    
    const nicknameInput = document.getElementById('nicknameInput');
    playerNickname = nicknameInput.value.trim();
    
    if (!playerNickname) {
        alert('請輸入暱稱');
        return;
    }
    
    try {
        // 檢查房間是否存在
        const roomRef = ref(database, `rooms/${roomId}`);
        const snapshot = await new Promise((resolve) => {
            onValue(roomRef, resolve, { onlyOnce: true });
        });
        
        if (!snapshot.val()) {
            alert('找不到房間資料，請確認：\n1. 房間連結是否正確\n2. 是否使用正確的 QR Code\n3. 主持人是否已開啟房間');
            return;
        }
        
        // 生成樂透券數字
        generateLotteryNumbers();
        
        // 加入玩家到房間
        await set(ref(database, `rooms/${roomId}/players/${playerId}`), {
            id: playerId,
            nickname: playerNickname,
            numbers: playerNumbers,
            joinedAt: Date.now(),
            bingoLines: 0
        });
        
        // 開始監聽房間資料變化
        onValue(ref(database, `rooms/${roomId}`), (snapshot) => {
            const data = snapshot.val();
            if (data) {
                roomData = data;
                if (document.getElementById('ticketSection').style.display !== 'none') {
                    updateTicketDisplay();
                }
            }
        });
        
        // 隱藏暱稱輸入區，顯示樂透券
        document.getElementById('nicknameSection').style.display = 'none';
        document.getElementById('ticketSection').style.display = 'block';
        
        // 初始化顯示
        roomData = snapshot.val();
        updateTicketDisplay();
        
    } catch (error) {
        console.error('加入遊戲失敗:', error);
        alert('加入遊戲失敗，請檢查網路連線');
    }
}

function generateLotteryNumbers() {
    // 從 1-99 隨機選取 24 個不重複的數字
    const numbers = [];
    for (let i = 1; i <= 99; i++) {
        numbers.push(i);
    }
    
    // Fisher-Yates 洗牌演算法
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    
    // 取前 24 個數字
    const selected = numbers.slice(0, 24);
    
    // 建立 5x5 陣列，中間格子（索引 12）為 0（萬用格）
    playerNumbers = [];
    let selectedIndex = 0;
    
    for (let i = 0; i < 25; i++) {
        if (i === 12) {
            // 中間格子為萬用格
            playerNumbers.push(0);
        } else {
            playerNumbers.push(selected[selectedIndex++]);
        }
    }
}

function updateTicketDisplay() {
    // 更新玩家資訊
    document.getElementById('playerNickname').textContent = playerNickname;
    document.getElementById('roomIdDisplay').textContent = roomId;
    
    // 生成賓果格子
    generateBingoGrid();
    
    // 更新當前號碼
    if (roomData.drawnNumbers && roomData.drawnNumbers.length > 0) {
        const lastNumber = roomData.drawnNumbers[roomData.drawnNumbers.length - 1];
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
            
            // 檢查是否已被抽中
            if (roomData.drawnNumbers && roomData.drawnNumbers.includes(num)) {
                cell.classList.add('marked');
            }
        }
        
        grid.appendChild(cell);
    });
}

function updateDrawnHistory() {
    const container = document.getElementById('drawnHistory');
    container.innerHTML = '';
    
    if (!roomData.drawnNumbers || roomData.drawnNumbers.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">尚未抽出任何號碼</p>';
        return;
    }
    
    // 按照抽取順序顯示（最新的在前面）
    const reversedNumbers = [...roomData.drawnNumbers].reverse();
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

async function updateBingoStatus() {
    const bingoLines = countBingoLines();
    document.getElementById('lineCount').textContent = bingoLines;
    
    // 如果有新的賓果，顯示特效
    if (bingoLines > lastBingoCount) {
        showBingoEffect();
        lastBingoCount = bingoLines;
        
        // 更新到 Firebase
        await update(ref(database, `rooms/${roomId}/players/${playerId}`), {
            bingoLines: bingoLines
        });
    }
}

function countBingoLines() {
    let count = 0;
    const drawnNumbers = roomData.drawnNumbers || [];
    
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
    
    // 3 秒後自動隱藏
    setTimeout(() => {
        effect.style.display = 'none';
    }, 3000);
}
