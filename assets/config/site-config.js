// 網站配置文件 - 控制首頁的文字內容和社交媒體連結

const SITE_CONFIG = {
    // 首頁 Hero Section
    hero: {
        title: "生活，如此平凡",
        subtitle: "在這裡記錄著每一次旅行的足跡，每一部電影的感動。<br>用文字織就時光的詩篇，用影像留住歲月的溫柔。"
    },
    
    // 各區塊標題和副標題
    sections: {
        about: {
            title: "關於這個小角落",
            subtitle: "我是一個熱愛生活的人，喜歡透過旅行發現世界的美好，也喜歡在電影中尋找人生的感悟。在這個數位時代，我希望能用文字和影像記錄下這些珍貴的時刻。此網頁以 vibe coding 撰寫中。"
        },
        travel: {
            title: "旅行札記",
            subtitle: "記錄每一段美好的旅程"
        },
        movies: {
            title: "影劇回憶", 
            subtitle: "分享每一部觸動心靈的電影"
        },
        photography: {
            title: "攝影日記",
            subtitle: "透過鏡頭捕捉生活中的美好瞬間"
        }
    },
    
    // 頁尾版權聲明
    footer: {
        copyright: "&copy; 2025 Chuiyi 的生活札記. All rights reserved."
    },
    
    // 社交媒體連結
    socialLinks: {
        github: {
            url: "https://github.com/chuiyi",
            icon: "bi-github",
            title: "GitHub"
        },
        email: {
            url: "mailto:chuiyilin@gmail.com", // 請更換為實際的 email
            icon: "bi-envelope",
            title: "Email"
        },
        instagram: {
            url: "https://www.instagram.com/chuiyi", // 請更換為實際的 Instagram 連結
            icon: "bi-instagram", 
            title: "Instagram"
        },
        youtube: {
            url: "https://www.youtube.com/@chuiyi_studio", // 請更換為實際的 YouTube 連結
            icon: "bi-youtube",
            title: "YouTube"
        }
    },
    
    // 導航連結
    navigation: {
        brand: "Chuiyi 的生活札記",
        github: {
            url: "https://github.com/chuiyi",
            title: "GitHub"
        }
    }
};

// 導出配置供其他 JavaScript 文件使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SITE_CONFIG;
}
