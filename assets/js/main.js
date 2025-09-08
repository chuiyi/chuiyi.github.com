// Main JavaScript for Chuiyi's Website - Complete Content Management System

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

// 網站配置管理器
const SiteConfigManager = {
    init() {
        // 檢查 SITE_CONFIG 是否已載入
        if (typeof SITE_CONFIG !== 'undefined') {
            this.applySiteConfig();
        } else {
            console.warn('SITE_CONFIG 未載入，使用預設配置');
        }
    },
    
    applySiteConfig() {
        try {
            // 更新 Hero Section
            this.updateElement('hero-title', SITE_CONFIG.hero.title);
            this.updateElement('hero-subtitle', SITE_CONFIG.hero.subtitle, true); // 允許 HTML

            // 更新各 Section 標題和副標題
            this.updateElement('about-title', SITE_CONFIG.sections.about.title);
            this.updateElement('about-subtitle', SITE_CONFIG.sections.about.subtitle);
            
            // 更新 Travel Section（保留圖標）
            const travelTitle = `<i class="bi bi-compass me-3" style="color: var(--muted-brown);"></i>${SITE_CONFIG.sections.travel.title}`;
            this.updateElement('travel-title', travelTitle, true);
            this.updateElement('travel-subtitle', SITE_CONFIG.sections.travel.subtitle);
            
            // 更新 Movies Section（保留圖標）
            const moviesTitle = `<i class="bi bi-camera-reels me-3" style="color: var(--muted-brown);"></i>${SITE_CONFIG.sections.movies.title}`;
            this.updateElement('movies-title', moviesTitle, true);
            this.updateElement('movies-subtitle', SITE_CONFIG.sections.movies.subtitle);
            
            // 更新 Photography Section（保留圖標）
            const photographyTitle = `<i class="bi bi-camera me-3" style="color: var(--muted-brown);"></i>${SITE_CONFIG.sections.photography.title}`;
            this.updateElement('photography-title', photographyTitle, true);
            this.updateElement('photography-subtitle', SITE_CONFIG.sections.photography.subtitle);

            // 更新版權聲明
            this.updateElement('copyright', SITE_CONFIG.footer.copyright, true);
            
            // 更新導航欄
            this.updateNavigation();
            
            // 更新社交媒體連結
            this.updateSocialLinks();
            
        } catch (error) {
            console.error('應用網站配置時發生錯誤:', error);
        }
    },
    
    updateElement(elementId, content, allowHTML = false) {
        const element = document.getElementById(elementId);
        if (element) {
            if (allowHTML) {
                element.innerHTML = content;
            } else {
                element.textContent = content;
            }
        }
    },
    
    updateNavigation() {
        // 更新導航品牌名稱
        const navBrand = document.getElementById('navbar-brand');
        if (navBrand && SITE_CONFIG.navigation) {
            const brandHTML = `<i class="bi bi-feather me-2"></i>${SITE_CONFIG.navigation.brand}`;
            navBrand.innerHTML = brandHTML;
        }
        
        // 更新導航中的 GitHub 連結
        const navGithub = document.getElementById('nav-github');
        if (navGithub && SITE_CONFIG.navigation.github) {
            navGithub.href = SITE_CONFIG.navigation.github.url;
            navGithub.innerHTML = `<i class="bi bi-github me-1"></i>${SITE_CONFIG.navigation.github.title}`;
        }
    },
    
    updateSocialLinks() {
        const socialLinksContainer = document.getElementById('social-links');
        if (socialLinksContainer && SITE_CONFIG.socialLinks) {
            let linksHTML = '';
            
            // 依序生成各個社交媒體連結
            Object.keys(SITE_CONFIG.socialLinks).forEach(platform => {
                const link = SITE_CONFIG.socialLinks[platform];
                linksHTML += `
                    <a href="${link.url}" 
                       style="color: var(--warm-white); margin: 0 var(--spacing-sm); text-decoration: none;" 
                       target="_blank" 
                       title="${link.title}">
                        <i class="bi ${link.icon}"></i>
                    </a>
                `;
            });
            
            socialLinksContainer.innerHTML = linksHTML;
        }
    }
};

// 等待 DOM 載入完成
document.addEventListener('DOMContentLoaded', function() {
    // 初始化主題管理
    ThemeManager.init();
    
    // 初始化網站配置
    SiteConfigManager.init();
    
    // 初始化應用
    initializeApp();
    
    // 載入動態內容
    loadContent();
    
    // 設置事件監聽器
    setupEventListeners();
    
    // 初始化平滑滾動
    initializeSmoothScrolling();
    
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
function convertMarkdownToHtml(markdownContent, filePath = '') {
    if (!markdownContent) return '';
    
    let html = markdownContent;
    
    // 處理圖片並修正路徑
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        // 如果是相對路徑且以 ../../ 開頭，則轉換為正確的路徑
        if (src.startsWith('../../')) {
            src = src.replace('../../', '');
        }
        // 如果路徑不是以 http 開頭且不是以 / 開頭，則添加根路徑
        if (!src.startsWith('http') && !src.startsWith('/')) {
            src = src;
        }
        
        return `<img src="${src}" alt="${alt}" class="img-fluid rounded mb-3" style="max-width: 100%; height: auto;">`;
    });
    
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
    
    // 載入 Flickr 嵌入腳本，並在 DOM 更新後處理
    setTimeout(() => {
        loadFlickrScript();
    }, 100);
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
            <div class="card-body">
                <h3 class="card-title h5 mb-3" style="color: var(--deep-brown); font-family: 'Noto Serif TC', serif;">${photo.title}</h3>
                <div class="mb-3">
                    <span class="tag">${photo.location}</span>
                    <span class="tag">${yearBadge}</span>
                </div>
                <p class="card-excerpt text-muted mb-3">
                    ${photo.description}
                </p>
                <div class="card-meta d-flex justify-content-between align-items-center flex-wrap">
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
        // 如果已經載入，直接處理嵌入
        setTimeout(processFlickrEmbeds, 500);
        return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://embedr.flickr.com/assets/client-code.js';
    script.async = true;
    script.charset = 'utf-8';
    
    // 腳本載入完成後的回調
    script.onload = function() {
        window.flickrEmbedReady = true;
        // 延遲處理，確保 Flickr 腳本完全初始化
        setTimeout(processFlickrEmbeds, 1000);
    };
    
    document.head.appendChild(script);
}

// 處理 Flickr 嵌入元素
function processFlickrEmbeds() {
    const flickrEmbeds = document.querySelectorAll('[data-flickr-embed="true"]');
    
    if (flickrEmbeds.length > 0) {
        // 如果存在全域的 flickr 處理函數，使用它
        if (typeof window.flickrEmbed !== 'undefined' && window.flickrEmbed.process) {
            window.flickrEmbed.process();
        } else if (typeof window.processEmbeds !== 'undefined') {
            window.processEmbeds();
        } else {
            // 手動觸發 Flickr 嵌入處理
            flickrEmbeds.forEach(embed => {
                if (!embed.dataset.processed) {
                    embed.dataset.processed = 'true';
                    // 移除寬高限制，讓 Flickr 自行決定
                    const img = embed.querySelector('img');
                    if (img) {
                        img.removeAttribute('width');
                        img.removeAttribute('height');
                    }
                }
            });
        }
    }
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
                movie.parsedData = parseMovieMarkdown(content, movie.file);
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
                travel.parsedData = parseTravelMarkdown(content, travel.file);
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
            const htmlContent = convertMarkdownToHtml(movie.fullContent, movie.file);
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
            const htmlContent = convertMarkdownToHtml(travel.fullContent, travel.file);
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
                // 計算 navbar 的高度
                const navbar = document.querySelector('.navbar');
                const navbarHeight = navbar ? navbar.offsetHeight : 0;
                
                // 根據螢幕尺寸調整額外間距（進一步減少）
                const isMobile = window.innerWidth <= 768;
                const extraOffset = isMobile ? 0 : 5; // 幾乎不要額外間距
                
                // 計算目標位置，減去 navbar 高度和極少的額外間距
                const targetPosition = target.offsetTop - navbarHeight - extraOffset;
                
                window.scrollTo({
                    top: Math.max(0, targetPosition), // 確保不會滾動到負數位置
                    behavior: 'smooth'
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
