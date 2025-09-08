// 內容配置檔案 - 用於管理動態載入的 Markdown 檔案

// 電影評論檔案列表
const MOVIE_FILES = [
    {
        file: 'posts/movies/peace-maker-s2.md',
        id: 'peace-maker-s2',
        featured: true,  // 是否為精選內容
        title: '和平使者 Season 2',
        genre: '影集',
        rating: 4.5,
        watchDate: '2025年8月24日',
        description: '接軌DCU的作品，超人之後的故事線發展',
        images: 'posts/movies/imgs/peace_maker_s2.png'
    },
    {
        file: 'posts/movies/fantastic-4-first-step.md',
        id: 'fantastic-4-first-step',
        featured: true,  // 是否為精選內容
        title: '驚奇四超人：第一步',
        genre: '電影',
        rating: 3,
        watchDate: '2025年7月24日',
        description: 'MCU第5階段的開幕曲，但...很難讓人有更多期待...',
        images: 'posts/movies/imgs/fantastic_4_first_step.jpg'
    },
];

// 旅行筆記檔案列表
const TRAVEL_FILES = [
    {
        file: 'posts/travel/osaka-expo-2025.md',
        id: 'osaka-expo-2025',
        images: 'posts/travel/imgs/GR011874.JPG',
        featured: true,
        title: '2025大阪萬博之旅',
        location: '日本 | 大阪',
        date: '2025年6月17日 - 6月22日',
        description: '從小就心心嚮往的日本萬博，終於在2025年再度舉辦！'
    },
    {
        file: 'posts/travel/spain-honeymoon-2024.md',
        id: 'spain-honeymoon-2024',
        images: '', // 使用現有圖片
        featured: true,
        title: '西班牙蜜月旅行',
        location: '西班牙',
        date: '2024年11月15日 - 11月30日',
        description: '從台北出發，體驗西班牙的多元文化，美食與美麗風景...'
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

// 攝影札記檔案列表
const PHOTOGRAPHY_FILES = [
    {
        id: 'nagoya-2023',
        title: '2023.10 日本 | 名古屋',
        location: '日本名古屋',
        date: '2023年10月',
        description: '名古屋的城市風光與文化探索，記錄中部地區的獨特魅力。',
        featured: true,
        flickrEmbed: '<a data-flickr-embed="true" data-header="true" data-footer="true" href="https://www.flickr.com/photos/chuiyi/albums/72177720319994162" title="2023.10 日本 | 名古屋"><img src="https://live.staticflickr.com/65535/53965050771_f3be107b14.jpg" width="500" height="375" alt="2023.10 日本 | 名古屋"/></a>',
        albumUrl: 'https://www.flickr.com/photos/chuiyi/albums/72177720319994162'
    },
    {
        id: 'kamakura-enoshima-2023',
        title: '神奈川，鐮倉x江之島',
        location: '日本神奈川',
        date: '2023年8月',
        description: '在鐮倉和江之島的攝影旅程，捕捉古都與海島的美麗瞬間。',
        featured: true,
        flickrEmbed: '<a data-flickr-embed="true" data-header="true" data-footer="true" href="https://www.flickr.com/photos/chuiyi/albums/72177720320156114" title="2023.08 日本 | 神奈川,鐮倉x江之島"><img src="https://live.staticflickr.com/65535/53977575351_aef9a7096a.jpg" width="500" height="375" alt="2023.08 日本 | 神奈川,鐮倉x江之島"/></a>',
        albumUrl: 'https://www.flickr.com/photos/chuiyi/albums/72177720320156114'
    },
    {
        id: 'ricoh-gr-iiix',
        title: 'Ricoh GR IIIx',
        location: '街頭攝影',
        date: '2023年',
        description: '使用 Ricoh GR IIIx 相機進行的街頭攝影作品集，記錄日常生活的美好瞬間。',
        featured: true,
        flickrEmbed: '<a data-flickr-embed="true" data-header="true" data-footer="true" href="https://www.flickr.com/photos/chuiyi/albums/72177720306570600" title="Ricoh GR IIIx"><img src="https://live.staticflickr.com/65535/52684597080_4e6a52600b.jpg" width="500" height="375" alt="Ricoh GR IIIx"/></a>',
        albumUrl: 'https://www.flickr.com/photos/chuiyi/albums/72177720306570600'
    }
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
    
    // 獲取所有攝影札記
    getAllPhotographies: function() {
        return PHOTOGRAPHY_FILES;
    },
    
    // 根據ID獲取電影
    getMovieById: function(id) {
        return MOVIE_FILES.find(movie => movie.id === id);
    },
    
    // 根據ID獲取旅行
    getTravelById: function(id) {
        return TRAVEL_FILES.find(travel => travel.id === id);
    },
    
    // 根據ID獲取攝影札記
    getPhotographyById: function(id) {
        return PHOTOGRAPHY_FILES.find(photo => photo.id === id);
    },
    
    // 獲取精選電影
    getFeaturedMovies: function() {
        return MOVIE_FILES.filter(movie => movie.featured);
    },
    
    // 獲取精選旅行
    getFeaturedTravels: function() {
        return TRAVEL_FILES.filter(travel => travel.featured);
    },
    
    // 獲取精選攝影札記
    getFeaturedPhotographies: function() {
        return PHOTOGRAPHY_FILES.filter(photo => photo.featured);
    },
    
    // 添加新電影（運行時動態添加）
    addMovie: function(movieConfig) {
        MOVIE_FILES.push(movieConfig);
    },
    
    // 添加新旅行（運行時動態添加）
    addTravel: function(travelConfig) {
        TRAVEL_FILES.push(travelConfig);
    },
    
    // 添加新攝影札記（運行時動態添加）
    addPhotography: function(photoConfig) {
        PHOTOGRAPHY_FILES.push(photoConfig);
    }
};

// 導出配置供 main.js 使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MOVIE_FILES, TRAVEL_FILES, PHOTOGRAPHY_FILES, CONTENT_MANAGER };
} else {
    // 瀏覽器環境
    window.CONTENT_CONFIG = { 
        MOVIE_FILES, 
        TRAVEL_FILES, 
        PHOTOGRAPHY_FILES,
        CONTENT_MANAGER 
    };
}
