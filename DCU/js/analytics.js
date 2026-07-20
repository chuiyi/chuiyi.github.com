/**
 * Google Analytics (GA4) 共用初始化 + 自訂事件追蹤輔助函式
 * 由每個頁面的 <head> 以 <script src="/assets/js/analytics.js"></script> 引入
 */
(function () {
    'use strict';

    var GA_MEASUREMENT_ID = 'G-X6DCTL1SXW';

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID);

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(script);

    // 各子站呼叫 window.trackEvent('event_name', { key: value }) 記錄自訂事件
    window.trackEvent = function (eventName, params) {
        if (typeof gtag === 'function') {
            gtag('event', eventName, params || {});
        }
    };
})();
