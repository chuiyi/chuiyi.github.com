/**
 * Jable.tv 流媒體連結提取 Console 測試腳本
 * 
 * 使用方法:
 * 1. 打開 jable.tv 網站的任何視頻頁面
 * 2. 按 F12 打開開發者工具
 * 3. 切換到 Console 標籤
 * 4. 複製並粘貼以下代碼
 * 5. 按 Enter 執行
 */

// ==================== 配置 ====================
const CONFIG = {
    // 提取 M3U8 的激進模式
    m3u8Patterns: [
        /https?:\/\/[^\s"'<>]+\.m3u8(?:[^\s"'<>]*)?/gi,
        /["']?(https?:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*)["']?/gi,
    ],
    // 提取 MP4 的模式
    mp4Pattern: /https?:\/\/[^\s"'<>]+\.mp4/gi,
    // JavaScript 配置模式
    jsConfigPatterns: [
        /(?:player|video|stream|src|url)[\s]*[:=][\s]*["']([^"']*(?:\.m3u8|\.mp4)[^"']*)["']/gi,
        /m3u8\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/gi,
    ]
};

// ==================== 日誌輔助函數 ====================
const logger = {
    log: (msg, type = 'info') => {
        const colors = {
            'success': 'color: green; font-weight: bold;',
            'error': 'color: red; font-weight: bold;',
            'info': 'color: blue;',
            'warning': 'color: orange; font-weight: bold;',
        };
        console.log(`%c[${type.toUpperCase()}] ${msg}`, colors[type] || '');
    },
    group: (title) => console.group(`%c${title}`, 'color: blue; font-weight: bold;'),
    groupEnd: () => console.groupEnd(),
    table: (data) => console.table(data)
};

// ==================== 提取函數 ====================

/**
 * 從 HTML 中提取所有流媒體連結
 */
async function extractStreams(pageUrl = window.location.href) {
    logger.log('開始提取流媒體連結...', 'info');
    logger.log(`目標 URL: ${pageUrl}`, 'info');
    
    try {
        let html;
        
        // 嘗試直接 fetch
        try {
            logger.log('嘗試直接 fetch 頁面...', 'info');
            const response = await fetch(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.ok) {
                html = await response.text();
                logger.log(`✓ 直接 fetch 成功! 頁面大小: ${html.length} 字元`, 'success');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            logger.log(`直接 fetch 失敗: ${error.message}`, 'warning');
            logger.log('嘗試使用 Jina 代理...', 'info');
            
            const jinaUrl = `https://r.jina.ai/${pageUrl}`;
            const response = await fetch(jinaUrl);
            if (!response.ok) {
                throw new Error('Jina 代理也失敗');
            }
            html = await response.text();
            logger.log(`✓ Jina 代理成功! 內容大小: ${html.length} 字元`, 'success');
        }
        
        // 提取流媒體連結
        const streams = extractFromHtml(html);
        return streams;
        
    } catch (error) {
        logger.log(`❌ 錯誤: ${error.message}`, 'error');
        return [];
    }
}

/**
 * 從 HTML 字符串中提取流媒體連結
 */
function extractFromHtml(html) {
    logger.group('流媒體連結提取結果');
    
    const results = {
        m3u8: [],
        mp4: [],
        other: [],
        javascript: [],
    };
    
    // 提取 M3U8
    logger.log('搜索 M3U8 連結...', 'info');
    CONFIG.m3u8Patterns.forEach((pattern, idx) => {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const url = (match[1] || match[0]).replace(/["';]$/, '');
            if (url.endsWith('.m3u8') && !results.m3u8.includes(url)) {
                results.m3u8.push(url);
                logger.log(`✓ 找到 M3U8: ${url.substring(0, 80)}...`, 'success');
            }
        }
    });
    
    // 提取 MP4
    logger.log(`\n搜索 MP4 連結...`, 'info');
    let mp4Match;
    while ((mp4Match = CONFIG.mp4Pattern.exec(html)) !== null) {
        if (!results.mp4.includes(mp4Match[0])) {
            results.mp4.push(mp4Match[0]);
            logger.log(`✓ 找到 MP4: ${mp4Match[0].substring(0, 80)}...`, 'success');
        }
    }
    
    // 提取 JavaScript 配置
    logger.log(`\n搜索 JavaScript 配置...`, 'info');
    CONFIG.jsConfigPatterns.forEach((pattern) => {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const url = match[1];
            if (url && !results.javascript.includes(url)) {
                results.javascript.push(url);
                logger.log(`✓ 找到 JS 配置: ${url.substring(0, 80)}...`, 'success');
            }
        }
    });
    
    // 摘要
    logger.log(`\n========== 摘要 ==========`, 'info');
    logger.log(`M3U8 連結: ${results.m3u8.length} 個`, 'info');
    logger.log(`MP4 連結: ${results.mp4.length} 個`, 'info');
    logger.log(`JavaScript 配置: ${results.javascript.length} 個`, 'info');
    logger.log(`總計: ${results.m3u8.length + results.mp4.length + results.javascript.length} 個`, 'success');
    
    logger.groupEnd();
    
    return results;
}

/**
 * 測試流媒體連結是否可訪問
 */
async function testStream(url, timeout = 5000) {
    logger.log(`\n測試 URL: ${url}`, 'info');
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal
        }).catch(() => fetch(url, { signal: controller.signal }));
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            logger.log(`✓ URL 可訪問! (狀態: ${response.status})`, 'success');
            logger.log(`內容類型: ${response.headers.get('content-type')}`, 'info');
            logger.log(`內容大小: ${response.headers.get('content-length')} 字元`, 'info');
            return true;
        } else {
            logger.log(`⚠ URL 返回狀態 ${response.status}`, 'warning');
            return false;
        }
    } catch (error) {
        logger.log(`❌ 無法訪問: ${error.message}`, 'error');
        return false;
    }
}

/**
 * 在播放器中測試流媒體
 */
function testPlayback(m3u8Url) {
    logger.log(`\n在播放器中測試: ${m3u8Url}`, 'info');
    
    // 移除舊播放器
    const old = document.getElementById('test-stream-player');
    if (old) old.remove();
    
    // 創建播放器容器
    const container = document.createElement('div');
    container.id = 'test-stream-player';
    container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 400px;
        height: 300px;
        background: black;
        border: 2px solid white;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;
    
    // 創建視頻標籤
    const video = document.createElement('video');
    video.src = m3u8Url;
    video.controls = true;
    video.autoplay = true;
    video.style.cssText = 'width: 100%; height: 100%; border-radius: 6px;';
    
    container.appendChild(video);
    document.body.appendChild(container);
    
    logger.log('✓ 播放器已打開（右下角）', 'success');
    logger.log('✓ 按空格鍵播放/暫停，按 Esc 關閉', 'info');
    
    // ESC 鍵關閉
    const closePlayer = (e) => {
        if (e.key === 'Escape') {
            container.remove();
            document.removeEventListener('keydown', closePlayer);
            logger.log('播放器已關閉', 'info');
        }
    };
    document.addEventListener('keydown', closePlayer);
}

/**
 * 複製 URL 到剪貼簿
 */
async function copyUrl(url) {
    try {
        await navigator.clipboard.writeText(url);
        logger.log(`✓ URL 已複製到剪貼簿`, 'success');
    } catch (error) {
        logger.log(`❌ 複製失敗: ${error.message}`, 'error');
    }
}

// ==================== 主程序 ====================

// 在全局作用域中暴露函數
window.streamExtractor = {
    extract: extractStreams,
    test: testStream,
    play: testPlayback,
    copy: copyUrl,
};

logger.log('✅ 流媒體提取工具已加載!', 'success');
logger.log('可用命令:', 'info');
logger.log('  streamExtractor.extract() - 提取當前頁面的流媒體', 'info');
logger.log('  streamExtractor.test(url) - 測試 URL 是否可訪問', 'info');
logger.log('  streamExtractor.play(m3u8Url) - 在播放器中播放', 'info');
logger.log('  streamExtractor.copy(url) - 複製 URL', 'info');
logger.log('\n例如:', 'info');
logger.log('  const streams = await streamExtractor.extract();', 'info');
logger.log('  await streamExtractor.test(streams.m3u8[0]);', 'info');
logger.log('  streamExtractor.play(streams.m3u8[0]);', 'info');

// 自動提取當前頁面
console.log('\n');
console.log('%c正在自動提取當前頁面的流媒體連結...', 'color: blue; font-size: 14px; font-weight: bold;');
extractStreams().then(results => {
    if (results.m3u8.length > 0) {
        console.log('%c✓ 找到可播放的 M3U8 連結!', 'color: green; font-size: 12px; font-weight: bold;');
        console.table(results.m3u8.map((url, idx) => ({
            'index': idx + 1,
            'type': 'M3U8',
            'url': url,
            'action': `streamExtractor.play('${url}')`
        })));
    } else {
        console.log('%c⚠ 未找到 M3U8 連結', 'color: orange; font-size: 12px; font-weight: bold;');
    }
    
    if (results.mp4.length > 0) {
        console.log('%c✓ 找到 MP4 連結!', 'color: green; font-size: 12px; font-weight: bold;');
        console.table(results.mp4.map((url, idx) => ({
            'index': idx + 1,
            'type': 'MP4',
            'url': url.substring(0, 80) + (url.length > 80 ? '...' : '')
        })));
    }
}).catch(err => {
    console.error('提取失敗:', err);
});
