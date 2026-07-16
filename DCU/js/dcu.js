/**
 * DCU 資料庫 - 從 /DCU/data/ 目錄讀取 JSON 並渲染角色卡與時間軸
 */

'use strict';

const DCU = (() => {

    const DATA_BASE = './data/';

    async function fetchJSON(file) {
        const resp = await fetch(DATA_BASE + file);
        if (!resp.ok) throw new Error(`無法載入 ${file} (HTTP ${resp.status})`);
        return resp.json();
    }

    function renderCharacterCard(c) {
        const avatarHtml = c.pending
            ? `<div class="char-avatar char-avatar-placeholder">?</div>`
            : `<img class="char-avatar" src="${c.avatar}" alt="${c.avatarAlt}">`;
        return `
            <div class="char-card${c.pending ? ' pending' : ''}">
                <div class="char-avatar-wrap">
                    ${avatarHtml}
                    <img class="char-actor-badge" src="${c.actorPhoto}" alt="${c.actorPhotoAlt}">
                </div>
                <h3>${c.name}</h3>
                <p class="char-actor">${c.actorName} <span class="char-role">${c.role}</span></p>
                <p class="char-first">${c.firstAppearanceHtml}</p>
            </div>`;
    }

    function renderTimelineItem(t) {
        const subtitle = t.subtitle ? ` <small>${t.subtitle}</small>` : '';
        const posterHtml = t.posterPending
            ? `<div class="timeline-poster timeline-poster-placeholder">?</div>`
            : `<img class="timeline-poster" src="${t.poster}" alt="${t.posterAlt}" loading="lazy">`;
        return `
            <li class="timeline-item ${t.phase}">
                ${posterHtml}
                <div class="timeline-body">
                    <span class="timeline-date">${t.date}</span>
                    <span class="timeline-type">${t.type}</span>
                    <span class="timeline-status status-${t.phase}">${t.statusLabel}</span>
                    <h3>${t.title}${subtitle}</h3>
                    <p>${t.descriptionHtml}</p>
                </div>
            </li>`;
    }

    function renderDevItem(d) {
        return `<li><strong>${d.name}</strong>（${d.type}）— ${d.statusHtml}</li>`;
    }

    function renderNewsCard(n) {
        return `
            <li class="news-card">
                <span class="news-date">${n.date}</span>
                <span class="news-tag">${n.tag}</span>
                <h3>${n.title}</h3>
                <p>${n.summaryHtml}</p>
                <p class="news-source">資料來源：<a href="${n.sourceUrl}" target="_blank" rel="noopener">${n.sourceName}</a></p>
            </li>`;
    }

    async function renderCharacters(containerId, file) {
        const el = document.getElementById(containerId);
        if (!el) return;
        try {
            const characters = await fetchJSON(file);
            el.innerHTML = characters.map(renderCharacterCard).join('');
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

    async function renderNews(containerId, file) {
        const el = document.getElementById(containerId);
        if (!el) return;
        try {
            const items = await fetchJSON(file);
            el.innerHTML = items.map(renderNewsCard).join('');
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

    return { renderCharacters, renderTimeline, renderDevList, renderNews, renderElseworlds };
})();
