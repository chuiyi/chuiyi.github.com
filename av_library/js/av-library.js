(() => {
    const STORAGE_KEY = "avLibraryDB";
    const VIEW_KEY = "avLibraryViewMode";
    const SORT_KEY = "avLibrarySortMode";
    const AUTO_SYNC_KEY = "avLibraryAutoSync";
    const PLACEHOLDER_COVER = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23e9ecef'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='20' fill='%236c757d'%3ENo Cover%3C/text%3E%3C/svg%3E";
    const GOOGLE_CLIENT_ID = "200098245584-ms1ekqgikfvorm7jh4akcmsc1a6ub3dp.apps.googleusercontent.com";
    const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
    const DRIVE_FILE_NAME = "av_library_db.json";

    let googleTokenClient = null;
    let googleAccessToken = "";
    let googleTokenExpiry = 0;
    let pendingSyncAction = null;
    let syncDirty = false;
    let syncTimer = null;

    const $ = (selector) => document.querySelector(selector);

    const setSyncStatus = (message) => {
        const status = $("#av-sync-status");
        if (status) status.textContent = message;
    };

    const isTokenValid = () => googleAccessToken && Date.now() < googleTokenExpiry - 60000;

    const ensureAuth = (action, options = {}) => {
        if (isTokenValid()) {
            action();
            return;
        }
        if (!googleTokenClient) {
            setSyncStatus("Google 驗證尚未就緒");
            return;
        }
        pendingSyncAction = action;
        const prompt = options.silent ? "" : "consent";
        googleTokenClient.requestAccessToken({ prompt });
    };

    const markDirty = () => {
        syncDirty = true;
        if (getAutoSync()) {
            if (syncTimer) window.clearTimeout(syncTimer);
            syncTimer = window.setTimeout(() => {
                if (!syncDirty) return;
                ensureAuth(() => runPush(true), { silent: true });
            }, 1500);
        }
    };

    const driveFetch = async (url, options = {}) => {
        const headers = {
            Authorization: `Bearer ${googleAccessToken}`,
            ...(options.headers || {})
        };
        return fetch(url, { ...options, headers });
    };

    const listDriveFiles = async () => {
        const query = "name='" + DRIVE_FILE_NAME + "' and 'appDataFolder' in parents and trashed=false";
        const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=${encodeURIComponent(query)}`;
        const response = await driveFetch(url);
        if (!response.ok) throw new Error("Drive list failed");
        const data = await response.json();
        return data.files || [];
    };

    const downloadDriveFile = async (fileId) => {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const response = await driveFetch(url);
        if (!response.ok) throw new Error("Drive download failed");
        return response.text();
    };

    const uploadDriveFile = async (fileId, content) => {
        const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
        const response = await driveFetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: content
        });
        if (!response.ok) throw new Error("Drive upload failed");
    };

    const createDriveFile = async (content) => {
        const boundary = `avlib_${Date.now()}`;
        const metadata = {
            name: DRIVE_FILE_NAME,
            parents: ["appDataFolder"]
        };
        const body = [
            `--${boundary}`,
            "Content-Type: application/json; charset=UTF-8",
            "",
            JSON.stringify(metadata),
            `--${boundary}`,
            "Content-Type: application/json",
            "",
            content,
            `--${boundary}--`
        ].join("\r\n");

        const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
        const response = await driveFetch(url, {
            method: "POST",
            headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
            body
        });
        if (!response.ok) throw new Error("Drive create failed");
    };

    const runPull = async () => {
        const files = await listDriveFiles();
        if (!files.length) {
            setSyncStatus("雲端尚無資料");
            return;
        }
        const content = await downloadDriveFile(files[0].id);
        const remote = JSON.parse(content || "[]");
        const merged = mergeDb(getDb(), Array.isArray(remote) ? remote : []);
        setDb(merged);
        const listPage = document.body?.dataset?.avList;
        if (listPage) renderList(listPage);
        setSyncStatus("同步完成");
    };

    const runPush = async (silent = false) => {
        const content = JSON.stringify(getDb());
        const files = await listDriveFiles();
        if (files.length) {
            await uploadDriveFile(files[0].id, content);
        } else {
            await createDriveFile(content);
        }
        syncDirty = false;
        setSyncStatus(silent ? "自動同步完成" : "已上傳雲端");
    };

    const mergeDb = (local, remote) => {
        const map = new Map();
        const upsert = (item) => {
            if (!item) return;
            const key = `${item.slug || ""}|${item.status || ""}`;
            const existing = map.get(key);
            if (!existing) {
                map.set(key, item);
                return;
            }
            const a = new Date(existing.addedAt || 0).getTime();
            const b = new Date(item.addedAt || 0).getTime();
            map.set(key, b >= a ? item : existing);
        };
        local.forEach(upsert);
        remote.forEach(upsert);
        return Array.from(map.values());
    };

    const parseInput = (raw) => {
        if (!raw) return null;
        const trimmed = raw.trim();
        const domainMatch = trimmed.match(/jable\.(tv|tw)/i);
        if (domainMatch) {
            const safeUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
            try {
                const url = new URL(safeUrl);
                const slugMatch = url.pathname.match(/\/(?:s0\/)?videos\/([^/]+)/i);
                if (!slugMatch) return null;
                const slug = slugMatch[1].toLowerCase();
                return {
                    code: slug.toUpperCase(),
                    slug,
                    domain: url.hostname
                };
            } catch (error) {
                return null;
            }
        }
        const compact = trimmed.replace(/[\s-]+/g, "").toUpperCase();
        const match = compact.match(/^([A-Z]+)(\d+)$/);
        if (!match) return null;
        const [, letters, digits] = match;
        return {
            code: `${letters}-${digits}`,
            slug: `${letters}-${digits}`.toLowerCase(),
            domain: "jable.tv"
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

    const getAutoSync = () => localStorage.getItem(AUTO_SYNC_KEY) === "true";
    const setAutoSync = (value) => localStorage.setItem(AUTO_SYNC_KEY, value ? "true" : "false");

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

    const findMetaFromMarkdown = (text, fallbackTitle) => {
        const titleLine = text.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
        const headingLine = text.match(/^####\s+(.+)$/m)?.[1]?.trim();
        const title = titleLine || headingLine || fallbackTitle;

        const cover = text.match(/https?:\/\/assets-cdn\.jable\.tv\/contents\/videos_screenshots\/\d+\/\d+\/preview\.jpg/i)?.[0] || "";
        return { title, cover };
    };

    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const parseCoverFromSearch = (text, slug, domain) => {
        const safeSlug = escapeRegExp(slug);
        const safeHost = escapeRegExp((domain || "jable.tv").replace(/^www\./, ""));
        const pattern = new RegExp(
            `\\[!\\[[^\\]]*\\]\\((https?://assets-cdn\\.jable\\.tv/contents/videos_screenshots/\\d+/\\d+/320x180/1\\.jpg)\\)[^\\]]*\\]\\(https?://(?:www\\.)?${safeHost}/videos/${safeSlug}/\\)`,
            "i"
        );
        const match = text.match(pattern)?.[1]
            || text.match(/https?:\/\/assets-cdn\.jable\.tv\/contents\/videos_screenshots\/\d+\/\d+\/320x180\/1\.jpg/i)?.[0]
            || "";
        if (!match) return "";
        return match.replace("/320x180/1.jpg", "/preview.jpg");
    };

    const fetchFromJina = async (targetUrl) => {
        const proxyUrl = `https://r.jina.ai/http://${targetUrl.replace(/^https?:\/\//, "")}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error("Fetch failed");
        }
        return response.text();
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

    const fetchMeta = async (url, fallbackTitle, slug, domain) => {
        try {
            const html = await fetchFromJina(url);
            if (html.includes("Markdown Content:")) {
                const meta = findMetaFromMarkdown(html, fallbackTitle);
                if (!meta.cover && slug) {
                    try {
                        const searchHost = (domain || "jable.tv").replace(/^www\./, "");
                        const searchHtml = await fetchFromJina(`https://${searchHost}/search/${slug}/`);
                        const cover = parseCoverFromSearch(searchHtml, slug, searchHost);
                        return { ...meta, cover };
                    } catch (error) {
                        return meta;
                    }
                }
                return meta;
            }
            return findMetaFromHtml(html, fallbackTitle, url);
        } catch (error) {
            return { title: fallbackTitle, cover: "" };
        }
    };

    const searchModules = {
        jable: {
            id: "jable",
            label: "Jable",
            buildUrl: (slug, domain = "jable.tv") => `https://${domain}/s0/videos/${slug}/`,
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
            const cover = item.cover || PLACEHOLDER_COVER;
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
        const saveButton = $("#av-preview-save");
        const cancelButton = $("#av-preview-cancel");

        if (!preview || !payload) return;
        preview.classList.remove("d-none");
        const coverUrl = payload.cover || PLACEHOLDER_COVER;
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
        if (saveButton) saveButton.disabled = !payload.cover;
        if (cancelButton) cancelButton.disabled = false;
    };

    const clearPreview = () => {
        const preview = $("#av-preview");
        if (preview) preview.classList.add("d-none");
    };

    const initForm = () => {
        const form = $("#av-form");
        if (!form) return;
        const input = $("#av-code");
        const statusInputs = document.querySelectorAll("input[name='av-status']");
        const hint = $("#av-hint");
        const loading = $("#av-loading");
        const saveButton = $("#av-preview-save");
        const cancelButton = $("#av-preview-cancel");
        let pendingPayload = null;

        if (saveButton) {
            saveButton.addEventListener("click", () => {
                if (!pendingPayload) return;
                if (!pendingPayload.cover) {
                    if (hint) hint.textContent = "未取得封面，無法儲存";
                    return;
                }
                const result = saveItem(pendingPayload);
                if (hint) hint.textContent = result.message;
                if (result.saved && input) {
                    input.value = "";
                }
                if (result.saved) markDirty();
                pendingPayload = null;
                clearPreview();
            });
        }

        if (cancelButton) {
            cancelButton.addEventListener("click", () => {
                pendingPayload = null;
                clearPreview();
            });
        }

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (hint) hint.textContent = "";

            const raw = input?.value || "";
            const normalized = parseInput(raw);
            if (!normalized) {
                if (hint) hint.textContent = "請輸入有效序號，例如 SSNI-865";
                return;
            }
            const status = Array.from(statusInputs).find((item) => item.checked)?.value || "watched";
            const source = searchModules.jable;
            const url = source.buildUrl(normalized.slug, normalized.domain);

            if (loading) loading.classList.remove("d-none");
            const meta = await source.fetchMeta(url, normalized.code, normalized.slug, normalized.domain);
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
            pendingPayload = payload;
            if (hint) {
                hint.textContent = payload.cover ? "已取得影片資訊，請確認後儲存" : "未取得封面，請更換序號";
            }
        });
    };

    const initGoogleSync = () => {
        const loginButton = $("#av-sync-login");
        const logoutButton = $("#av-sync-logout");
        const pullButton = $("#av-sync-pull");
        const pushButton = $("#av-sync-push");
        const autoToggle = $("#av-sync-auto");
        if (!loginButton || !logoutButton || !pullButton || !pushButton || !autoToggle) return;

        const waitForGis = () => {
            if (window.google?.accounts?.oauth2) {
                googleTokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: DRIVE_SCOPE,
                    callback: (tokenResponse) => {
                        if (tokenResponse?.error) {
                            setSyncStatus("需要重新登入 Google");
                            return;
                        }
                        googleAccessToken = tokenResponse.access_token;
                        const expiresIn = tokenResponse.expires_in ? tokenResponse.expires_in * 1000 : 3600 * 1000;
                        googleTokenExpiry = Date.now() + expiresIn;
                        setSyncStatus("已登入 Google Drive");
                        if (pendingSyncAction) {
                            const action = pendingSyncAction;
                            pendingSyncAction = null;
                            action();
                        }
                    }
                });
                return;
            }
            setTimeout(waitForGis, 300);
        };

        setSyncStatus("載入 Google 驗證中...");
        waitForGis();

        autoToggle.checked = getAutoSync();

        loginButton.addEventListener("click", () => {
            ensureAuth(() => setSyncStatus("已登入 Google Drive"));
        });

        logoutButton.addEventListener("click", () => {
            if (googleAccessToken && window.google?.accounts?.oauth2) {
                window.google.accounts.oauth2.revoke(googleAccessToken, () => {
                    googleAccessToken = "";
                    googleTokenExpiry = 0;
                    setSyncStatus("已登出 Google Drive");
                });
            } else {
                googleAccessToken = "";
                googleTokenExpiry = 0;
                setSyncStatus("已登出 Google Drive");
            }
        });

        pullButton.addEventListener("click", () => {
            ensureAuth(async () => {
                setSyncStatus("同步下載中...");
                try {
                    await runPull();
                } catch (error) {
                    setSyncStatus("同步失敗");
                }
            });
        });

        pushButton.addEventListener("click", () => {
            ensureAuth(async () => {
                setSyncStatus("同步上傳中...");
                try {
                    await runPush();
                } catch (error) {
                    setSyncStatus("同步失敗");
                }
            });
        });

        autoToggle.addEventListener("change", () => {
            setAutoSync(autoToggle.checked);
            if (autoToggle.checked) {
                ensureAuth(async () => {
                    setSyncStatus("自動同步啟用，進行首次同步...");
                    try {
                        await runPull();
                        if (syncDirty) await runPush(true);
                    } catch (error) {
                        setSyncStatus("同步失敗");
                    }
                }, { silent: true });
            } else {
                setSyncStatus("已關閉自動同步");
            }
        });

        if (getAutoSync()) {
            ensureAuth(async () => {
                setSyncStatus("自動同步啟用，進行首次同步...");
                try {
                    await runPull();
                } catch (error) {
                    setSyncStatus("同步失敗");
                }
            }, { silent: true });
        }
    };

    const deleteItem = (id) => {
        const db = getDb();
        const next = db.filter((item) => item.id !== id);
        setDb(next);
        markDirty();
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
        initGoogleSync();
    };

    document.addEventListener("DOMContentLoaded", initPage);
})();
