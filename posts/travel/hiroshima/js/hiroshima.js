const DATA_FILE = "trip-data.json";
const CHECKLIST_STORAGE_KEY = "hiroshima-trip-checklist-v2";

// ===== 測試用時間覆蓋變數 =====
// 設為 null 表示使用真實系統時間
// 設為日期字串可模擬特定時間點，例如："2026-05-30T00:00:00+09:00" 或 "2026-05-30"
// const TEST_CURRENT_TIME_OVERRIDE = "2026-06-03T00:00:00+08:00"; // 行程結束後
// const TEST_CURRENT_TIME_OVERRIDE = "2026-05-28T04:29:00+08:00"; // 行程進行中
const TEST_CURRENT_TIME_OVERRIDE = null; // 使用真實時間

const ThemeManager = {
    init() {
        const savedTheme = localStorage.getItem("chuiy-theme") || "light";
        this.setTheme(savedTheme);

        const themeToggle = document.getElementById("themeToggle");
        if (themeToggle) {
            themeToggle.addEventListener("click", () => this.toggleTheme());
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
    activeTab: "overview",
    timelineDayId: null,
    transportDayFilter: "all",
    selectedTimelineId: null,
    expandedTimelineId: null,
    checklistState: {},
    previousCountdown: { days: -1, hours: -1, minutes: -1, seconds: -1 }
};

document.addEventListener("DOMContentLoaded", async () => {
    ThemeManager.init();
    await loadPageData();
    initializeState();
    renderPage();
    bindEvents();
    startRealtimeUpdates();
});

async function loadPageData() {
    const response = await fetch(DATA_FILE);
    if (!response.ok) {
        throw new Error("無法讀取廣島旅遊資料");
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
            // 點擊緊湊卡片，切換該卡片的展開/收合
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
            state.expandedTimelineId = null;
        } else {
            state.expandedTimelineId = itemId;
        }
        state.selectedTimelineId = itemId;
        renderTimelinePanel();
        renderTransportPanel();
        renderSightseeingPanel();
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
    }
}

function renderPage() {
    renderHero();
    // renderSidebar();
    renderOverviewPanel();
    renderTimelinePanel();
    renderTransportPanel();
    renderSightseeingPanel();
    renderDiningPanel();
    renderSouvenirPanel();
    renderChecklistPanel();
    renderOthersPanel();
    updateTripMetaText();
    updateVjwModal();
    syncTabUi();
}

function renderHero() {
    const trip = state.tripData.trip;
    setText("hiroshima-title", trip.title);
    setText("hiroshima-subtitle", trip.subtitle);
    setText("hiroshima-range", trip.dateRangeLabel);
    setText("hiroshima-timezone", trip.timezone);
    setText("hiroshima-updated", `更新：${trip.lastUpdated}`);

    const heroTags = document.getElementById("hero-tags");
    heroTags.innerHTML = [
        createPillHtml(`${state.tripData.timelineDays.length} 天行程`, "bi-calendar3"),
        createPillHtml(`${state.tripData.dining.length} 間餐飲`, "bi-cup-hot"),
        createPillHtml(`${state.tripData.souvenirs.length} 項伴手禮`, "bi-bag-heart")
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
    const now = new Date();
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
    } else if (new Date(item.end) < new Date()) {
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
    
    const hasRelatedInfo = (item.transportIds || []).length > 0 || (item.diningIds || []).length > 0 || (item.souvenirIds || []).length > 0 || (item.sightseeingIds || []).length > 0 || (item.otherInfoIds || []).length > 0;
    
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
    
    const hasAnyInfo = transports.length > 0 || dinings.length > 0 || sightseeings.length > 0 || souvenirs.length > 0 || otherInfos.length > 0;
    
    if (!hasAnyInfo) {
        return '';
    }
    
    let html = '<div class="timeline-item-related">';
    
    // 交通資訊
    if (transports.length > 0) {
        html += `<div class="related-info-section"><h4 class="related-info-title"><i class="bi bi-sign-turn-right me-1"></i>交通 (${transports.length})</h4>`;
        transports.forEach(transport => {
            html += renderCompactTransportCard(transport);
        });
        html += '</div>';
    }
    
    // 景點資訊
    if (sightseeings.length > 0) {
        html += `<div class="related-info-section"><h4 class="related-info-title"><i class="bi bi-camera-fill me-1"></i>景點 (${sightseeings.length})</h4>`;
        sightseeings.forEach(sight => {
            html += renderCompactSightseeingCard(sight);
        });
        html += '</div>';
    }
    
    // 餐飲資訊
    if (dinings.length > 0) {
        html += `<div class="related-info-section"><h4 class="related-info-title"><i class="bi bi-cup-hot me-1"></i>餐飲 (${dinings.length})</h4>`;
        dinings.forEach(dining => {
            html += renderCompactDiningCard(dining);
        });
        html += '</div>';
    }
    
    // 伴手禮資訊
    if (souvenirs.length > 0) {
        html += `<div class="related-info-section"><h4 class="related-info-title"><i class="bi bi-bag-heart me-1"></i>伴手禮 (${souvenirs.length})</h4>`;
        souvenirs.forEach(souvenir => {
            html += renderCompactSouvenirCard(souvenir);
        });
        html += '</div>';
    }
    
    // 其他資訊
    if (otherInfos.length > 0) {
        html += `<div class="related-info-section"><h4 class="related-info-title"><i class="bi bi-info-circle-fill me-1"></i>其他資訊 (${otherInfos.length})</h4>`;
        otherInfos.forEach(info => {
            html += renderCompactOtherInfoCard(info);
        });
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

/**
 * 渲染緊湊版交通卡片
 */
function renderCompactTransportCard(transport) {
    return `
        <div class="compact-card">
            <div class="compact-card-header">
                <h5 class="compact-card-title">${transport.title}</h5>
                <div class="compact-card-tags">
                    <span class="compact-tag">${transport.type}</span>
                    <span class="compact-tag status">${transport.status}</span>
                    ${transport.websiteUrl ? `<a href="${transport.websiteUrl}" target="_blank" class="compact-map-link" title="官方網站" onclick="event.stopPropagation()"><i class="bi bi-globe"></i></a>` : ''}
                    ${transport.mapsUrl ? `<a href="${transport.mapsUrl}" target="_blank" class="compact-map-link" title="Google Map" onclick="event.stopPropagation()"><i class="bi bi-geo-alt-fill"></i></a>` : ''}
                </div>
            </div>
            <div class="compact-card-summary">${autoLinkify(transport.route)}</div>
            <div class="compact-card-details" hidden>
                <div class="compact-detail-row"><strong>時間</strong> ${autoLinkify(transport.depart)} → ${autoLinkify(transport.arrive)}</div>
                <div class="compact-detail-row"><strong>費用</strong> ${autoLinkify(transport.cost)}</div>
                ${transport.note ? `<div class="compact-detail-row"><strong>備註</strong> ${autoLinkify(transport.note)}</div>` : ''}
                ${transport.image ? `<div class="compact-detail-image"><img src="${transport.image}" alt="${transport.imageCaption || transport.title}" />${transport.imageCaption ? `<p class="compact-image-caption">${autoLinkify(transport.imageCaption)}</p>` : ''}</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * 渲染緊湊版景點卡片
 */
function renderCompactSightseeingCard(sight) {
    return `
        <div class="compact-card">
            <div class="compact-card-header">
                <h5 class="compact-card-title">${sight.name}</h5>
                <div class="compact-card-tags">
                    <span class="compact-tag">${sight.category}</span>
                    <span class="compact-tag status">${sight.visitPlan}</span>
                    ${sight.websiteUrl ? `<a href="${sight.websiteUrl}" target="_blank" class="compact-map-link" title="官方網站" onclick="event.stopPropagation()"><i class="bi bi-globe"></i></a>` : ''}
                    ${sight.mapsUrl ? `<a href="${sight.mapsUrl}" target="_blank" class="compact-map-link" title="Google Map" onclick="event.stopPropagation()"><i class="bi bi-geo-alt-fill"></i></a>` : ''}
                </div>
            </div>
            <div class="compact-card-summary">${autoLinkify(sight.area)}</div>
            <div class="compact-card-details" hidden>
                ${sight.openingHours ? `<div class="compact-detail-row"><strong>開放時間</strong> ${autoLinkify(sight.openingHours)}</div>` : ''}
                ${sight.admission ? `<div class="compact-detail-row"><strong>門票</strong> ${autoLinkify(sight.admission)}</div>` : ''}
                ${sight.note ? `<div class="compact-detail-row"><strong>備註</strong> ${autoLinkify(sight.note)}</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * 渲染緊湊版餐飲卡片
 */
function renderCompactDiningCard(dining) {
    return `
        <div class="compact-card">
            <div class="compact-card-header">
                <h5 class="compact-card-title">${dining.name}</h5>
                <div class="compact-card-tags">
                    <span class="compact-tag">${dining.category}</span>
                    <span class="compact-tag status">${dining.reservationStatus}</span>
                    ${dining.websiteUrl ? `<a href="${dining.websiteUrl}" target="_blank" class="compact-map-link" title="官方網站" onclick="event.stopPropagation()"><i class="bi bi-globe"></i></a>` : ''}
                    ${dining.mapsUrl ? `<a href="${dining.mapsUrl}" target="_blank" class="compact-map-link" title="Google Map" onclick="event.stopPropagation()"><i class="bi bi-geo-alt-fill"></i></a>` : ''}
                </div>
            </div>
            <div class="compact-card-summary">${autoLinkify(dining.area)}</div>
            <div class="compact-card-details" hidden>
                ${dining.note ? `<div class="compact-detail-row"><strong>備註</strong> ${autoLinkify(dining.note)}</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * 渲染緊湊版伴手禮卡片
 */
function renderCompactSouvenirCard(souvenir) {
    return `
        <div class="compact-card">
            <div class="compact-card-header">
                <h5 class="compact-card-title">${souvenir.name}</h5>
                <div class="compact-card-tags">
                    <span class="compact-tag">${souvenir.category}</span>
                    <span class="compact-tag status">${souvenir.buyPlan}</span>
                    ${souvenir.websiteUrl ? `<a href="${souvenir.websiteUrl}" target="_blank" class="compact-map-link" title="官方網站" onclick="event.stopPropagation()"><i class="bi bi-globe"></i></a>` : ''}
                    ${souvenir.mapsUrl ? `<a href="${souvenir.mapsUrl}" target="_blank" class="compact-map-link" title="Google Map" onclick="event.stopPropagation()"><i class="bi bi-geo-alt-fill"></i></a>` : ''}
                </div>
            </div>
            <div class="compact-card-summary">${autoLinkify(souvenir.area)}</div>
            <div class="compact-card-details" hidden>
                ${souvenir.note ? `<div class="compact-detail-row"><strong>備註</strong> ${autoLinkify(souvenir.note)}</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * 渲染緊湊版其他資訊卡片
 */
function renderCompactOtherInfoCard(info) {
    const categoryIcons = {
        "租車資訊": "bi-bicycle",
        "飲食建議": "bi-egg-fried",
        "景點推薦": "bi-geo-alt-fill",
        "攝影資訊": "bi-camera-fill",
        "伴手禮資訊": "bi-gift-fill",
        "旅行提醒": "bi-exclamation-triangle-fill",
        "緊急資訊": "bi-telephone-fill",
        "交通資訊": "bi-bus-front-fill"
    };
    const iconClass = categoryIcons[info.category] || "bi-info-circle-fill";
    
    return `
        <div class="compact-card">
            <div class="compact-card-header">
                <h5 class="compact-card-title">${info.title}</h5>
                <div class="compact-card-tags">
                    <span class="compact-tag"><i class="bi ${iconClass} me-1"></i>${info.category}</span>
                    ${info.websiteUrl ? `<a href="${info.websiteUrl}" target="_blank" class="compact-map-link" title="官方網站" onclick="event.stopPropagation()"><i class="bi bi-globe"></i></a>` : ''}
                    ${info.mapsUrl ? `<a href="${info.mapsUrl}" target="_blank" class="compact-map-link" title="Google Map" onclick="event.stopPropagation()"><i class="bi bi-geo-alt-fill"></i></a>` : ''}
                </div>
            </div>
            ${info.subtitle ? `<div class="compact-card-summary">${autoLinkify(info.subtitle)}</div>` : ''}
            ${info.location ? `<div class="compact-card-summary"><i class="bi bi-pin-map-fill me-1"></i>${autoLinkify(info.location)}</div>` : ''}
            <div class="compact-card-details" hidden>
                ${info.details.map(detail => `<div class="compact-detail-item"><i class="bi bi-check-circle me-1"></i>${autoLinkify(detail)}</div>`).join('')}
                ${info.note ? `<div class="compact-detail-row mt-2"><strong>備註</strong> ${autoLinkify(info.note)}</div>` : ''}
            </div>
        </div>
    `;
}

function renderTransportPanel() {
    const selectedItem = getTimelineItemById(state.selectedTimelineId);
    const linkedIds = new Set((selectedItem?.transportIds || []).map((id) => id));

    const transports = state.tripData.transports;
    const target = document.getElementById("transport-list");
    target.innerHTML = transports.map((transport) => {
        const classes = ["transport-card"];
        if (linkedIds.has(transport.id)) {
            classes.push("is-linked");
        }

        // 查找對應的日期標籤
        const day = state.tripData.timelineDays.find(d => d.id === transport.dayId);
        const dayLabel = day ? `${day.label} ${day.dateLabel}` : transport.dayId;

        return `
            <article class="${classes.join(" ")}">
                <div class="card-actions mb-3">
                    <span class="transport-type">${dayLabel}</span>
                    <span class="transport-type">${transport.type}</span>
                    <span class="status-pill">${transport.status}</span>
                </div>
                <h3 class="card-title">${transport.title}</h3>
                <p class="transport-route mb-2">${transport.route}</p>
                ${transport.image ? `
                    <div class="transport-image-container mb-3">
                        <img src="${transport.image}" alt="${transport.imageCaption || transport.title}" class="transport-image" />
                        ${transport.imageCaption ? `<p class="transport-image-caption">${transport.imageCaption}</p>` : ""}
                    </div>
                ` : ""}
                <div class="transport-meta">
                    <div><strong>時間</strong> ${transport.depart} -> ${transport.arrive}</div>
                    <div><strong>費用</strong> ${transport.cost}</div>
                    <div><strong>備註</strong> ${transport.note}</div>
                </div>
                <div class="card-actions mt-3">
                    <div class="card-meta-pills">
                        ${(transport.linkedTimelineIds || []).map((id) => createPillHtml(getTimelineItemById(id)?.title || id, "bi-clock-history")).join("")}
                    </div>
                    <a class="link-btn" href="${transport.mapsUrl}" target="_blank"><i class="bi bi-geo-alt"></i>Google Map</a>
                </div>
            </article>
        `;
    }).join("");
}

function renderDiningPanel() {
    const selectedItem = getTimelineItemById(state.selectedTimelineId);
    const linkedIds = new Set(selectedItem?.diningIds || []);
    
    document.getElementById("dining-list").innerHTML = state.tripData.dining.map((item) => renderListCard(item, {
        topLabel: item.category,
        secondaryLabel: item.reservationStatus,
        footerLabel: item.area,
        note: item.note,
        isLinked: linkedIds.has(item.name)
    })).join("");
}

function renderSightseeingPanel() {
    const selectedItem = getTimelineItemById(state.selectedTimelineId);
    const linkedIds = new Set(selectedItem?.sightseeingIds || []);
    
    document.getElementById("sightseeing-list").innerHTML = state.tripData.sightseeing.map((item) => renderListCard(item, {
        topLabel: item.category,
        secondaryLabel: item.visitPlan,
        footerLabel: item.area,
        note: item.note,
        openingHours: item.openingHours,
        admission: item.admission,
        isLinked: linkedIds.has(item.name)
    })).join("");
}

function renderSouvenirPanel() {
    const selectedItem = getTimelineItemById(state.selectedTimelineId);
    const linkedIds = new Set(selectedItem?.souvenirIds || []);
    
    document.getElementById("souvenir-list").innerHTML = state.tripData.souvenirs.map((item) => renderListCard(item, {
        topLabel: item.category,
        secondaryLabel: item.buyPlan,
        footerLabel: item.area,
        note: item.note,
        isLinked: linkedIds.has(item.name)
    })).join("");
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
                <label class="checklist-branch-header">
                    <input type="checkbox" class="form-check-input checklist-parent-input" data-branch-id="${branch.id}" ${branchState.checked ? "checked" : ""} ${branchState.indeterminate ? 'data-indeterminate="true"' : ""}>
                    <span class="checklist-branch-title">${branch.title}</span>
                </label>
                <div class="checklist-items">
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
                    <label class="checklist-nested-header">
                        <input type="checkbox" 
                               class="form-check-input checklist-nested-parent me-2" 
                               data-item-id="${item.id}" 
                               ${itemState.checked ? "checked" : ""} 
                               ${itemState.indeterminate ? 'data-indeterminate="true"' : ""}>
                        <span class="checklist-nested-title">${item.title}</span>
                        <button type="button" 
                                class="checklist-toggle-btn" 
                                data-toggle-group="${item.id}"
                                aria-expanded="true">
                            <i class="bi bi-chevron-up"></i>
                        </button>
                    </label>
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
                           class="form-check-input checklist-child-input me-2" 
                           data-item-id="${item.id}" 
                           ${state.checklistState[item.id] ? "checked" : ""}>
                    <span>${item.title}</span>
                </label>
            `;
        }
    }).join("");
}

function renderOthersPanel() {
    const selectedItem = getTimelineItemById(state.selectedTimelineId);
    const linkedIds = new Set(selectedItem?.otherInfoIds || []);
    
    document.getElementById("others-info-list").innerHTML = state.tripData.otherInfo.map((item) => renderOtherInfoCard(item, linkedIds.has(item.id))).join("");
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
    // 移除這兩行，避免每秒重新渲染整個頁面導致展開的卡片被重置
    // renderTimelinePanel();
    // renderTransportPanel();
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
    const now = TEST_CURRENT_TIME_OVERRIDE ? new Date(TEST_CURRENT_TIME_OVERRIDE) : new Date();
    
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
    const now = new Date();
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
