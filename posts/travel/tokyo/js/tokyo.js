const DATA_FILE = "trip-data.json";
const CHECKLIST_STORAGE_KEY = "tokyo-trip-checklist-v2";
const CARD_COMPLETION_KEY = "tokyo-cards-completion-v1";
const MAP_GEOCODE_CACHE_KEY = "tokyo-area-map-geocode-cache-v1";
const GOOGLE_MAPS_API_KEY = "AIzaSyAK0en_h_LMU53zCJ27q25zymAnzJ4RT6A";

// ===== 測試用時間覆蓋變數 =====
// 設為 null 表示使用真實系統時間
// 設為日期字串可模擬特定時間點，例如："2026-05-30T00:00:00+09:00" 或 "2026-05-30"
// const TEST_CURRENT_TIME_OVERRIDE = "2026-06-03T00:00:00+08:00"; // 行程結束後
// const TEST_CURRENT_TIME_OVERRIDE = "2026-05-29T09:29:00+08:00"; // 行程進行中
const TEST_CURRENT_TIME_OVERRIDE = null; // 使用真實時間

/**
 * 統一取得當前時間（支援測試時間覆寫）
 */
function getCurrentTime() {
    return TEST_CURRENT_TIME_OVERRIDE ? new Date(TEST_CURRENT_TIME_OVERRIDE) : new Date();
}

const ThemeManager = {
    init() {
        const savedTheme = localStorage.getItem("chuiy-theme") || "light";
        this.setTheme(savedTheme);

        const themeToggle = document.getElementById("themeToggle");
        if (themeToggle) {
            themeToggle.addEventListener("click", (e) => {
                e.preventDefault();
                this.toggleTheme();
            });
        }
    },

    setTheme(theme) {
        const html = document.documentElement;
        if (theme === "dark") {
            html.setAttribute("data-theme", "dark");
        } else {
            html.removeAttribute("data-theme");
        }
        localStorage.setItem("chuiy-theme", theme);
    },

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        this.setTheme(newTheme);
    }
};

const state = {
    tripData: null,
    overviewMarkdown: "",
    othersMarkdown: "",
    activeTab: "timeline",
    timelineDayId: null,
    transportDayFilter: "all",
    transportTypeFilter: "all",
    selectedTimelineId: null,
    expandedTimelineId: null,
    checklistState: {},
    cardCompletionState: {},
    mapPoints: [],
    mapAreaFilter: "all",
    mapSelectionId: null,
    mapGeocodeCache: {},
    mapObject: null,
    mapMarkers: new Map(),
    mapInfoWindow: null,
    mapInitTried: false,
    mapApiReady: false,
    mapGeocodeJobId: 0,
    previousCountdown: { days: -1, hours: -1, minutes: -1, seconds: -1 },
    previousTimelineState: { currentId: null, nextId: null } // 記錄上次的行程狀態
};

document.addEventListener("DOMContentLoaded", async () => {
    ThemeManager.init();
    await loadPageData();
    initializeState();
    renderPage();
    bindEvents();
    setupMasonryResizeListener();
    startRealtimeUpdates();
});

async function loadPageData() {
    const response = await fetch(DATA_FILE);
    if (!response.ok) {
        throw new Error("無法讀取東京旅遊資料");
    }

    state.tripData = await response.json();
    // state.overviewMarkdown = await getMarkdownContent(state.tripData.markdown.overview); // 不再顯示大綱補充，保留 md 檔案供補充
    state.othersMarkdown = await getMarkdownContent(state.tripData.markdown.others);
}

async function getMarkdownContent(filePath) {
    if (!filePath) return "";
    const response = await fetch(filePath);
    if (!response.ok) {
        return "";
    }
    return response.text();
}

function initializeState() {
    state.timelineDayId = state.tripData.timelineDays[0]?.id || null;
    state.selectedTimelineId = getRecommendedTimelineItem()?.id || null;
    state.checklistState = loadChecklistState();
    state.cardCompletionState = loadCardCompletionState();
    state.mapGeocodeCache = loadMapGeocodeCache();
    state.mapPoints = buildMapPointsFromTripData();
}

/**
 * 渲染相關資訊面板（在卡片完成狀態變更時調用）
 * 重新計算瀑布流布局以適應卡片高度變化
 */
function renderRelatedInfoPanel() {
    // 保留函式供卡片勾選事件呼叫，時程表相關資訊不使用瀑布流
}

/**
 * 目前改為純 CSS 瀑布流（columns），此函式保留為相容介面
 */
function initMasonryLayout() {
    return;
}

/**
 * 監聽窗口 resize 事件，重新計算瀑布流布局
 */
function setupMasonryResizeListener() {
    return;
}

function bindEvents() {
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("change", handleDocumentChange);
}

function handleDocumentClick(event) {
    const tabButton = event.target.closest(".trip-tab");
    if (tabButton) {
        setActiveTab(tabButton.dataset.tab);
        return;
    }

    const openVjwButton = event.target.closest("[data-open-vjw]");
    if (openVjwButton) {
        updateVjwModal();
        const modalElement = document.getElementById("vjwModal");
        bootstrap.Modal.getOrCreateInstance(modalElement).show();
        return;
    }

    const openCompletedListButton = event.target.closest("[data-open-completed-list]");
    if (openCompletedListButton) {
        renderCompletedListModal();
        const modalElement = document.getElementById("completedListModal");
        bootstrap.Modal.getOrCreateInstance(modalElement).show();
        return;
    }

    const mapFilterButton = event.target.closest("[data-area-filter]");
    if (mapFilterButton) {
        setAreaMapFilter(mapFilterButton.dataset.areaFilter);
        return;
    }

    const mapListItem = event.target.closest("[data-map-point-id]");
    if (mapListItem) {
        const pointId = mapListItem.dataset.mapPointId;
        focusMapPointById(pointId, true);
        return;
    }

    const timelineDayButton = event.target.closest(".timeline-day-btn");
    if (timelineDayButton) {
        state.timelineDayId = timelineDayButton.dataset.dayId;
        renderTimelinePanel();
        return;
    }

    // 相關資訊區塊展開/收合
    const relatedGroupHeader = event.target.closest(".related-group-header");
    if (relatedGroupHeader) {
        toggleRelatedGroup(relatedGroupHeader);
        return;
    }

    const relatedToggle = event.target.closest("[data-related-toggle]");
    if (relatedToggle) {
        toggleRelatedGroup(relatedToggle);
        return;
    }

    // transport-day-btn 已移除，不再需要篩選處理

    const timelineItem = event.target.closest(".timeline-item");
    if (timelineItem) {
        // 如果沒有相關資訊，不做任何事
        const hasRelatedInfo = timelineItem.dataset.hasRelated === "true";
        if (!hasRelatedInfo) {
            return;
        }
        
        // 如果點擊的是相關資訊區域內的元素，且不是外部連結，不觸發收合
        const relatedArea = event.target.closest(".timeline-item-related");
        const compactCard = event.target.closest(".compact-card");
        const isExternalLink = event.target.closest("a[href]");
        
        if (relatedArea && !compactCard) {
            // 點擊在相關資訊背景區域，但不是卡片本身，不做任何事
            return;
        }
        
        if (compactCard && relatedArea) {
            // 如果用戶正在選取文字，不觸發收合
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) {
                return;
            }
            
            // 如果點擊的是圖片或圖片導航按鈕，不觸發收合
            const isImageElement = event.target.closest(".compact-detail-image, .compact-detail-gallery, .gallery-btn, .gallery-indicator, .carousel-control-prev, .carousel-control-next");
            if (isImageElement) {
                return;
            }
            
            // 如果點擊的是卡片詳細內容區域（非標題和摘要），不觸發收合
            const isDetailsArea = event.target.closest(".compact-card-details");
            const isHeaderOrSummary = event.target.closest(".compact-card-header, .compact-card-summary");
            
            // 只有點擊標題或摘要區域才觸發收合，點擊詳細區域不觸發
            if (isDetailsArea && !isHeaderOrSummary) {
                return;
            }
            
            // 點擊緊湊卡片的標題或摘要，切換該卡片的展開/收合
            toggleCompactCard(compactCard);
            return;
        }
        
        if (isExternalLink && relatedArea) {
            // 點擊外部連結，不觸發任何事件，讓連結正常工作
            return;
        }
        
        // 如果用戶正在選取文字，不觸發收合
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
            return;
        }
        
        // 點擊行程卡片主體，切換展開/收合
        const itemId = timelineItem.dataset.itemId;
        if (state.expandedTimelineId === itemId) {
            // 收合時取消選取
            state.expandedTimelineId = null;
            state.selectedTimelineId = null;
        } else {
            // 展開時選取
            state.expandedTimelineId = itemId;
            state.selectedTimelineId = itemId;
        }
        renderTimelinePanel();
        renderTransportPanel();
        renderSightseeingPanel();
        renderManholeCardPanel();
        renderDiningPanel();
        renderSouvenirPanel();
        renderOthersPanel();
        updateHeroPhase();
        return;
    }

    const copyButton = event.target.closest("[data-copy-target]");
    if (copyButton) {
        copyTextareaValue(copyButton.dataset.copyTarget);
        return;
    }

    const checklistActionButton = event.target.closest("[data-checklist-action]");
    if (checklistActionButton) {
        handleChecklistAction(checklistActionButton.dataset.checklistAction);
        return;
    }

    const checklistToggleButton = event.target.closest("[data-toggle-group]");
    if (checklistToggleButton) {
        toggleChecklistGroup(checklistToggleButton);
        return;
    }

    const stayDetailToggleButton = event.target.closest("[data-stay-detail-toggle]");
    if (stayDetailToggleButton) {
        toggleStayDetail(stayDetailToggleButton);
        return;
    }
}

function handleDocumentChange(event) {
    if (event.target.matches(".checklist-parent-input")) {
        toggleChecklistBranch(event.target.dataset.branchId, event.target.checked);
        renderChecklistPanel();
        return;
    }

    if (event.target.matches(".checklist-nested-parent")) {
        toggleChecklistItem(event.target.dataset.itemId, event.target.checked);
        renderChecklistPanel();
        return;
    }

    if (event.target.matches(".checklist-child-input")) {
        state.checklistState[event.target.dataset.itemId] = event.target.checked;
        persistChecklistState();
        renderChecklistPanel();
        return;
    }

    // 已完成清單的 checkbox
    if (event.target.matches(".completed-item-checkbox input[type='checkbox']")) {
        const checkbox = event.target;
        const cardType = checkbox.dataset.cardType;
        const cardId = checkbox.dataset.cardId;
        const isNowChecked = checkbox.checked;
        
        // 如果是取消勾選（checked = false），觸發垃圾桶動畫
        if (!isNowChecked) {
            // 阻止預設行為，保持 checkbox 為 checked 狀態，等動畫完成再更新
            checkbox.checked = true;
            
            const completedItem = checkbox.closest('.completed-item');
            if (completedItem) {
                playTrashAnimation(completedItem, cardType, cardId);
                return;
            }
        }
        
        // 如果是重新勾選（不應該發生，但保留處理邏輯）
        toggleCardCompletion(cardType, cardId);
        renderTimelinePanel();
        renderTransportPanel();
        renderSightseeingPanel();
        renderManholeCardPanel();
        renderDiningPanel();
        renderSouvenirPanel();
        renderOthersPanel();
        renderCompletedListModal();
    }
}

function renderPage() {
    renderHero();
    // renderSidebar();
    // renderOverviewPanel(); // 大綱功能已移除，保留 VJW 功能
    renderTimelinePanel();
    renderTransportPanel();
    renderSightseeingPanel();
    renderManholeCardPanel();
    renderDiningPanel();
    renderSouvenirPanel();
    renderAreaMapPanel();
    renderChecklistPanel();
    renderOthersPanel();
    updateTripMetaText();
    updateVjwModal();
    syncTabUi();
    
    // 初始化時程表狀態記錄
    const initialTimelineState = getTimelineState();
    state.previousTimelineState.currentId = initialTimelineState.current?.id || null;
    state.previousTimelineState.nextId = initialTimelineState.next?.id || null;
}

function renderHero() {
    const trip = state.tripData.trip;
    setText("tokyo-title", trip.title);
    setText("tokyo-subtitle", trip.subtitle);
    setText("tokyo-range", trip.dateRangeLabel);
    setText("tokyo-timezone", trip.timezone);
    setText("tokyo-updated", `更新：${trip.lastUpdated}`);

    const heroTags = document.getElementById("hero-tags");
    heroTags.innerHTML = [
        createPillHtml(`${state.tripData.timelineDays.length} 天行程`, "bi-calendar3"),
        createPillHtml(`${state.tripData.dining.length} 間餐飲`, "bi-cup-hot"),
        createPillHtml(`${state.tripData.souvenirs.length} 項伴手禮`, "bi-bag-heart"),
        createPillHtml(`${state.tripData.manholeCards.length} 張人孔蓋卡`, "bi-record-circle")
    ].join("");

    updateCountdown();
    updateHeroPhase();
}

function updateHeroPhase() {
    const timelineState = getTimelineState();
    const statusTarget = document.getElementById("hero-status-card");
    
    if (!statusTarget) {
        return;
    }

    // 判断是否旅程已结束
    const allItems = getFlattenedTimeline();
    const now = getCurrentTime();
    const allEnded = allItems.length > 0 && allItems.every(item => new Date(item.end) < now);
    
    if (allEnded) {
        statusTarget.innerHTML = `
            <p class="hero-side-label">目前狀態</p>
            <div class="timeline-status-title">旅途完成</div>
            <div class="hero-side-text">所有行程已完成，感謝同行！</div>
        `;
        return;
    }

    // 永遠顯示目前/下一個行程（不受 selectedTimelineId 影響）
    const focusItem = timelineState.current || timelineState.next;
    
    statusTarget.innerHTML = `
        <p class="hero-side-label">目前狀態</p>
        <div class="timeline-status-title">${timelineState.phaseTitle}</div>
        <div class="hero-side-text">${timelineState.phaseText}</div>
        ${focusItem ? `<div class="mini-pill mt-2">${focusItem.dayLabel} · ${focusItem.title}</div>` : ""}
        ${focusItem ? `<button type="button" class="btn-literary btn-sm mt-2" onclick="jumpToCurrentTimeline()" style="width: 100%; font-size: 0.82rem; padding: 0.4rem 0.5rem; border-radius: 8px;"><i class="bi bi-arrow-down-circle me-1"></i>跳轉到該行程</button>` : ""}
    `;
}

// Trip Console removed - function disabled
// function renderSidebar() {
//     const timelineState = getTimelineState();
//     const vjwData = buildVjwBlocks();
//     const summaryTarget = document.getElementById("sidebar-summary");
//     const stayComplete = vjwData.missingFields.length === 0 ? "已齊全" : `${vjwData.missingFields.length} 項待補`;
//     const focusItem = getTimelineItemById(state.selectedTimelineId) || timelineState.current || timelineState.next;
//
//     summaryTarget.innerHTML = `
//         <div class="sidebar-summary-grid">
//             <div class="summary-block">
//                 <div class="summary-label">目前焦點</div>
//                 <div class="summary-value">${focusItem ? focusItem.title : "尚未設定"}</div>
//             </div>
//             <div class="summary-block">
//                 <div class="summary-label">VJW 完整度</div>
//                 <div class="summary-value">${stayComplete}</div>
//             </div>
//             <div class="summary-block">
//                 <div class="summary-label">下一段交通</div>
//                 <div class="summary-value">${getNextTransportTitle()}</div>
//             </div>
//         </div>
//     `;
// }

function renderOverviewPanel() {
    const overview = state.tripData.overview;
    const outbound = overview.outboundFlight;
    const stay = getPrimaryStay();
    const allStays = getAllStays();
    const vjwData = buildVjwBlocks();

    document.getElementById("overview-alerts").innerHTML = vjwData.missingFields.length > 0
        ? `<div class="overview-warning"><strong>VJW 資料尚未完整。</strong><br>${vjwData.missingFields.join("、")}</div>`
        : "";

    document.getElementById("flight-card").innerHTML = `
        <p class="sidebar-card-label">Flight</p>
        <h3 class="card-title">航班資訊</h3>
        <dl class="info-list">
            <div class="info-row"><dt>去程</dt><dd>${outbound.airlineCode}${outbound.flightNumber} ${outbound.departureTimeLabel}</dd></div>
            <div class="info-row"><dt>路線</dt><dd>${outbound.departureAirportCode} -> ${outbound.arrivalAirportCode}</dd></div>
            <div class="info-row"><dt>回程</dt><dd>${overview.returnFlight.airlineCode}${overview.returnFlight.flightNumber} ${overview.returnFlight.departureTimeLabel}</dd></div>
            <div class="info-row"><dt>旅行名</dt><dd>${overview.travelName}</dd></div>
        </dl>
    `;

    document.getElementById("stay-card").innerHTML = `
        <p class="sidebar-card-label">Stay</p>
        <h3 class="card-title">住宿資訊</h3>
        ${allStays.map((item, index) => `
            <dl class="info-list ${index > 0 ? "mt-3" : ""}">
                <div class="info-row"><dt>時段</dt><dd>${formatValue(item.label || "未標註")}${index === 0 ? "（VJW）" : ""}</dd></div>
                <div class="info-row"><dt>住宿</dt><dd>${formatValue(item.name)}</dd></div>
                <div class="info-row"><dt>地圖</dt><dd>${item.mapsUrl ? `<a class="link-btn" href="${item.mapsUrl}" target="_blank">Google Map</a>` : ""}</dd></div>
            </dl>
            <div class="stay-detail-section">
                <button type="button" class="stay-detail-toggle-btn" data-stay-detail-toggle="stay-detail-${index}" aria-expanded="false">
                    <i class="bi bi-chevron-down me-1"></i>詳細資訊
                </button>
                ${index === 0 ? `
                    <div class="vjw-actions">
                        <button type="button" class="btn-literary" data-open-vjw="true">
                            <i class="bi bi-clipboard2-check me-1"></i>開啟 VJW
                        </button>
                    </div>
                ` : ""}
                ${renderStayDetailBlock(item, `stay-detail-${index}`)}
            </div>
        `).join("")}
    `;
}

function renderTimelinePanel() {
    const days = state.tripData.timelineDays;
    const dayTabs = document.getElementById("timeline-day-tabs");
    dayTabs.innerHTML = days.map((day) => `
        <button type="button" class="timeline-day-btn ${state.timelineDayId === day.id ? "active" : ""}" data-day-id="${day.id}">
            ${day.label} ${day.dateLabel}
        </button>
    `).join("");

    const timelineState = getTimelineState();
    const selectedDay = days.find((day) => day.id === state.timelineDayId) || days[0];
    const listTarget = document.getElementById("timeline-list");
    listTarget.innerHTML = selectedDay.items.map((item) => renderTimelineItem(item, selectedDay.id, timelineState)).join("");
}

function renderTimelineItem(item, dayId, timelineState) {
    const classes = ["timeline-item"];
    const isExpanded = state.expandedTimelineId === item.id;

    if (state.selectedTimelineId === item.id) {
        classes.push("is-selected");
    }
    if (isExpanded) {
        classes.push("is-expanded");
    }
    if (timelineState.current?.id === item.id) {
        classes.push("is-current");
    } else if (timelineState.next?.id === item.id) {
        classes.push("is-next");
    } else if (new Date(item.end) < getCurrentTime()) {
        classes.push("is-past");
    }

    // Category icon mapping
    const categoryIcons = {
        "flight": "bi-airplane-fill",
        "transport": "bi-bus-front-fill",
        "dining": "bi-cup-hot-fill",
        "shopping": "bi-bag-fill",
        "sightseeing": "bi-camera-fill",
        "accommodation": "bi-house-door-fill",
        "activity": "bi-calendar-event-fill",
        "checkin": "bi-key-fill"
    };
    
    const iconClass = item.category ? categoryIcons[item.category] || "bi-circle-fill" : "";
    const iconHtml = iconClass ? `<i class="${iconClass} me-2"></i>` : "";
    
    const hasRelatedInfo = (item.transportIds || []).length > 0 || (item.diningIds || []).length > 0 || (item.souvenirIds || []).length > 0 || (item.sightseeingIds || []).length > 0 || (item.otherInfoIds || []).length > 0 || (item.manholeCardIds || []).length > 0;
    
    // 渲染相關資訊區塊（僅在展開時）
    const relatedInfoHtml = isExpanded ? renderCompactRelatedInfo(item) : '';

    return `
        <article class="${classes.join(" ")}" data-item-id="${item.id}" data-has-related="${hasRelatedInfo}">
            <div class="timeline-item-main">
                <div class="timeline-time">${item.timeLabel}</div>
                <h3 class="timeline-item-title">${iconHtml}${item.title}</h3>
                <div class="timeline-location">${item.location}</div>
                <p class="mb-3">${item.description}</p>
                <div class="timeline-actions">
                    <div class="card-meta-pills">
                        ${hasRelatedInfo ? `<span class="hero-tag has-related-info"><i class="bi bi-link-45deg"></i>有相關資訊 ${isExpanded ? '·已展開' : ''}</span>` : ""}
                    </div>
                </div>
            </div>
            ${relatedInfoHtml}
        </article>
    `;
}

/**
 * 渲染緊湊版的相關資訊（在行程卡片內部顯示）
 */
function renderCompactRelatedInfo(item) {
    const transports = (item.transportIds || []).map(id => state.tripData.transports.find(t => t.id === id)).filter(Boolean);
    const dinings = (item.diningIds || []).map(id => state.tripData.dining.find(d => d.name === id)).filter(Boolean);
    const sightseeings = (item.sightseeingIds || []).map(id => state.tripData.sightseeing.find(s => s.name === id)).filter(Boolean);
    const souvenirs = (item.souvenirIds || []).map(id => state.tripData.souvenirs.find(s => s.name === id)).filter(Boolean);
    const otherInfos = (item.otherInfoIds || []).map(id => state.tripData.otherInfo.find(o => o.id === id)).filter(Boolean);
    const manholeCards = (item.manholeCardIds || []).map(id => state.tripData.manholeCards.find(m => m.name === id)).filter(Boolean);

    const hasAnyInfo = transports.length > 0 || dinings.length > 0 || sightseeings.length > 0 || souvenirs.length > 0 || otherInfos.length > 0 || manholeCards.length > 0;
    
    if (!hasAnyInfo) {
        return '';
    }
    
    let html = '<div class="timeline-item-related">';
    
    // 交通資訊
    if (transports.length > 0) {
        html += `<div class="related-info-section"><h4 class="related-info-title"><i class="bi bi-sign-turn-right me-1"></i>交通 (${transports.length})</h4>`;
        transports.forEach(transport => {
            html += renderCompactTransportCard(transport, true);
        });
        html += '</div>';
    }
    
    // 景點資訊
    if (sightseeings.length > 0) {
        html += `<div class="related-info-section"><h4 class="related-info-title"><i class="bi bi-camera-fill me-1"></i>景點 (${sightseeings.length})</h4>`;
        sightseeings.forEach(sight => {
            html += renderCompactSightseeingCard(sight, true);
        });
        html += '</div>';
    }
    
    // 餐飲資訊
    if (dinings.length > 0) {
        html += `<div class="related-info-section"><h4 class="related-info-title"><i class="bi bi-cup-hot me-1"></i>餐飲 (${dinings.length})</h4>`;
        dinings.forEach(dining => {
            html += renderCompactDiningCard(dining, true);
        });
        html += '</div>';
    }
    
    // 伴手禮資訊
    if (souvenirs.length > 0) {
        html += `<div class="related-info-section"><h4 class="related-info-title"><i class="bi bi-bag-heart me-1"></i>伴手禮 (${souvenirs.length})</h4>`;
        souvenirs.forEach(souvenir => {
            html += renderCompactSouvenirCard(souvenir, true);
        });
        html += '</div>';
    }
    
    // 其他資訊
    if (otherInfos.length > 0) {
        html += `<div class="related-info-section"><h4 class="related-info-title"><i class="bi bi-info-circle-fill me-1"></i>其他資訊 (${otherInfos.length})</h4>`;
        otherInfos.forEach(info => {
            html += renderCompactOtherInfoCard(info, true);
        });
        html += '</div>';
    }

    // 人孔蓋卡
    if (manholeCards.length > 0) {
        html += `<div class="related-info-section"><h4 class="related-info-title"><i class="bi bi-record-circle me-1"></i>人孔蓋卡 (${manholeCards.length})</h4>`;
        manholeCards.forEach(card => {
            html += renderCompactManholeCard(card, true);
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}

/**
 * 渲染緊湊版交通卡片
 * @param {Object} transport - 交通資料
 * @param {boolean} collapseByDefault - 是否預設收合詳細資訊（預設 false）
 */
function renderCompactTransportCard(transport, collapseByDefault = false) {
    const cardId = transport.id;
    const isCompleted = isCardCompleted('transport', cardId);
    
    // 交通工具圖標映射
    const typeIcons = {
        "航班": "bi-airplane-fill",
        "接駁車": "bi-car-front-fill",
        "機場巴士": "bi-bus-front-fill",
        "巴士": "bi-bus-front-fill",
        "JR": "bi-train-front-fill",
        "JR 快速": "bi-train-front-fill",
        "JR + 新幹線": "bi-train-front-fill",
        "接駁船": "bi-water",
        "觀光船": "bi-water",
        "徒步": "bi-person-walking"
    };
    const iconClass = typeIcons[transport.type] || "bi-geo-alt-fill";
    
    // 處理圖片：支援單張 image 或多張 images
    let imageHtml = '';
    if (transport.images && transport.images.length > 0) {
        imageHtml = renderImageGallery(transport.images, transport.title);
    } else if (transport.image) {
        imageHtml = `<div class="compact-detail-image"><img src="${transport.image}" alt="${transport.imageCaption || transport.title}" />${transport.imageCaption ? `<p class="compact-image-caption">${autoLinkify(transport.imageCaption)}</p>` : ''}</div>`;
    }
    
    return `
        <div class="compact-card ${isCompleted ? 'card-completed' : ''}" data-transport-type="${transport.type}" data-entity-type="transport" data-entity-key="${encodeEntityKey(cardId)}">
            <div class="compact-card-header">
                <div class="compact-card-tags">
                    <span class="compact-tag">${transport.type}</span>
                    <span class="compact-tag status">${transport.status}</span>
                    ${transport.websiteUrl ? `<a href="${transport.websiteUrl}" target="_blank" class="compact-map-link" title="官方網站" onclick="event.stopPropagation()"><i class="bi bi-globe"></i></a>` : ''}
                </div>
                <div class="compact-card-title-wrapper">
                    <label class="card-completion-checkbox" onclick="event.stopPropagation()">
                        <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleCardCompletion('transport', '${cardId}'); event.target.closest('.compact-card').classList.toggle('card-completed'); renderRelatedInfoPanel();" />
                        <span class="checkbox-custom"></span>
                    </label>
                    <i class="bi ${iconClass} me-2" style="color: var(--muted-brown);"></i>
                    <h5 class="compact-card-title">${transport.title}</h5>
                </div>
            </div>
            <div class="compact-card-summary">${autoLinkify(transport.route)}</div>
            <div class="compact-card-details"${collapseByDefault ? ' hidden' : ''}>
                <div class="compact-detail-row"><strong>時間</strong> ${autoLinkify(transport.depart)} → ${autoLinkify(transport.arrive)}</div>
                <div class="compact-detail-row"><strong>費用</strong> ${autoLinkify(transport.cost)}</div>
                ${transport.note ? `<div class="compact-detail-row"><strong>備註</strong> ${autoLinkify(transport.note)}</div>` : ''}
                ${imageHtml}
            </div>
        </div>
    `;
}

/**
 * 渲染緊湊版景點卡片
 * @param {Object} sight - 景點資料
 * @param {boolean} collapseByDefault - 是否預設收合詳細資訊（預設 false）
 */
function renderCompactSightseeingCard(sight, collapseByDefault = false) {
    const cardId = sight.name;
    const isCompleted = isCardCompleted('sightseeing', cardId);
    
    let imageHtml = '';
    if (sight.images && sight.images.length > 0) {
        imageHtml = renderImageGallery(sight.images, sight.name);
    } else if (sight.image) {
        imageHtml = `<div class="compact-detail-image"><img src="${sight.image}" alt="${sight.imageCaption || sight.name}" />${sight.imageCaption ? `<p class="compact-image-caption">${autoLinkify(sight.imageCaption)}</p>` : ''}</div>`;
    }
    
    return `
        <div class="compact-card ${isCompleted ? 'card-completed' : ''}" data-entity-type="sightseeing" data-entity-key="${encodeEntityKey(cardId)}">
            <div class="compact-card-header">
                <div class="compact-card-tags">
                    <span class="compact-tag">${sight.category}</span>
                    <span class="compact-tag status">${sight.visitPlan}</span>
                    ${sight.websiteUrl ? `<a href="${sight.websiteUrl}" target="_blank" class="compact-map-link" title="官方網站" onclick="event.stopPropagation()"><i class="bi bi-globe"></i></a>` : ''}
                    ${sight.mapsUrl ? `<a href="${sight.mapsUrl}" target="_blank" class="compact-map-link" title="Google Map" onclick="event.stopPropagation()"><i class="bi bi-geo-alt-fill"></i></a>` : ''}
                </div>
                <div class="compact-card-title-wrapper">
                    <label class="card-completion-checkbox" onclick="event.stopPropagation()">
                        <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleCardCompletion('sightseeing', '${cardId}'); event.target.closest('.compact-card').classList.toggle('card-completed'); renderRelatedInfoPanel();" />
                        <span class="checkbox-custom"></span>
                    </label>
                    <h5 class="compact-card-title">${sight.name}</h5>
                </div>
            </div>
            <div class="compact-card-summary">${autoLinkify(sight.area)}</div>
            <div class="compact-card-details"${collapseByDefault ? ' hidden' : ''}>
                ${sight.openingHours ? `<div class="compact-detail-row"><strong>開放時間</strong> ${autoLinkify(sight.openingHours)}</div>` : ''}
                ${sight.admission ? `<div class="compact-detail-row"><strong>門票</strong> ${autoLinkify(sight.admission)}</div>` : ''}
                ${sight.note ? `<div class="compact-detail-row"><strong>備註</strong> ${autoLinkify(sight.note)}</div>` : ''}
                ${imageHtml}
            </div>
        </div>
    `;
}

/**
 * 渲染緊湊版人孔蓋卡卡片
 * @param {Object} card - 人孔蓋卡資料
 * @param {boolean} collapseByDefault - 是否預設收合詳細資訊（預設 false）
 */
function renderCompactManholeCard(card, collapseByDefault = false) {
    const cardId = card.name;
    const isCompleted = isCardCompleted('manholeCard', cardId);

    let imageHtml = '';
    if (card.images && card.images.length > 0) {
        imageHtml = renderImageGallery(card.images, card.name);
    } else if (card.image) {
        imageHtml = `<div class="compact-detail-image"><img src="${card.image}" alt="${card.imageCaption || card.name}" />${card.imageCaption ? `<p class="compact-image-caption">${autoLinkify(card.imageCaption)}</p>` : ''}</div>`;
    }

    return `
        <div class="compact-card ${isCompleted ? 'card-completed' : ''}" data-entity-type="manholeCard" data-entity-key="${encodeEntityKey(cardId)}">
            <div class="compact-card-header">
                <div class="compact-card-tags">
                    <span class="compact-tag">${card.category}</span>
                    <span class="compact-tag status">${card.collectStatus}</span>
                    ${card.websiteUrl ? `<a href="${card.websiteUrl}" target="_blank" class="compact-map-link" title="官方網站" onclick="event.stopPropagation()"><i class="bi bi-globe"></i></a>` : ''}
                    ${card.mapsUrl ? `<a href="${card.mapsUrl}" target="_blank" class="compact-map-link" title="Google Map" onclick="event.stopPropagation()"><i class="bi bi-geo-alt-fill"></i></a>` : ''}
                </div>
                <div class="compact-card-title-wrapper">
                    <label class="card-completion-checkbox" onclick="event.stopPropagation()">
                        <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleCardCompletion('manholeCard', '${cardId}'); event.target.closest('.compact-card').classList.toggle('card-completed'); renderRelatedInfoPanel();" />
                        <span class="checkbox-custom"></span>
                    </label>
                    <h5 class="compact-card-title">${card.name}</h5>
                </div>
            </div>
            <div class="compact-card-summary">${autoLinkify(card.area)}</div>
            <div class="compact-card-details"${collapseByDefault ? ' hidden' : ''}>
                ${card.distributionPlace ? `<div class="compact-detail-row"><strong>換領地點</strong> ${autoLinkify(card.distributionPlace)}</div>` : ''}
                ${card.distributionHours ? `<div class="compact-detail-row"><strong>開放時間</strong> ${autoLinkify(card.distributionHours)}</div>` : ''}
                ${card.manholeLocation ? `<div class="compact-detail-row"><strong>人孔蓋位置</strong> ${autoLinkify(card.manholeLocation)}</div>` : ''}
                ${card.note ? `<div class="compact-detail-row"><strong>備註</strong> ${autoLinkify(card.note)}</div>` : ''}
                ${imageHtml}
            </div>
        </div>
    `;
}

/**
 * 渲染緊湊版餐飲卡片
 * @param {Object} dining - 餐飲資料
 * @param {boolean} collapseByDefault - 是否預設收合詳細資訊（預設 false）
 */
function renderCompactDiningCard(dining, collapseByDefault = false) {
    const cardId = dining.name;
    const isCompleted = isCardCompleted('dining', cardId);
    
    let imageHtml = '';
    if (dining.images && dining.images.length > 0) {
        imageHtml = renderImageGallery(dining.images, dining.name);
    } else if (dining.image) {
        imageHtml = `<div class="compact-detail-image"><img src="${dining.image}" alt="${dining.imageCaption || dining.name}" />${dining.imageCaption ? `<p class="compact-image-caption">${autoLinkify(dining.imageCaption)}</p>` : ''}</div>`;
    }
    
    return `
        <div class="compact-card ${isCompleted ? 'card-completed' : ''}" data-entity-type="dining" data-entity-key="${encodeEntityKey(cardId)}">
            <div class="compact-card-header">
                <div class="compact-card-tags">
                    <span class="compact-tag">${dining.category}</span>
                    <span class="compact-tag status">${dining.reservationStatus}</span>
                    ${dining.websiteUrl ? `<a href="${dining.websiteUrl}" target="_blank" class="compact-map-link" title="官方網站" onclick="event.stopPropagation()"><i class="bi bi-globe"></i></a>` : ''}
                    ${dining.mapsUrl ? `<a href="${dining.mapsUrl}" target="_blank" class="compact-map-link" title="Google Map" onclick="event.stopPropagation()"><i class="bi bi-geo-alt-fill"></i></a>` : ''}
                </div>
                <div class="compact-card-title-wrapper">
                    <label class="card-completion-checkbox" onclick="event.stopPropagation()">
                        <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleCardCompletion('dining', '${cardId}'); event.target.closest('.compact-card').classList.toggle('card-completed'); renderRelatedInfoPanel();" />
                        <span class="checkbox-custom"></span>
                    </label>
                    <h5 class="compact-card-title">${dining.name}</h5>
                </div>
            </div>
            <div class="compact-card-summary">${autoLinkify(dining.area)}</div>
            <div class="compact-card-details"${collapseByDefault ? ' hidden' : ''}>
                ${dining.note ? `<div class="compact-detail-row"><strong>備註</strong> ${autoLinkify(dining.note)}</div>` : ''}
                ${imageHtml}
            </div>
        </div>
    `;
}

/**
 * 渲染緊湊版伴手禮卡片
 * @param {Object} souvenir - 伴手禮資料
 * @param {boolean} collapseByDefault - 是否預設收合詳細資訊（預設 false）
 */
function renderCompactSouvenirCard(souvenir, collapseByDefault = false) {
    const cardId = souvenir.name;
    const isCompleted = isCardCompleted('souvenir', cardId);
    
    let imageHtml = '';
    if (souvenir.images && souvenir.images.length > 0) {
        imageHtml = renderImageGallery(souvenir.images, souvenir.name);
    } else if (souvenir.image) {
        imageHtml = `<div class="compact-detail-image"><img src="${souvenir.image}" alt="${souvenir.imageCaption || souvenir.name}" />${souvenir.imageCaption ? `<p class="compact-image-caption">${autoLinkify(souvenir.imageCaption)}</p>` : ''}</div>`;
    }
    
    return `
        <div class="compact-card ${isCompleted ? 'card-completed' : ''}" data-entity-type="souvenir" data-entity-key="${encodeEntityKey(cardId)}">
            <div class="compact-card-header">
                <div class="compact-card-tags">
                    <span class="compact-tag">${souvenir.category}</span>
                    <span class="compact-tag status">${souvenir.buyPlan}</span>
                    ${souvenir.websiteUrl ? `<a href="${souvenir.websiteUrl}" target="_blank" class="compact-map-link" title="官方網站" onclick="event.stopPropagation()"><i class="bi bi-globe"></i></a>` : ''}
                    ${souvenir.mapsUrl ? `<a href="${souvenir.mapsUrl}" target="_blank" class="compact-map-link" title="Google Map" onclick="event.stopPropagation()"><i class="bi bi-geo-alt-fill"></i></a>` : ''}
                </div>
                <div class="compact-card-title-wrapper">
                    <label class="card-completion-checkbox" onclick="event.stopPropagation()">
                        <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleCardCompletion('souvenir', '${cardId}'); event.target.closest('.compact-card').classList.toggle('card-completed'); renderRelatedInfoPanel();" />
                        <span class="checkbox-custom"></span>
                    </label>
                    <h5 class="compact-card-title">${souvenir.name}</h5>
                </div>
            </div>
            <div class="compact-card-summary">${autoLinkify(souvenir.area)}</div>
            <div class="compact-card-details"${collapseByDefault ? ' hidden' : ''}>
                ${souvenir.note ? `<div class="compact-detail-row"><strong>備註</strong> ${autoLinkify(souvenir.note)}</div>` : ''}
                ${imageHtml}
            </div>
        </div>
    `;
}

/**
 * 渲染緊湊版其他資訊卡片
 * @param {Object} info - 其他資訊資料
 * @param {boolean} collapseByDefault - 是否預設收合詳細資訊（預設 false）
 */
function renderCompactOtherInfoCard(info, collapseByDefault = false) {
    const categoryIcons = {
        "租車資訊": "bi-bicycle",
        "飲食建議": "bi-egg-fried",
        "景點推薦": "bi-geo-alt-fill",
        "攝影資訊": "bi-camera-fill",
        "伴手禮資訊": "bi-gift-fill",
        "旅行提醒": "bi-exclamation-triangle-fill",
        "緊急資訊": "bi-telephone-fill",
        "交通資訊": "bi-bus-front-fill",
        "聖地資訊": "bi-star-fill",
        "住宿資訊": "bi-house-fill"
    };
    const iconClass = categoryIcons[info.category] || "bi-info-circle-fill";
    const cardId = info.id;
    const isCompleted = isCardCompleted('otherInfo', cardId);
    
    let imageHtml = '';
    if (info.images && info.images.length > 0) {
        imageHtml = renderImageGallery(info.images, info.title);
    } else if (info.image) {
        imageHtml = `<div class="compact-detail-image"><img src="${info.image}" alt="${info.imageCaption || info.title}" />${info.imageCaption ? `<p class="compact-image-caption">${autoLinkify(info.imageCaption)}</p>` : ''}</div>`;
    }
    
    // 對於作為 VJW 聯絡處的住宿，添加 VJW 按鈕
    const vjwButton = info.isVjwContact ? `
        <div class="compact-vjw-actions mt-2">
            <button type="button" class="btn-literary btn-sm" data-open-vjw="true">
                <i class="bi bi-clipboard2-check me-1"></i>開啟 VJW
            </button>
        </div>
    ` : '';
    
    return `
        <div class="compact-card ${isCompleted ? 'card-completed' : ''}" data-entity-type="otherInfo" data-entity-key="${encodeEntityKey(cardId)}">
            <div class="compact-card-header">
                <div class="compact-card-tags">
                    <span class="compact-tag"><i class="bi ${iconClass} me-1"></i>${info.category}</span>
                    ${info.websiteUrl ? `<a href="${info.websiteUrl}" target="_blank" class="compact-map-link" title="官方網站" onclick="event.stopPropagation()"><i class="bi bi-globe"></i></a>` : ''}
                    ${info.mapsUrl ? `<a href="${info.mapsUrl}" target="_blank" class="compact-map-link" title="Google Map" onclick="event.stopPropagation()"><i class="bi bi-geo-alt-fill"></i></a>` : ''}
                </div>
                <div class="compact-card-title-wrapper">
                    <label class="card-completion-checkbox" onclick="event.stopPropagation()">
                        <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleCardCompletion('otherInfo', '${cardId}'); event.target.closest('.compact-card').classList.toggle('card-completed'); renderRelatedInfoPanel();" />
                        <span class="checkbox-custom"></span>
                    </label>
                    <h5 class="compact-card-title">${info.title}</h5>
                </div>
            </div>
            ${info.subtitle ? `<div class="compact-card-summary">${autoLinkify(info.subtitle)}</div>` : ''}
            ${info.location ? `<div class="compact-card-summary"><i class="bi bi-pin-map-fill me-1"></i>${autoLinkify(info.location)}</div>` : ''}
            <div class="compact-card-details"${collapseByDefault ? ' hidden' : ''}>
                ${info.details.map(detail => `<div class="compact-detail-item"><i class="bi bi-check-circle me-1"></i>${autoLinkify(detail)}</div>`).join('')}
                ${info.note ? `<div class="compact-detail-row mt-2"><strong>備註</strong> ${autoLinkify(info.note)}</div>` : ''}
                ${imageHtml}
                ${vjwButton}
            </div>
        </div>
    `;
}

function renderTransportPanel() {
    const transports = state.tripData.transports;
    
    // 收集所有交通工具類型
    const allTypes = [...new Set(transports.map(t => t.type))];
    
    // 類型圖標映射
    const typeIcons = {
        "航班": "bi-airplane-fill",
        "接駁車": "bi-car-front-fill",
        "機場巴士": "bi-bus-front-fill",
        "巴士": "bi-bus-front-fill",
        "JR": "bi-train-front-fill",
        "JR 快速": "bi-train-front-fill",
        "JR + 新幹線": "bi-train-front-fill",
        "接駁船": "bi-water",
        "觀光船": "bi-water",
        "徒步": "bi-person-walking"
    };
    
    // 圖標到類型組的映射
    const iconToTypes = {};
    allTypes.forEach(type => {
        const icon = typeIcons[type] || "bi-geo-alt-fill";
        if (!iconToTypes[icon]) {
            iconToTypes[icon] = [];
        }
        iconToTypes[icon].push(type);
    });
    
    // 生成篩選按鈕（放在標題右側）
    const filterButtonsHtml = `
        <button class="transport-filter-btn ${state.transportTypeFilter === 'all' ? 'active' : ''}" 
                data-filter-type="all" 
                onclick="setTransportTypeFilter('all')" 
                title="全部">
            <i class="bi bi-grid-fill"></i>
        </button>
        ${Object.entries(iconToTypes).map(([icon, types]) => {
            const isActive = types.includes(state.transportTypeFilter);
            const typesStr = types.join(',');
            const title = types.join('/');
            return `
                <button class="transport-filter-btn ${isActive ? 'active' : ''}" 
                        data-filter-types="${typesStr}" 
                        onclick="setTransportTypeFilter('${types[0]}', '${typesStr}')" 
                        title="${title}">
                    <i class="bi ${icon}"></i>
                </button>
            `;
        }).join('')}
    `;
    
    // 更新篩選按鈕
    const filterContainer = document.getElementById('transport-type-filters');
    if (filterContainer) {
        filterContainer.innerHTML = filterButtonsHtml;
    }
    
    // 篩選交通卡片（支援多類型）
    const filterTypes = state.transportTypeFilter === 'all' 
        ? null 
        : state.transportTypeFilterTypes ? state.transportTypeFilterTypes.split(',') : [state.transportTypeFilter];
    
    const filteredTransports = !filterTypes
        ? transports 
        : transports.filter(t => filterTypes.includes(t.type));
    
    // 渲染卡片（使用 compact 格式並使用瀑布流容器）
    const cardsHtml = filteredTransports.map(transport => renderCompactTransportCard(transport)).join('');
    
    const target = document.getElementById("transport-list");
    target.classList.remove("card-grid");
    target.classList.remove("souvenir-masonry");
    target.classList.add("panel-masonry");
    target.innerHTML = cardsHtml || '<div class="text-center text-muted py-5">無符合條件的交通資訊</div>';
}

function setTransportTypeFilter(type, typesStr) {
    state.transportTypeFilter = type;
    state.transportTypeFilterTypes = typesStr || type;
    renderTransportPanel();
}

function renderDiningPanel() {
    const dining = state.tripData.dining;
    const target = document.getElementById("dining-list");
    const cardsHtml = dining.map(item => renderCompactDiningCard(item)).join("");
    target.classList.remove("card-grid");
    target.classList.remove("souvenir-masonry");
    target.classList.add("panel-masonry");
    target.innerHTML = cardsHtml;
}

function renderSightseeingPanel() {
    const sightseeing = state.tripData.sightseeing;
    const target = document.getElementById("sightseeing-list");
    const cardsHtml = sightseeing.map(item => renderCompactSightseeingCard(item)).join("");
    target.classList.remove("card-grid");
    target.classList.remove("souvenir-masonry");
    target.classList.add("panel-masonry");
    target.innerHTML = cardsHtml;
}

function renderManholeCardPanel() {
    const manholeCards = state.tripData.manholeCards;
    const target = document.getElementById("manhole-card-list");
    const cardsHtml = manholeCards.map(item => renderCompactManholeCard(item)).join("");
    target.classList.remove("card-grid");
    target.classList.remove("souvenir-masonry");
    target.classList.add("panel-masonry");
    target.innerHTML = cardsHtml;
}

function renderSouvenirPanel() {
    const souvenirs = state.tripData.souvenirs;
    const target = document.getElementById("souvenir-list");
    const cardsHtml = souvenirs.map(item => renderCompactSouvenirCard(item)).join("");
    target.classList.remove("card-grid");
    target.classList.remove("souvenir-masonry");
    target.classList.add("panel-masonry");
    target.innerHTML = cardsHtml;
}

function renderAreaMapPanel() {
    const filterTarget = document.getElementById("area-map-filters");
    const listTarget = document.getElementById("area-map-list");
    const countTarget = document.getElementById("area-map-count");

    if (!filterTarget || !listTarget || !countTarget) {
        return;
    }

    const filters = getAreaMapFilters();
    filterTarget.innerHTML = filters.map((filter) => `
        <button type="button" class="area-filter-btn ${state.mapAreaFilter === filter.id ? "active" : ""}" data-area-filter="${filter.id}">
            ${filter.label}
        </button>
    `).join("");

    const points = getFilteredMapPoints();
    countTarget.textContent = `${points.length} 筆`;

    listTarget.innerHTML = points.map((point, index) => {
        const sourceLabel = getMapPointSourceLabel(point);
        const iconClass = getMapPointIconClass(point.category);
        return `
        <button type="button" class="area-map-row ${state.mapSelectionId === point.id ? "is-active" : ""}" data-map-point-id="${point.id}">
            <div class="area-map-row-title-wrap">
                <span class="area-map-row-index">${index + 1}</span>
                <div class="area-map-row-title-main">
                    <div class="area-map-row-title"><i class="bi ${iconClass} me-1"></i>${point.name}</div>
                    <div class="area-map-row-meta">${point.area} · ${point.category || "未分類"}</div>
                </div>
            </div>
            ${sourceLabel ? `<div class="area-map-row-source">${sourceLabel}</div>` : ""}
            ${point.note ? `<div class="area-map-row-note">${point.note}</div>` : ""}
        </button>
    `;
    }).join("");

    if (state.activeTab === "area-map") {
        if (state.mapApiReady) {
            updateAreaMapMarkers();
        } else if (state.mapInitTried) {
            renderAreaMapFallbackLinks();
        } else {
            ensureAreaMapInitialized();
        }
    }
}

function getAreaMapFilters() {
    // ponytail: 廣島的分區清單已移除，待東京行程資料確定後再依區域補上 matcher
    return [
        { id: "all", label: "全部", matcher: () => true }
    ];
}

function getFilteredMapPoints() {
    const filters = getAreaMapFilters();
    const current = filters.find((item) => item.id === state.mapAreaFilter) || filters[0];
    return state.mapPoints
        .filter((point) => current.matcher(point.area || "其他"))
        .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
}

function setAreaMapFilter(filterId) {
    state.mapAreaFilter = filterId;
    state.mapSelectionId = null;
    renderAreaMapPanel();
    if (state.mapApiReady) {
        updateAreaMapMarkers();
    }
}

function buildMapPointsFromTripData() {
    if (!state.tripData) return [];

    const explicitPoints = Array.isArray(state.tripData.areaMapPoints) ? state.tripData.areaMapPoints : [];
    if (explicitPoints.length > 0) {
        return explicitPoints.map((item, index) => {
            const sourceMeta = resolveMapPointSourceMeta(item.name) || {};
            return {
            id: item.id || `trip-point-${index + 1}`,
            name: item.name || "未命名點位",
            area: item.area || "其他",
            category: item.category || "未分類",
            rating: item.rating || "",
            reviewCount: item.reviewCount || "",
            priceRange: item.priceRange || "",
            note: item.note || "",
            mapsUrl: item.mapsUrl || buildPointMapLink({ name: item.name || "", area: item.area || "其他" }),
            lat: Number.isFinite(item.lat) ? item.lat : null,
            lng: Number.isFinite(item.lng) ? item.lng : null,
            coordSource: item.coordSource || "",
            sourceType: sourceMeta.sourceType || item.sourceType || "csv",
            sourceTab: sourceMeta.sourceTab || item.sourceTab || "",
            sourceKey: sourceMeta.sourceKey || item.sourceKey || "",
            sourceTitle: sourceMeta.sourceTitle || item.sourceTitle || ""
            };
        });
    }

    // fallback: 若未配置 areaMapPoints，從 trip-data 既有餐飲/景點自動提取
    const fromDining = (state.tripData.dining || []).map((item, idx) => ({
        id: `dining-${idx + 1}`,
        name: item.name,
        area: inferSpotArea(item.name || "", item.category || "", item.note || ""),
        category: item.category || "餐飲",
        note: item.note || "",
        mapsUrl: item.mapsUrl || buildPointMapLink({ name: item.name, area: "其他" })
    }));

    const fromSightseeing = (state.tripData.sightseeing || []).map((item, idx) => ({
        id: `sight-${idx + 1}`,
        name: item.name,
        area: inferSpotArea(item.name || "", item.category || "", item.note || ""),
        category: item.category || "景點",
        note: item.note || "",
        mapsUrl: item.mapsUrl || buildPointMapLink({ name: item.name, area: "其他" })
    }));

    const combined = [...fromDining, ...fromSightseeing].filter((p) => ["尾道市區", "生口島・瀨戶田", "尾道", "生口島"].includes(p.area));
    const seen = new Set();
    return combined.filter((p) => {
        const key = normalizeSpotName(p.name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function parseSpotPoints(rawText) {
    if (!rawText) return [];
    const blocks = rawText
        .split(/\r?\n\s*\r?\n+/)
        .map((chunk) => chunk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))
        .filter((lines) => lines.length > 0);

    const points = [];
    const seen = new Set();
    blocks.forEach((lines, idx) => {
        const point = {
            id: `spot-${idx + 1}`,
            name: lines[0],
            rating: "",
            reviewCount: "",
            price: "",
            type: "",
            note: "",
            area: "其他"
        };

        let cursor = 1;

        if (cursor < lines.length) {
            const match = lines[cursor].match(/^([0-9]+\.[0-9])\(([0-9,]+)\)$/);
            if (match) {
                point.rating = match[1];
                point.reviewCount = match[2].replace(/,/g, "");
                cursor += 1;
            }
        }

        if (cursor < lines.length && /^(¥|￥|\$\$|超過\s*¥)/.test(lines[cursor])) {
            point.price = lines[cursor].replace(/,/g, "");
            cursor += 1;
        }

        if (cursor < lines.length) {
            if (lines[cursor].startsWith("·")) {
                point.type = lines[cursor].replace(/^·\s*/, "").trim();
                cursor += 1;
            } else if (/(店|舖|餐廳|景點|商場|神社|中心|館|市場|戲院|博物館|紀念館|觀景台|飯店|服裝|雜貨|模型|商店街|糖果|地標|雕塑|圖書館|批發商|旅客|社區)/.test(lines[cursor])) {
                point.type = lines[cursor];
                cursor += 1;
            }
        }

        point.note = lines.slice(cursor).join("；");
        point.area = inferSpotArea(point.name, point.type, point.note);

        const normalizedName = normalizeSpotName(point.name);

        if (seen.has(normalizedName)) {
            return;
        }

        seen.add(normalizedName);
        points.push(point);
    });

    return points;
}

function normalizeSpotName(name) {
    return (name || "")
        .toLowerCase()
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function encodeEntityKey(value) {
    return encodeURIComponent(String(value || "").trim());
}

function getMapPointIconClass(category) {
    const text = String(category || "");
    if (/咖啡|茶|飲品/.test(text)) return "bi-cup-hot-fill";
    if (/餐|居酒|拉麵|燒|甜|餅|麵包|海鮮/.test(text)) return "bi-fork-knife";
    if (/景點|神社|公園|博物館|世界遺產|展望|地標/.test(text)) return "bi-camera-fill";
    if (/住宿|飯店|旅館|Guest House/.test(text)) return "bi-house-door-fill";
    if (/商店|購物|市集|雜貨/.test(text)) return "bi-bag-fill";
    if (/車站|交通|港口|渡輪/.test(text)) return "bi-sign-turn-right-fill";
    return "bi-geo-alt-fill";
}

function resolveMapPointSourceMeta(name) {
    if (!state.tripData || !name) return null;

    const target = normalizeSpotName(name);
    const matchBy = (value) => normalizeSpotName(value) === target;

    const dining = (state.tripData.dining || []).find((item) => matchBy(item.name));
    if (dining) {
        return { sourceType: "dining", sourceTab: "dining", sourceKey: dining.name, sourceTitle: dining.name };
    }

    const sightseeing = (state.tripData.sightseeing || []).find((item) => matchBy(item.name));
    if (sightseeing) {
        return { sourceType: "sightseeing", sourceTab: "sightseeing", sourceKey: sightseeing.name, sourceTitle: sightseeing.name };
    }

    const souvenir = (state.tripData.souvenirs || []).find((item) => matchBy(item.name));
    if (souvenir) {
        return { sourceType: "souvenir", sourceTab: "souvenirs", sourceKey: souvenir.name, sourceTitle: souvenir.name };
    }

    const manholeCard = (state.tripData.manholeCards || []).find((item) => matchBy(item.name));
    if (manholeCard) {
        return { sourceType: "manholeCard", sourceTab: "manhole-cards", sourceKey: manholeCard.name, sourceTitle: manholeCard.name };
    }

    const otherInfo = (state.tripData.otherInfo || []).find((item) => matchBy(item.title));
    if (otherInfo) {
        return { sourceType: "otherInfo", sourceTab: "others", sourceKey: otherInfo.id, sourceTitle: otherInfo.title };
    }

    const transport = (state.tripData.transports || []).find((item) => matchBy(item.title));
    if (transport) {
        return { sourceType: "transport", sourceTab: "transport", sourceKey: transport.id, sourceTitle: transport.title };
    }

    return { sourceType: "csv", sourceTab: "", sourceKey: "", sourceTitle: "" };
}

function getMapPointSourceLabel(point) {
    const typeMap = {
        dining: "餐飲",
        sightseeing: "景點",
        souvenir: "伴手禮",
        manholeCard: "人孔蓋卡",
        otherInfo: "其他資訊",
        transport: "交通",
        csv: "CSV"
    };

    const typeLabel = typeMap[point.sourceType] || "CSV";
    if (point.sourceTitle) {
        return `來源：${typeLabel} / ${point.sourceTitle}`;
    }
    return point.sourceType ? `來源：${typeLabel}` : "";
}

function inferSpotArea(name, type, note) {
    // ponytail: 廣島的店名分區規則已移除，待東京行程資料確定後再依區域補上
    return "其他";
}

async function ensureAreaMapInitialized() {
    if (state.mapApiReady) {
        updateAreaMapMarkers();
        return;
    }

    if (state.mapInitTried) {
        return;
    }

    state.mapInitTried = true;
    try {
        await loadGoogleMapsApi();
        initAreaMap();
        state.mapApiReady = true;
        showAreaMapNotice("");
        updateAreaMapMarkers();
    } catch (error) {
        showAreaMapNotice("尚未設定 Google Maps API Key，暫時無法顯示可互動地圖。請在 js/tokyo.js 設定 GOOGLE_MAPS_API_KEY。", true);
        renderAreaMapFallbackLinks();
    }
}

let googleMapsLoaderPromise = null;
function loadGoogleMapsApi() {
    if (window.google && window.google.maps) {
        return Promise.resolve();
    }

    if (googleMapsLoaderPromise) {
        return googleMapsLoaderPromise;
    }

    const apiKey = (window.TOKYO_GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY || "").trim();
    if (!apiKey) {
        return Promise.reject(new Error("Google Maps API key missing"));
    }

    googleMapsLoaderPromise = new Promise((resolve, reject) => {
        const callbackName = "__tokyoMapApiReady";
        window[callbackName] = () => {
            delete window[callbackName];
            resolve();
        };

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${callbackName}`;
        script.async = true;
        script.onerror = () => reject(new Error("Google Maps API load failed"));
        document.head.appendChild(script);
    });

    return googleMapsLoaderPromise;
}

function initAreaMap() {
    const mapCanvas = document.getElementById("area-map-canvas");
    if (!mapCanvas) return;

    // Remove fallback iframe content before mounting Google Map.
    mapCanvas.innerHTML = "";

    state.mapObject = new google.maps.Map(mapCanvas, {
        center: { lat: 35.6812, lng: 139.7671 },
        zoom: 9,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
    });

    state.mapInfoWindow = new google.maps.InfoWindow();
}

function renderAreaMapFallbackLinks() {
    const mapCanvas = document.getElementById("area-map-canvas");
    const points = getFilteredMapPoints();
    if (!mapCanvas) return;

    const first = points[0];
    const query = first ? `${first.name} ${first.area}` : "Tokyo";
    const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    mapCanvas.innerHTML = `<iframe class="area-map-iframe" title="Google Map" src="${embedUrl}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
}

async function updateAreaMapMarkers() {
    if (!state.mapObject || !state.mapApiReady) {
        return;
    }

    const points = getFilteredMapPoints();
    const pointSequence = new Map(points.map((point, index) => [point.id, index + 1]));
    clearAreaMapMarkers();
    renderAreaMapPanelSelectionOnly();

    const bounds = new google.maps.LatLngBounds();
    const unresolved = [];

    points.forEach((point) => {
        const sequence = pointSequence.get(point.id) || 0;
        if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
            addMapMarker(point, { lat: point.lat, lng: point.lng }, bounds, sequence);
            return;
        }

        const cache = state.mapGeocodeCache[point.id];
        if (cache && Number.isFinite(cache.lat) && Number.isFinite(cache.lng)) {
            addMapMarker(point, { lat: cache.lat, lng: cache.lng }, bounds, sequence);
        } else {
            unresolved.push(point);
        }
    });

    fitMapBoundsIfReady(bounds, points.length);

    if (unresolved.length === 0) {
        showAreaMapNotice("");
        return;
    }

    const jobId = ++state.mapGeocodeJobId;
    showAreaMapNotice(`地圖定位中：${points.length - unresolved.length}/${points.length}`);

    for (let index = 0; index < unresolved.length; index += 1) {
        if (jobId !== state.mapGeocodeJobId) {
            return;
        }

        const point = unresolved[index];
        const sequence = pointSequence.get(point.id) || 0;
        const position = await geocodePoint(point);
        if (position) {
            addMapMarker(point, position, bounds, sequence);
            state.mapGeocodeCache[point.id] = position;
            persistMapGeocodeCache();
            fitMapBoundsIfReady(bounds, points.length);
        }

        const done = points.length - (unresolved.length - (index + 1));
        showAreaMapNotice(`地圖定位中：${done}/${points.length}`);
    }

    showAreaMapNotice("");
}

function fitMapBoundsIfReady(bounds, pointCount) {
    if (!state.mapObject) return;
    if (pointCount === 0) {
        state.mapObject.setCenter({ lat: 35.6812, lng: 139.7671 });
        state.mapObject.setZoom(9);
        return;
    }

    if (!bounds.isEmpty()) {
        state.mapObject.fitBounds(bounds, 48);
    }
}

function clearAreaMapMarkers() {
    state.mapMarkers.forEach((marker) => marker.setMap(null));
    state.mapMarkers.clear();
}

function getMarkerColorByArea(area) {
    const text = String(area || "");
    if (text.includes("東京")) return "#1f6f8b";
    if (text.includes("吳") || text.includes("呉")) return "#9a3412";
    if (text.includes("宮島")) return "#7c3aed";
    if (text.includes("尾道")) return "#166534";
    if (text.includes("生口") || text.includes("瀨戶田") || text.includes("瀬戸田")) return "#b45309";
    return "#4b5563";
}

function renderMapInfoWindowContent(point, sequence) {
    const mapLink = buildPointMapLink(point);
    const sourceLabel = getMapPointSourceLabel(point);
    return `<div class="map-infowindow"><strong>#${sequence} ${point.name}</strong><br><small>${point.area} · ${point.category || "未分類"}</small>${sourceLabel ? `<br><span class="map-source">${sourceLabel}</span>` : ""}<br><a href="${mapLink}" target="_blank" rel="noopener noreferrer">Google Maps</a></div>`;
}

function addMapMarker(point, position, bounds, sequence = 0) {
    const markerColor = getMarkerColorByArea(point.area);
    const marker = new google.maps.Marker({
        map: state.mapObject,
        position,
        title: point.name,
        label: {
            text: String(sequence),
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: "700"
        },
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: markerColor,
            fillOpacity: 0.98,
            strokeColor: "#ffffff",
            strokeWeight: 1.8
        }
    });

    marker.addListener("click", () => {
        if (state.mapInfoWindow) {
            state.mapInfoWindow.setContent(renderMapInfoWindowContent(point, sequence));
            state.mapInfoWindow.open({ anchor: marker, map: state.mapObject });
        }

        state.mapSelectionId = point.id;
        highlightMapListSelection(point.id, true);
    });

    state.mapMarkers.set(point.id, marker);
    bounds.extend(position);
}

async function focusMapPointById(pointId, shouldScrollMap = false) {
    state.mapSelectionId = pointId;
    const point = state.mapPoints.find((item) => item.id === pointId);
    if (!point) return;

    if (!state.mapApiReady) {
        window.open(buildPointMapLink(point), "_blank", "noopener,noreferrer");
        return;
    }

    let marker = state.mapMarkers.get(pointId);
    if (!marker) {
        let position = null;
        if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
            position = { lat: point.lat, lng: point.lng };
        } else {
            position = await geocodePoint(point);
        }

        if (!position) {
            window.open(buildPointMapLink(point), "_blank", "noopener,noreferrer");
            return;
        }

        state.mapGeocodeCache[point.id] = position;
        persistMapGeocodeCache();
        const bounds = new google.maps.LatLngBounds();
        addMapMarker(point, position, bounds, getFilteredMapPoints().findIndex((item) => item.id === point.id) + 1);
        marker = state.mapMarkers.get(pointId);
    }

    if (state.mapObject && marker) {
        const position = marker.getPosition();
        state.mapObject.panTo(position);
        state.mapObject.setZoom(Math.max(state.mapObject.getZoom() || 13, 14));

        if (state.mapInfoWindow) {
            const sequence = getFilteredMapPoints().findIndex((item) => item.id === point.id) + 1;
            state.mapInfoWindow.setContent(renderMapInfoWindowContent(point, sequence));
            state.mapInfoWindow.open({ anchor: marker, map: state.mapObject });
        }
    }

    highlightMapListSelection(pointId, false);

    if (shouldScrollMap) {
        const mapCanvas = document.getElementById("area-map-canvas");
        if (mapCanvas) {
            const top = mapCanvas.getBoundingClientRect().top + window.scrollY;
            const topSafeOffset = getTopOverlayOffset();
            window.scrollTo({ behavior: "smooth", top: Math.max(0, top - topSafeOffset) });
        }
    }
}

function highlightMapListSelection(pointId, scrollRow) {
    document.querySelectorAll(".area-map-row").forEach((row) => {
        row.classList.toggle("is-active", row.dataset.mapPointId === pointId);
    });

    if (scrollRow) {
        const target = document.querySelector(`.area-map-row[data-map-point-id="${pointId}"]`);
        target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        target?.focus({ preventScroll: true });
    }
}

function renderAreaMapPanelSelectionOnly() {
    const listTarget = document.getElementById("area-map-list");
    if (!listTarget) return;
    listTarget.querySelectorAll(".area-map-row").forEach((row) => {
        row.classList.toggle("is-active", row.dataset.mapPointId === state.mapSelectionId);
    });
}

function getTopOverlayOffset() {
    const fixedElements = document.querySelectorAll(".fixed-top");
    let maxBottom = 0;

    fixedElements.forEach((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return;

        const rect = el.getBoundingClientRect();
        if (rect.height <= 0) return;

        if (rect.top <= 0 && rect.bottom > 0) {
            maxBottom = Math.max(maxBottom, rect.bottom);
        }
    });

    return Math.ceil(maxBottom) + 8;
}

function openMapPointLinkedCard(pointId) {
    const point = state.mapPoints.find((item) => item.id === pointId);
    if (!point || !point.sourceTab || !point.sourceType || !point.sourceKey) {
        return;
    }

    setActiveTab(point.sourceTab);

    const selector = `.trip-panel[data-panel="${point.sourceTab}"] .compact-card[data-entity-type="${point.sourceType}"][data-entity-key="${encodeEntityKey(point.sourceKey)}"]`;
    const card = document.querySelector(selector);
    if (!card) {
        return;
    }

    card.classList.add("map-linked-pulse");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
        card.classList.remove("map-linked-pulse");
    }, 1800);
}

function buildPointMapLink(point) {
    const query = `${point.name} ${point.area} 東京`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function geocodePoint(point) {
    return new Promise((resolve) => {
        if (!window.google || !google.maps) {
            resolve(null);
            return;
        }

        const geocoder = new google.maps.Geocoder();
        const query = buildGeocodeQuery(point);
        geocoder.geocode({ address: query }, (results, status) => {
            if (status === "OK" && results && results[0]) {
                const loc = results[0].geometry.location;
                resolve({ lat: loc.lat(), lng: loc.lng() });
                return;
            }
            resolve(null);
        });
    });
}

function buildGeocodeQuery(point) {
    // ponytail: 廣島的分區別名對照表已移除，待東京行程分區確定後再補上
    const areaAliasMap = {};

    const areaHint = areaAliasMap[point.area] || point.area || "Tokyo";
    return `${point.name}, ${areaHint}, Japan`;
}

function showAreaMapNotice(message, isWarn = false) {
    const notice = document.getElementById("area-map-notice");
    if (!notice) return;
    notice.textContent = message;
    notice.classList.toggle("is-visible", Boolean(message));
    notice.classList.toggle("is-warning", Boolean(message) && isWarn);
}

function loadMapGeocodeCache() {
    try {
        const raw = localStorage.getItem(MAP_GEOCODE_CACHE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function persistMapGeocodeCache() {
    localStorage.setItem(MAP_GEOCODE_CACHE_KEY, JSON.stringify(state.mapGeocodeCache));
}

function renderListCard(item, options) {
    const classes = ["list-card"];
    if (options.isLinked) {
        classes.push("is-linked");
    }
    
    return `
        <article class="${classes.join(" ")}">
            <div class="card-actions mb-3">
                <span class="transport-type">${options.topLabel}</span>
                <span class="status-pill">${options.secondaryLabel}</span>
            </div>
            <h3 class="card-title">${item.name}</h3>
            <div class="list-meta">
                ${options.openingHours ? `<div><strong>開放時間</strong> ${options.openingHours}</div>` : ""}
                ${options.admission ? `<div><strong>門票</strong> ${options.admission}</div>` : ""}
                <div><strong>地點</strong> ${options.footerLabel}</div>
                <div><strong>備註</strong> ${options.note}</div>
            </div>
            <div class="card-actions mt-3">
                <div class="card-meta-pills">${createPillHtml(options.secondaryLabel, "bi-pin-map")}</div>
                <a class="link-btn" href="${item.mapsUrl}" target="_blank"><i class="bi bi-geo-alt"></i>Google Map</a>
            </div>
        </article>
    `;
}

function renderChecklistPanel() {
    const treeTarget = document.getElementById("checklist-tree");
    treeTarget.className = "checklist-tree";
    treeTarget.innerHTML = state.tripData.checklist.map((branch) => {
        const branchState = getChecklistBranchState(branch);
        return `
            <section class="checklist-branch">
                <div class="checklist-branch-header" data-level="1">
                    <label class="checklist-nested-checkbox" onclick="event.stopPropagation()">
                        <input type="checkbox" class="form-check-input checklist-parent-input" data-branch-id="${branch.id}" ${branchState.checked ? "checked" : ""} ${branchState.indeterminate ? 'data-indeterminate="true"' : ""}>
                    </label>
                    <button type="button"
                            class="checklist-branch-title-btn"
                            data-toggle-group="${branch.id}"
                            aria-expanded="true">
                        <span class="checklist-branch-title">${branch.title}</span>
                    </button>
                    <button type="button"
                            class="checklist-toggle-btn"
                            data-toggle-group="${branch.id}"
                            aria-expanded="true">
                        <i class="bi bi-chevron-up"></i>
                    </button>
                </div>
                <div class="checklist-items" data-group="${branch.id}">
                    ${renderChecklistItems(branch.children, 1)}
                </div>
            </section>
        `;
    }).join("");

    document.querySelectorAll(".checklist-parent-input[data-indeterminate='true']").forEach((checkbox) => {
        checkbox.indeterminate = true;
    });
    
    document.querySelectorAll(".checklist-nested-parent[data-indeterminate='true']").forEach((checkbox) => {
        checkbox.indeterminate = true;
    });
}

/**
 * 遞迴渲染 checklist 項目
 * @param {Array} items - 項目陣列
 * @param {number} level - 層級深度（用於縮排）
 */
function renderChecklistItems(items, level = 1) {
    if (!items || items.length === 0) return '';
    
    return items.map((item) => {
        const hasChildren = item.children && item.children.length > 0;
        
        if (hasChildren) {
            // 有子項目的項目（可展開/收合）
            const itemState = getChecklistItemState(item);
            return `
                <div class="checklist-nested-group" data-level="${level}">
                    <div class="checklist-nested-header">
                        <label class="checklist-nested-checkbox" onclick="event.stopPropagation()">
                            <input type="checkbox" 
                                   class="form-check-input checklist-nested-parent" 
                                   data-item-id="${item.id}" 
                                   ${itemState.checked ? "checked" : ""} 
                                   ${itemState.indeterminate ? 'data-indeterminate="true"' : ""}>
                        </label>
                        <button type="button"
                                class="checklist-nested-title-btn"
                                data-toggle-group="${item.id}"
                                aria-expanded="true">
                            <span class="checklist-nested-title">${item.title}</span>
                        </button>
                        <button type="button" 
                                class="checklist-toggle-btn" 
                                data-toggle-group="${item.id}"
                                aria-expanded="true">
                            <i class="bi bi-chevron-up"></i>
                        </button>
                    </div>
                    <div class="checklist-nested-items" data-group="${item.id}">
                        ${renderChecklistItems(item.children, level + 1)}
                    </div>
                </div>
            `;
        } else {
            // 無子項目的項目（一般 checkbox）
            return `
                <label class="checklist-item" data-level="${level}">
                    <input type="checkbox" 
                           class="form-check-input checklist-child-input" 
                           data-item-id="${item.id}" 
                           ${state.checklistState[item.id] ? "checked" : ""}>
                    <span>${item.title}</span>
                </label>
            `;
        }
    }).join("");
}

function renderOthersPanel() {
    const otherInfo = state.tripData.otherInfo;
    const target = document.getElementById("others-info-list");
    const cardsHtml = otherInfo.map(item => renderCompactOtherInfoCard(item)).join("");
    target.classList.remove("card-grid");
    target.classList.remove("souvenir-masonry");
    target.classList.add("panel-masonry");
    target.innerHTML = cardsHtml;
}

function renderOtherInfoCard(item, isLinked = false) {
    const categoryIcons = {
        "租車資訊": "bi-bicycle",
        "飲食建議": "bi-egg-fried",
        "景點推薦": "bi-geo-alt-fill",
        "攝影資訊": "bi-camera-fill",
        "伴手禮資訊": "bi-gift-fill",
        "旅行提醒": "bi-exclamation-triangle-fill",
        "緊急資訊": "bi-telephone-fill"
    };
    
    const iconClass = categoryIcons[item.category] || "bi-info-circle-fill";
    const hasMap = item.mapsUrl && item.mapsUrl.length > 0;
    const classes = ["list-card", "other-info-card"];
    if (isLinked) {
        classes.push("is-linked");
    }
    
    return `
        <article class="${classes.join(" ")}">
            <div class="card-actions mb-3">
                <span class="transport-type"><i class="bi ${iconClass} me-1"></i>${item.category}</span>
            </div>
            <h3 class="card-title">${item.title}</h3>
            ${item.subtitle ? `<p class="card-subtitle mb-2">${item.subtitle}</p>` : ""}
            ${item.location ? `<p class="location-badge mb-2"><i class="bi bi-pin-map-fill me-1"></i>${item.location}</p>` : ""}
            <div class="other-info-details mb-3">
                ${item.details.map(detail => `<div class="detail-item"><i class="bi bi-check-circle me-1"></i>${detail}</div>`).join("")}
            </div>
            <p class="card-note mb-3">${item.note}</p>
            <div class="card-actions">
                ${hasMap ? `<a class="link-btn" href="${item.mapsUrl}" target="_blank"><i class="bi bi-geo-alt"></i>Google Map</a>` : ""}
            </div>
        </article>
    `;
}

function setActiveTab(tabId) {
    state.activeTab = tabId;
    syncTabUi();
    
    // 切換到時程表分頁時，立即檢查並更新狀態
    if (tabId === 'timeline') {
        updateTimelineIfNeeded();
    }

    if (tabId === "area-map") {
        ensureAreaMapInitialized();
    }
}

function syncTabUi() {
    document.querySelectorAll(".trip-tab").forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === state.activeTab);
    });

    document.querySelectorAll(".trip-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.panel === state.activeTab);
    });
}

function updateTripMetaText() {
    updateCountdown();
    updateHeroPhase();
    
    // 智能更新：只在行程狀態改變時才更新時程表
    updateTimelineIfNeeded();
}

/**
 * 智能更新時程表（只在狀態改變時更新）
 */
function updateTimelineIfNeeded() {
    // 只在時程表分頁時才檢查更新
    if (state.activeTab !== 'timeline') {
        return;
    }
    
    const timelineState = getTimelineState();
    const currentId = timelineState.current?.id || null;
    const nextId = timelineState.next?.id || null;
    
    // 檢查是否狀態有改變
    const hasChanged = 
        currentId !== state.previousTimelineState.currentId ||
        nextId !== state.previousTimelineState.nextId;
    
    if (hasChanged) {
        // 狀態有改變，保留使用者操作狀態並更新
        const scrollPosition = window.scrollY;
        const expandedId = state.expandedTimelineId;
        
        // 更新時程表（會自動讀取並保留 state.expandedTimelineId）
        renderTimelinePanel();
        
        // 恢復捲動位置，避免頁面跳動
        window.scrollTo(0, scrollPosition);
        
        // 更新記錄
        state.previousTimelineState.currentId = currentId;
        state.previousTimelineState.nextId = nextId;
    }
}

function getTripEndTime() {
    if (!state.tripData || !state.tripData.timelineDays) {
        return null;
    }
    
    let lastEndTime = null;
    
    // 遍歷所有天數和所有項目，找出最後的結束時間
    state.tripData.timelineDays.forEach(day => {
        if (day.items && day.items.length > 0) {
            day.items.forEach(item => {
                if (item.end) {
                    const endTime = new Date(item.end);
                    if (!lastEndTime || endTime > lastEndTime) {
                        lastEndTime = endTime;
                    }
                }
            });
        }
    });
    
    return lastEndTime;
}

function startRealtimeUpdates() {
    updateCountdown();
    updateTripMetaText();
    setInterval(() => {
        updateCountdown();
        updateTripMetaText();
        // updateTimelineStatus(); // Status now in hero-side, updated by updateHeroPhase()
    }, 1000);
}

function updateCountdown() {
    const countdownTarget = new Date(state.tripData.trip.countdownTarget);
    const container = document.getElementById("countdown-container");
    if (!container || Number.isNaN(countdownTarget.getTime())) {
        return;
    }

    // 使用測試時間或真實時間
    const now = getCurrentTime();
    
    // 找出行程最後一個項目的結束時間
    const tripEndTime = getTripEndTime();
    
    // 判斷旅程狀態
    if (tripEndTime && now >= tripEndTime) {
        container.innerHTML = '<div class="countdown-finished">旅程已結束</div>';
        return;
    }
    
    const diffMs = countdownTarget - now;

    if (diffMs <= 0) {
        container.innerHTML = '<div class="countdown-finished">旅程已開始 🎉</div>';
        return;
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const hourMs = 60 * 60 * 1000;
    const minuteMs = 60 * 1000;
    const secondMs = 1000;

    const days = Math.floor(diffMs / dayMs);
    const hours = Math.floor((diffMs % dayMs) / hourMs);
    const minutes = Math.floor((diffMs % hourMs) / minuteMs);
    const seconds = Math.floor((diffMs % minuteMs) / secondMs);
    
    // 更新各個時間單位的翻板
    updateFlipUnit('days', days);
    updateFlipUnit('hours', hours);
    updateFlipUnit('minutes', minutes);
    updateFlipUnit('seconds', seconds);
}

function updateFlipUnit(unit, newValue) {
    const previous = state.previousCountdown[unit];
    
    // 如果值沒有改變，不需要動畫
    if (previous === newValue) {
        return;
    }
    
    const flipElement = document.querySelector(`[data-unit="${unit}"]`);
    if (!flipElement) {
        return;
    }
    
    const topStatic = flipElement.previousElementSibling;
    const bottomStatic = flipElement.nextElementSibling;
    const flipFront = flipElement.querySelector('.flip-front');
    const flipBack = flipElement.querySelector('.flip-back');
    
    if (!topStatic || !bottomStatic || !flipFront || !flipBack) {
        return;
    }
    
    // 如果是第一次運行（previous === -1），直接設置不動畫
    if (previous === -1) {
        topStatic.querySelector('span').textContent = newValue;
        bottomStatic.querySelector('span').textContent = newValue;
        flipFront.textContent = newValue;
        flipBack.textContent = newValue;
        // 【新增這行】初始化時同步寫入屬性
        flipBack.setAttribute('data-number', newValue);

        topStatic.dataset.value = newValue;
        bottomStatic.dataset.value = newValue;
        state.previousCountdown[unit] = newValue;
        return;
    }
    
    // !! 關鍵修正：動畫前的狀態設置
    // 上半部固定背景：立即更新為新數字（會被翻板正面的舊數字遮住）
    topStatic.querySelector('span').textContent = newValue;
    topStatic.dataset.value = newValue;
    
    // 下半部固定背景：保持舊數字（會被翻板背面的新數字逐漸覆蓋）
    // 不要在這裡更新！要等動畫結束後再更新
    
    // 翻板正面：舊數字的上半部
    flipFront.textContent = previous;
    
    // 翻板背面：新數字的下半部（需要設置 data-number 給 CSS ::before 使用）
    flipBack.textContent = '';  // 清空直接文字
    flipBack.setAttribute('data-number', newValue);  // 設置給偽元素用

    // 移除之前的動畫
    flipElement.classList.remove('flipping');
    
    // 短暫延遲後開始翻轉動畫
    setTimeout(() => {
        flipElement.classList.add('flipping');
        
        // 在動畫中期（約250ms，翻到90度時）更新 flip-front 為新數字
        // 此時 flip-front 已經垂直看不見，更新後為下次動畫做準備
        setTimeout(() => {
            flipFront.textContent = newValue;
        }, 250);
        
        // 動畫結束後（0.5秒），清理並更新狀態
        setTimeout(() => {
            flipElement.classList.remove('flipping');
            
            // 動畫結束後才更新底部固定背景為新數字
            bottomStatic.querySelector('span').textContent = newValue;
            bottomStatic.dataset.value = newValue;
            
            // 更新翻板正面為新數字（為下次翻動準備）
            flipFront.textContent = newValue;
            
            state.previousCountdown[unit] = newValue;
        }, 500); // 與 CSS 動畫時長一致
    }, 10);
}

function getFlattenedTimeline() {
    return state.tripData.timelineDays.flatMap((day) => day.items.map((item) => ({ ...item, dayId: day.id, dayLabel: day.label, dateLabel: day.dateLabel })));
}

function getTimelineState() {
    const items = getFlattenedTimeline().sort((left, right) => new Date(left.start) - new Date(right.start));
    const now = getCurrentTime();
    const current = items.find((item) => now >= new Date(item.start) && now <= new Date(item.end)) || null;
    const next = items.find((item) => new Date(item.start) > now) || null;
    const previous = [...items].reverse().find((item) => new Date(item.end) < now) || null;

    if (current) {
        return {
            current,
            next,
            previous,
            phaseTitle: "目前進行中",
            phaseText: `${current.dayLabel} ${current.timeLabel} · ${current.title}`
        };
    }

    if (next) {
        return {
            current: null,
            next,
            previous,
            phaseTitle: previous ? "下一個節點" : "旅程尚未開始",
            phaseText: `${next.dayLabel} ${next.timeLabel} · ${next.title}`
        };
    }

    return {
        current: null,
        next: null,
        previous,
        phaseTitle: "已完成",
        phaseText: previous ? `最後一段：${previous.dayLabel} ${previous.title}` : "尚無時程資料"
    };
}

// Timeline status moved to hero-side, no longer needed here
// function updateTimelineStatus() {
//     if (state.activeTab !== "timeline") {
//         return;
//     }
//     const timelineState = getTimelineState();
//     const statusTarget = document.getElementById("timeline-status-card");
//     if (!statusTarget) {
//         return;
//     }
//     const focusItem = getTimelineItemById(state.selectedTimelineId) || timelineState.current || timelineState.next;
//     statusTarget.innerHTML = `
//         <div class="timeline-status-title">${timelineState.phaseTitle}</div>
//         <div class="timeline-status-copy">${timelineState.phaseText}</div>
//         ${focusItem ? `<div class="mini-pill mt-2">焦點：${focusItem.title}</div>` : ""}
//     `;
// }

function getRecommendedTimelineItem() {
    const timelineState = getTimelineState();
    return timelineState.current || timelineState.next || getFlattenedTimeline()[0] || null;
}

function getTimelineItemById(itemId) {
    return getFlattenedTimeline().find((item) => item.id === itemId) || null;
}

function getLinkedTransportsForSelectedTimeline() {
    const item = getTimelineItemById(state.selectedTimelineId);
    if (!item || !item.transportIds) {
        return [];
    }
    return state.tripData.transports.filter((transport) => item.transportIds.includes(transport.id));
}

function getFilteredTransports() {
    if (state.transportDayFilter === "all") {
        return state.tripData.transports;
    }
    return state.tripData.transports.filter((transport) => transport.dayId === state.transportDayFilter);
}

function getNextTransportTitle() {
    const linked = getLinkedTransportsForSelectedTimeline();
    if (linked.length > 0) {
        return linked[0].title;
    }
    return state.tripData.transports[0]?.title || "尚未設定";
}

function buildVjwBlocks() {
    const overview = state.tripData.overview;
    const outbound = overview.outboundFlight;
    const stay = getPrimaryStay();
    const vjwStay = stay.vjw || {};

    const vjwPostalCode = firstNonEmpty(vjwStay.postalCode, normalizeDigitsOnly(stay.postalCode));
    const vjwPrefecture = firstNonEmpty(vjwStay.prefecture, stay.prefecture);
    const vjwCityWard = firstNonEmpty(vjwStay.cityWard, stay.cityWard);
    const vjwAddressLine = firstNonEmpty(vjwStay.addressLine, stay.addressLine);
    const vjwName = firstNonEmpty(vjwStay.name, stay.name);
    const vjwPhone = firstNonEmpty(vjwStay.phone, normalizeDigitsOnly(stay.phone));

    const missingFields = [];

    const requiredMap = [
        [overview.travelName, "旅行名稱"],
        [outbound.arrivalDateForVjw, "抵達日本預定日"],
        [outbound.airlineName, "航空公司名稱"],
        [outbound.flightNumber, "航班號碼"],
        [outbound.departureAirport, "出發地"],
        [vjwPrefecture, "都道府縣"],
        [vjwCityWard, "市區町村名"],
        [vjwAddressLine, "町字、番地"],
        [vjwName, "住宿處、飯店名稱"],
        [vjwPhone, "在日本國內可連絡的電話號碼"],
    ];

    requiredMap.forEach(([value, label]) => {
        if (!value || String(value).trim() === "") {
            missingFields.push(label);
        }
    });

    const arrivalText = [
        `旅行名稱: ${withPlaceholder(overview.travelName)}`,
        `抵達日本預定日: ${withPlaceholder(outbound.arrivalDateForVjw)}`,
        `航空公司名稱: ${withPlaceholder(`${outbound.airlineCode} : ${outbound.airlineName}`)}`,
        `航班號: ${withPlaceholder(outbound.flightNumber)}`,
        `出發地: ${withPlaceholder(outbound.departureAirport)}`
    ].join("\n");

    const contactText = [
        `郵遞區號: ${withPlaceholder(vjwPostalCode, false)}`,
        `都道府縣: ${withPlaceholder(vjwPrefecture)}`,
        `市區町村名: ${withPlaceholder(vjwCityWard)}`,
        `町字、番地: ${withPlaceholder(vjwAddressLine)}`,
        `住宿處、飯店名稱: ${withPlaceholder(vjwName)}`,
        `在日本國內可連絡的電話號碼: ${withPlaceholder(vjwPhone)}`
    ].join("\n");

    return { arrivalText, contactText, missingFields };
}

function getPrimaryStay() {
    const fromList = state.tripData?.overview?.stays?.[0];
    return fromList || state.tripData.overview.stay || {};
}

function getAllStays() {
    const list = state.tripData?.overview?.stays;
    if (Array.isArray(list) && list.length > 0) {
        return list;
    }
    return state.tripData?.overview?.stay ? [state.tripData.overview.stay] : [];
}

function updateVjwModal() {
    const vjwData = buildVjwBlocks();
    const missingAlert = document.getElementById("vjw-missing-alert");

    document.getElementById("vjw-arrival-output").value = vjwData.arrivalText;
    document.getElementById("vjw-contact-output").value = vjwData.contactText;

    if (!missingAlert) {
        return;
    }

    if (vjwData.missingFields.length > 0) {
        missingAlert.hidden = false;
        missingAlert.innerHTML = `<div class="overview-warning mb-3"><strong>以下資料尚未補齊：</strong><br>${vjwData.missingFields.join("、")}</div>`;
        return;
    }

    missingAlert.hidden = true;
    missingAlert.innerHTML = "";
}

async function copyTextareaValue(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) {
        return;
    }
    try {
        await navigator.clipboard.writeText(textarea.value);
    } catch (error) {
        console.error("複製失敗", error);
    }
}

function loadChecklistState() {
    try {
        const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        return {};
    }
}

function persistChecklistState() {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state.checklistState));
}

/**
 * 載入卡片完成狀態（支援舊格式相容性）
 */
function loadCardCompletionState() {
    try {
        const raw = localStorage.getItem(CARD_COMPLETION_KEY);
        if (!raw) return {};
        
        const data = JSON.parse(raw);
        const result = {};
        
        // 檢查並轉換舊格式（boolean）為新格式（{completed: boolean, timestamp: string}）
        Object.keys(data).forEach(key => {
            if (typeof data[key] === 'boolean') {
                // 舊格式：直接是 boolean
                result[key] = {
                    completed: data[key],
                    timestamp: new Date().toISOString() // 給舊資料一個時間戳
                };
            } else if (typeof data[key] === 'object' && data[key] !== null) {
                // 新格式：已經是物件
                result[key] = data[key];
            }
        });
        
        return result;
    } catch (error) {
        return {};
    }
}

/**
 * 儲存卡片完成狀態
 */
function persistCardCompletionState() {
    localStorage.setItem(CARD_COMPLETION_KEY, JSON.stringify(state.cardCompletionState));
}

/**
 * 切換卡片完成狀態（記錄時間戳）
 */
function toggleCardCompletion(cardType, cardId) {
    const key = `${cardType}-${cardId}`;
    const currentData = state.cardCompletionState[key];
    const currentState = currentData?.completed || false;
    
    if (currentState) {
        // 取消勾選：直接刪除該筆資料
        delete state.cardCompletionState[key];
    } else {
        // 勾選：記錄完成狀態和時間戳
        state.cardCompletionState[key] = {
            completed: true,
            timestamp: new Date().toISOString()
        };
        // 顯示慶祝動畫
        showCompletionAnimation();
    }
    
    persistCardCompletionState();
}

/**
 * 檢查卡片是否已完成
 */
function isCardCompleted(cardType, cardId) {
    const key = `${cardType}-${cardId}`;
    const data = state.cardCompletionState[key];
    return data?.completed || false;
}

/**
 * 顯示完成動畫
 */
/**
 * 播放垃圾桶動畫（取消完成時）
 */
function playTrashAnimation(completedItem, cardType, cardId) {
    // 添加動畫 class
    completedItem.classList.add('trashing');
    
    // 等待動畫完成後再更新狀態
    setTimeout(() => {
        // 更新完成狀態
        toggleCardCompletion(cardType, cardId);
        
        // 重新渲染所有相關面板
        renderTimelinePanel();
        renderTransportPanel();
        renderSightseeingPanel();
        renderManholeCardPanel();
        renderDiningPanel();
        renderSouvenirPanel();
        renderOthersPanel();
        
        // 檢查是否需要移除整個分類
        const group = completedItem.closest('.completed-day-group');
        const itemsList = group?.querySelector('.completed-items-list');
        
        if (itemsList && itemsList.children.length === 0) {
            // 如果該分類沒有項目了，縮小整個分類
            group.style.maxHeight = group.offsetHeight + 'px';
            setTimeout(() => {
                group.classList.add('group-collapsing');
            }, 10);
            
            setTimeout(() => {
                renderCompletedListModal();
            }, 400);
        } else {
            // 只是移除單一項目
            renderCompletedListModal();
        }
    }, 800); // 與 CSS 動畫時長一致
}

function showCompletionAnimation() {
    // 創建慶祝動畫元素
    const celebration = document.createElement('div');
    celebration.className = 'completion-celebration';
    celebration.innerHTML = `
        <div class="celebration-content">
            <div class="celebration-icon">✓</div>
            <div class="celebration-text">完成了！</div>
        </div>
    `;
    document.body.appendChild(celebration);
    
    // 動畫結束後移除元素
    setTimeout(() => {
        celebration.remove();
    }, 1500);
}

/**
 * 渲染圖片區塊（支援單張或多張）
 */
function renderImageGallery(images, altText) {
    if (!images || images.length === 0) return '';
    
    // 單張圖片
    if (images.length === 1) {
        const img = images[0];
        return `
            <div class="compact-detail-image">
                <img src="${img.image}" alt="${img.imageCaption || altText}" />
                ${img.imageCaption ? `<p class="compact-image-caption">${autoLinkify(img.imageCaption)}</p>` : ''}
            </div>
        `;
    }
    
    // 多張圖片 - 輪播
    const galleryId = 'gallery-' + Math.random().toString(36).substr(2, 9);
    return `
        <div class="compact-detail-gallery" id="${galleryId}">
            <div class="gallery-images">
                ${images.map((img, index) => `
                    <div class="gallery-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
                        <img src="${img.image}" alt="${img.imageCaption || altText}" />
                        ${img.imageCaption ? `<p class="compact-image-caption">${autoLinkify(img.imageCaption)}</p>` : ''}
                    </div>
                `).join('')}
            </div>
            <button class="gallery-btn gallery-prev" onclick="navigateGallery('${galleryId}', -1)">
                <i class="bi bi-chevron-left"></i>
            </button>
            <button class="gallery-btn gallery-next" onclick="navigateGallery('${galleryId}', 1)">
                <i class="bi bi-chevron-right"></i>
            </button>
            <div class="gallery-indicators">
                ${images.map((_, index) => `
                    <span class="gallery-indicator ${index === 0 ? 'active' : ''}" onclick="goToSlide('${galleryId}', ${index})"></span>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * 導航圖片輪播
 */
function navigateGallery(galleryId, direction) {
    const gallery = document.getElementById(galleryId);
    if (!gallery) return;
    
    const slides = gallery.querySelectorAll('.gallery-slide');
    const indicators = gallery.querySelectorAll('.gallery-indicator');
    const currentSlide = gallery.querySelector('.gallery-slide.active');
    const currentIndex = parseInt(currentSlide.dataset.index);
    let newIndex = currentIndex + direction;
    
    // 循環
    if (newIndex < 0) newIndex = slides.length - 1;
    if (newIndex >= slides.length) newIndex = 0;
    
    // 更新活動狀態
    slides.forEach(slide => slide.classList.remove('active'));
    indicators.forEach(indicator => indicator.classList.remove('active'));
    slides[newIndex].classList.add('active');
    indicators[newIndex].classList.add('active');
}

/**
 * 跳轉到特定圖片
 */
/**
 * 跳轉到當前時間對應的行程卡片
 */
function jumpToCurrentTimeline() {
    const timelineState = getTimelineState();
    const targetItem = timelineState.current || timelineState.next;
    
    if (!targetItem) {
        return;
    }
    
    // 切換到時程表分頁
    setActiveTab('timeline');
    
    // 切換到對應的天數
    state.timelineDayId = targetItem.dayId;
    
    // 設定選中的行程
    state.selectedTimelineId = targetItem.id;
    state.expandedTimelineId = targetItem.id;
    
    // 重新渲染
    renderTimelinePanel();
    
    // 捲動到該卡片
    setTimeout(() => {
        const targetElement = document.querySelector(`[data-item-id="${targetItem.id}"]`);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

function goToSlide(galleryId, index) {
    const gallery = document.getElementById(galleryId);
    if (!gallery) return;
    
    const slides = gallery.querySelectorAll('.gallery-slide');
    const indicators = gallery.querySelectorAll('.gallery-indicator');
    
    slides.forEach(slide => slide.classList.remove('active'));
    indicators.forEach(indicator => indicator.classList.remove('active'));
    slides[index].classList.add('active');
    indicators[index].classList.add('active');
}

/**
 * 渲染已完成清單 Modal
 */
function renderCompletedListModal() {
    const completedItems = [];
    
    // 收集所有已完成的卡片
    Object.keys(state.cardCompletionState).forEach(key => {
        const data = state.cardCompletionState[key];
        if (!data?.completed) return; // 跳過未完成的
        
        // 解析 key 格式：type-id
        const parts = key.split('-');
        if (parts.length < 2) return;
        
        const type = parts[0];
        const cardId = parts.slice(1).join('-'); // 支援 id 中包含橫線的情況
        
        // 找到對應的卡片資料
        let cardData = null;
        let typeName = '';
        let icon = '';
        
        switch(type) {
            case 'transport':
                cardData = state.tripData.transports.find(t => t.id === cardId);
                typeName = '交通';
                icon = 'bi-geo-alt-fill';
                break;
            case 'sightseeing':
                cardData = state.tripData.sightseeing.find(s => s.name === cardId);
                typeName = '景點';
                icon = 'bi-camera-fill';
                break;
            case 'dining':
                cardData = state.tripData.dining.find(d => d.name === cardId);
                typeName = '餐飲';
                icon = 'bi-cup-hot-fill';
                break;
            case 'souvenir':
                cardData = state.tripData.souvenirs.find(s => s.name === cardId);
                typeName = '伴手禮';
                icon = 'bi-gift-fill';
                break;
            case 'otherInfo':
                cardData = state.tripData.otherInfo.find(o => o.id === cardId);
                typeName = '其他資訊';
                icon = 'bi-info-circle-fill';
                break;
            case 'manholeCard':
                cardData = state.tripData.manholeCards.find(m => m.name === cardId);
                typeName = '人孔蓋卡';
                icon = 'bi-record-circle';
                break;
        }
        
        if (cardData) {
            completedItems.push({
                type: type,
                typeName: typeName,
                icon: icon,
                title: cardData.name || cardData.title,
                cardId: cardId,
                data: cardData
            });
        }
    });
    
    // 生成 HTML
    const contentEl = document.getElementById('completed-list-content');
    
    if (completedItems.length === 0) {
        contentEl.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-inbox" style="font-size: 3rem; opacity: 0.3;"></i>
                <p class="mt-3">尚無已完成項目</p>
            </div>
        `;
        return;
    }
    
    // 按類型分組
    const groupedByType = {};
    completedItems.forEach(item => {
        if (!groupedByType[item.typeName]) {
            groupedByType[item.typeName] = {
                icon: item.icon,
                items: []
            };
        }
        groupedByType[item.typeName].items.push(item);
    });
    
    // 生成 HTML
    let html = '';
    const typeOrder = ['交通', '景點', '餐飲', '伴手禮', '其他資訊'];
    typeOrder.forEach(typeName => {
        const group = groupedByType[typeName];
        if (!group) return;
        
        html += `
            <div class="completed-day-group mb-3">
                <h6 class="completed-day-title mb-2">
                    <i class="bi ${group.icon} me-2"></i>${typeName}
                </h6>
                <div class="completed-items-list">
                    ${group.items.map(item => `
                        <div class="completed-item">
                            <label class="completed-item-checkbox" onclick="event.stopPropagation()">
                                <input type="checkbox" 
                                       checked 
                                       data-card-type="${item.type}" 
                                       data-card-id="${item.cardId}" />
                                <span class="checkbox-custom"></span>
                            </label>
                            <div class="completed-item-content">
                                <div class="completed-item-title">${item.title}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    contentEl.innerHTML = html;
}

function toggleChecklistBranch(branchId, isChecked) {
    const branch = state.tripData.checklist.find((item) => item.id === branchId);
    if (!branch) {
        return;
    }

    // 遞迴設置所有子項目的狀態
    setChecklistItemsState(branch.children, isChecked);
    persistChecklistState();
}

/**
 * 遞迴設置項目及其所有子項目的狀態
 */
function setChecklistItemsState(items, isChecked) {
    if (!items) return;
    
    items.forEach((item) => {
        state.checklistState[item.id] = isChecked;
        if (item.children && item.children.length > 0) {
            setChecklistItemsState(item.children, isChecked);
        }
    });
}

/**
 * 切換嵌套項目及其所有子項目的狀態
 */
function toggleChecklistItem(itemId, isChecked) {
    state.checklistState[itemId] = isChecked;
    
    // 找到該項目並遞迴設置其所有子項目
    const item = findChecklistItemById(itemId);
    if (item && item.children) {
        setChecklistItemsState(item.children, isChecked);
    }
    
    persistChecklistState();
}

/**
 * 在整個 checklist 中搜尋項目（遞迴）
 */
function findChecklistItemById(itemId) {
    for (const branch of state.tripData.checklist) {
        const found = findItemInChildren(branch.children, itemId);
        if (found) return found;
    }
    return null;
}

function findItemInChildren(items, itemId) {
    if (!items) return null;
    
    for (const item of items) {
        if (item.id === itemId) return item;
        if (item.children) {
            const found = findItemInChildren(item.children, itemId);
            if (found) return found;
        }
    }
    return null;
}

function handleChecklistAction(action) {
    if (action === "check-all" || action === "uncheck-all") {
        const checked = action === "check-all";
        state.tripData.checklist.forEach((branch) => {
            setChecklistItemsState(branch.children, checked);
        });
        persistChecklistState();
        renderChecklistPanel();
        return;
    }

    if (action === "reset") {
        state.checklistState = {};
        persistChecklistState();
        renderChecklistPanel();
    }
}

/**
 * 計算分支的狀態（遞迴計算所有子項目包括嵌套項目）
 */
function getChecklistBranchState(branch) {
    const allLeafIds = getAllLeafItemIds(branch.children);
    const checkedCount = allLeafIds.filter(id => Boolean(state.checklistState[id])).length;
    
    return {
        checked: checkedCount === allLeafIds.length && allLeafIds.length > 0,
        indeterminate: checkedCount > 0 && checkedCount < allLeafIds.length
    };
}

/**
 * 計算嵌套項目的狀態
 */
function getChecklistItemState(item) {
    if (!item.children || item.children.length === 0) {
        return {
            checked: Boolean(state.checklistState[item.id]),
            indeterminate: false
        };
    }
    
    const allLeafIds = getAllLeafItemIds(item.children);
    const checkedCount = allLeafIds.filter(id => Boolean(state.checklistState[id])).length;
    
    return {
        checked: checkedCount === allLeafIds.length && allLeafIds.length > 0,
        indeterminate: checkedCount > 0 && checkedCount < allLeafIds.length
    };
}

/**
 * 遞迴獲取所有最終子項目（葉節點）的 ID
 */
function getAllLeafItemIds(items) {
    if (!items) return [];
    
    const leafIds = [];
    items.forEach(item => {
        if (item.children && item.children.length > 0) {
            leafIds.push(...getAllLeafItemIds(item.children));
        } else {
            leafIds.push(item.id);
        }
    });
    return leafIds;
}

/**
 * 展開/收合嵌套的 checklist 分組
 */
function toggleChecklistGroup(button) {
    const groupId = button.dataset.toggleGroup;
    const content = document.querySelector(`[data-group="${groupId}"]`);
    
    if (!content) return;
    
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    const newState = !isExpanded;
    
    button.setAttribute('aria-expanded', String(newState));
    content.hidden = !newState;
    
    // 更新圖標
    const icon = button.querySelector('i');
    if (icon) {
        icon.className = newState ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
    }
}

function createPillHtml(label, icon) {
    return `<span class="hero-tag"><i class="bi ${icon}"></i>${label}</span>`;
}

function formatValue(value) {
    if (!value || String(value).trim() === "") {
        return '<span class="missing-value">待補資料</span>';
    }
    return value;
}

function renderCollapsibleTip(value) {
    if (!value || String(value).trim() === "") {
        return '<span class="missing-value">待補資料</span>';
    }

    return `
        <details class="inline-tip">
            <summary class="tip-trigger">點擊查看</summary>
            <span class="tip-content">${value}</span>
        </details>
    `;
}

function renderStayDetailBlock(stay, detailId) {
    const detailRows = [
        ["電話", stay.phone],
        ["郵遞區號", stay.postalCode],
        ["地區", joinParts([stay.prefecture, stay.cityWard], " ")],
        ["地址", stay.addressLine]
    ];

    const hasDetail = detailRows.some(([, value]) => value && String(value).trim() !== "");
    if (!hasDetail && !stay.notes) {
        return '<span class="missing-value">待補資料</span>';
    }

    return `
        <div id="${detailId}" class="stay-detail-panel" hidden>
            <dl class="stay-detail-list">
                ${detailRows.map(([label, value]) => `
                    <div class="stay-detail-row">
                        <dt>${label}</dt>
                        <dd>${formatValue(value)}</dd>
                    </div>
                `).join("")}
            </dl>
            ${stay.notes ? `<p class="stay-detail-notes">${stay.notes}</p>` : ""}
        </div>
    `;
}

function toggleStayDetail(button) {
    const targetId = button.dataset.stayDetailToggle;
    const detailPanel = document.getElementById(targetId);

    if (!detailPanel) {
        return;
    }

    const nextExpanded = detailPanel.hidden;
    detailPanel.hidden = !nextExpanded;
    button.setAttribute("aria-expanded", String(nextExpanded));
    button.classList.toggle("expanded", nextExpanded);
}

/**
 * 切換緊湊卡片的展開/收合狀態
 */
function toggleCompactCard(card) {
    const detailsDiv = card.querySelector('.compact-card-details');
    
    if (!detailsDiv) {
        return;
    }
    
    const isExpanded = !detailsDiv.hidden;
    detailsDiv.hidden = isExpanded;
    
    // 更新卡片的視覺狀態
    card.classList.toggle('is-expanded', !isExpanded);
}

function withPlaceholder(value, required = true) {
    if (!value || String(value).trim() === "") {
        return required ? "【待補】" : "";
    }
    return value;
}

function normalizeDigitsOnly(value) {
    if (!value) {
        return "";
    }
    return String(value).replace(/\D/g, "");
}

function firstNonEmpty(...values) {
    for (const value of values) {
        if (value && String(value).trim() !== "") {
            return value;
        }
    }
    return "";
}

function joinParts(parts, separator) {
    return parts.filter(Boolean).join(separator);
}

function setText(id, value) {
    const target = document.getElementById(id);
    if (target) {
        target.textContent = value;
    }
}

/**
 * 自動將文字中的連結、電話、Email 轉換成可點擊的連結
 */
function autoLinkify(text) {
    if (!text) return text;
    
    let result = String(text);
    
    // 1. 先轉換 URL（支援 http/https）
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;
    result = result.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">$1</a>');
    
    // 2. 轉換 Email（避免已經在 <a> 標籤中的）
    const emailRegex = /(?<!href=")((?:[a-zA-Z0-9._-]+)@(?:[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}))/g;
    result = result.replace(emailRegex, '<a href="mailto:$1" onclick="event.stopPropagation()">$1</a>');
    
    // 3. 轉換電話號碼（只轉換明確的電話號碼格式，避免誤判時間）
    // 格式：+XX-XXXX-XXXX 或 (0XX) XXXX-XXXX 或 0XX-XXXX-XXXX
    const phoneRegex = /(?<!\d)(\+?\d{1,4}[-.\s()]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4})(?!\d)/g;
    result = result.replace(phoneRegex, (match) => {
        // 只有當數字總數大於等於 8 位時才轉換（避免誤判時間如 12:30）
        const digitCount = match.replace(/\D/g, '').length;
        if (digitCount >= 8) {
            return `<a href="tel:${match.replace(/\s/g, '')}" onclick="event.stopPropagation()">${match}</a>`;
        }
        return match;
    });
    
    return result;
}

// ===== 相關資訊折疊控制 =====

/**
 * 切換相關資訊分組的展開/收合狀態
 */
function toggleRelatedGroup(button) {
    const groupId = button.dataset.relatedToggle;
    const content = document.querySelector(`[data-related-group="${groupId}"]`);
    
    if (!content) return;
    
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    const newState = !isExpanded;
    
    button.setAttribute('aria-expanded', String(newState));
    content.hidden = !newState;
    
    // 更新按鈕文字
    const icon = button.querySelector('i');
    const hiddenCount = content.children.length;
    
    if (newState) {
        icon.className = 'bi bi-chevron-up me-1';
        button.innerHTML = `<i class="bi bi-chevron-up me-1"></i>顯示較少`;
    } else {
        icon.className = 'bi bi-chevron-down me-1';
        button.innerHTML = `<i class="bi bi-chevron-down me-1"></i>顯示更多 (${hiddenCount})`;
    }
}
