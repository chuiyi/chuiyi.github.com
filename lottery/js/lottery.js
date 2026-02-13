// lottery.js - 主頁面功能
document.addEventListener('DOMContentLoaded', () => {
    const createGameBtn = document.getElementById('createGameBtn');
    
    createGameBtn.addEventListener('click', createNewGame);
});

function createNewGame() {
    // 生成唯一的房間 ID
    const roomId = generateRoomId();
    
    // 初始化房間資料
    const roomData = {
        id: roomId,
        created: Date.now(),
        players: [],
        drawnNumbers: [],
        status: 'active'
    };
    
    // 儲存到 localStorage
    localStorage.setItem(`lottery_room_${roomId}`, JSON.stringify(roomData));
    
    // 跳轉到房間頁面
    window.location.href = `room.html?id=${roomId}`;
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
