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
    let googleAccessToken = sessionStorage.getItem("avGoogleAccessToken") || "";
    let googleTokenExpiry = Number(sessionStorage.getItem("avGoogleTokenExpiry") || 0);
    let pendingSyncAction = null;
    let syncDirty = false;
    let syncTimer = null;
    let playerModal = null;

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
        const prompt = options.silent ? "none" : "consent";
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
        
        // Try to extract stream URL using improved strategy
        const stream = extractStreamUrl(text);
        
        return { title, cover, stream };
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

    const extractStreamUrlFromSearch = (text) => {
        // 從搜尋結果中尋找流 URL
        // 通常在 JavaScript 配置或 API 響應中
        
        // 策略 1: 尋找 hlsUrl JavaScript 變數
        const hlsMatch = text.match(/var\s+hlsUrl\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i);
        if (hlsMatch && hlsMatch[1]) {
            console.log(`[Search] 策略 1 (hlsUrl): ${hlsMatch[1]}`);
            return hlsMatch[1];
        }

        // 策略 2: 尋找 m3u8 URL
        const m3u8Match = text.match(/https?:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*/i);
        if (m3u8Match) {
            console.log(`[Search] 策略 2 (m3u8): ${m3u8Match[0]}`);
            return m3u8Match[0].replace(/[;'"]$/, '');
        }

        // 策略 3: 尋找 mp4 URL
        const mp4Match = text.match(/https?:\/\/[^\s"'<>]*\.mp4[^\s"'<>]*/i);
        if (mp4Match) {
            console.log(`[Search] 策略 3 (mp4): ${mp4Match[0]}`);
            return mp4Match[0].replace(/[;'"]$/, '');
        }

        // 策略 4: 尋找 VOD/TS 文件並推斷 m3u8
        const tsMatch = text.match(/https?:\/\/[^\s"'<>]*\/(vod\/\d+\/\d+\/)\d+\.ts[^\s"'<>]*/i);
        if (tsMatch) {
            const baseUrl = tsMatch[0].split('/').slice(0, -1).join('/');
            const m3u8Url = baseUrl + '/playlist.m3u8';
            console.log(`[Search] 策略 4 (TS推斷): ${m3u8Url}`);
            return m3u8Url;
        }

        // 策略 5: 尋找 assets-cdn URL
        const cdnMatch = text.match(/https?:\/\/assets-cdn\.jable\.tv\/[^\s"'<>]*\.(?:m3u8|mp4|mpd)[^\s"'<>]*/i);
        if (cdnMatch) {
            console.log(`[Search] 策略 5 (CDN): ${cdnMatch[0]}`);
            return cdnMatch[0].replace(/[;'"]$/, '');
        }

        // 策略 6: 尋找任何可能的流 URL
        const streamMatch = text.match(/https?:\/\/[^\s"'<>]*\/(?:vod|stream|video|hls)[^\s"'<>]*\.(?:m3u8|mp4|mpd)[^\s"'<>]*/i);
        if (streamMatch) {
            console.log(`[Search] 策略 6 (流): ${streamMatch[0]}`);
            return streamMatch[0].replace(/[;'"]$/, '');
        }

        console.log(`[Search] 未找到流 URL`);
        return "";
    };

    const fetchFromJina = async (targetUrl) => {
        // 嘗試直接獲取 HTML 格式（添加 Accept 頭）
        let proxyUrl = `https://r.jina.ai/${targetUrl}`;
        console.log(`[Jina] Fetching ${targetUrl}`);
        
        try {
            const response = await fetch(proxyUrl, {
                headers: {
                    'Accept': 'text/html',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            let text = await response.text();
            console.log(`[Jina] Fetched ${targetUrl}, content length: ${text.length}`);
            
            // 如果返回 Markdown，嘗試添加查詢參數
            if (text.includes('Markdown Content:')) {
                console.log(`[Jina] 返回 Markdown，嘗試 HTML 版本`);
                proxyUrl = `https://r.jina.ai/${targetUrl}?Accept=text/html`;
                const response2 = await fetch(proxyUrl, {
                    headers: {
                        'Accept': 'text/html'
                    }
                });
                if (response2.ok) {
                    text = await response2.text();
                    console.log(`[Jina] HTML 版本長度: ${text.length}`);
                }
            }
            
            return text;
        } catch (error) {
            console.log(`[Jina] 失敗: ${error.message}`);
            throw error;
        }
    };

    // Extract stream URL with multiple strategies
    // Extract stream URL with multiple strategies
    const extractStreamUrl = (html) => {
        if (!html) return "";
        
        // Strategy 1: Look for hlsUrl JavaScript variable (most direct)
        const hlsMatch = html.match(/var\s+hlsUrl\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i);
        if (hlsMatch && hlsMatch[1]) {
            console.log(`[extractStreamUrl] Strategy 1 (hlsUrl): ${hlsMatch[1]}`);
            return hlsMatch[1];
        }

        // Strategy 1b: Alternative hlsUrl patterns
        const hlsMatch2 = html.match(/hlsUrl\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i);
        if (hlsMatch2 && hlsMatch2[1]) {
            console.log(`[extractStreamUrl] Strategy 1b (hlsUrl alt): ${hlsMatch2[1]}`);
            return hlsMatch2[1];
        }
        
        // Strategy 2: Direct m3u8 URL in HTML
        const m3u8Match = html.match(/https?:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*/i)?.[0];
        if (m3u8Match) {
            console.log(`[extractStreamUrl] Strategy 2 (直接 m3u8): ${m3u8Match}`);
            return m3u8Match.replace(/[;'"]$/, '');
        }
        
        // Strategy 3: m3u8 inside JavaScript variables/config
        const jsM3u8Match = html.match(/["']?(https?:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*)["']?/i)?.[1];
        if (jsM3u8Match) {
            console.log(`[extractStreamUrl] Strategy 3 (JS 變數): ${jsM3u8Match}`);
            return jsM3u8Match;
        }
        
        // Strategy 4: src or data-src attributes
        const srcMatch = html.match(/(?:src|data-src)\s*=\s*["'](https?:\/\/[^\s"'<>]*\.(?:m3u8|mp4))/i)?.[1];
        if (srcMatch) {
            console.log(`[extractStreamUrl] Strategy 4 (src/data-src): ${srcMatch}`);
            return srcMatch;
        }
        
        // Strategy 5: HLS or streaming URLs with common patterns
        const streamMatch = html.match(/https?:\/\/[^\s"'<>]*(?:hls|stream|video|play|vod)[^\s"'<>]*\.(?:mp4|m3u8|mpd)/i)?.[0];
        if (streamMatch) {
            console.log(`[extractStreamUrl] Strategy 5 (HLS/流): ${streamMatch}`);
            return streamMatch;
        }
        
        // Strategy 6: URL patterns with tokens (common in CDN URLs)
        const tokenMatch = html.match(/https?:\/\/[^\s"'<>]*\?[^\s"'<>]*(?:token|auth|key)[^\s"'<>]*\.m3u8/i)?.[0];
        if (tokenMatch) {
            console.log(`[extractStreamUrl] Strategy 6 (Token CDN): ${tokenMatch}`);
            return tokenMatch;
        }

        // Strategy 7: Look for .ts file pattern and extract base URL for m3u8
        const tsMatch = html.match(/https?:\/\/[^\s"'<>]*\/(vod\/\d+\/\d+\/)\d+\.ts[^\s"'<>]*/i);
        if (tsMatch) {
            const baseUrl = tsMatch[0].split('/').slice(0, -1).join('/');
            const m3u8Url = baseUrl + '/playlist.m3u8';
            console.log(`[extractStreamUrl] Strategy 7 (TS to M3U8): ${m3u8Url}`);
            return m3u8Url;
        }

        // Strategy 8: Look for patterns with vod in the path
        const vodMatch = html.match(/https?:\/\/[^\s"'<>]*\/vod\/[^\s"'<>]*\.m3u8[^\s"'<>]*/i)?.[0];
        if (vodMatch) {
            console.log(`[extractStreamUrl] Strategy 8 (VOD path): ${vodMatch}`);
            return vodMatch;
        }
        
        console.log(`[extractStreamUrl] 未找到流 URL`);
        return "";
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
        
        console.log(`[findMetaFromHtml] og:image tag:`, imageTag?.content);
        console.log(`[findMetaFromHtml] jsonLd.thumbnail:`, jsonLd.thumbnail);
        
        // If no cover from meta tags, try other methods
        if (!cover) {
            const poster = doc.querySelector("video[poster]")?.getAttribute("poster");
            if (poster) cover = poster;
            console.log(`[findMetaFromHtml] video poster:`, poster);
        }
        if (!cover) {
            const img = doc.querySelector("img[class*='cover'], img[src*='cover'], img[src*='poster'], img[src*='preview']");
            if (img?.getAttribute("src")) cover = img.getAttribute("src");
            console.log(`[findMetaFromHtml] img element:`, img?.getAttribute("src"));
        }
        if (!cover) {
            const match = html.match(/poster\s*=\s*"([^"]+)"/i);
            if (match?.[1]) cover = match[1];
            console.log(`[findMetaFromHtml] poster regex:`, match?.[1]);
        }
        if (!cover) {
            const previewMatch = html.match(/https?:\/\/assets-cdn\.jable\.tv\/contents\/videos_screenshots\/\d+\/\d+\/preview\.jpg/);
            if (previewMatch?.[0]) cover = previewMatch[0];
            console.log(`[findMetaFromHtml] preview regex:`, previewMatch?.[0]);
        }
        
        // Last resort: look for any image that looks reasonable
        if (!cover) {
            const anyImg = html.match(/https?:\/\/[^\s"'<>]*assets-cdn[^\s"'<>]*\.jpg/i)?.[0];
            if (anyImg) cover = anyImg;
            console.log(`[findMetaFromHtml] assets-cdn regex:`, anyImg);
        }
        
        const resolvedCover = resolveUrl(baseUrl, cover);
        console.log(`[findMetaFromHtml] Final cover:`, resolvedCover);
        
        // Try to extract stream URL using improved strategy
        const stream = extractStreamUrl(html);
        
        return { title: title?.trim() || fallbackTitle, cover: resolvedCover, stream };
    };

    const fetchMeta = async (url, fallbackTitle, slug, domain) => {
        try {
            // Use Jina as primary method (more reliable for fetching without CORS issues)
            let html = await fetchFromJina(url);
            
            // Check if it's Markdown format from Jina
            if (html.includes("Markdown Content:")) {
                const meta = findMetaFromMarkdown(html, fallbackTitle);
                if (!meta.cover && slug) {
                    try {
                        const searchHost = (domain || "jable.tv").replace(/^www\./, "");
                        const searchHtml = await fetchFromJina(`https://${searchHost}/search/${slug}/`);
                        const cover = parseCoverFromSearch(searchHtml, slug, searchHost);
                        const stream = extractStreamUrlFromSearch(searchHtml);
                        return { ...meta, cover, stream: stream || meta.stream };
                    } catch (error) {
                        return meta;
                    }
                }
                return meta;
            }
            
            // Parse HTML from Jina
            const meta = findMetaFromHtml(html, fallbackTitle, url);
            
            // If cover or stream not found, try search page fallback
            if ((!meta.cover || !meta.stream) && slug) {
                try {
                    const searchHost = (domain || "jable.tv").replace(/^www\./, "");
                    const searchHtml = await fetchFromJina(`https://${searchHost}/search/${slug}/`);
                    
                    if (!meta.cover) {
                        const cover = parseCoverFromSearch(searchHtml, slug, searchHost);
                        if (cover) {
                            meta.cover = cover;
                        }
                    }
                    
                    if (!meta.stream) {
                        const stream = extractStreamUrlFromSearch(searchHtml);
                        if (stream) {
                            meta.stream = stream;
                        }
                    }
                } catch (error) {
                    console.log(`[fetchMeta] 搜尋頁面備選方案失敗: ${error.message}`);
                }
            }
            
            return meta;
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
            const playBtnHtml = item.stream ? `<button type="button" class="btn btn-sm btn-outline-info" data-action="play" data-stream="${item.stream.replace(/"/g, '&quot;')}" data-title="${item.title.replace(/"/g, '&quot;')}">播放</button>` : "";
            card.innerHTML = `
                <div style="position: relative;">
                    <img src="${cover}" alt="${item.title}" style="cursor: pointer; width: 100%; aspect-ratio: 16/9; object-fit: cover;" data-action="open" data-url="${item.url}" ${item.stream ? `data-stream="${item.stream.replace(/"/g, '&quot;')}" data-title="${item.title.replace(/"/g, '&quot;')}"` : ""}>
                    <div class="av-card-overlay" data-action="open" data-url="${item.url}" ${item.stream ? `data-stream="${item.stream.replace(/"/g, '&quot;')}" data-title="${item.title.replace(/"/g, '&quot;')}"` : ""}>
                        <div class="av-play-btn"><i class="bi bi-play-fill"></i></div>
                    </div>
                </div>
                <div class="av-card-body">
                    <div class="av-card-title">${item.title}</div>
                    <div class="av-card-code">${item.code}</div>
                    <div class="d-flex justify-content-between align-items-center mt-2">
                        <span class="badge rounded-pill badge-status">${status === "watched" ? "看過的影片" : "稍後觀看"}</span>
                        <div class="d-flex gap-2">
                            <a href="${item.url}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary">前往</a>
                            ${playBtnHtml}
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
        const playButton = $("#av-preview-play");
        const streamDiv = $("#av-preview-stream");
        const streamLink = $("#av-preview-stream-link");

        if (!preview || !payload) return;
        preview.classList.remove("d-none");
        const coverUrl = payload.cover || PLACEHOLDER_COVER;
        if (cover) {
            cover.src = coverUrl;
            cover.style.cursor = "pointer";
            cover.onclick = () => {
                if (payload.stream) {
                    openPlayer(payload.title, payload.stream);
                } else if (payload.url) {
                    window.open(payload.url, "_blank");
                }
            };
        }
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
        
        // Show play button and stream URL if available
        if (playButton) {
            if (payload.stream) {
                playButton.style.display = "inline-block";
                playButton.onclick = () => openPlayer(payload.title, payload.stream);
            } else {
                playButton.style.display = "none";
            }
        }
        if (streamDiv && streamLink) {
            if (payload.stream) {
                streamDiv.classList.remove("d-none");
                streamLink.href = payload.stream;
                streamLink.textContent = payload.stream;
            } else {
                streamDiv.classList.add("d-none");
            }
        }
    };

    const openPlayer = (title, streamUrl) => {
        console.log(`[openPlayer] title: ${title}, streamUrl: ${streamUrl}`);
        if (!playerModal) {
            console.log(`[openPlayer] Initializing player modal`);
            playerModal = new bootstrap.Modal(document.getElementById("av-player-modal"));
        }
        const playerTitle = document.getElementById("av-player-title");
        const player = document.getElementById("av-player");
        if (playerTitle) playerTitle.textContent = title || "播放影片";
        if (player) {
            console.log(`[openPlayer] Setting player src to: ${streamUrl}`);
            player.src = streamUrl;
            player.load();
        }
        playerModal.show();
        console.log(`[openPlayer] Modal shown`);
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
                stream: meta.stream || "",
                status,
                sourceId: source.id,
                sourceName: source.label,
                addedAt: new Date().toISOString()
            };

            renderPreview(payload);
            pendingPayload = payload;
            if (payload.cover) {
                const result = saveItem(payload);
                if (result.saved) markDirty();
                if (hint) hint.textContent = result.saved ? "已自動儲存" : result.message;
            } else {
                if (hint) hint.textContent = "未取得封面，無法自動儲存";
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
                            pendingSyncAction = null;
                            return;
                        }
                        googleAccessToken = tokenResponse.access_token;
                        const expiresIn = tokenResponse.expires_in ? tokenResponse.expires_in * 1000 : 3600 * 1000;
                        googleTokenExpiry = Date.now() + expiresIn;
                        sessionStorage.setItem("avGoogleAccessToken", googleAccessToken);
                        sessionStorage.setItem("avGoogleTokenExpiry", String(googleTokenExpiry));
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
                    sessionStorage.removeItem("avGoogleAccessToken");
                    sessionStorage.removeItem("avGoogleTokenExpiry");
                    setSyncStatus("已登出 Google Drive");
                });
            } else {
                googleAccessToken = "";
                googleTokenExpiry = 0;
                sessionStorage.removeItem("avGoogleAccessToken");
                sessionStorage.removeItem("avGoogleTokenExpiry");
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
                let target = event.target;
                if (!(target instanceof HTMLElement)) return;
                
                // Find closest element with data-action attribute
                const actionElement = target.closest("[data-action]");
                if (!actionElement) {
                    console.log(`[Click event] No data-action found on click target or parents`);
                    return;
                }
                
                const action = actionElement.dataset.action;
                console.log(`[Click event] action: ${action}, target: ${target.tagName}`);
                
                if (action === "delete") {
                    const id = actionElement.dataset.id;
                    if (!id) return;
                    deleteItem(id);
                    renderList(status);
                } else if (action === "play") {
                    const stream = actionElement.dataset.stream;
                    const title = actionElement.dataset.title;
                    console.log(`[Action: play] stream: ${stream}, title: ${title}`);
                    if (stream) openPlayer(title, stream);
                } else if (action === "open") {
                    const stream = actionElement.dataset.stream;
                    const url = actionElement.dataset.url;
                    const title = actionElement.dataset.title;
                    console.log(`[Action: open] stream: ${stream}, url: ${url}, title: ${title}`);
                    if (stream) {
                        openPlayer(title, stream);
                    } else if (url) {
                        console.log(`[Action: open] No stream, opening URL in new tab`);
                        window.open(url, "_blank");
                    }
                }
            });
        }

        renderList(status);
    };

    const initPage = () => {
        // Initialize player modal if it exists
        const playerModalEl = document.getElementById("av-player-modal");
        if (playerModalEl) {
            playerModal = new bootstrap.Modal(playerModalEl);
        }
        
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
