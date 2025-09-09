const express = require('express');
const path = require('path');
const app = express();
const PORT = 13145;

// 設置靜態文件目錄
app.use(express.static(path.join(__dirname)));

// 設置正確的 MIME 類型
app.use((req, res, next) => {
    if (req.path.endsWith('.js')) {
        res.type('application/javascript');
    } else if (req.path.endsWith('.css')) {
        res.type('text/css');
    } else if (req.path.endsWith('.md')) {
        res.type('text/markdown');
    } else if (req.path.endsWith('.png')) {
        res.type('image/png');
    } else if (req.path.endsWith('.jpg') || req.path.endsWith('.jpeg')) {
        res.type('image/jpeg');
    } else if (req.path.endsWith('.ico')) {
        res.type('image/x-icon');
    } else if (req.path.endsWith('.svg')) {
        res.type('image/svg+xml');
    }
    next();
});

// 處理 favicon 請求
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'assets/images/favicon.ico'));
});

// 處理 SPA 路由，所有路由都返回 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 處理 movie.html 路由
app.get('/movie.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'movie.html'));
});

// 處理所有其他路由，回退到 index.html
app.get('*', (req, res) => {
    // 如果是 API 請求或文件請求，不重定向
    if (req.path.startsWith('/api/') || 
        req.path.includes('.') && !req.path.endsWith('.html')) {
        res.status(404).send('File not found');
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send('Internal Server Error');
});

// 啟動服務器
app.listen(PORT, () => {
    console.log(`🚀 Chuiyi's Website Server 啟動成功！`);
    console.log(`📱 本地網址: http://localhost:${PORT}`);
    console.log(`🌐 網路網址: http://127.0.0.1:${PORT}`);
    console.log(`📂 服務目錄: ${__dirname}`);
    console.log(`⏰ 啟動時間: ${new Date().toLocaleString('zh-TW')}`);
    console.log('');
    console.log('📋 可用路由:');
    console.log(`   - 首頁: http://localhost:${PORT}/`);
    console.log(`   - 電影頁面: http://localhost:${PORT}/movie.html`);
    console.log(`   - 靜態資源: http://localhost:${PORT}/assets/`);
    console.log('');
    console.log('🔧 使用 Ctrl+C 來停止服務器');
});

// 優雅關閉
process.on('SIGINT', () => {
    console.log('\n🛑 正在關閉服務器...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 正在關閉服務器...');
    process.exit(0);
});
