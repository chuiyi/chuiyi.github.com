// lottery.js - 主頁面功能
document.addEventListener('DOMContentLoaded', () => {
    const createGameBtn = document.getElementById('createGameBtn');
    
    createGameBtn.addEventListener('click', createNewGame);
});

const WORD_POOL = [
    '銀河', '星雲', '彗星', '流星', '黑洞', '白矮星', '超新星', '月光', '晨星', '北斗',
    '海豚', '藍鯨', '海龜', '章魚', '珊瑚', '海葵', '海馬', '海豹', '企鵝', '鯨鯊',
    '獅子', '老虎', '獵豹', '長頸鹿', '斑馬', '大象', '河馬', '袋鼠', '熊貓', '狐狸',
    '松鼠', '刺蝟', '浣熊', '水獺', '鸚鵡', '孔雀', '火鶴', '白鷺', '夜鷹', '蜂鳥',
    '向日葵', '薰衣草', '玫瑰', '茉莉', '百合', '銀杏', '楓葉', '櫻花', '竹子', '松樹',
    '山峰', '峽谷', '瀑布', '湖泊', '河流', '冰川', '沙漠', '草原', '森林', '海岸',
    '琥珀', '翡翠', '水晶', '寶石', '珍珠', '珊瑚玉', '青金石', '紅瑪瑙', '紫水晶', '黑曜石',
    '風鈴', '紙鳶', '書卷', '墨水', '畫筆', '木琴', '小號', '吉他', '鋼琴', '鼓聲',
    '咖啡', '抹茶', '可可', '奶茶', '蜂蜜', '楓糖', '薄荷', '香草', '奶酪', '麵包',
    '日出', '日落', '微風', '晴空', '彩虹', '雲朵', '細雨', '霧氣', '雪花', '雷光'
];

function createNewGame() {
    // 生成唯一的房間 ID
    const roomId = generateRoomId();

    const tickets = generateUniqueTickets(100, WORD_POOL);
    
    // 初始化房間資料
    const roomData = {
        id: roomId,
        created: Date.now(),
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
            claimedBy: null
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
