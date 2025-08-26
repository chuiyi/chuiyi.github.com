// 內容配置檔案 - 用於管理動態載入的 Markdown 檔案

// 電影評論檔案列表
const MOVIE_FILES = [
    {
        file: 'posts/movies/your-name-2024.md',
        id: 'your-name-2024',
        featured: true  // 是否為精選內容
    }
    // 新增電影時，在這裡添加新條目
    // {
    //     file: 'posts/movies/new-movie-2024.md',
    //     id: 'new-movie-2024',
    //     featured: false
    // }
];

// 旅行筆記檔案列表
const TRAVEL_FILES = [
    {
        file: 'posts/travel/taiwan-around-island-2024.md',
        id: 'taiwan-2024',
        featured: true
    }
    // 新增旅行時，在這裡添加新條目
    // {
    //     file: 'posts/travel/new-travel-2024.md',
    //     id: 'new-travel-2024',
    //     featured: false
    // }
];

// 導出配置供 main.js 使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MOVIE_FILES, TRAVEL_FILES };
} else {
    // 瀏覽器環境
    window.CONTENT_CONFIG = { MOVIE_FILES, TRAVEL_FILES };
}
