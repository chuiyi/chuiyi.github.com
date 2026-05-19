const DATA_FILE = "posts/travel/hiroshima/trip-data.json";
const CHECKLIST_STORAGE_KEY = "hiroshima-trip-checklist-v2";

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
    checklistState: {}
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
    state.overviewMarkdown = await getMarkdownContent(state.tripData.markdown.overview);
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

    const transportDayButton = event.target.closest(".transport-day-btn");
    if (transportDayButton) {
        state.transportDayFilter = transportDayButton.dataset.dayId;
        renderTransportPanel();
        return;
    }

    const timelineItem = event.target.closest(".timeline-item");
    if (timelineItem) {
        state.selectedTimelineId = timelineItem.dataset.itemId;
        const selectedItem = getTimelineItemById(state.selectedTimelineId);
        if (selectedItem?.dayId) {
            state.transportDayFilter = selectedItem.dayId;
        }
        renderTimelinePanel();
        renderTransportPanel();
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

    document.getElementById("overview-markdown").innerHTML = marked.parse(state.overviewMarkdown || "");
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

    renderTimelineRelatedInfo();
}

function renderTimelineItem(item, dayId, timelineState) {
    const classes = ["timeline-item"];

    if (state.selectedTimelineId === item.id) {
        classes.push("is-selected");
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

    return `
        <article class="${classes.join(" ")}" data-item-id="${item.id}">
            <div class="timeline-time">${item.timeLabel}</div>
            <h3 class="timeline-item-title">${iconHtml}${item.title}</h3>
            <div class="timeline-location">${item.location}</div>
            <p class="mb-3">${item.description}</p>
            <div class="timeline-actions">
                <div class="card-meta-pills">
                    ${(item.transportIds || []).length > 0 || (item.diningIds || []).length > 0 || (item.souvenirIds || []).length > 0 ? `<span class="hero-tag has-related-info"><i class="bi bi-link-45deg"></i>有相關資訊</span>` : ""}
                </div>
                ${item.mapsUrl ? `<a class="link-btn" href="${item.mapsUrl}" target="_blank"><i class="bi bi-geo-alt"></i>Google Map</a>` : ""}
            </div>
        </article>
    `;
}

function renderTimelineRelatedInfo() {
    const target = document.getElementById("timeline-related-info");
    const item = getTimelineItemById(state.selectedTimelineId);
    
    if (!item) {
        target.innerHTML = `<p class="related-empty mb-0">選取時程節點後，這裡會顯示相關資訊。</p>`;
        return;
    }

    const transports = (item.transportIds || []).map(id => state.tripData.transports.find(t => t.id === id)).filter(Boolean);
    const dinings = (item.diningIds || []).map(id => state.tripData.dining.find(d => d.name === id)).filter(Boolean);
    const souvenirs = (item.souvenirIds || []).map(id => state.tripData.souvenirs.find(s => s.name === id)).filter(Boolean);

    const hasAnyInfo = transports.length > 0 || dinings.length > 0 || souvenirs.length > 0;

    if (!hasAnyInfo) {
        target.innerHTML = `<p class="related-empty mb-0">此時程節點沒有關聯的資訊。</p>`;
        return;
    }

    let html = '';

    if (transports.length > 0) {
        html += '<div class="related-section"><h4 class="related-section-title"><i class="bi bi-sign-turn-right me-1"></i>交通</h4>';
        html += transports.map((transport) => `
            <article class="transport-card is-linked is-related mb-2">
                <div class="card-actions mb-2">
                    <span class="transport-type">${transport.type}</span>
                    <span class="status-pill">${transport.status}</span>
                </div>
                <h3 class="card-title mb-2">${transport.title}</h3>
                <p class="transport-route mb-2">${transport.route}</p>
                ${transport.image ? `
                    <div class="transport-image-container mb-3">
                        <img src="${transport.image}" alt="${transport.imageCaption || transport.title}" class="transport-image" />
                        ${transport.imageCaption ? `<p class="transport-image-caption">${transport.imageCaption}</p>` : ""}
                    </div>
                ` : ""}
                <p class="card-note mb-3">${transport.note}</p>
                <a class="link-btn" href="${transport.mapsUrl}" target="_blank"><i class="bi bi-geo-alt"></i>Google Map</a>
            </article>
        `).join("");
        html += '</div>';
    }

    if (dinings.length > 0) {
        html += '<div class="related-section"><h4 class="related-section-title"><i class="bi bi-cup-hot me-1"></i>餐飲</h4>';
        html += dinings.map((dining) => `
            <article class="list-card is-related mb-2">
                <div class="card-actions mb-2">
                    <span class="transport-type">${dining.category}</span>
                    <span class="status-pill">${dining.reservationStatus}</span>
                </div>
                <h3 class="card-title mb-2">${dining.name}</h3>
                <div class="list-meta mb-2">
                    <div><strong>地點</strong> ${dining.area}</div>
                    <div><strong>備註</strong> ${dining.note}</div>
                </div>
                <a class="link-btn" href="${dining.mapsUrl}" target="_blank"><i class="bi bi-geo-alt"></i>Google Map</a>
            </article>
        `).join("");
        html += '</div>';
    }

    if (souvenirs.length > 0) {
        html += '<div class="related-section"><h4 class="related-section-title"><i class="bi bi-bag-heart me-1"></i>伴手禮</h4>';
        html += souvenirs.map((souvenir) => `
            <article class="list-card is-related mb-2">
                <div class="card-actions mb-2">
                    <span class="transport-type">${souvenir.category}</span>
                    <span class="status-pill">${souvenir.buyPlan}</span>
                </div>
                <h3 class="card-title mb-2">${souvenir.name}</h3>
                <div class="list-meta mb-2">
                    <div><strong>地點</strong> ${souvenir.area}</div>
                    <div><strong>備註</strong> ${souvenir.note}</div>
                </div>
                <a class="link-btn" href="${souvenir.mapsUrl}" target="_blank"><i class="bi bi-geo-alt"></i>Google Map</a>
            </article>
        `).join("");
        html += '</div>';
    }

    target.innerHTML = html;
}

function renderTransportPanel() {
    const filtersTarget = document.getElementById("transport-day-filters");
    filtersTarget.innerHTML = [`
        <button type="button" class="transport-day-btn ${state.transportDayFilter === "all" ? "active" : ""}" data-day-id="all">全部</button>
    `, ...state.tripData.timelineDays.map((day) => `
        <button type="button" class="transport-day-btn ${state.transportDayFilter === day.id ? "active" : ""}" data-day-id="${day.id}">${day.label}</button>
    `)].join("");

    const focusNote = document.getElementById("transport-focus-note");
    const selectedItem = getTimelineItemById(state.selectedTimelineId);
    const linkedIds = new Set((selectedItem?.transportIds || []).map((id) => id));
    focusNote.innerHTML = linkedIds.size > 0
        ? `<div class="focus-note"><strong>已從時程表連動：</strong>${selectedItem.title} 對應 ${linkedIds.size} 張交通卡，以下已高亮。</div>`
        : "";

    const transports = getFilteredTransports();
    const target = document.getElementById("transport-list");
    target.innerHTML = transports.map((transport) => {
        const classes = ["transport-card"];
        if (linkedIds.has(transport.id)) {
            classes.push("is-linked");
        }
        if (state.transportDayFilter !== "all" && transport.dayId === state.transportDayFilter) {
            classes.push("is-active-day");
        }

        return `
            <article class="${classes.join(" ")}">
                <div class="card-actions mb-3">
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
    document.getElementById("dining-list").innerHTML = state.tripData.dining.map((item) => renderListCard(item, {
        topLabel: item.category,
        secondaryLabel: item.reservationStatus,
        footerLabel: item.area,
        note: item.note
    })).join("");
}

function renderSouvenirPanel() {
    document.getElementById("souvenir-list").innerHTML = state.tripData.souvenirs.map((item) => renderListCard(item, {
        topLabel: item.category,
        secondaryLabel: item.buyPlan,
        footerLabel: item.area,
        note: item.note
    })).join("");
}

function renderListCard(item, options) {
    return `
        <article class="list-card">
            <div class="card-actions mb-3">
                <span class="transport-type">${options.topLabel}</span>
                <span class="status-pill">${options.secondaryLabel}</span>
            </div>
            <h3 class="card-title">${item.name}</h3>
            <div class="list-meta">
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
                    ${branch.children.map((item) => `
                        <label class="checklist-item">
                            <input type="checkbox" class="form-check-input checklist-child-input me-2" data-item-id="${item.id}" ${state.checklistState[item.id] ? "checked" : ""}>
                            <span>${item.title}</span>
                        </label>
                    `).join("")}
                </div>
            </section>
        `;
    }).join("");

    document.querySelectorAll(".checklist-parent-input[data-indeterminate='true']").forEach((checkbox) => {
        checkbox.indeterminate = true;
    });
}

function renderOthersPanel() {
    document.getElementById("others-markdown").innerHTML = marked.parse(state.othersMarkdown || "");
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
    // renderSidebar();
    renderTimelinePanel();
    renderTransportPanel();
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
    const element = document.getElementById("countdown-value");
    if (!element || Number.isNaN(countdownTarget.getTime())) {
        return;
    }

    const now = new Date();
    const diffMs = countdownTarget - now;

    if (diffMs <= 0) {
        element.textContent = "旅程已開始";
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
    element.textContent = `${days} 天 ${hours} 小時 ${minutes} 分 ${seconds} 秒`;
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

    branch.children.forEach((item) => {
        state.checklistState[item.id] = isChecked;
    });
    persistChecklistState();
}

function handleChecklistAction(action) {
    if (action === "check-all" || action === "uncheck-all") {
        const checked = action === "check-all";
        state.tripData.checklist.forEach((branch) => {
            branch.children.forEach((item) => {
                state.checklistState[item.id] = checked;
            });
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

function getChecklistBranchState(branch) {
    const checkedCount = branch.children.filter((item) => Boolean(state.checklistState[item.id])).length;
    return {
        checked: checkedCount === branch.children.length && checkedCount > 0,
        indeterminate: checkedCount > 0 && checkedCount < branch.children.length
    };
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
