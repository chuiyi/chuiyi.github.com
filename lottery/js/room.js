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

    if (!roomData.tickets) {
        const maxPlayers = roomData.maxPlayers || 20;
        const wordPool = buildWordPool();
        const selectedWords = pickRandomWords(maxPlayers, wordPool);
        roomData.tickets = generateUniqueTickets(maxPlayers, selectedWords);
        saveRoomData();
    }

    updateRoomDisplay();
}

function updateRoomDisplay() {
    document.getElementById('roomId').textContent = roomId;
    document.getElementById('playerCount').textContent = roomData.players.length;
    
    // 更新已抽出的號碼
    updateDrawnNumbersDisplay();
    
    // 更新玩家列表
    updatePlayersList();

    // 更新專用詞列表與指派
    updateWordPoolList();
    updateAssignList();
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
    const ticketUrl = `${window.location.origin}${window.location.pathname.replace('room.html', 'ticket.html')}?room=${roomId}`;
    
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
        const wordText = player.ticketWord ? `（${player.ticketWord}）` : '（尚未抽取）';
        nameSpan.textContent = `${player.nickname}${wordText}`;
        
        playerDiv.appendChild(nameSpan);
        
        // 如果玩家有賓果，顯示徽章
        if (player.bingoLines && player.bingoLines > 0) {
            const bingoBadge = document.createElement('span');
            bingoBadge.className = 'bingo-badge';
            const badgeWord = player.ticketWord ? ` - ${player.ticketWord}` : '';
            bingoBadge.textContent = `🎉 BINGO x${player.bingoLines}${badgeWord}`;
            playerDiv.appendChild(bingoBadge);
        }
        
        container.appendChild(playerDiv);
    });
}

function updateWordPoolList() {
    const container = document.getElementById('wordPoolList');
    if (!container) return;

    const tickets = roomData.tickets || [];
    if (tickets.length === 0) {
        container.innerHTML = '<p class="empty-message">尚未建立專用詞</p>';
        return;
    }

    container.innerHTML = '';
    tickets.forEach((ticket) => {
        const item = document.createElement('div');
        const isAssigned = Boolean(ticket.assignedTo);
        const assignedPlayer = ticket.assignedTo
            ? roomData.players.find(p => p.id === ticket.assignedTo)?.nickname
            : '';

        item.className = `word-item${isAssigned ? ' assigned' : ''}`;

        const tag = document.createElement('span');
        tag.className = 'word-tag';
        tag.textContent = ticket.word;

        const status = document.createElement('span');
        status.className = `word-status${isAssigned ? ' assigned' : ''}`;
        status.textContent = isAssigned ? `已指派：${assignedPlayer || '玩家'}` : '未指派';

        item.appendChild(tag);
        item.appendChild(status);
        container.appendChild(item);
    });
}

function updateAssignList() {
    const container = document.getElementById('assignList');
    if (!container) return;

    if (roomData.players.length === 0) {
        container.innerHTML = '<p class="empty-message">尚無玩家加入...</p>';
        return;
    }

    container.innerHTML = '';
    roomData.players.forEach(player => {
        const row = document.createElement('div');
        row.className = 'assign-row';

        const name = document.createElement('span');
        name.className = 'assign-name';
        name.textContent = player.nickname;

        const select = document.createElement('select');
        select.className = 'assign-select';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = player.ticketWord ? `目前：${player.ticketWord}` : '選擇專用詞';
        select.appendChild(defaultOption);

        roomData.tickets.forEach((ticket, index) => {
            if (ticket.assignedTo && ticket.assignedTo !== player.id) return;
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = `${ticket.word} (${ticket.id})`;
            select.appendChild(option);
        });

        const button = document.createElement('button');
        button.className = 'assign-btn';
        button.textContent = '指派';

        button.addEventListener('click', () => {
            if (!select.value) return;
            const ticketIndex = Number(select.value);
            const ticket = roomData.tickets[ticketIndex];
            if (!ticket) return;

            ticket.assignedTo = player.id;
            if (!ticket.claimedBy) {
                ticket.claimedBy = player.id;
            }

            player.ticketId = ticket.id;
            player.ticketWord = ticket.word;

            saveRoomData();
            updateRoomDisplay();
        });

        row.appendChild(name);
        row.appendChild(select);
        row.appendChild(button);
        container.appendChild(row);
    });
}

function generateUniqueTickets(count, words) {
    const tickets = [];
    const used = new Set();

    for (let i = 0; i < count; i++) {
        let numbers = [];
        let key = '';
        let attempts = 0;

        do {
            numbers = generateTicketNumbers();
            key = numbers.join('-');
            attempts++;
        } while (used.has(key) && attempts < 500);

        used.add(key);

        tickets.push({
            id: `T${String(i + 1).padStart(3, '0')}`,
            word: words[i] || `詞彙${i + 1}`,
            numbers,
            claimedBy: null,
            assignedTo: null
        });
    }

    return tickets;
}

function buildWordPool() {
    const adjectives = [
        '星光', '月影', '晨曦', '晚霞', '彩虹', '微風', '晴空', '霧語', '雪舞', '雷鳴',
        '海風', '潮汐', '雲朵', '雨滴', '露珠', '晨露', '暮色', '流星', '彗光', '極光',
        '銀河', '星雲', '太陽', '琥珀', '翡翠'
    ];
    const nouns = [
        '小鹿', '海豚', '藍鯨', '白狐', '松鼠', '刺蝟', '浣熊', '水獺', '鸚鵡', '蜂鳥',
        '向日葵', '薰衣草', '玫瑰', '茉莉', '百合', '銀杏', '楓葉', '櫻花', '竹林', '松林'
    ];

    const pool = [];
    adjectives.forEach(adj => {
        nouns.forEach(noun => {
            pool.push(`${adj}${noun}`);
        });
    });

    return pool;
}

function pickRandomWords(count, pool) {
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
}

function generateTicketNumbers() {
    const numbers = [];
    for (let i = 1; i <= 99; i++) {
        numbers.push(i);
    }

    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    const selected = numbers.slice(0, 24);
    const gridNumbers = [];
    let selectedIndex = 0;

    for (let i = 0; i < 25; i++) {
        if (i === 12) {
            gridNumbers.push(0);
        } else {
            gridNumbers.push(selected[selectedIndex++]);
        }
    }

    return gridNumbers;
}

function resetGame() {
    if (!confirm('確定要重新開始遊戲嗎？這將清除所有已抽出的數字。')) {
        return;
    }
    
    roomData.drawnNumbers = [];
    roomData.players.forEach(player => {
        player.bingoLines = 0;
        player.markedIndices = Array(25).fill(false);
        player.markedIndices[12] = true;
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

        if (JSON.stringify(latestData.tickets) !== JSON.stringify(roomData.tickets)) {
            roomData.tickets = latestData.tickets;
            updateWordPoolList();
            updateAssignList();
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
