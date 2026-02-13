// lottery-socket.js - 使用 Socket.IO 的主頁面功能
const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    const createGameBtn = document.getElementById('createGameBtn');
    createGameBtn.addEventListener('click', createNewGame);
});

function createNewGame() {
    // 向伺服器請求建立房間
    socket.emit('createRoom', (response) => {
        if (response.success) {
            // 跳轉到房間頁面
            window.location.href = `room-online.html?id=${response.roomId}`;
        } else {
            alert('建立房間失敗，請稍後再試');
        }
    });
}
