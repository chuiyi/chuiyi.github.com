/**
 * 樂透賓果遊戲 - 後端伺服器範例
 * 
 * 此檔案提供一個簡單的 Node.js + Socket.IO 伺服器
 * 可實現真正的跨裝置即時同步
 * 
 * 安裝方式：
 * npm install express socket.io
 * 
 * 啟動方式：
 * node server-example.js
 * 
 * 然後修改前端 JS 檔案，將 localStorage 操作改為 socket.emit/on
 */

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// 儲存所有房間資料（實際應用中應使用 Redis 或資料庫）
const rooms = new Map();

// 提供靜態檔案
app.use(express.static(path.join(__dirname)));

// 重定向主頁到線上版本
app.get('/', (req, res) => {
    res.redirect('/index-online.html');
});

// Socket.IO 連線處理
io.on('connection', (socket) => {
    console.log('新客戶端連線:', socket.id);
    
    // 建立房間
    socket.on('createRoom', (callback) => {
        const roomId = generateRoomId();
        const roomData = {
            id: roomId,
            created: Date.now(),
            players: [],
            drawnNumbers: [],
            status: 'active'
        };
        
        rooms.set(roomId, roomData);
        socket.join(roomId);
        
        console.log('建立房間:', roomId);
        callback({ success: true, roomId, roomData });
    });
    
    // 加入房間
    socket.on('joinRoom', (roomId, callback) => {
        const room = rooms.get(roomId);
        
        if (!room) {
            callback({ success: false, error: '找不到房間' });
            return;
        }
        
        socket.join(roomId);
        callback({ success: true, roomData: room });
        console.log('玩家加入房間:', roomId);
    });
    
    // 玩家加入遊戲
    socket.on('addPlayer', ({ roomId, player }) => {
        const room = rooms.get(roomId);
        
        if (!room) {
            socket.emit('error', '找不到房間');
            return;
        }
        
        room.players.push(player);
        
        // 廣播給房間內所有人
        io.to(roomId).emit('playerJoined', { player, players: room.players });
        console.log('玩家加入遊戲:', player.nickname, '房間:', roomId);
    });
    
    // 抽取數字
    socket.on('drawNumber', ({ roomId, number }) => {
        const room = rooms.get(roomId);
        
        if (!room) {
            socket.emit('error', '找不到房間');
            return;
        }
        
        room.drawnNumbers.push(number);
        
        // 廣播給房間內所有人
        io.to(roomId).emit('numberDrawn', {
            number,
            drawnNumbers: room.drawnNumbers
        });
        
        console.log('抽取數字:', number, '房間:', roomId);
    });
    
    // 更新玩家賓果狀態
    socket.on('updateBingo', ({ roomId, playerId, bingoLines }) => {
        const room = rooms.get(roomId);
        
        if (!room) {
            socket.emit('error', '找不到房間');
            return;
        }
        
        const player = room.players.find(p => p.id === playerId);
        if (player) {
            player.bingoLines = bingoLines;
            
            // 廣播給房間內所有人
            io.to(roomId).emit('bingoUpdated', {
                playerId,
                bingoLines,
                players: room.players
            });
            
            console.log('玩家賓果:', playerId, '線數:', bingoLines);
        }
    });
    
    // 重置遊戲
    socket.on('resetGame', (roomId) => {
        const room = rooms.get(roomId);
        
        if (!room) {
            socket.emit('error', '找不到房間');
            return;
        }
        
        room.drawnNumbers = [];
        room.players.forEach(player => {
            player.bingoLines = 0;
        });
        
        // 廣播給房間內所有人
        io.to(roomId).emit('gameReset', { roomData: room });
        
        console.log('重置遊戲:', roomId);
    });
    
    // 斷線處理
    socket.on('disconnect', () => {
        console.log('客戶端斷線:', socket.id);
    });
});

// 生成房間 ID
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let roomId = '';
    for (let i = 0; i < 6; i++) {
        roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // 確保 ID 唯一
    if (rooms.has(roomId)) {
        return generateRoomId();
    }
    
    return roomId;
}

// 定期清理過期房間（超過 24 小時）
setInterval(() => {
    const now = Date.now();
    const expireTime = 24 * 60 * 60 * 1000; // 24 小時
    
    for (const [roomId, room] of rooms.entries()) {
        if (now - room.created > expireTime) {
            rooms.delete(roomId);
            console.log('清理過期房間:', roomId);
        }
    }
}, 60 * 60 * 1000); // 每小時檢查一次

server.listen(PORT, () => {
    console.log(`樂透賓果伺服器運行在 http://localhost:${PORT}`);
    console.log('按 Ctrl+C 停止伺服器');
});
