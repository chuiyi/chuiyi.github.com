(() => {
    const STORAGE_KEY = "avLibraryDB";
    const VIEW_KEY = "avLibraryViewMode";
    const SORT_KEY = "avLibrarySortMode";

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

    const getViewMode = () => localStorage.getItem(VIEW_KEY) || "grid";
    const setViewMode = (mode) => localStorage.setItem(VIEW_KEY, mode);

    const getSortMode = () => localStorage.getItem(SORT_KEY) || "newest";
    const setSortMode = (mode) => localStorage.setItem(SORT_KEY, mode);

    const pickFirstText = (elements) => {
        for (const el of elements) {
            const text = el?.textContent?.trim();
            if (text && text.length > 1) return text;
        }
        return "";
    };

    const parseJsonLd = (doc) => {
        const scripts = Array.from(doc.querySelectorAll("script[type='application/ld+json']"));
        for (const script of scripts) {
            try {
                const parsed = JSON.parse(script.textContent || "");
                const items = Array.isArray(parsed) ? parsed : [parsed];
                for (const item of items) {
                    if (!item || typeof item !== "object") continue;
                    const name = item.name || item.headline;
                    const thumbnail = item.thumbnailUrl || item.image;
                    if (name || thumbnail) {
                        return { name, thumbnail };
                    }
                }
            } catch (error) {
                continue;
            }
        }
        return { name: "", thumbnail: "" };
    };

    const resolveUrl = (baseUrl, value) => {
        if (!value) return "";
        try {
            return new URL(value, baseUrl).toString();
        } catch (error) {
            return value;
        }
    };

    const findMetaFromHtml = (html, fallbackTitle, baseUrl) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const titleTag = doc.querySelector("meta[property='og:title']")
            || doc.querySelector("meta[name='twitter:title']")
            || doc.querySelector("meta[name='title']");
        const imageTag = doc.querySelector("meta[property='og:image']")
            || doc.querySelector("meta[name='twitter:image']")
            || doc.querySelector("link[rel='image_src']");
        const jsonLd = parseJsonLd(doc);
        const infoHeaderTitle = pickFirstText(
            doc.querySelectorAll(".info-header h1, .info-header h2, .info-header h3, .info-header .h1, .info-header .h2, .info-header .title")
        );
        const headingTitle = pickFirstText(doc.querySelectorAll("h1, h2, h3"));
        const title = titleTag?.content
            || jsonLd.name
            || infoHeaderTitle
            || headingTitle
            || doc.title
            || fallbackTitle;

        let cover = imageTag?.content || imageTag?.href || jsonLd.thumbnail || "";
        if (!cover) {
            const poster = doc.querySelector("video[poster]")?.getAttribute("poster");
            if (poster) cover = poster;
        }
        if (!cover) {
            const img = doc.querySelector("img[class*='cover'], img[src*='cover'], img[src*='poster'], img[src*='preview']");
            if (img?.getAttribute("src")) cover = img.getAttribute("src");
        }
        if (!cover) {
            const match = html.match(/poster\s*=\s*"([^"]+)"/i);
            if (match?.[1]) cover = match[1];
        }
        if (!cover) {
            const previewMatch = html.match(/https?:\/\/assets-cdn\.jable\.tv\/contents\/videos_screenshots\/\d+\/\d+\/preview\.jpg/);
            if (previewMatch?.[0]) cover = previewMatch[0];
        }
        const resolvedCover = resolveUrl(baseUrl, cover);
        return { title: title?.trim() || fallbackTitle, cover: resolvedCover };
    };

    const fetchMeta = async (url, fallbackTitle) => {
        try {
            const proxyUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error("Fetch failed");
            }
            const html = await response.text();
            return findMetaFromHtml(html, fallbackTitle, url);
        } catch (error) {
            return { title: fallbackTitle, cover: "" };
        }
    };

    const searchModules = {
        jable: {
            id: "jable",
            label: "Jable",
            buildUrl: (slug) => `https://jable.tv/s0/videos/${slug}/`,
            fetchMeta
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
        const sortMode = getSortMode();
        const sorted = [...filtered].sort((a, b) => {
            if (sortMode === "oldest") {
                return new Date(a.addedAt || 0) - new Date(b.addedAt || 0);
            }
            if (sortMode === "title") {
                return (a.title || a.code).localeCompare(b.title || b.code, "zh-Hant");
            }
            return new Date(b.addedAt || 0) - new Date(a.addedAt || 0);
        });
        container.innerHTML = "";
        if (sorted.length === 0) {
            if (empty) empty.classList.remove("d-none");
            return;
        }
        if (empty) empty.classList.add("d-none");
        const viewMode = getViewMode();
        container.classList.toggle("list-grid", viewMode === "list");
        container.classList.toggle("card-grid", viewMode !== "list");
        sorted.forEach((item) => {
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
                        <div class="d-flex gap-2">
                            <a href="${item.url}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary">前往</a>
                            <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${item.id}">刪除</button>
                        </div>
                    </div>
                    ${item.sourceName ? `<div class="av-card-source">來源：${item.sourceName}</div>` : ""}
                </div>
            `;
            container.appendChild(card);
        });
    };

    const renderPreview = (payload) => {
        const preview = $("#av-preview");
        const cover = $("#av-preview-cover");
        const title = $("#av-preview-title");
        const code = $("#av-preview-code");
        const source = $("#av-preview-source");
        const link = $("#av-preview-link");
        const status = $("#av-preview-status");

        if (!preview || !payload) return;
        preview.classList.remove("d-none");
        const coverUrl = payload.cover || "https://via.placeholder.com/480x720?text=No+Cover";
        if (cover) cover.src = coverUrl;
        if (title) title.textContent = payload.title || payload.code;
        if (code) code.textContent = payload.code;
        if (source) source.textContent = `來源：${payload.sourceName}`;
        if (link) {
            link.href = payload.url;
            link.textContent = payload.url;
        }
        if (status) {
            status.textContent = payload.status === "watched" ? "看過的影片" : "稍後觀看";
        }
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
            const source = searchModules.jable;
            const url = source.buildUrl(normalized.slug);

            if (loading) loading.classList.remove("d-none");
            const meta = await source.fetchMeta(url, normalized.code);
            if (loading) loading.classList.add("d-none");

            const payload = {
                code: normalized.code,
                slug: normalized.slug,
                url,
                title: meta.title,
                cover: meta.cover,
                status,
                sourceId: source.id,
                sourceName: source.label,
                addedAt: new Date().toISOString()
            };

            renderPreview(payload);

            const result = saveItem(payload);

            if (hint) hint.textContent = result.message;
            if (result.saved && input) {
                input.value = "";
            }
        });
    };

    const deleteItem = (id) => {
        const db = getDb();
        const next = db.filter((item) => item.id !== id);
        setDb(next);
    };

    const initListPage = (status) => {
        const sortSelect = $("#av-sort");
        const viewButtons = document.querySelectorAll("[data-av-view]");
        const container = $("#av-card-list");

        if (sortSelect) {
            sortSelect.value = getSortMode();
            sortSelect.addEventListener("change", () => {
                setSortMode(sortSelect.value);
                renderList(status);
            });
        }

        viewButtons.forEach((button) => {
            const mode = button.dataset.avView;
            if (mode === getViewMode()) {
                button.classList.add("active");
            }
            button.addEventListener("click", () => {
                setViewMode(mode);
                viewButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.avView === mode));
                renderList(status);
            });
        });

        if (container) {
            container.addEventListener("click", (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                const action = target.dataset.action;
                if (action === "delete") {
                    const id = target.dataset.id;
                    if (!id) return;
                    deleteItem(id);
                    renderList(status);
                }
            });
        }

        renderList(status);
    };

    const initPage = () => {
        const listPage = document.body?.dataset?.avList;
        if (listPage) {
            initListPage(listPage);
        } else {
            initForm();
        }
    };

    document.addEventListener("DOMContentLoaded", initPage);
})();
