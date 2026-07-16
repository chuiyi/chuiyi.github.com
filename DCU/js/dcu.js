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
        const badgeHtml = !c.dual ? '' : c.actorPhotoPending
            ? `<div class="char-actor-badge badge-pending">?</div>`
            : `<img class="char-actor-badge" src="${c.actorPhoto}" alt="${c.actorPhotoAlt}">`;
        const nameZhHtml = c.nameZh ? `<p class="name-zh">${c.nameZh}</p>` : '';
        const actorNameZhHtml = c.actorNameZh ? `<span class="actor-zh">（${c.actorNameZh}）</span>` : '';
        return `
            <div class="char-card${c.pending ? ' pending' : ''}" data-index="${index}" role="button" tabindex="0">
                <div class="char-avatar-wrap">
                    ${avatarHtml}
                    ${badgeHtml}
                </div>
                <h3>${c.name}</h3>
                ${nameZhHtml}
                <p class="char-actor">${c.actorName}${actorNameZhHtml} <span class="char-role">${c.role}</span></p>
                <p class="char-first">${c.firstAppearanceHtml}</p>
            </div>`;
    }

    function renderTimelineItem(t) {
        const subtitle = t.subtitle ? ` <small>${t.subtitle}</small>` : '';
        const titleZhHtml = t.titleZh ? `<p class="title-zh">${t.titleZh}</p>` : '';
        const posterHtml = t.posterPending
            ? `<div class="timeline-poster timeline-poster-placeholder">?</div>`
            : `<img class="timeline-poster" src="${t.poster}" alt="${t.posterAlt}" loading="lazy">`;
        return `
            <li class="timeline-item ${t.phase}${t.unconfirmed ? ' unconfirmed' : ''}">
                ${posterHtml}
                <div class="timeline-body">
                    <span class="timeline-date">${t.date}</span>
                    <span class="timeline-type">${t.type}</span>
                    <span class="timeline-status status-${t.phase}">${t.statusLabel}</span>
                    <h3>${t.title}${subtitle}</h3>
                    ${titleZhHtml}
                    <p>${t.descriptionHtml}</p>
                </div>
            </li>`;
    }

    function renderDevItem(d) {
        return `<li><strong>${d.name}</strong>（${d.type}）— ${d.statusHtml}</li>`;
    }

    function renderGlossaryItem(g) {
        return `
            <li class="glossary-card">
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

        const avatarHtml = c.pending
            ? `<div class="char-modal-avatar char-avatar-placeholder">?</div>`
            : `<img class="char-modal-avatar" src="${c.avatar}" alt="${c.avatarAlt}">`;
        const badgeHtml = !c.dual ? '' : c.actorPhotoPending
            ? `<div class="char-modal-actor-photo badge-pending">?</div>`
            : `<img class="char-modal-actor-photo" src="${c.actorPhoto}" alt="${c.actorPhotoAlt}">`;

        const nameZhHtml = c.nameZh ? `<p class="name-zh">${c.nameZh}</p>` : '';
        const actorNameZhHtml = c.actorNameZh ? `<span class="actor-zh">（${c.actorNameZh}）</span>` : '';

        body.innerHTML = `
            <div class="char-modal-media">
                ${avatarHtml}
                ${badgeHtml}
            </div>
            <h3>${c.name}</h3>
            ${nameZhHtml}
            <p class="char-actor">${c.actorName}${actorNameZhHtml} <span class="char-role">${c.role}</span></p>
            <p class="char-first">${c.firstAppearanceHtml}</p>`;

        overlay.hidden = false;
        document.body.classList.add('modal-open');
    }

    function closeCharacterModal() {
        const overlay = document.getElementById('char-modal-overlay');
        if (!overlay) return;
        overlay.hidden = true;
        document.body.classList.remove('modal-open');
    }

    function initCharacterModal() {
        const overlay = document.getElementById('char-modal-overlay');
        if (!overlay) return;
        const closeBtn = overlay.querySelector('.char-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', closeCharacterModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeCharacterModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeCharacterModal();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCharacterModal);
    } else {
        initCharacterModal();
    }

    async function renderCharacters(containerId, file) {
        const el = document.getElementById(containerId);
        if (!el) return;
        try {
            const characters = await fetchJSON(file);
            el.innerHTML = characters.map(renderCharacterCard).join('');
            el.addEventListener('click', (e) => {
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
                    listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            }
            const batmanNoteEl = document.getElementById('batman-dev-note');
            if (batmanNoteEl && data.batman && data.batman.devNoteHtml) {
                batmanNoteEl.innerHTML = data.batman.devNoteHtml;
            }

            const jokerEl = document.getElementById('joker-timeline');
            if (jokerEl && data.joker) {
                jokerEl.innerHTML = data.joker.timeline.map(renderTimelineItem).join('');
            }
        } catch (err) {
            console.error('[DCU] Elseworlds 資料載入失敗', err);
        }
    }

    return { renderCharacters, renderTimeline, renderDevList, renderGlossary, renderNews, renderElseworlds };
})();
