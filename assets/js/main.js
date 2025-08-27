// Main JavaScript for Chuiy's Website - Complete Content Management System

// 電影和旅行數據
let movieData = [];
let travelData = [];
let photographyData = [];

// Markdown 緩存
let markdownCache = new Map();

// 主題管理
const ThemeManager = {
    init() {
        // 從 localStorage 載入保存的主題，預設為淺色主題
        const savedTheme = localStorage.getItem('chuiy-theme') || 'light';
        this.setTheme(savedTheme);
        
        // 綁定主題切換按鈕事件
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
    },
    
    setTheme(theme) {
        const html = document.documentElement;
        if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.removeAttribute('data-theme');
        }
        
        // 保存主題設置到 localStorage
        localStorage.setItem('chuiy-theme', theme);
    },
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        
        // 顯示切換提示
        const message = newTheme === 'dark' ? '已切換到深色主題' : '已切換到淺色主題';
        showNotification(message, 'success');
    },
    
    getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }
};

// 等待 DOM 載入完成
document.addEventListener('DOMContentLoaded', function() {
    // 初始化主題管理
    ThemeManager.init();
    
    // 初始化應用
    initializeApp();
    
    // 載入動態內容
    loadContent();
    
    // 設置事件監聽器
    setupEventListeners();
    
    // 初始化平滑滾動
    initializeSmoothScrolling();
    
    // 初始化回到頂部按鈕
    initializeBackToTop();
    
    // 初始化動畫
    initializeAnimations();
});

// 初始化應用
function initializeApp() {
    console.log('Chuiy\'s Website Initialized - Complete Content Management System');
}

// 載入所有內容
async function loadContent() {
    try {
        // 並行載入電影、旅行和攝影內容
        await Promise.all([
            loadMovieReviews(),
            loadTravelPosts(),
            loadPhotographyGallery()
        ]);
    } catch (error) {
        console.error('載入內容時發生錯誤:', error);
    }
}

// 動態載入電影評論
async function loadMovieReviews() {
    try {
        const movieContainer = document.getElementById('movie-reviews');
        if (!movieContainer) return;
        
        movieContainer.innerHTML = '<div class="loading text-center py-5"><i class="bi bi-hourglass-split"></i> 載入電影評論中...</div>';
        
        // 從配置檔案中獲取電影檔案列表
        const movieFiles = window.CONTENT_CONFIG ? window.CONTENT_CONFIG.CONTENT_MANAGER.getAllMovies() : [];
        
        movieData = [];
        
        for (const movieConfig of movieFiles) {
            try {
                // 使用配置檔案中的基本資訊
                const movieInfo = {
                    id: movieConfig.id,
                    title: movieConfig.title,
                    genre: movieConfig.genre,
                    rating: movieConfig.rating,
                    watchDate: movieConfig.watchDate,
                    description: movieConfig.description,
                    featured: movieConfig.featured,
                    file: movieConfig.file,
                    images: movieConfig.images, // 新增圖片參數
                    fullContent: null // 延遲載入完整內容
                };
                
                movieData.push(movieInfo);
            } catch (error) {
                console.warn(`無法載入電影配置: ${movieConfig.id}`, error);
            }
        }
        
        // 渲染電影卡片
        renderMovieCards();
        
    } catch (error) {
        console.error('載入電影評論時發生錯誤:', error);
    }
}

// 動態載入旅行筆記
async function loadTravelPosts() {
    try {
        const travelContainer = document.getElementById('travel-posts');
        if (!travelContainer) return;
        
        travelContainer.innerHTML = '<div class="loading text-center py-5"><i class="bi bi-hourglass-split"></i> 載入旅行筆記中...</div>';
        
        // 從配置檔案中獲取旅行檔案列表
        const travelFiles = window.CONTENT_CONFIG ? window.CONTENT_CONFIG.CONTENT_MANAGER.getAllTravels() : [];
        
        travelData = [];
        
        for (const travelConfig of travelFiles) {
            try {
                // 使用配置檔案中的基本資訊
                const travelInfo = {
                    id: travelConfig.id,
                    title: travelConfig.title,
                    location: travelConfig.location,
                    date: travelConfig.date,
                    description: travelConfig.description,
                    featured: travelConfig.featured,
                    file: travelConfig.file,
                    fullContent: null // 延遲載入完整內容
                };
                
                travelData.push(travelInfo);
            } catch (error) {
                console.warn(`無法載入旅行配置: ${travelConfig.id}`, error);
            }
        }
        
        // 渲染旅行卡片
        renderTravelCards();
        
    } catch (error) {
        console.error('載入旅行筆記時發生錯誤:', error);
    }
}

// 動態載入攝影札記
async function loadPhotographyGallery() {
    try {
        const photographyContainer = document.getElementById('photography-gallery');
        if (!photographyContainer) return;
        
        photographyContainer.innerHTML = '<div class="loading text-center py-5"><i class="bi bi-hourglass-split"></i> 載入攝影作品中...</div>';
        
        // 從配置檔案中獲取攝影檔案列表
        const photographyFiles = window.CONTENT_CONFIG ? window.CONTENT_CONFIG.CONTENT_MANAGER.getAllPhotographies() : [];
        
        photographyData = [];
        
        for (const photoConfig of photographyFiles) {
            try {
                // 使用配置檔案中的資訊
                const photoInfo = {
                    id: photoConfig.id,
                    title: photoConfig.title,
                    location: photoConfig.location,
                    date: photoConfig.date,
                    description: photoConfig.description,
                    featured: photoConfig.featured,
                    flickrEmbed: photoConfig.flickrEmbed,
                    albumUrl: photoConfig.albumUrl
                };
                
                photographyData.push(photoInfo);
            } catch (error) {
                console.warn(`無法載入攝影配置: ${photoConfig.id}`, error);
            }
        }
        
        // 渲染攝影卡片
        renderPhotographyCards();
        
    } catch (error) {
        console.error('載入攝影札記時發生錯誤:', error);
    }
}

// 獲取並解析 Markdown 檔案內容
async function getMarkdownContent(filePath) {
    try {
        // 檢查緩存
        if (markdownCache.has(filePath)) {
            return markdownCache.get(filePath);
        }
        
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const content = await response.text();
        
        // 緩存內容
        markdownCache.set(filePath, content);
        
        return content;
    } catch (error) {
        console.error(`無法獲取 Markdown 內容: ${filePath}`, error);
        return null;
    }
}

// 將 Markdown 轉換為 HTML
function convertMarkdownToHtml(markdownContent) {
    if (!markdownContent) return '';
    
    let html = markdownContent;
    
    // 處理標題
    html = html.replace(/^# (.+)$/gm, '<h1 class="markdown-h1 text-info mb-4">$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="markdown-h2 text-warning border-bottom border-secondary pb-2 mb-3">$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3 class="markdown-h3 text-info mb-3">$1</h3>');
    
    // 處理粗體
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-warning">$1</strong>');
    
    // 處理斜體
    html = html.replace(/\*(.+?)\*/g, '<em class="text-light">$1</em>');
    
    // 處理列表項
    html = html.replace(/^- (.+)$/gm, '<li class="markdown-li text-light mb-2">$1</li>');
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="markdown-li-numbered text-light mb-2">$2</li>');
    
    // 包裝連續的列表項
    html = html.replace(/(<li class="markdown-li"[^>]*>.*?<\/li>)/gs, '<ul class="markdown-ul mb-3">$1</ul>');
    html = html.replace(/(<li class="markdown-li-numbered"[^>]*>.*?<\/li>)/gs, '<ol class="markdown-ol mb-3">$1</ol>');
    
    // 處理段落
    html = html.replace(/^([^<\n#*-].+)$/gm, '<p class="markdown-p text-light mb-3">$1</p>');
    
    // 處理連結
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="markdown-link text-info" target="_blank">$1</a>');
    
    // 處理星星評分
    html = html.replace(/⭐/g, '<i class="bi bi-star-fill text-warning"></i>');
    
    // 處理標籤
    html = html.replace(/#(\w+)/g, '<span class="badge bg-primary me-1">#$1</span>');
    
    // 處理分隔線
    html = html.replace(/^---$/gm, '<hr class="markdown-hr border-secondary my-4">');
    
    // 清理多餘的空行
    html = html.replace(/\n\s*\n/g, '\n');
    
    return html;
}

// 解析電影 Markdown 內容
function parseMovieMarkdown(content, id) {
    const lines = content.split('\n');
    const movie = {
        id: id,
        title: '',
        originalTitle: '',
        director: '',
        year: '',
        genre: '',
        watchDate: '',
        rating: 0,
        plot: '',
        reviews: {
            visual: '',
            story: '',
            music: '',
            meaning: ''
        },
        recommendation: '',
        tags: [],
        fullContent: content
    };
    
    // 解析標題
    const titleMatch = content.match(/^# (.+)/m);
    if (titleMatch) {
        movie.title = titleMatch[1].replace(/ - .+/, '');
    }
    
    // 解析電影資訊
    const originalTitleMatch = content.match(/\*\*原名\*\*:\s*(.+)/);
    if (originalTitleMatch) movie.originalTitle = originalTitleMatch[1];
    
    const directorMatch = content.match(/\*\*導演\*\*:\s*(.+)/);
    if (directorMatch) movie.director = directorMatch[1];
    
    const yearMatch = content.match(/\*\*年份\*\*:\s*(.+)/);
    if (yearMatch) movie.year = yearMatch[1];
    
    const genreMatch = content.match(/\*\*類型\*\*:\s*(.+)/);
    if (genreMatch) movie.genre = genreMatch[1].split('、')[0]; // 取第一個類型
    
    const watchDateMatch = content.match(/\*\*觀看日期\*\*:\s*(.+)/);
    if (watchDateMatch) movie.watchDate = watchDateMatch[1];
    
    const ratingMatch = content.match(/\*\*我的評分\*\*:\s*([0-9.]+)/);
    if (ratingMatch) movie.rating = parseFloat(ratingMatch[1]);
    
    // 解析劇情簡介
    const plotMatch = content.match(/## 劇情簡介\s*\n\n(.+?)(?=\n\n##|\n\n$)/s);
    if (plotMatch) movie.plot = plotMatch[1].trim();
    
    // 解析觀影心得的各個部分
    const visualMatch = content.match(/### 視覺呈現\s*\n(.+?)(?=\n\n###|\n\n##|\n\n$)/s);
    if (visualMatch) movie.reviews.visual = visualMatch[1].trim();
    
    const storyMatch = content.match(/### 故事情節\s*\n(.+?)(?=\n\n###|\n\n##|\n\n$)/s);
    if (storyMatch) movie.reviews.story = storyMatch[1].trim();
    
    const musicMatch = content.match(/### 音樂配樂\s*\n(.+?)(?=\n\n###|\n\n##|\n\n$)/s);
    if (musicMatch) movie.reviews.music = musicMatch[1].trim();
    
    const meaningMatch = content.match(/### 深層含義\s*\n(.+?)(?=\n\n###|\n\n##|\n\n$)/s);
    if (meaningMatch) movie.reviews.meaning = meaningMatch[1].trim();
    
    // 解析推薦指數
    const recommendationMatch = content.match(/⭐⭐⭐⭐⭐ (.+)/);
    if (recommendationMatch) movie.recommendation = recommendationMatch[1];
    
    // 解析標籤
    const tagsMatch = content.match(/#(\w+)/g);
    if (tagsMatch) {
        movie.tags = tagsMatch.map(tag => tag.substring(1));
    }
    
    return movie;
}

// 解析旅行 Markdown 內容
function parseTravelMarkdown(content, id) {
    const travel = {
        id: id,
        title: '',
        location: '',
        date: '',
        content: '',
        highlights: [],
        foods: [],
        tips: [],
        fullContent: content
    };
    
    // 解析標題
    const titleMatch = content.match(/^# (.+)/m);
    if (titleMatch) {
        travel.title = titleMatch[1];
    }
    
    // 解析日期
    const dateMatch = content.match(/\*\*日期\*\*:\s*(.+)/);
    if (dateMatch) travel.date = dateMatch[1];
    
    // 解析地點
    const locationMatch = content.match(/\*\*地點\*\*:\s*(.+)/);
    if (locationMatch) travel.location = locationMatch[1];
    
    // 解析旅行心得
    const contentMatch = content.match(/## 旅行心得\s*\n\n(.+?)(?=\n\n###|\n\n##|\n\n---|\n\n$)/s);
    if (contentMatch) travel.content = contentMatch[1].trim();
    
    // 解析印象深刻的景點
    const highlightsMatch = content.match(/### 印象深刻的景點\s*\n\n(.+?)(?=\n\n###|\n\n##|\n\n---|\n\n$)/s);
    if (highlightsMatch) {
        const highlightsList = highlightsMatch[1].match(/\d+\.\s\*\*(.+?)\*\*\s-\s(.+)/g);
        if (highlightsList) {
            travel.highlights = highlightsList.map(item => {
                const match = item.match(/\*\*(.+?)\*\*\s-\s(.+)/);
                return match ? { name: match[1], description: match[2] } : null;
            }).filter(Boolean);
        }
    }
    
    // 解析美食體驗
    const foodMatch = content.match(/### 美食體驗\s*\n\n(.+?)(?=\n\n###|\n\n##|\n\n---|\n\n$)/s);
    if (foodMatch) {
        const foodList = foodMatch[1].match(/- (.+)/g);
        if (foodList) {
            travel.foods = foodList.map(item => item.replace('- ', ''));
        }
    }
    
    // 解析旅行建議
    const tipsMatch = content.match(/## 旅行建議\s*\n\n.+?\n(.+?)(?=\n\n---|\n\n$)/s);
    if (tipsMatch) {
        const tipsList = tipsMatch[1].match(/\d+\.\s(.+)/g);
        if (tipsList) {
            travel.tips = tipsList.map(item => item.replace(/\d+\.\s/, ''));
        }
    }
    
    return travel;
}

// 渲染電影卡片
function renderMovieCards() {
    const movieContainer = document.getElementById('movie-reviews');
    
    // 清空現有內容
    movieContainer.innerHTML = '';
    
    const movieCount = movieData.length;
    
    movieData.forEach((movie, index) => {
        const movieElement = createMovieCardElement(movie, movieCount, index);
        movieContainer.appendChild(movieElement);
    });
}

// 渲染旅行卡片
function renderTravelCards() {
    const travelContainer = document.getElementById('travel-posts');
    
    // 清空現有內容
    travelContainer.innerHTML = '';
    
    const travelCount = travelData.length;
    
    travelData.forEach((travel, index) => {
        const travelElement = createTravelCardElement(travel, travelCount, index);
        travelContainer.appendChild(travelElement);
    });
}

// 渲染攝影卡片
function renderPhotographyCards() {
    const photographyContainer = document.getElementById('photography-gallery');
    if (!photographyContainer) return;
    
    // 清空現有內容
    photographyContainer.innerHTML = '';
    
    // 攝影作品固定使用三欄式佈局
    photographyData.forEach((photo, index) => {
        const photoElement = createPhotographyCardElement(photo);
        photographyContainer.appendChild(photoElement);
    });
    
    // 載入 Flickr 嵌入腳本
    loadFlickrScript();
}

// 創建電影卡片元素（支援智能佈局）
function createMovieCardElement(movie, totalCount, index) {
    const col = document.createElement('div');
    
    // 決定佈局類型
    const layoutType = getLayoutType(totalCount, index);
    
    // 設定 column 類別
    col.className = layoutType.colClass;
    
    const stars = generateStarRating(movie.rating);
    
    // 準備圖片內容
    const imageContent = movie.images 
        ? `<img src="${movie.images}" alt="${movie.title}" style="width: 100%; height: 100%; object-fit: cover;">`
        : `<i class="bi bi-camera-reels"></i>`;
    
    // 根據佈局類型創建不同的 HTML 結構
    if (layoutType.isHorizontal) {
        // 水平佈局（圖片在左，內容在右）
        col.innerHTML = `
            <article class="article-card horizontal">
                <div class="card-image">
                    ${imageContent}
                </div>
                <div class="card-body">
                    <h3 class="card-title">${movie.title}</h3>
                    <div class="rating mb-3">
                        ${stars}
                        <span style="color: var(--text-light); margin-left: 0.5rem;">${movie.rating}/5</span>
                    </div>
                    <div class="mb-3">
                        <span class="tag">${movie.genre}</span>
                    </div>
                    <p class="card-excerpt">
                        ${movie.description}
                    </p>
                    <div class="card-meta">
                        <div class="card-date">
                            <i class="bi bi-calendar3"></i>
                            ${movie.watchDate}
                        </div>
                        <button class="read-more-btn" onclick="showMovieDetail('${movie.id}')">
                            閱讀完整評論
                        </button>
                    </div>
                </div>
            </article>
        `;
    } else {
        // 標準卡片佈局
        col.innerHTML = `
            <article class="article-card">
                <div class="card-image">
                    ${imageContent}
                </div>
                <div class="card-body">
                    <h3 class="card-title">${movie.title}</h3>
                    <div class="rating">
                        ${stars}
                        <span style="color: var(--text-light); margin-left: 0.5rem;">${movie.rating}/5</span>
                    </div>
                    <div class="mb-2">
                        <span class="tag">${movie.genre}</span>
                    </div>
                    <p class="card-excerpt">
                        ${movie.description.substring(0, 120)}${movie.description.length > 120 ? '...' : ''}
                    </p>
                    <div class="card-meta">
                        <div class="card-date">
                            <i class="bi bi-calendar3"></i>
                            ${movie.watchDate}
                        </div>
                        <button class="read-more-btn" onclick="showMovieDetail('${movie.id}')">
                            閱讀評論
                        </button>
                    </div>
                </div>
            </article>
        `;
    }
    
    return col;
}

// 創建旅行卡片元素（支援智能佈局）
function createTravelCardElement(travel, totalCount, index) {
    const col = document.createElement('div');
    
    // 決定佈局類型
    const layoutType = getLayoutType(totalCount, index);
    
    // 設定 column 類別
    col.className = layoutType.colClass;
    
    // 從日期中提取年月
    const dateMatch = travel.date.match(/(\d{4})年(\d{1,2})月/);
    const dateBadge = dateMatch ? `${dateMatch[1]}.${dateMatch[2].padStart(2, '0')}` : '2024.08';
    
    // 根據佈局類型創建不同的 HTML 結構
    if (layoutType.isHorizontal) {
        // 水平佈局（圖片在左，內容在右）
        col.innerHTML = `
            <article class="article-card horizontal">
                <div class="card-image">
                    <i class="bi bi-geo-alt-fill"></i>
                </div>
                <div class="card-body">
                    <h3 class="card-title">${travel.title}</h3>
                    <div class="mb-3">
                        <span class="tag">${travel.location}</span>
                        <span class="tag">${dateBadge}</span>
                    </div>
                    <p class="card-excerpt">
                        ${travel.description}
                    </p>
                    <div class="card-meta">
                        <div class="card-date">
                            <i class="bi bi-calendar3"></i>
                            ${travel.date}
                        </div>
                        <button class="read-more-btn" onclick="showTravelDetail('${travel.id}')">
                            閱讀完整紀錄
                        </button>
                    </div>
                </div>
            </article>
        `;
    } else {
        // 標準卡片佈局
        col.innerHTML = `
            <article class="article-card">
                <div class="card-image">
                    <i class="bi bi-geo-alt-fill"></i>
                </div>
                <div class="card-body">
                    <h3 class="card-title">${travel.title}</h3>
                    <div class="mb-2">
                        <span class="tag">${travel.location}</span>
                        <span class="tag">${dateBadge}</span>
                    </div>
                    <p class="card-excerpt">
                        ${travel.description.substring(0, 120)}${travel.description.length > 120 ? '...' : ''}
                    </p>
                    <div class="card-meta">
                        <div class="card-date">
                            <i class="bi bi-calendar3"></i>
                            ${travel.date}
                        </div>
                        <button class="read-more-btn" onclick="showTravelDetail('${travel.id}')">
                            閱讀紀錄
                        </button>
                    </div>
                </div>
            </article>
        `;
    }
    
    return col;
}

// 創建攝影卡片元素（固定三欄式佈局）
function createPhotographyCardElement(photo) {
    const col = document.createElement('div');
    col.className = 'col-lg-4 col-md-6 col-12 mb-4';
    
    // 從日期中提取年份
    const yearMatch = photo.date.match(/(\d{4})/);
    const yearBadge = yearMatch ? yearMatch[1] : '2023';
    
    col.innerHTML = `
        <article class="photography-card">
            <div class="flickr-embed-container">
                ${photo.flickrEmbed}
            </div>
            <div class="card-body p-4" style="background-color: var(--warm-white); border: 1px solid var(--border-light); border-top: none;">
                <h3 class="card-title h5 mb-3" style="color: var(--deep-brown); font-family: 'Noto Serif TC', serif;">${photo.title}</h3>
                <div class="mb-3">
                    <span class="tag">${photo.location}</span>
                    <span class="tag">${yearBadge}</span>
                </div>
                <p class="card-excerpt text-muted mb-3">
                    ${photo.description}
                </p>
                <div class="card-meta d-flex justify-content-between align-items-center">
                    <small class="text-muted">
                        <i class="bi bi-calendar3 me-1"></i>
                        ${photo.date}
                    </small>
                    <a href="${photo.albumUrl}" target="_blank" class="btn btn-outline-primary btn-sm">
                        <i class="bi bi-images me-1"></i>查看相簿
                    </a>
                </div>
            </div>
        </article>
    `;
    
    return col;
}

// 載入 Flickr 嵌入腳本
function loadFlickrScript() {
    // 檢查是否已經載入過
    if (document.querySelector('script[src*="embedr.flickr.com"]')) {
        return;
    }
    
    const script = document.createElement('script');
    script.src = '//embedr.flickr.com/assets/client-code.js';
    script.async = true;
    script.charset = 'utf-8';
    document.head.appendChild(script);
}

// 智能佈局決策函數
function getLayoutType(totalCount, currentIndex) {
    if (totalCount === 1) {
        // 只有一篇：全寬度水平佈局
        return {
            colClass: 'col-12',
            isHorizontal: true
        };
    } else if (totalCount === 2) {
        // 兩篇：各佔 50% 水平佈局
        return {
            colClass: 'col-lg-6 col-12',
            isHorizontal: true
        };
    } else {
        // 三篇以上：每行最多三個，標準卡片佈局
        return {
            colClass: 'col-lg-4 col-md-6 col-12',
            isHorizontal: false
        };
    }
}

// 顯示電影詳情 Modal
async function showMovieDetail(movieId) {
    const movie = movieData.find(m => m.id === movieId);
    if (!movie) {
        console.error('找不到電影資料:', movieId);
        return;
    }
    
    try {
        // 如果還沒有載入完整內容，現在載入
        if (!movie.fullContent) {
            const content = await getMarkdownContent(movie.file);
            if (content) {
                movie.fullContent = content;
                movie.parsedData = parseMovieMarkdown(content);
            }
        }
        
        // 動態更新 Modal 內容
        updateMovieModal(movie);
        
        // 顯示 Modal
        const modal = new bootstrap.Modal(document.getElementById('movieModal1'));
        modal.show();
    } catch (error) {
        console.error('載入電影詳情時發生錯誤:', error);
        showNotification('載入電影詳情時發生錯誤', 'error');
    }
}

// 顯示旅行詳情 Modal
async function showTravelDetail(travelId) {
    const travel = travelData.find(t => t.id === travelId);
    if (!travel) {
        console.error('找不到旅行資料:', travelId);
        return;
    }
    
    try {
        // 如果還沒有載入完整內容，現在載入
        if (!travel.fullContent) {
            const content = await getMarkdownContent(travel.file);
            if (content) {
                travel.fullContent = content;
                travel.parsedData = parseTravelMarkdown(content);
            }
        }
        
        // 動態更新 Modal 內容
        updateTravelModal(travel);
        
        // 顯示 Modal
        const modal = new bootstrap.Modal(document.getElementById('travelModal1'));
        modal.show();
    } catch (error) {
        console.error('載入旅行詳情時發生錯誤:', error);
        showNotification('載入旅行詳情時發生錯誤', 'error');
    }
}

// 更新電影 Modal 內容
function updateMovieModal(movie) {
    const modal = document.getElementById('movieModal1');
    if (!modal) return;
    
    // 更新標題
    const modalTitle = modal.querySelector('.modal-title');
    if (modalTitle) {
        modalTitle.textContent = `${movie.title} - 完整評論`;
    }
    
    // 更新內容
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) {
        if (movie.fullContent) {
            // 如果有完整的 Markdown 內容，轉換為 HTML
            const htmlContent = convertMarkdownToHtml(movie.fullContent);
            modalBody.innerHTML = `
                <div class="markdown-content">
                    ${htmlContent}
                </div>
            `;
        } else {
            // 使用基本配置資訊
            modalBody.innerHTML = `
                <div class="bg-danger rounded d-flex align-items-center justify-content-center mb-3" 
                     style="height: 300px;">
                    <div class="text-center">
                        <i class="bi bi-film text-white" style="font-size: 4rem;"></i>
                        <p class="mt-2 mb-0 text-white">${movie.title}</p>
                    </div>
                </div>
                
                <!-- 電影資訊 -->
                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="card bg-secondary border-0">
                            <div class="card-body">
                                <h6 class="card-title text-warning mb-3">
                                    <i class="bi bi-info-circle me-2"></i>電影資訊
                                </h6>
                                <div class="small text-light">
                                    <div class="mb-2"><strong>類型:</strong> ${movie.genre}</div>
                                    <div class="mb-2"><strong>觀看日期:</strong> ${movie.watchDate}</div>
                                    <div class="d-flex align-items-center">
                                        <strong class="me-2">我的評分:</strong>
                                        <div class="text-warning">
                                            ${generateStarRating(movie.rating)}
                                            <span class="ms-2">${movie.rating}/5</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 簡介 -->
                <div class="mb-4">
                    <h6 class="text-warning border-bottom border-secondary pb-2">
                        <i class="bi bi-chat-quote me-2"></i>電影簡介
                    </h6>
                    <p class="text-light">${movie.description}</p>
                </div>
                
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    <strong>提示:</strong> 完整的評論內容正在載入中...
                </div>
            `;
        }
    }
}

// 更新旅行 Modal 內容
function updateTravelModal(travel) {
    const modal = document.getElementById('travelModal1');
    if (!modal) return;
    
    // 更新標題
    const modalTitle = modal.querySelector('.modal-title');
    if (modalTitle) {
        modalTitle.textContent = travel.title;
    }
    
    // 更新內容
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) {
        if (travel.fullContent) {
            // 如果有完整的 Markdown 內容，轉換為 HTML
            const htmlContent = convertMarkdownToHtml(travel.fullContent);
            modalBody.innerHTML = `
                <div class="markdown-content">
                    ${htmlContent}
                </div>
            `;
        } else {
            // 使用基本配置資訊
            modalBody.innerHTML = `
                <div class="bg-success rounded d-flex align-items-center justify-content-center mb-3" 
                     style="height: 300px;">
                    <div class="text-center">
                        <i class="bi bi-images text-white" style="font-size: 4rem;"></i>
                        <p class="mt-2 mb-0 text-white">旅行相冊</p>
                    </div>
                </div>
                
                <!-- 旅行資訊 -->
                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="card bg-secondary border-0">
                            <div class="card-body">
                                <h6 class="card-title text-warning mb-3">
                                    <i class="bi bi-info-circle me-2"></i>旅行資訊
                                </h6>
                                <div class="small text-light">
                                    <div class="mb-2"><strong>日期:</strong> ${travel.date}</div>
                                    <div class="mb-2"><strong>地點:</strong> ${travel.location}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 旅行心得 -->
                <div class="mb-4">
                    <h6 class="text-warning border-bottom border-secondary pb-2">
                        <i class="bi bi-heart me-2"></i>旅行心得
                    </h6>
                    <p class="text-light">${travel.description}</p>
                </div>
                
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    <strong>提示:</strong> 完整的旅行紀錄正在載入中...
                </div>
            `;
        }
    }
}

// 解析電影 Markdown 內容
function parseMovieMarkdown(content) {
    const movie = {
        title: '',
        originalTitle: '',
        director: '',
        year: '',
        genre: '',
        watchDate: '',
        rating: 0,
        plot: '',
        reviews: {
            visual: '',
            story: '',
            music: '',
            meaning: ''
        },
        recommendation: '',
        tags: [],
        fullHtml: convertMarkdownToHtml(content)
    };
    
    // 解析標題
    const titleMatch = content.match(/^# (.+)/m);
    if (titleMatch) {
        movie.title = titleMatch[1].replace(/ - .+/, '');
    }
    
    // 解析電影資訊
    const originalTitleMatch = content.match(/\*\*原名\*\*:\s*(.+)/);
    if (originalTitleMatch) movie.originalTitle = originalTitleMatch[1];
    
    const directorMatch = content.match(/\*\*導演\*\*:\s*(.+)/);
    if (directorMatch) movie.director = directorMatch[1];
    
    const yearMatch = content.match(/\*\*年份\*\*:\s*(.+)/);
    if (yearMatch) movie.year = yearMatch[1];
    
    const genreMatch = content.match(/\*\*類型\*\*:\s*(.+)/);
    if (genreMatch) movie.genre = genreMatch[1].split('、')[0];
    
    const watchDateMatch = content.match(/\*\*觀看日期\*\*:\s*(.+)/);
    if (watchDateMatch) movie.watchDate = watchDateMatch[1];
    
    const ratingMatch = content.match(/\*\*我的評分\*\*:\s*([0-9.]+)/);
    if (ratingMatch) movie.rating = parseFloat(ratingMatch[1]);
    
    // 解析劇情簡介
    const plotMatch = content.match(/## 劇情簡介\s*\n\n(.+?)(?=\n\n##|\n\n$)/s);
    if (plotMatch) movie.plot = plotMatch[1].trim();
    
    // 解析標籤
    const tagsMatch = content.match(/#(\w+)/g);
    if (tagsMatch) {
        movie.tags = tagsMatch.map(tag => tag.substring(1));
    }
    
    return movie;
}

// 解析旅行 Markdown 內容
function parseTravelMarkdown(content) {
    const travel = {
        title: '',
        location: '',
        date: '',
        content: '',
        highlights: [],
        foods: [],
        tips: [],
        fullHtml: convertMarkdownToHtml(content)
    };
    
    // 解析標題
    const titleMatch = content.match(/^# (.+)/m);
    if (titleMatch) {
        travel.title = titleMatch[1];
    }
    
    // 解析日期
    const dateMatch = content.match(/\*\*日期\*\*:\s*(.+)/);
    if (dateMatch) travel.date = dateMatch[1];
    
    // 解析地點
    const locationMatch = content.match(/\*\*地點\*\*:\s*(.+)/);
    if (locationMatch) travel.location = locationMatch[1];
    
    // 解析旅行心得
    const contentMatch = content.match(/## 旅行心得\s*\n\n(.+?)(?=\n\n###|\n\n##|\n\n---|\n\n$)/s);
    if (contentMatch) travel.content = contentMatch[1].trim();
    
    return travel;
}

// 產生星級評分 HTML
function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="bi bi-star-fill text-warning"></i>';
    }
    if (hasHalfStar) {
        stars += '<i class="bi bi-star-half text-warning"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="bi bi-star text-warning"></i>';
    }
    
    return stars;
}

// 顯示通知
function showNotification(message, type = 'info') {
    // 創建通知元素
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // 5秒後自動移除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// 根據類型獲取樣式類別
function getGenreClass(genre) {
    const genreMap = {
        '動畫': 'bg-warning text-dark',
        '動作': 'bg-danger',
        '喜劇': 'bg-success',
        '劇情': 'bg-primary',
        '科幻': 'bg-info',
        '恐怖': 'bg-dark',
        '愛情': 'bg-warning text-dark'
    };
    return genreMap[genre] || 'bg-secondary';
}

// 其餘的輔助函數
function setupEventListeners() {
    // 導航連結的平滑滾動
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

function initializeSmoothScrolling() {
    // 已在 setupEventListeners 中處理
}

function initializeBackToTop() {
    // 創建回到頂部按鈕
    const backToTop = document.createElement('button');
    backToTop.innerHTML = '<i class="bi bi-arrow-up"></i>';
    backToTop.className = 'back-to-top';
    backToTop.setAttribute('aria-label', 'Back to top');
    document.body.appendChild(backToTop);
    
    // 顯示/隱藏基於滾動位置
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTop.classList.add('show');
        } else {
            backToTop.classList.remove('show');
        }
    });
    
    // 點擊滾動到頂部
    backToTop.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

function initializeAnimations() {
    // Intersection Observer for animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
            }
        });
    }, {
        threshold: 0.1
    });
    
    // 觀察需要動畫的元素
    const animateElements = document.querySelectorAll('.card, .display-5, .lead');
    animateElements.forEach(el => observer.observe(el));
}

// 將函數暴露到全域範圍
window.showMovieDetail = showMovieDetail;
window.showTravelDetail = showTravelDetail;

// Create travel post element
function createTravelPostElement(data) {
    const col = document.createElement('div');
    col.className = 'col-lg-6';
    
    const dateFormatted = data.date ? new Date(data.date).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit' }) : '最近';
    
    // Use icon placeholder instead of placeholder image
    const imageHtml = data.image instanceof File ? 
        `<img src="${URL.createObjectURL(data.image)}" class="card-img-top" alt="旅行照片" style="height: 250px; object-fit: cover;">` :
        `<div class="bg-success rounded d-flex align-items-center justify-content-center" style="height: 250px;">
            <div class="text-center">
                <i class="bi bi-image text-white placeholder-icon" style="font-size: 4rem;"></i>
                <p class="mt-2 mb-0 text-white">旅行照片</p>
            </div>
        </div>`;
    
    col.innerHTML = `
        <div class="card shadow-sm h-100 travel-card bg-dark text-white">
            ${imageHtml}
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h5 class="card-title text-white">${data.title}</h5>
                    <span class="badge bg-success">${dateFormatted}</span>
                </div>
                <p class="card-text text-light">
                    ${data.notes.substring(0, 100)}${data.notes.length > 100 ? '...' : ''}
                </p>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-light">
                        <i class="bi bi-geo-alt me-1"></i>${data.location}
                    </small>
                    <div>
                        <button class="btn btn-outline-info btn-sm" onclick="showTravelDetail('${data.title}')">
                            <i class="bi bi-eye me-1"></i>查看詳情
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return col;
}

// Create movie review element
function createMovieReviewElement(data) {
    const col = document.createElement('div');
    col.className = 'col-lg-4 col-md-6';
    
    const ratingValue = parseFloat(data.rating.split(' - ')[0]);
    const fullStars = Math.floor(ratingValue);
    const hasHalfStar = ratingValue % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let starsHtml = '';
    for (let i = 0; i < fullStars; i++) {
        starsHtml += '<i class="bi bi-star-fill"></i>';
    }
    if (hasHalfStar) {
        starsHtml += '<i class="bi bi-star-half"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        starsHtml += '<i class="bi bi-star"></i>';
    }
    
    // Use icon placeholder instead of placeholder image
    const imageHtml = data.poster instanceof File ? 
        `<img src="${URL.createObjectURL(data.poster)}" class="card-img-top" alt="電影海報" style="height: 300px; object-fit: cover;">` :
        `<div class="bg-danger rounded-top d-flex align-items-center justify-content-center" style="height: 300px;">
            <div class="text-center">
                <i class="bi bi-film text-white placeholder-icon" style="font-size: 4rem;"></i>
                <p class="mt-2 mb-0 text-white">電影海報</p>
            </div>
        </div>`;
    
    col.innerHTML = `
        <div class="card shadow-sm h-100 movie-card bg-secondary text-white">
            ${imageHtml}
            <div class="card-body">
                <h5 class="card-title text-white">${data.title}</h5>
                <div class="mb-2">
                    <span class="badge bg-warning text-dark me-2">${data.genre}</span>
                    <span class="text-warning">
                        ${starsHtml}
                        ${ratingValue}/5
                    </span>
                </div>
                <p class="card-text text-light">
                    ${data.review.substring(0, 80)}${data.review.length > 80 ? '...' : ''}
                </p>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-light">${new Date().toLocaleDateString('zh-TW')}</small>
                    <button class="btn btn-outline-info btn-sm" onclick="showMovieDetail('${data.title}')">
                        <i class="bi bi-eye me-1"></i>完整評論
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return col;
}

// Setup file upload previews
function setupFileUploadPreviews() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                // Create preview if needed
                console.log('Image selected:', file.name);
            }
        });
    });
}

// Setup modal events
function setupModalEvents() {
    // Clear forms when modals are hidden
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('hidden.bs.modal', function() {
            const form = this.querySelector('form');
            if (form) {
                form.reset();
            }
        });
    });
}

// Setup navigation events
function setupNavigationEvents() {
    // Active navigation highlighting
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Scroll spy for navigation
    window.addEventListener('scroll', function() {
        let current = '';
        const sections = document.querySelectorAll('section[id]');
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (scrollY >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    });
}

// Initialize smooth scrolling
function initializeSmoothScrolling() {
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Initialize back to top button
function initializeBackToTop() {
    // Create back to top button
    const backToTop = document.createElement('button');
    backToTop.innerHTML = '<i class="bi bi-arrow-up"></i>';
    backToTop.className = 'back-to-top';
    backToTop.setAttribute('aria-label', 'Back to top');
    document.body.appendChild(backToTop);
    
    // Show/hide based on scroll position
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTop.classList.add('show');
        } else {
            backToTop.classList.remove('show');
        }
    });
    
    // Scroll to top when clicked
    backToTop.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Initialize animations
function initializeAnimations() {
    // Intersection Observer for animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
            }
        });
    }, {
        threshold: 0.1
    });
    
    // Observe elements that should animate
    const animateElements = document.querySelectorAll('.card, .display-5, .lead');
    animateElements.forEach(el => observer.observe(el));
}

// Save travel post to localStorage
function saveTravelPost(data) {
    const savedPosts = JSON.parse(localStorage.getItem('travelPosts') || '[]');
    data.id = Date.now().toString();
    data.createdAt = new Date().toISOString();
    savedPosts.push(data);
    localStorage.setItem('travelPosts', JSON.stringify(savedPosts));
}

// Save movie review to localStorage
function saveMovieReview(data) {
    const savedReviews = JSON.parse(localStorage.getItem('movieReviews') || '[]');
    data.id = Date.now().toString();
    data.createdAt = new Date().toISOString();
    savedReviews.push(data);
    localStorage.setItem('movieReviews', JSON.stringify(savedReviews));
}

// Load saved content from localStorage
function loadSavedContent() {
    // Load travel posts
    const savedTravelPosts = JSON.parse(localStorage.getItem('travelPosts') || '[]');
    savedTravelPosts.forEach(post => {
        addTravelPost(post);
    });
    
    // Load movie reviews
    const savedMovieReviews = JSON.parse(localStorage.getItem('movieReviews') || '[]');
    savedMovieReviews.forEach(review => {
        addMovieReview(review);
    });
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Show travel detail - 顯示旅行詳情 Modal
async function showTravelDetail(travelId) {
    const travel = travelData.find(t => t.id === travelId);
    if (!travel) {
        console.error('找不到旅行資料:', travelId);
        showNotification('找不到旅行資料', 'error');
        return;
    }
    
    try {
        // 如果還沒有載入完整內容，現在載入
        if (!travel.fullContent) {
            const content = await getMarkdownContent(travel.file);
            if (content) {
                travel.fullContent = content;
                travel.parsedData = parseTravelMarkdown(content);
            }
        }
        
        // 動態更新 Modal 內容
        updateTravelModal(travel);
        
        // 顯示 Modal
        const modal = new bootstrap.Modal(document.getElementById('travelModal1'));
        modal.show();
    } catch (error) {
        console.error('載入旅行詳情時發生錯誤:', error);
        showNotification('載入旅行詳情時發生錯誤', 'error');
    }
}

// Show movie detail - 顯示電影詳情 Modal  
async function showMovieDetail(movieId) {
    const movie = movieData.find(m => m.id === movieId);
    if (!movie) {
        console.error('找不到電影資料:', movieId);
        showNotification('找不到電影資料', 'error');
        return;
    }
    
    try {
        // 如果還沒有載入完整內容，現在載入
        if (!movie.fullContent) {
            const content = await getMarkdownContent(movie.file);
            if (content) {
                movie.fullContent = content;
                movie.parsedData = parseMovieMarkdown(content);
            }
        }
        
        // 動態更新 Modal 內容
        updateMovieModal(movie);
        
        // 顯示 Modal
        const modal = new bootstrap.Modal(document.getElementById('movieModal1'));
        modal.show();
    } catch (error) {
        console.error('載入電影詳情時發生錯誤:', error);
        showNotification('載入電影詳情時發生錯誤', 'error');
    }
}

// Utility functions
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Export functions for global access
window.showTravelDetail = showTravelDetail;
window.showMovieDetail = showMovieDetail;
