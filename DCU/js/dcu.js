/**
 * DCU 資料庫 - 從 /DCU/data/ 目錄讀取 JSON 並渲染角色卡與時間軸
 */

'use strict';

const DCU = (() => {

    const DATA_BASE = './data/';
    const NEWS_PAGE_SIZE = 6;

    async function fetchJSON(file) {
        const resp = await fetch(DATA_BASE + file);
        if (!resp.ok) throw new Error(`無法載入 ${file} (HTTP ${resp.status})`);
        return resp.json();
    }

    function dateSortKey(dateStr) {
        const parts = String(dateStr).split('.');
        while (parts.length < 3) parts.push('00');
        return parts.map(p => p.padStart(2, '0')).join('.');
    }

    function renderCharacterCard(c, index) {
        const avatarHtml = c.pending
            ? `<div class="char-avatar char-avatar-placeholder">?</div>`
            : `<img class="char-avatar" src="${c.avatar}" alt="${c.avatarAlt}">`;
        const badgeHtml = (!c.actorPhoto && !c.actorPhotoPending) ? '' : c.actorPhotoPending
            ? `<div class="char-actor-badge badge-pending">?</div>`
            : `<img class="char-actor-badge" src="${c.actorPhoto}" alt="${c.actorPhotoAlt}">`;
        const nameZhHtml = c.nameZh ? `<p class="name-zh">${c.nameZh}</p>` : '';
        // 卡片只留頭像與名稱，演員/首次登場等細節收進點開的角色詳細頁（openCharacterModal）
        return `
            <div class="char-card${c.pending ? ' pending' : ''}" data-index="${index}" role="button" tabindex="0">
                <div class="char-avatar-wrap">
                    ${avatarHtml}
                    ${badgeHtml}
                </div>
                <h3>${c.name}</h3>
                ${nameZhHtml}
            </div>`;
    }

    function renderWorkFields(t) {
        const synopsisHtml = t.synopsisHtml
            ? `<p class="field-block"><span class="field-label">劇情簡介</span>${t.synopsisHtml}</p>` : '';
        const historyHtml = t.historyHtml
            ? `<p class="field-block"><span class="field-label">作品歷程</span>${t.historyHtml}</p>` : '';
        const noteHtml = t.noteHtml ? `<blockquote class="timeline-note">${t.noteHtml}</blockquote>` : '';
        return synopsisHtml + historyHtml + noteHtml;
    }

    function renderTimelineItem(t, index) {
        const subtitle = t.subtitle ? ` <small>${t.subtitle}</small>` : '';
        const titleZhHtml = t.titleZh ? `<p class="title-zh">${t.titleZh}</p>` : '';
        const posterHtml = t.posterPending
            ? `<div class="timeline-poster timeline-poster-placeholder">?</div>`
            : `<img class="timeline-poster" src="${t.poster}" alt="${t.posterAlt}" loading="lazy">`;
        return `
            <li class="timeline-item ${t.phase}${t.unconfirmed ? ' unconfirmed' : ''}" data-index="${index}" role="button" tabindex="0">
                ${posterHtml}
                <div class="timeline-body">
                    <span class="timeline-date">${t.date}</span>
                    <span class="timeline-type">${t.type}</span>
                    <span class="timeline-status status-${t.phase}">${t.statusLabel}</span>
                    <h3>${t.title}${subtitle}</h3>
                    ${titleZhHtml}
                    ${renderWorkFields(t)}
                </div>
            </li>`;
    }

    function renderDevItem(d) {
        return `<li><strong>${d.name}</strong>（${d.type}）— ${d.statusHtml}</li>`;
    }

    const GLOSSARY_CATEGORY_LABELS = {
        location: '地點',
        organization: '組織/機構',
        concept: '世界觀設定/概念'
    };

    function renderGlossaryItem(g) {
        const categoryLabel = GLOSSARY_CATEGORY_LABELS[g.category] || g.category;
        const categoryHtml = g.category
            ? `<span class="glossary-tag glossary-tag-${g.category}">${categoryLabel}</span>`
            : '';
        return `
            <li class="glossary-card">
                ${categoryHtml}
                <h3>${g.term}<span class="term-zh">${g.termZh}</span></h3>
                <p>${g.definitionHtml}</p>
            </li>`;
    }

    function renderNewsCard(n) {
        const tagClass = n.tag === 'Elseworlds' ? ' news-tag-elseworlds' : '';
        return `
            <li class="news-card">
                <span class="news-date">${n.date}</span>
                <span class="news-tag${tagClass}">${n.tag}</span>
                <h3>${n.title}</h3>
                <p>${n.summaryHtml}</p>
                <p class="news-source">資料來源：<a href="${n.sourceUrl}" target="_blank" rel="noopener">${n.sourceName}</a></p>
            </li>`;
    }

    function renderPaginationControls(page, totalPages) {
        if (totalPages <= 1) return '';
        let buttons = `<button class="page-btn" data-page="${page - 1}"${page === 1 ? ' disabled' : ''}>← 上一頁</button>`;
        for (let i = 1; i <= totalPages; i++) {
            buttons += `<button class="page-btn${i === page ? ' active' : ''}" data-page="${i}">${i}</button>`;
        }
        buttons += `<button class="page-btn" data-page="${page + 1}"${page === totalPages ? ' disabled' : ''}>下一頁 →</button>`;
        return buttons;
    }

    function openCharacterModal(c) {
        const overlay = document.getElementById('char-modal-overlay');
        const body = document.getElementById('char-modal-body');
        if (!overlay || !body) return;

        const badgeHtml = (!c.actorPhoto && !c.actorPhotoPending) ? '' : c.actorPhotoPending
            ? `<div class="char-modal-actor-photo badge-pending">?</div>`
            : `<img class="char-modal-actor-photo" src="${c.actorPhoto}" alt="${c.actorPhotoAlt}">`;

        // 角色同時跨足動畫與真人版本時，並排顯示兩張腳色劇照，並在右下角疊上演員（配音/真人）本人照片
        const mediaHtml = (c.avatarAnimated && c.avatarLive)
            ? `
            <div class="char-modal-media char-modal-media-dual">
                <div class="char-modal-dual-avatars">
                    <div class="char-modal-dual-item">
                        <img class="char-modal-avatar" src="${c.avatarAnimated}" alt="${c.avatarAnimatedAlt || c.name}">
                        <span class="char-modal-dual-label">動畫版</span>
                    </div>
                    <div class="char-modal-dual-item">
                        <img class="char-modal-avatar" src="${c.avatarLive}" alt="${c.avatarLiveAlt || c.name}">
                        <span class="char-modal-dual-label">真人版</span>
                    </div>
                    ${badgeHtml}
                </div>
            </div>`
            : `
            <div class="char-modal-media${c.pending ? ' pending' : ''}">
                ${c.pending
                    ? `<div class="char-modal-avatar char-avatar-placeholder">?</div>`
                    : `<img class="char-modal-avatar" src="${c.avatar}" alt="${c.avatarAlt}">`}
                ${badgeHtml}
            </div>`;

        const nameZhHtml = c.nameZh ? `<p class="name-zh">${c.nameZh}</p>` : '';
        const actorNameZhHtml = c.actorNameZh ? `<span class="actor-zh">（${c.actorNameZh}）</span>` : '';

        body.innerHTML = `
            ${mediaHtml}
            <h3>${c.name}</h3>
            ${nameZhHtml}
            <p class="char-actor">${c.actorName}${actorNameZhHtml} <span class="char-role">${c.role}</span></p>
            <p class="char-first">${c.firstAppearanceHtml}</p>`;

        overlay.hidden = false;
        refreshBodyScrollLock();
    }

    function closeCharacterModal() {
        const overlay = document.getElementById('char-modal-overlay');
        if (!overlay) return;
        overlay.hidden = true;
        refreshBodyScrollLock();
    }

    function openWorkModal(t) {
        const overlay = document.getElementById('work-modal-overlay');
        const body = document.getElementById('work-modal-body');
        if (!overlay || !body) return;

        const subtitle = t.subtitle ? ` <small>${t.subtitle}</small>` : '';
        const titleZhHtml = t.titleZh ? `<p class="title-zh">${t.titleZh}</p>` : '';
        const posterHtml = t.posterPending
            ? `<div class="work-modal-poster timeline-poster-placeholder">?</div>`
            : `<img class="work-modal-poster" src="${t.poster}" alt="${t.posterAlt}">`;

        body.innerHTML = `
            ${posterHtml}
            <span class="timeline-date">${t.date}</span>
            <span class="timeline-type">${t.type}</span>
            <span class="timeline-status status-${t.phase}">${t.statusLabel}</span>
            <h3>${t.title}${subtitle}</h3>
            ${titleZhHtml}
            ${renderWorkFields(t)}`;

        overlay.hidden = false;
        refreshBodyScrollLock();
    }

    function closeWorkModal() {
        const overlay = document.getElementById('work-modal-overlay');
        if (!overlay) return;
        overlay.hidden = true;
        refreshBodyScrollLock();
    }

    function refreshBodyScrollLock() {
        const anyOpen = ['char-modal-overlay', 'work-modal-overlay', 'image-lightbox-overlay']
            .some(id => {
                const el = document.getElementById(id);
                return el && !el.hidden;
            });
        document.body.classList.toggle('modal-open', anyOpen);
    }

    function openImageLightbox(src, alt) {
        const overlay = document.getElementById('image-lightbox-overlay');
        const img = document.getElementById('image-lightbox-img');
        if (!overlay || !img) return;
        img.src = src;
        img.alt = alt || '';
        overlay.hidden = false;
        refreshBodyScrollLock();
    }

    function closeImageLightbox() {
        const overlay = document.getElementById('image-lightbox-overlay');
        if (!overlay) return;
        overlay.hidden = true;
        refreshBodyScrollLock();
    }

    function attachTimelineModalHandlers(el, items) {
        el.addEventListener('click', (e) => {
            const item = e.target.closest('.timeline-item');
            if (!item) return;
            openWorkModal(items[Number(item.dataset.index)]);
        });
        el.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const item = e.target.closest('.timeline-item');
            if (!item) return;
            e.preventDefault();
            openWorkModal(items[Number(item.dataset.index)]);
        });
    }

    function initModals() {
        const charOverlay = document.getElementById('char-modal-overlay');
        if (charOverlay) {
            const closeBtn = charOverlay.querySelector('.char-modal-close');
            if (closeBtn) closeBtn.addEventListener('click', closeCharacterModal);
            charOverlay.addEventListener('click', (e) => {
                const badge = e.target.closest('.char-modal-actor-photo');
                if (badge && badge.tagName === 'IMG') {
                    openImageLightbox(badge.src, badge.alt);
                    return;
                }
                if (e.target === charOverlay) closeCharacterModal();
            });
        }

        const workOverlay = document.getElementById('work-modal-overlay');
        if (workOverlay) {
            const closeBtn = workOverlay.querySelector('.work-modal-close');
            if (closeBtn) closeBtn.addEventListener('click', closeWorkModal);
            workOverlay.addEventListener('click', (e) => {
                if (e.target === workOverlay) closeWorkModal();
            });
        }

        const lightboxOverlay = document.getElementById('image-lightbox-overlay');
        if (lightboxOverlay) {
            const closeBtn = lightboxOverlay.querySelector('.image-lightbox-close');
            if (closeBtn) closeBtn.addEventListener('click', closeImageLightbox);
            lightboxOverlay.addEventListener('click', (e) => {
                if (e.target === lightboxOverlay) closeImageLightbox();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            closeImageLightbox();
            closeCharacterModal();
            closeWorkModal();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initModals);
    } else {
        initModals();
    }

    async function renderCharacters(containerId, file) {
        const el = document.getElementById(containerId);
        if (!el) return;
        try {
            const characters = await fetchJSON(file);
            el.innerHTML = characters.map(renderCharacterCard).join('');
            el.addEventListener('click', (e) => {
                const badge = e.target.closest('.char-actor-badge');
                if (badge && badge.tagName === 'IMG') {
                    e.stopPropagation();
                    openImageLightbox(badge.src, badge.alt);
                    return;
                }
                const card = e.target.closest('.char-card');
                if (!card) return;
                openCharacterModal(characters[Number(card.dataset.index)]);
            });
            el.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const card = e.target.closest('.char-card');
                if (!card) return;
                e.preventDefault();
                openCharacterModal(characters[Number(card.dataset.index)]);
            });
        } catch (err) {
            console.error('[DCU] 角色資料載入失敗', err);
        }
    }

    async function renderTimeline(containerId, file) {
        const el = document.getElementById(containerId);
        if (!el) return;
        try {
            const items = await fetchJSON(file);
            el.innerHTML = items.map(renderTimelineItem).join('');
            attachTimelineModalHandlers(el, items);
        } catch (err) {
            console.error('[DCU] 時間軸資料載入失敗', err);
        }
    }

    async function renderDevList(containerId, file) {
        const el = document.getElementById(containerId);
        if (!el) return;
        try {
            const items = await fetchJSON(file);
            el.innerHTML = items.map(renderDevItem).join('');
        } catch (err) {
            console.error('[DCU] 開發中清單載入失敗', err);
        }
    }

    async function renderGlossary(containerId, file) {
        const el = document.getElementById(containerId);
        if (!el) return;
        try {
            const items = await fetchJSON(file);
            el.innerHTML = items.map(renderGlossaryItem).join('');
        } catch (err) {
            console.error('[DCU] 名詞解釋載入失敗', err);
        }
    }

    async function renderNews(containerId, file, paginationId) {
        const listEl = document.getElementById(containerId);
        const pagerEl = paginationId ? document.getElementById(paginationId) : null;
        if (!listEl) return;
        try {
            const items = await fetchJSON(file);
            items.sort((a, b) => dateSortKey(b.date).localeCompare(dateSortKey(a.date)));

            const totalPages = Math.max(1, Math.ceil(items.length / NEWS_PAGE_SIZE));
            let page = 1;

            function paint() {
                const start = (page - 1) * NEWS_PAGE_SIZE;
                listEl.innerHTML = items.slice(start, start + NEWS_PAGE_SIZE).map(renderNewsCard).join('');
                if (pagerEl) pagerEl.innerHTML = renderPaginationControls(page, totalPages);
            }

            if (pagerEl) {
                pagerEl.addEventListener('click', (e) => {
                    const btn = e.target.closest('[data-page]');
                    if (!btn || btn.disabled) return;
                    const target = Number(btn.dataset.page);
                    if (target < 1 || target > totalPages) return;
                    page = target;
                    paint();
                    const section = listEl.closest('section') || listEl;
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            }

            paint();
        } catch (err) {
            console.error('[DCU] 新聞資料載入失敗', err);
        }
    }

    async function renderElseworlds(file) {
        try {
            const data = await fetchJSON(file);

            const batmanEl = document.getElementById('batman-timeline');
            if (batmanEl && data.batman) {
                batmanEl.innerHTML = data.batman.timeline.map(renderTimelineItem).join('');
                attachTimelineModalHandlers(batmanEl, data.batman.timeline);
            }
            const batmanNoteEl = document.getElementById('batman-dev-note');
            if (batmanNoteEl && data.batman && data.batman.devNoteHtml) {
                batmanNoteEl.innerHTML = data.batman.devNoteHtml;
            }

            const jokerEl = document.getElementById('joker-timeline');
            if (jokerEl && data.joker) {
                jokerEl.innerHTML = data.joker.timeline.map(renderTimelineItem).join('');
                attachTimelineModalHandlers(jokerEl, data.joker.timeline);
            }
        } catch (err) {
            console.error('[DCU] Elseworlds 資料載入失敗', err);
        }
    }

    return { renderCharacters, renderTimeline, renderDevList, renderGlossary, renderNews, renderElseworlds };
})();
