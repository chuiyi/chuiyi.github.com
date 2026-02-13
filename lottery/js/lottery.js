// lottery.js - 主頁面功能
document.addEventListener('DOMContentLoaded', () => {
    const createGameBtn = document.getElementById('createGameBtn');
    
    createGameBtn.addEventListener('click', createNewGame);
});

function createNewGame() {
    // 生成唯一的房間 ID
    const roomId = generateRoomId();

    const playerCount = getPlayerCount();
    const wordPool = buildWordPool();
    const selectedWords = pickRandomWords(playerCount, wordPool);
    const tickets = generateUniqueTickets(playerCount, selectedWords);
    
    // 初始化房間資料
    const roomData = {
        id: roomId,
        created: Date.now(),
        maxPlayers: playerCount,
        tickets,
        players: [],
        drawnNumbers: [],
        status: 'active'
    };
    
    // 儲存到 localStorage
    localStorage.setItem(`lottery_room_${roomId}`, JSON.stringify(roomData));
    
    // 跳轉到房間頁面
    window.location.href = `room.html?id=${roomId}`;
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

function generateRoomId() {
    // 生成 6 位隨機房間 ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let roomId = '';
    for (let i = 0; i < 6; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return roomId;
}

function getPlayerCount() {
    const input = document.getElementById('playerCountInput');
    const value = Number(input?.value) || 20;
    return Math.min(Math.max(value, 1), 100);
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
