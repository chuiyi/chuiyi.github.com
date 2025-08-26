// Main JavaScript for Chuiy's Website

// 電影和旅行數據
let movieData = [];
let travelData = [];

// 等待 DOM 載入完成
document.addEventListener('DOMContentLoaded', function() {
    // 初始化應用
    initializeApp();
    
    // 載入動態內容
    loadMovieReviews();
    loadTravelPosts();
    
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
    console.log('Chuiy\'s Website Initialized - Dynamic MD Loading Enabled');
}

// 動態載入電影評論
async function loadMovieReviews() {
    try {
        // 從配置檔案中獲取電影檔案列表
        const movieFiles = window.CONTENT_CONFIG ? window.CONTENT_CONFIG.MOVIE_FILES : [
            {
                file: 'posts/movies/your-name-2024.md',
                id: 'your-name-2024'
            }
        ];
        
        for (const movie of movieFiles) {
            try {
                const content = await fetchMarkdownFile(movie.file);
                const parsedMovie = parseMovieMarkdown(content, movie.id);
                parsedMovie.featured = movie.featured || false;
                movieData.push(parsedMovie);
            } catch (error) {
                console.warn(`無法載入電影檔案: ${movie.file}`, error);
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
        // 從配置檔案中獲取旅行檔案列表
        const travelFiles = window.CONTENT_CONFIG ? window.CONTENT_CONFIG.TRAVEL_FILES : [
            {
                file: 'posts/travel/taiwan-around-island-2024.md',
                id: 'taiwan-2024'
            }
        ];
        
        for (const travel of travelFiles) {
            try {
                const content = await fetchMarkdownFile(travel.file);
                const parsedTravel = parseTravelMarkdown(content, travel.id);
                parsedTravel.featured = travel.featured || false;
                travelData.push(parsedTravel);
            } catch (error) {
                console.warn(`無法載入旅行檔案: ${travel.file}`, error);
            }
        }
        
        // 渲染旅行卡片
        renderTravelCards();
        
    } catch (error) {
        console.error('載入旅行筆記時發生錯誤:', error);
    }
}

// 獲取 Markdown 檔案內容
async function fetchMarkdownFile(filePath) {
    const response = await fetch(filePath);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
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
    const addButton = movieContainer.querySelector('.border-dashed')?.parentElement;
    
    // 清空現有的電影卡片（保留新增按鈕）
    const existingCards = movieContainer.querySelectorAll('.movie-card');
    existingCards.forEach(card => card.parentElement.remove());
    
    movieData.forEach(movie => {
        const movieElement = createMovieCardElement(movie);
        if (addButton) {
            movieContainer.insertBefore(movieElement, addButton);
        } else {
            movieContainer.appendChild(movieElement);
        }
    });
}

// 渲染旅行卡片
function renderTravelCards() {
    const travelContainer = document.getElementById('travel-posts');
    const addButton = travelContainer.querySelector('.border-dashed')?.parentElement;
    
    // 清空現有的旅行卡片（保留新增按鈕）
    const existingCards = travelContainer.querySelectorAll('.travel-card');
    existingCards.forEach(card => card.parentElement.remove());
    
    travelData.forEach(travel => {
        const travelElement = createTravelCardElement(travel);
        if (addButton) {
            travelContainer.insertBefore(travelElement, addButton);
        } else {
            travelContainer.appendChild(travelElement);
        }
    });
}

// 創建電影卡片元素
function createMovieCardElement(movie) {
    const col = document.createElement('div');
    col.className = 'col-lg-4 col-md-6';
    
    const stars = generateStarRating(movie.rating);
    const genreClasses = getGenreClass(movie.genre);
    
    col.innerHTML = `
        <div class="card shadow-sm h-100 movie-card bg-secondary text-white">
            <div class="bg-danger rounded-top d-flex align-items-center justify-content-center" 
                 style="height: 300px;">
                <div class="text-center">
                    <i class="bi bi-film text-white" style="font-size: 4rem;"></i>
                    <p class="mt-2 mb-0 text-white">${movie.title}</p>
                </div>
            </div>
            <div class="card-body">
                <h5 class="card-title text-white">${movie.title}</h5>
                <div class="mb-2">
                    <span class="badge ${genreClasses} me-2">${movie.genre}</span>
                    <span class="text-warning">
                        ${stars}
                        ${movie.rating}/5
                    </span>
                </div>
                <p class="card-text text-light">
                    ${movie.plot.substring(0, 80)}${movie.plot.length > 80 ? '...' : ''}
                </p>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-light">${movie.watchDate}</small>
                    <button class="btn btn-outline-info btn-sm" onclick="showMovieDetail('${movie.id}')">
                        <i class="bi bi-eye me-1"></i>完整評論
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return col;
}

// 創建旅行卡片元素
function createTravelCardElement(travel) {
    const col = document.createElement('div');
    col.className = 'col-lg-6';
    
    // 從日期中提取年月
    const dateMatch = travel.date.match(/(\d{4})年(\d{1,2})月/);
    const dateBadge = dateMatch ? `${dateMatch[1]}.${dateMatch[2].padStart(2, '0')}` : '2024.08';
    
    col.innerHTML = `
        <div class="card shadow-sm h-100 travel-card bg-dark text-white">
            <div class="bg-success rounded d-flex align-items-center justify-content-center" 
                 style="height: 250px;">
                <div class="text-center">
                    <i class="bi bi-image text-white" style="font-size: 4rem;"></i>
                    <p class="mt-2 mb-0 text-white">旅行照片</p>
                </div>
            </div>
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h5 class="card-title text-white">${travel.title}</h5>
                    <span class="badge bg-success">${dateBadge}</span>
                </div>
                <p class="card-text text-light">
                    ${travel.content.substring(0, 100)}${travel.content.length > 100 ? '...' : ''}
                </p>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-light">
                        <i class="bi bi-geo-alt me-1"></i>${travel.location}
                    </small>
                    <div>
                        <button class="btn btn-outline-info btn-sm" onclick="showTravelDetail('${travel.id}')">
                            <i class="bi bi-eye me-1"></i>查看詳情
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return col;
}

// 顯示電影詳情 Modal
function showMovieDetail(movieId) {
    const movie = movieData.find(m => m.id === movieId);
    if (!movie) {
        console.error('找不到電影資料:', movieId);
        return;
    }
    
    // 動態更新 Modal 內容
    updateMovieModal(movie);
    
    // 顯示 Modal
    const modal = new bootstrap.Modal(document.getElementById('movieModal1'));
    modal.show();
}

// 顯示旅行詳情 Modal  
function showTravelDetail(travelId) {
    const travel = travelData.find(t => t.id === travelId);
    if (!travel) {
        console.error('找不到旅行資料:', travelId);
        return;
    }
    
    // 動態更新 Modal 內容
    updateTravelModal(travel);
    
    // 顯示 Modal
    const modal = new bootstrap.Modal(document.getElementById('travelModal1'));
    modal.show();
}

// 更新電影 Modal 內容
function updateMovieModal(movie) {
    const modal = document.getElementById('movieModal1');
    
    // 更新標題
    modal.querySelector('.modal-title').textContent = `${movie.title} - 完整評論`;
    
    // 更新海報區域的電影名稱
    modal.querySelector('.bg-danger p').textContent = movie.title;
    
    // 更新電影資訊
    const infoCard = modal.querySelector('.card-body');
    infoCard.innerHTML = `
        <h6 class="card-title text-warning mb-3">
            <i class="bi bi-info-circle me-2"></i>電影資訊
        </h6>
        <div class="small text-light">
            <div class="mb-2"><strong>原名:</strong> ${movie.originalTitle}</div>
            <div class="mb-2"><strong>導演:</strong> ${movie.director}</div>
            <div class="mb-2"><strong>年份:</strong> ${movie.year}</div>
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
    `;
    
    // 更新主要內容
    const contentArea = modal.querySelector('.movie-review-content');
    contentArea.innerHTML = `
        <h5 class="text-info mb-3">
            <i class="bi bi-chat-quote me-2"></i>一部關於命運與愛情的動畫傑作
        </h5>
        
        <!-- 劇情簡介 -->
        <div class="mb-4">
            <h6 class="text-warning border-bottom border-secondary pb-2">
                <i class="bi bi-play-circle me-2"></i>劇情簡介
            </h6>
            <p class="text-light">${movie.plot}</p>
        </div>

        <!-- 觀影心得 -->
        <div class="mb-4">
            <h6 class="text-warning border-bottom border-secondary pb-2">
                <i class="bi bi-heart me-2"></i>觀影心得
            </h6>
            
            ${movie.reviews.visual ? `
            <div class="mb-3">
                <h6 class="text-info h6">視覺呈現</h6>
                <p class="text-light">${movie.reviews.visual}</p>
            </div>
            ` : ''}

            ${movie.reviews.story ? `
            <div class="mb-3">
                <h6 class="text-info h6">故事情節</h6>
                <p class="text-light">${movie.reviews.story}</p>
            </div>
            ` : ''}

            ${movie.reviews.music ? `
            <div class="mb-3">
                <h6 class="text-info h6">音樂配樂</h6>
                <p class="text-light">${movie.reviews.music}</p>
            </div>
            ` : ''}

            ${movie.reviews.meaning ? `
            <div class="mb-3">
                <h6 class="text-info h6">深層含義</h6>
                <p class="text-light">${movie.reviews.meaning}</p>
            </div>
            ` : ''}
        </div>

        <!-- 標籤 -->
        <div class="mb-3">
            <h6 class="text-warning">
                <i class="bi bi-tags me-2"></i>標籤
            </h6>
            <div class="d-flex flex-wrap gap-1">
                ${movie.tags.map(tag => `<span class="badge bg-primary">#${tag}</span>`).join('')}
            </div>
        </div>

        <!-- 相關討論 -->
        <div class="alert alert-info">
            <i class="bi bi-info-circle me-2"></i>
            <strong>相關討論:</strong> 這裡可以嵌入相關的社群討論或影評貼文
        </div>
    `;
}

// 更新旅行 Modal 內容
function updateTravelModal(travel) {
    const modal = document.getElementById('travelModal1');
    
    // 更新標題
    modal.querySelector('.modal-title').textContent = travel.title;
    
    // 更新內容
    const modalBody = modal.querySelector('.modal-body');
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
                    <div class="card-body p-3">
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
        <div class="travel-content mb-4">
            <h6 class="text-warning border-bottom border-secondary pb-2">
                <i class="bi bi-heart me-2"></i>旅行心得
            </h6>
            <p class="text-light">${travel.content}</p>
        </div>
        
        ${travel.highlights && travel.highlights.length > 0 ? `
        <!-- 印象深刻的景點 -->
        <div class="mb-4">
            <h6 class="text-warning border-bottom border-secondary pb-2">
                <i class="bi bi-geo-alt me-2"></i>印象深刻的景點
            </h6>
            <div class="row g-3">
                ${travel.highlights.map((highlight, index) => `
                    <div class="col-md-6">
                        <div class="card bg-secondary border-0">
                            <div class="card-body p-3">
                                <h6 class="text-info">${highlight.name}</h6>
                                <p class="text-light small mb-0">${highlight.description}</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
        ${travel.foods && travel.foods.length > 0 ? `
        <!-- 美食體驗 -->
        <div class="mb-4">
            <h6 class="text-warning border-bottom border-secondary pb-2">
                <i class="bi bi-cup-hot me-2"></i>美食體驗
            </h6>
            <div class="d-flex flex-wrap gap-2">
                ${travel.foods.map(food => `
                    <span class="badge bg-success">${food}</span>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
        ${travel.tips && travel.tips.length > 0 ? `
        <!-- 旅行建議 -->
        <div class="mb-4">
            <h6 class="text-warning border-bottom border-secondary pb-2">
                <i class="bi bi-lightbulb me-2"></i>旅行建議
            </h6>
            <ul class="text-light">
                ${travel.tips.map(tip => `<li>${tip}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        
        <div class="alert alert-info">
            <i class="bi bi-info-circle me-2"></i>
            這裡可以嵌入 Flickr 相冊或 Instagram 貼文
        </div>
    `;
}

// 產生星級評分 HTML
function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="bi bi-star-fill"></i>';
    }
    if (hasHalfStar) {
        stars += '<i class="bi bi-star-half"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="bi bi-star"></i>';
    }
    
    return stars;
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

// Show travel detail (placeholder function)
function showTravelDetail(title) {
    console.log('Showing travel detail for:', title);
    // This would open a modal with full travel details
    showNotification('旅行詳情功能開發中...', 'info');
}

// Show movie detail (placeholder function)
function showMovieDetail(title) {
    console.log('Showing movie detail for:', title);
    // This would open a modal with full movie review
    showNotification('電影詳情功能開發中...', 'info');
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
