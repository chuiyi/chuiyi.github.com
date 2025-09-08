// 網站配置文件 - 控制首頁的文字內容和社交媒體連結

const SITE_CONFIG = {
    // 首頁 Hero Section
    hero: {
        title: "生活，如此平凡",
        subtitle: "旅行了這麼多趟，該是時候好好整理這些回憶了。<br>而好看的電影跟好看的照片則是不斷的增加，也一起整理在這裡吧。"
    },
    
    // 各區塊標題和副標題
    sections: {
        about: {
            title: "關於這個小角落",
            subtitle: `多年後重拾這個空間，正好vibe coding流行起來，就讓AI協助發展吧。
            <br>此網頁以 vibe coding 撰寫中。`
        },
        travel: {
            title: "旅行札記",
            subtitle: "記錄每一段美好與不美好的旅程"
        },
        movies: {
            title: "影劇回憶", 
            subtitle: "電影跟戲劇雜食者，從溫馨到獵奇通吃"
        },
        photography: {
            title: "攝影紀實",
            subtitle: "喜歡拍照，希望照片也能被喜歡"
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
