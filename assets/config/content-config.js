// 內容配置檔案 - 用於管理動態載入的 Markdown 檔案

// 電影評論檔案列表
const MOVIE_FILES = [
    {
        file: 'posts/movies/your-name-2024.md',
        id: 'your-name-2024',
        featured: true,  // 是否為精選內容
        title: '你的名字',
        genre: '動畫',
        rating: 4.5,
        watchDate: '2024年8月15日',
        description: '一部關於命運與愛情的美麗動畫，畫面精美，情感動人...'
    }
    // 新增電影時，在這裡添加新條目
    // {
    //     file: 'posts/movies/spirited-away-2024.md',
    //     id: 'spirited-away-2024',
    //     featured: false,
    //     title: '神隱少女',
    //     genre: '動畫',
    //     rating: 5.0,
    //     watchDate: '2024年8月20日',
    //     description: '宮崎駿的經典之作，一個關於成長與勇氣的奇幻故事...'
    // }
];

// 旅行筆記檔案列表
const TRAVEL_FILES = [
    {
        file: 'posts/travel/taiwan-around-island-2024.md',
        id: 'taiwan-2024',
        featured: true,
        title: '台灣環島之旅',
        location: '台灣',
        date: '2024年8月10日 - 8月20日',
        description: '從台北出發，一路向南，體驗台灣的多元文化與美麗風景...'
    }
    // 新增旅行時，在這裡添加新條目
    // {
    //     file: 'posts/travel/japan-kyoto-2024.md',
    //     id: 'japan-kyoto-2024',
    //     featured: false,
    //     title: '京都古都巡禮',
    //     location: '日本京都',
    //     date: '2024年9月5日 - 9月10日',
    //     description: '走訪千年古都，感受日式傳統文化的優雅與寧靜...'
    // }
];

// 內容管理功能
const CONTENT_MANAGER = {
    // 獲取所有電影
    getAllMovies: function() {
        return MOVIE_FILES;
    },
    
    // 獲取所有旅行
    getAllTravels: function() {
        return TRAVEL_FILES;
    },
    
    // 根據ID獲取電影
    getMovieById: function(id) {
        return MOVIE_FILES.find(movie => movie.id === id);
    },
    
    // 根據ID獲取旅行
    getTravelById: function(id) {
        return TRAVEL_FILES.find(travel => travel.id === id);
    },
    
    // 獲取精選電影
    getFeaturedMovies: function() {
        return MOVIE_FILES.filter(movie => movie.featured);
    },
    
    // 獲取精選旅行
    getFeaturedTravels: function() {
        return TRAVEL_FILES.filter(travel => travel.featured);
    },
    
    // 添加新電影（運行時動態添加）
    addMovie: function(movieConfig) {
        MOVIE_FILES.push(movieConfig);
    },
    
    // 添加新旅行（運行時動態添加）
    addTravel: function(travelConfig) {
        TRAVEL_FILES.push(travelConfig);
    }
};

// 導出配置供 main.js 使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MOVIE_FILES, TRAVEL_FILES, CONTENT_MANAGER };
} else {
    // 瀏覽器環境
    window.CONTENT_CONFIG = { 
        MOVIE_FILES, 
        TRAVEL_FILES, 
        CONTENT_MANAGER 
    };
}
