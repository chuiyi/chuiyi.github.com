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
        let remote = JSON.parse(content || "[]");
        
        // 检查并迁移远程数据
        remote = migrateRemoteDataIfNeeded(remote);
        
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
            // 新数据结构：使用 slug 作为唯一键
            const key = item.slug || "";
            const existing = map.get(key);
            if (!existing) {
                map.set(key, item);
                return;
            }
            // 保留更新时间较新的版本
            const a = new Date(existing.addedAt || 0).getTime();
            const b = new Date(item.addedAt || 0).getTime();
            if (b >= a) {
                // 保持现有的 isFavorite 状态（如果新项没有明确设置的话）
                if (item.isFavorite === undefined) {
                    item.isFavorite = existing.isFavorite;
                }
                map.set(key, item);
            }
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

    // ============= 数据迁移相关函数 =============
    const needsMigration = () => {
        const db = getDb();
        const favorites = localStorage.getItem("avLibraryFavorites");
        
        // 如果存在旧的独立收藏列表，需要迁移
        if (favorites) return true;
        
        // 检查是否有 isFavorite 字段（新结构特征）
        const hasNewStructure = db.length > 0 && db.some((item) => item.isFavorite !== undefined);
        if (hasNewStructure) return false;  // 已经是新结构，无需迁移
        
        // 检查是否有重复的 slug（不同 status）- 旧结构特征
        if (db.length > 0) {
            const slugStatusMap = {};
            for (const item of db) {
                if (!slugStatusMap[item.slug]) {
                    slugStatusMap[item.slug] = new Set();
                }
                slugStatusMap[item.slug].add(item.status);
            }
            
            // 如果同一 slug 有多个不同的 status，说明是旧结构
            for (const statuses of Object.values(slugStatusMap)) {
                if (statuses.size > 1) return true;
            }
        }
        
        return false;
    };

    const migrateToNewStructure = () => {
        console.log("[Migration] 开始数据迁移...");
        const db = getDb();
        const favorites = JSON.parse(localStorage.getItem("avLibraryFavorites") || "[]");
        
        const migratedMap = {};
        const migrated = [];
        
        // 遍历旧数据，按 slug 合并
        for (const item of db) {
            if (migratedMap[item.slug]) {
                // 同 slug 的影片已处理，跳过
                continue;
            }
            
            // 找到该 slug 的所有条目
            const allEntriesWithSlug = db.filter((entry) => entry.slug === item.slug);
            
            // 优先级：watched > later
            let targetItem = allEntriesWithSlug.find((entry) => entry.status === "watched");
            if (!targetItem) {
                targetItem = allEntriesWithSlug.find((entry) => entry.status === "later");
            }
            if (!targetItem) {
                targetItem = allEntriesWithSlug[0];
            }
            
            // 更新 isFavorite 状态
            targetItem.isFavorite = favorites.includes(targetItem.id);
            
            migrated.push(targetItem);
            migratedMap[item.slug] = true;
        }
        
        // 保存迁移后的数据
        setDb(migrated);
        
        // 清理旧的收藏列表
        localStorage.removeItem("avLibraryFavorites");
        
        console.log(`[Migration] 成功迁移 ${migrated.length} 条数据到新结构`);
    };

    const migrateRemoteDataIfNeeded = (remoteData) => {
        // 检查远程数据是否是新结构
        const hasNewStructure = remoteData.length > 0 && remoteData.some((item) => item.isFavorite !== undefined);
        
        if (hasNewStructure) {
            // 已经是新结构，无需迁移
            return remoteData;
        }
        
        // 旧结构需要迁移
        if (remoteData.length === 0) {
            return remoteData;
        }
        
        console.log("[Migration] 远程数据是旧结构，正在迁移...");
        
        const migratedMap = {};
        const migrated = [];
        
        // 遍历旧数据，按 slug 合并
        for (const item of remoteData) {
            if (migratedMap[item.slug]) {
                // 同 slug 的影片已处理，跳过
                continue;
            }
            
            // 找到该 slug 的所有条目
            const allEntriesWithSlug = remoteData.filter((entry) => entry.slug === item.slug);
            
            // 优先级：watched > later
            let targetItem = allEntriesWithSlug.find((entry) => entry.status === "watched");
            if (!targetItem) {
                targetItem = allEntriesWithSlug.find((entry) => entry.status === "later");
            }
            if (!targetItem) {
                targetItem = allEntriesWithSlug[0];
            }
            
            // 设置默认的 isFavorite 状态
            if (targetItem.isFavorite === undefined) {
                targetItem.isFavorite = false;
            }
            
            migrated.push(targetItem);
            migratedMap[item.slug] = true;
        }
        
        console.log(`[Migration] 远程数据迁移完成，合并后 ${migrated.length} 条数据`);
        return migrated;
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

        // 策略 1: 尋找 preview.jpg (完整解析度)
        let cover = text.match(/https?:\/\/assets-cdn\.jable\.tv\/contents\/videos_screenshots\/\d+\/\d+\/preview\.jpg/i)?.[0];
        
        // 策略 2: 尋找任何 jable.tv 的圖片 URL (包括縮圖)
        if (!cover) {
            const thumbMatch = text.match(/https?:\/\/assets-cdn\.jable\.tv\/contents\/videos_screenshots\/(\d+)\/(\d+)\/320x180\/1\.jpg/i);
            if (thumbMatch) {
                // 轉換縮圖 URL 為完整 preview.jpg
                cover = `https://assets-cdn.jable.tv/contents/videos_screenshots/${thumbMatch[1]}/${thumbMatch[2]}/preview.jpg`;
            }
        }
        
        // 策略 3: 尋找任何 assets-cdn 的 jpg 圖片
        if (!cover) {
            cover = text.match(/https?:\/\/assets-cdn\.jable\.tv\/[^\s"'<>]*\.jpg/i)?.[0] || "";
        }
        
        // 策略 4: 尋找 Markdown 圖片語法中的 URL
        if (!cover) {
            const mdImgMatch = text.match(/!\[[^\]]*\]\((https?:\/\/[^)]+\.jpg)\)/i);
            if (mdImgMatch) {
                cover = mdImgMatch[1];
            }
        }
        
        console.log(`[findMetaFromMarkdown] title:`, title);
        console.log(`[findMetaFromMarkdown] cover:`, cover);
        
        const stream = extractStreamUrl(text);
        
        return { title, cover: cover || "", stream };
    };

    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const parseCoverFromSearch = (text, slug, domain) => {
        const safeSlug = escapeRegExp(slug);
        const safeHost = escapeRegExp((domain || "jable.tv").replace(/^www\./, ""));

        // 策略 1: Markdown 連結格式 [![...](img)](video_url)，同時支援 /videos/ 和 /s0/videos/
        const pattern = new RegExp(
            `\\[!\\[[^\\]]*\\]\\((https?://assets-cdn\\.jable\\.tv/contents/videos_screenshots/\\d+/\\d+/320x180/1\\.jpg)\\)[^\\]]*\\]\\(https?://(?:www\\.)?${safeHost}/(?:s0/)?videos/${safeSlug}/\\)`,
            "i"
        );
        const directMatch = text.match(pattern)?.[1];
        if (directMatch) {
            console.log(`[parseCoverFromSearch] 策略 1 命中: ${directMatch}`);
            return directMatch.replace("/320x180/1.jpg", "/preview.jpg");
        }

        // 策略 2: 在 slug 出現位置附近（前 600 字元）尋找圖片 URL，避免抓到無關的推薦影片
        const slugIndex = text.search(new RegExp(`/${safeSlug}/`, "i"));
        if (slugIndex > -1) {
            const nearby = text.substring(Math.max(0, slugIndex - 600), slugIndex + 200);
            const nearbyThumb = nearby.match(/https?:\/\/assets-cdn\.jable\.tv\/contents\/videos_screenshots\/(\d+)\/(\d+)\/320x180\/1\.jpg/i);
            if (nearbyThumb) {
                const nearbyPreview = `https://assets-cdn.jable.tv/contents/videos_screenshots/${nearbyThumb[1]}/${nearbyThumb[2]}/preview.jpg`;
                console.log(`[parseCoverFromSearch] 策略 2 (slug 附近) 命中: ${nearbyPreview}`);
                return nearbyPreview;
            }
            const nearbyPreviewDirect = nearby.match(/https?:\/\/assets-cdn\.jable\.tv\/contents\/videos_screenshots\/\d+\/\d+\/preview\.jpg/i);
            if (nearbyPreviewDirect) {
                console.log(`[parseCoverFromSearch] 策略 2 (slug 附近 preview) 命中: ${nearbyPreviewDirect[0]}`);
                return nearbyPreviewDirect[0];
            }
        }

        // 策略 3 (最後手段): 全頁第一個縮圖（可能不準確）
        const fallbackThumb = text.match(/https?:\/\/assets-cdn\.jable\.tv\/contents\/videos_screenshots\/\d+\/\d+\/320x180\/1\.jpg/i)?.[0];
        if (fallbackThumb) {
            console.log(`[parseCoverFromSearch] 策略 3 (全頁第一張，可能不準) 命中: ${fallbackThumb}`);
            return fallbackThumb.replace("/320x180/1.jpg", "/preview.jpg");
        }

        return "";
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
        const proxyUrl = `https://r.jina.ai/${targetUrl}`;
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
            const text = await response.text();
            console.log(`[Jina] Fetched ${targetUrl}, content length: ${text.length}`);
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
            // 嘗試各種圖片元素和 data attributes
            const img = doc.querySelector(
                "img[class*='cover'], img[src*='cover'], img[src*='poster'], img[src*='preview'], " +
                "img[data-src*='preview'], img[data-original], .video-img img, .thumb img"
            );
            if (img) {
                cover = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-original") || "";
            }
            console.log(`[findMetaFromHtml] img element:`, cover);
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
        if (!cover) {
            // 尋找縮圖並轉換為完整解析度
            const thumbMatch = html.match(/https?:\/\/assets-cdn\.jable\.tv\/contents\/videos_screenshots\/(\d+)\/(\d+)\/320x180\/1\.jpg/i);
            if (thumbMatch) {
                cover = `https://assets-cdn.jable.tv/contents/videos_screenshots/${thumbMatch[1]}/${thumbMatch[2]}/preview.jpg`;
                console.log(`[findMetaFromHtml] converted from thumbnail:`, cover);
            }
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
            // 僅發送一次請求獲取詳情頁
            const html = await fetchFromJina(url);
            
            // 檢查是否為 Markdown 格式
            if (html.includes("Markdown Content:")) {
                const meta = findMetaFromMarkdown(html, fallbackTitle);
                // Markdown 格式通常沒有正確的封面（只有推薦影片的縮圖）
                // 直接使用搜索頁獲取正確的封面
                if (slug) {
                    try {
                        const searchHost = (domain || "jable.tv").replace(/^www\./, "");
                        const searchHtml = await fetchFromJina(`https://${searchHost}/search/${slug}/`);
                        const cover = parseCoverFromSearch(searchHtml, slug, searchHost);
                        return { 
                            title: meta.title || fallbackTitle, 
                            cover: cover || meta.cover || "", 
                            stream: meta.stream || ""
                        };
                    } catch (error) {
                        console.log(`[fetchMeta] 搜尋頁面失敗: ${error.message}`);
                        return meta;
                    }
                }
                return meta;
            }
            
            // 解析 HTML 格式（優先使用詳情頁資訊）
            const meta = findMetaFromHtml(html, fallbackTitle, url);
            
            // 只有在封面完全沒有時才嘗試搜索頁（減少請求次數）
            if (!meta.cover && slug) {
                try {
                    const searchHost = (domain || "jable.tv").replace(/^www\./, "");
                    const searchHtml = await fetchFromJina(`https://${searchHost}/search/${slug}/`);
                    const cover = parseCoverFromSearch(searchHtml, slug, searchHost);
                    if (cover) {
                        meta.cover = cover;
                    }
                } catch (error) {
                    console.log(`[fetchMeta] 搜尋頁面備選方案失敗: ${error.message}`);
                }
            }
            
            return meta;
        } catch (error) {
            console.log(`[fetchMeta] 錯誤: ${error.message}`);
            return { title: fallbackTitle, cover: "", stream: "" };
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
        // 检查是否已存在相同 slug 的影片（无论 status）
        const exists = db.find((entry) => entry.slug === item.slug);
        
        if (exists) {
            // 影片已存在，只更新状态
            exists.status = item.status;
            exists.isFavorite = exists.isFavorite || false;  // 保持现有的喜爱状态
            setDb(db);
            return { saved: false, message: `已将"${exists.title}"更新为"${item.status === 'watched' ? '看過的影片' : '稍後觀看'}"` };
        }
        
        // 影片不存在，新增
        const newItem = {
            ...item,
            id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
            isFavorite: false
        };
        const next = [newItem, ...db];
        setDb(next);
        return { saved: true, message: "已新增至清單" };
    };

    const toggleFavorite = (id) => {
        const db = getDb();
        const item = db.find((entry) => entry.id === id);
        if (!item) return;
        
        item.isFavorite = !item.isFavorite;
        setDb(db);
        markDirty();
    };

    const isFavorite = (id) => {
        const db = getDb();
        const item = db.find((entry) => entry.id === id);
        return item?.isFavorite || false;
    };

    const moveItem = (id, newStatus) => {
        const db = getDb();
        const item = db.find((entry) => entry.id === id);
        if (!item || item.status === newStatus) return;
        
        item.status = newStatus;
        setDb(db);
        markDirty();
    };

    const renderList = (status) => {
        const container = $("#av-card-list");
        const empty = $("#av-empty-state");
        if (!container) return;
        const db = getDb();
        
        let filtered;
        if (status === "favorite") {
            // favorite 页面显示所有 isFavorite=true 的项目
            filtered = db.filter((item) => item.isFavorite === true);
        } else {
            // later/watched 页面按 status 过滤
            filtered = db.filter((item) => item.status === status);
        }
        
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
            const isFav = item.isFavorite === true;
            
            // Determine button labels based on current status
            let moveButtonLabel = "";
            let moveButtonAction = "";
            if (item.status === "later") {
                moveButtonLabel = "看過";
                moveButtonAction = "watched";
            } else if (item.status === "watched") {
                moveButtonLabel = "稍後觀看";
                moveButtonAction = "later";
            }
            
            card.innerHTML = `
                <div style="position: relative;">
                    <img src="${cover}" alt="${item.title}" style="cursor: pointer; width: 100%; aspect-ratio: 16/9; object-fit: cover;" data-action="open" data-url="${item.url}" data-item-id="${item.id}">
                    <button type="button" class="btn btn-sm fix-cover-btn ${brokenCoverCache.has(item.id) ? '' : 'd-none'}" data-action="fix-cover" data-id="${item.id}" style="position: absolute; top: 8px; right: 8px;" title="修復封面">
                        <i class="bi bi-wrench-adjustable"></i>
                    </button>
                    <div class="av-card-overlay" data-action="open" data-url="${item.url}">
                        <div class="av-play-btn"><i class="bi bi-play-fill"></i></div>
                    </div>
                </div>
                <div class="av-card-body">
                    <div class="av-card-title">${item.title}</div>
                    <div class="av-card-code">${item.code}</div>
                    <div class="d-flex justify-content-between align-items-center mt-2">
                        <span class="badge rounded-pill badge-status">${item.status === "watched" ? "看過的影片" : item.status === "later" ? "稍後觀看" : "喜愛的影片"}</span>
                        <div class="d-flex gap-2 align-items-center">
                            <button type="button" class="btn btn-sm btn-icon" data-action="favorite" data-id="${item.id}" title="${isFav ? '取消收藏' : '加入喜愛'}">
                                <i class="bi ${isFav ? 'bi-heart-fill' : 'bi-heart'}"></i>
                            </button>
                            ${status !== "favorite" ? `
                            <button type="button" class="btn btn-sm btn-icon" data-action="move" data-id="${item.id}" data-new-status="${moveButtonAction}" title="${moveButtonLabel}">
                                <i class="bi bi-arrow-left-right"></i>
                            </button>
                            ` : ""}
                            <a href="${item.url}" target="_blank" rel="noopener" class="btn btn-sm btn-icon" title="前往">
                                <i class="bi bi-link-45deg"></i>
                            </a>
                            <button type="button" class="btn btn-sm btn-icon" data-action="delete" data-id="${item.id}" title="刪除">
                                <i class="bi bi-trash3"></i>
                            </button>
                        </div>
                    </div>
                    ${item.sourceName ? `<div class="av-card-source">來源：${item.sourceName}</div>` : ""}
                </div>
            `;
            container.appendChild(card);
        });
        
        // 為新生成的img元素重新綁定onerror事件
        setTimeout(attachImageErrorHandlers, 50);
        
        // 為新生成的img元素重新綁定onerror事件
        setTimeout(attachImageErrorHandlers, 50);
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
                if (payload.url) {
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

    // 缓存失效的封面链接，避免重复修复
    const brokenCoverCache = new Set();
    // 限流计时器
    let fixCoverThrottle = false;

    const fixItemCover = async (item) => {
        if (!item || !item.url || !item.slug) {
            console.log(`[fixItemCover] 缺少必要參數`);
            return false;
        }
        
        try {
            const source = searchModules[item.sourceId] || searchModules.jable;
            const url = source.buildUrl(item.slug, item.domain);
            console.log(`[fixItemCover] 正在獲取 meta: ${url}`);
            const meta = await source.fetchMeta(url, item.code, item.slug, item.domain);
            
            console.log(`[fixItemCover] 獲取的封面: ${meta.cover}`);
            
            if (meta.cover) {
                // 測試圖片 URL 是否能載入
                console.log(`[fixItemCover] 測試圖片 URL: ${meta.cover}`);
                
                const testImg = new Image();
                
                const canLoad = await new Promise((resolve) => {
                    let resolved = false;
                    
                    testImg.onload = () => {
                        if (!resolved) {
                            resolved = true;
                            console.log(`[fixItemCover] 圖片載入成功，尺寸: ${testImg.width}x${testImg.height}`);
                            resolve(true);
                        }
                    };
                    testImg.onerror = (e) => {
                        if (!resolved) {
                            resolved = true;
                            console.log(`[fixItemCover] 圖片載入失敗:`, e);
                            resolve(false);
                        }
                    };
                    
                    testImg.src = meta.cover;
                    
                    // 10秒超時
                    setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            console.log(`[fixItemCover] 圖片載入超時（10秒）`);
                            resolve(false);
                        }
                    }, 10000);
                });
                
                if (canLoad) {
                    // 圖片能載入，直接保存新的 URL（不需要時間戳）
                    const db = getDb();
                    const dbItem = db.find((entry) => entry.id === item.id);
                    if (dbItem) {
                        console.log(`[fixItemCover] 更新封面為: ${meta.cover}`);
                        dbItem.cover = meta.cover;
                        setDb(db);
                        markDirty();
                        return true;
                    }
                } else {
                    console.log(`[fixItemCover] 圖片無法載入，不更新資料庫`);
                }
            } else {
                console.log(`[fixItemCover] 未獲取到封面 URL`);
            }
        } catch (error) {
            console.log(`[fixItemCover] 修復失敗: ${error.message}`);
        }
        return false;
    };

    const fixAllCoversBatch = async (status, onProgress) => {
        const db = getDb();
        let filtered;
        if (status === "favorite") {
            filtered = db.filter((item) => item.isFavorite === true);
        } else {
            filtered = db.filter((item) => item.status === status);
        }
        
        let fixed = 0;
        for (let i = 0; i < filtered.length; i++) {
            const item = filtered[i];
            if (brokenCoverCache.has(item.id)) {
                // 跳过已标记为失效的项
                continue;
            }
            
            const success = await fixItemCover(item, false);
            if (success) {
                fixed++;
                if (onProgress) {
                    onProgress(i + 1, filtered.length);
                }
            }
            
            // 限流：每个修复间隔500ms
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        return fixed;
    };

    // 為所有圖片綁定onerror事件處理
    // 為所有圖片綁定onerror事件處理
    const attachImageErrorHandlers = () => {
        let errorCount = 0;
        const images = document.querySelectorAll("img[data-item-id]");
        
        images.forEach((img) => {
            img.onerror = function() {
                const itemId = this.getAttribute("data-item-id");
                if (itemId) {
                    const fixButton = this.parentElement?.querySelector(".fix-cover-btn");
                    if (fixButton) {
                        fixButton.classList.remove("d-none");
                    }
                    // 標記為失效
                    brokenCoverCache.add(itemId);
                    errorCount++;
                }
            };
        });
        
        // 延遲檢查並顯示錯誤訊息（等待圖片載入完成）
        setTimeout(() => {
            updateErrorBanner();
        }, 1000);
    };
    
    // 更新錯誤提示標語
    const updateErrorBanner = () => {
        const banner = document.getElementById("av-error-banner");
        const message = document.getElementById("av-error-message");
        
        if (!banner || !message) return;
        
        const errorCount = brokenCoverCache.size;
        
        if (errorCount > 0) {
            message.textContent = `有 ${errorCount} 個圖片無法開啟，請點擊卡片上的修復按鈕進行修復。`;
            banner.classList.remove("d-none");
        } else {
            banner.classList.add("d-none");
        }
    };

    const initListPage = (status) => {
        const sortSelect = $("#av-sort");
        const viewButtons = document.querySelectorAll("[data-av-view]");
        const container = $("#av-card-list");
        
        // 初始綁定
        setTimeout(attachImageErrorHandlers, 100);

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
                } else if (action === "open") {
                    const url = actionElement.dataset.url;
                    if (url) {
                        window.open(url, "_blank");
                    }
                } else if (action === "favorite") {
                    const id = actionElement.dataset.id;
                    if (!id) return;
                    toggleFavorite(id);
                    renderList(status);
                } else if (action === "move") {
                    const id = actionElement.dataset.id;
                    const newStatus = actionElement.dataset.newStatus;
                    if (!id || !newStatus) return;
                    moveItem(id, newStatus);
                    renderList(status);
                } else if (action === "fix-cover") {
                    const id = actionElement.dataset.id;
                    if (!id || fixCoverThrottle) return;
                    
                    fixCoverThrottle = true;
                    const button = actionElement;
                    const icon = button.querySelector('i');
                    const originalTitle = button.title;
                    const originalIconClass = icon ? icon.className : '';
                    
                    // 1. 設定按鈕為修復中狀態（禁用按鈕、顯示 loading 圖示）
                    button.disabled = true;
                    button.title = "修復中...";
                    if (icon) {
                        icon.className = 'bi bi-arrow-clockwise spin';
                    }
                    
                    const db = getDb();
                    const item = db.find((entry) => entry.id === id);
                    if (item) {
                        fixItemCover(item).then((success) => {
                            fixCoverThrottle = false;
                            
                            if (success) {
                                // 2. 成功：從 brokenCoverCache 移除
                                brokenCoverCache.delete(id);
                                
                                // 3. 更新卡片圖片並隱藏修復按鈕
                                const card = button.closest('.av-card');
                                if (card) {
                                    const img = card.querySelector('img[data-item-id="' + id + '"]');
                                    if (img) {
                                        const updatedItem = getDb().find((entry) => entry.id === id);
                                        if (updatedItem && updatedItem.cover) {
                                            console.log(`[Event] 更新圖片 src 為: ${updatedItem.cover}`);
                                            
                                            // 設定新的 onload 和 onerror
                                            img.onload = function() {
                                                console.log(`[Event] 圖片載入成功`);
                                                // 載入成功後移除事件處理
                                                this.onload = null;
                                                this.onerror = null;
                                            };
                                            img.onerror = function() {
                                                console.log(`[Event] 圖片載入失敗，顯示修復按鈕`);
                                                button.classList.remove('d-none');
                                                brokenCoverCache.add(id);
                                            };
                                            
                                            img.src = updatedItem.cover;
                                        }
                                    }
                                }
                                
                                button.title = "修復成功";
                                if (icon) {
                                    icon.className = 'bi bi-check-circle-fill';
                                }
                                
                                // 延遲隱藏按鈕以顯示成功狀態
                                setTimeout(() => {
                                    button.classList.add("d-none");
                                    // 更新錯誤提示
                                    updateErrorBanner();
                                }, 800);
                            } else {
                                // 2. 失敗：保持按鈕顯示
                                button.disabled = false;
                                button.title = "修復失敗，請稍後重試";
                                if (icon) {
                                    icon.className = 'bi bi-exclamation-triangle-fill';
                                }
                                
                                // 3秒後恢復原狀
                                setTimeout(() => {
                                    button.title = originalTitle;
                                    if (icon) {
                                        icon.className = originalIconClass;
                                    }
                                }, 3000);
                            }
                        });
                    } else {
                        fixCoverThrottle = false;
                        button.disabled = false;
                        button.title = originalTitle;
                    }
                }
            });
        }

        renderList(status);
    };

    const initPage = () => {
        // 检测并执行迁移
        if (needsMigration()) {
            console.log("[Migration] 检测到旧版数据结构，开始迁移...");
            migrateToNewStructure();
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
