(() => {
    const STORAGE_KEY = "avLibraryDB";

    const $ = (selector) => document.querySelector(selector);

    const normalizeCode = (raw) => {
        if (!raw) return null;
        const compact = raw.replace(/[\s-]+/g, "").toUpperCase();
        const match = compact.match(/^([A-Z]+)(\d+)$/);
        if (!match) return null;
        const [, letters, digits] = match;
        return {
            code: `${letters}-${digits}`,
            slug: `${letters}-${digits}`.toLowerCase()
        };
    };

    const buildUrl = (slug) => `https://jable.tv/s0/videos/${slug}/`;

    const getDb = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            return [];
        }
    };

    const setDb = (items) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    };

    const findMetaFromHtml = (html, fallbackTitle) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const titleTag = doc.querySelector("meta[property='og:title']");
        const imageTag = doc.querySelector("meta[property='og:image']");
        const title = titleTag?.content || doc.title || fallbackTitle;
        const cover = imageTag?.content || "";
        return { title: title?.trim() || fallbackTitle, cover };
    };

    const fetchMeta = async (url, fallbackTitle) => {
        try {
            const proxyUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error("Fetch failed");
            }
            const html = await response.text();
            return findMetaFromHtml(html, fallbackTitle);
        } catch (error) {
            return { title: fallbackTitle, cover: "" };
        }
    };

    const saveItem = (item) => {
        const db = getDb();
        const exists = db.find((entry) => entry.slug === item.slug && entry.status === item.status);
        if (exists) {
            return { saved: false, message: "此影片已存在清單中" };
        }
        const next = [{ ...item, id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}` }, ...db];
        setDb(next);
        return { saved: true, message: "已新增至清單" };
    };

    const renderList = (status) => {
        const container = $("#av-card-list");
        const empty = $("#av-empty-state");
        if (!container) return;
        const db = getDb();
        const filtered = db.filter((item) => item.status === status);
        container.innerHTML = "";
        if (filtered.length === 0) {
            if (empty) empty.classList.remove("d-none");
            return;
        }
        if (empty) empty.classList.add("d-none");
        filtered.forEach((item) => {
            const card = document.createElement("div");
            card.className = "av-card";
            const cover = item.cover || "https://via.placeholder.com/480x720?text=No+Cover";
            card.innerHTML = `
                <img src="${cover}" alt="${item.title}">
                <div class="av-card-body">
                    <div class="av-card-title">${item.title}</div>
                    <div class="av-card-code">${item.code}</div>
                    <div class="d-flex justify-content-between align-items-center mt-2">
                        <span class="badge rounded-pill badge-status">${status === "watched" ? "看過的影片" : "稍後觀看"}</span>
                        <a href="${item.url}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary">前往</a>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    };

    const initForm = () => {
        const form = $("#av-form");
        if (!form) return;
        const input = $("#av-code");
        const statusInputs = document.querySelectorAll("input[name='av-status']");
        const hint = $("#av-hint");
        const loading = $("#av-loading");

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (hint) hint.textContent = "";

            const raw = input?.value || "";
            const normalized = normalizeCode(raw);
            if (!normalized) {
                if (hint) hint.textContent = "請輸入有效序號，例如 SSNI-865";
                return;
            }
            const status = Array.from(statusInputs).find((item) => item.checked)?.value || "watched";
            const url = buildUrl(normalized.slug);

            if (loading) loading.classList.remove("d-none");
            const meta = await fetchMeta(url, normalized.code);
            if (loading) loading.classList.add("d-none");

            const result = saveItem({
                code: normalized.code,
                slug: normalized.slug,
                url,
                title: meta.title,
                cover: meta.cover,
                status,
                addedAt: new Date().toISOString()
            });

            if (hint) hint.textContent = result.message;
            if (result.saved && input) {
                input.value = "";
            }
        });
    };

    const initPage = () => {
        const listPage = document.body?.dataset?.avList;
        if (listPage) {
            renderList(listPage);
        } else {
            initForm();
        }
    };

    document.addEventListener("DOMContentLoaded", initPage);
})();
