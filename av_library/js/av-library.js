(() => {
    const STORAGE_KEY = "avLibraryDB";
    const ACTRESS_KEY = "avLibraryActresses";
    const VIEW_KEY = "avLibraryViewMode";
    const SORT_KEY = "avLibrarySortMode";
    const AUTO_SYNC_KEY = "avLibraryAutoSync";
    const LAST_SYNC_KEY = "avLibraryDriveLastSyncAt";
    const SWIPE_TRANSITION_KEY = "avLibrarySwipeTransition";
    const PLACEHOLDER_COVER = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect width='640' height='360' fill='%23e9ecef'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='20' fill='%236c757d'%3ENo Cover%3C/text%3E%3C/svg%3E";
    const GOOGLE_CLIENT_ID = "200098245584-ms1ekqgikfvorm7jh4akcmsc1a6ub3dp.apps.googleusercontent.com";
    const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
    const DRIVE_FILE_NAME = "av_library_db.json";

    let googleTokenClient = null;
    let googleAccessToken = sessionStorage.getItem("avGoogleAccessToken") || "";
    let googleTokenExpiry = Number(sessionStorage.getItem("avGoogleTokenExpiry") || 0);
    let syncDirty = false;
    let syncTimer = null;
    let syncInFlight = false;
    let lastSyncRefreshTimer = null;

    const $ = (selector) => document.querySelector(selector);

    const setSyncStatus = (message, tone = "idle") => {
        const status = $("#av-sync-status");
        if (!status) return;
        status.textContent = `同步狀態：${message}`;
        status.classList.remove("is-idle", "is-running", "is-success", "is-warning", "is-error");
        status.classList.add(`is-${tone}`);
    };

    const getLastSyncAt = () => localStorage.getItem(LAST_SYNC_KEY) || "";

    const formatRelativeTime = (value) => {
        if (!value) return "尚未同步";
        const timestamp = new Date(value).getTime();
        if (Number.isNaN(timestamp)) return "尚未同步";

        const diff = Date.now() - timestamp;
        if (diff < 60000) return "剛剛";
        const minutes = Math.floor(diff / 60000);
        if (minutes < 60) return `${minutes} 分鐘前`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} 小時前`;
        const days = Math.floor(hours / 24);
        return `${days} 天前`;
    };

    const updateLastSyncText = () => {
        const text = `上次同步：${formatRelativeTime(getLastSyncAt())}`;
        document.querySelectorAll(".js-last-sync-text").forEach((element) => {
            element.textContent = text;
        });
    };

    const setLastSyncAt = (value) => {
        localStorage.setItem(LAST_SYNC_KEY, value);
        updateLastSyncText();
    };

    const updateAutoSyncButtonLabel = () => {
        const autoButton = $("#av-sync-auto-btn");
        if (!autoButton) return;
        const enabled = getAutoSync();
        autoButton.textContent = `自動同步：${enabled ? "開" : "關"}`;
        autoButton.classList.toggle("is-active", enabled);
    };

    const consumeSwipeTransitionDirection = () => {
        try {
            const direction = sessionStorage.getItem(SWIPE_TRANSITION_KEY) || "";
            sessionStorage.removeItem(SWIPE_TRANSITION_KEY);
            return direction;
        } catch (error) {
            return "";
        }
    };

    const storeSwipeTransitionDirection = (direction) => {
        try {
            sessionStorage.setItem(SWIPE_TRANSITION_KEY, direction);
        } catch (error) {
            // ignore write errors in private mode
        }
    };

    const applySwipeEnterTransition = () => {
        const direction = consumeSwipeTransitionDirection();
        if (!direction) return;

        const body = document.body;
        if (!body) return;

        body.classList.add(`av-swipe-in-${direction}`);
        window.setTimeout(() => {
            body.classList.remove(`av-swipe-in-${direction}`);
        }, 280);
    };

    const isTokenValid = () => googleAccessToken && Date.now() < googleTokenExpiry - 60000;

    const ensureAuth = async ({ interactive = true } = {}) => {
        if (isTokenValid()) {
            return googleAccessToken;
        }
        if (!googleTokenClient) {
            throw new Error("Google 驗證尚未就緒");
        }

        return new Promise((resolve, reject) => {
            googleTokenClient.callback = (tokenResponse) => {
                if (tokenResponse?.error) {
                    reject(new Error(tokenResponse.error));
                    return;
                }
                googleAccessToken = tokenResponse.access_token || "";
                const expiresIn = tokenResponse.expires_in ? tokenResponse.expires_in * 1000 : 3600 * 1000;
                googleTokenExpiry = Date.now() + expiresIn;
                sessionStorage.setItem("avGoogleAccessToken", googleAccessToken);
                sessionStorage.setItem("avGoogleTokenExpiry", String(googleTokenExpiry));
                resolve(googleAccessToken);
            };

            const prompt = interactive ? (googleAccessToken ? "" : "consent") : "none";
            googleTokenClient.requestAccessToken({ prompt });
        });
    };

    const markDirty = () => {
        syncDirty = true;
        if (getAutoSync()) {
            if (syncTimer) window.clearTimeout(syncTimer);
            syncTimer = window.setTimeout(() => {
                if (!syncDirty) return;
                runDriveSync({ interactive: false, silent: true, reason: "auto-save" }).catch((error) => {
                    console.warn("[Drive sync] auto-save skipped", error.message);
                });
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

    const normalizeDbForCompare = (items = []) => {
        return [...items]
            .map((item) => ({
                id: item?.id || "",
                slug: item?.slug || "",
                code: item?.code || "",
                url: item?.url || "",
                title: item?.title || "",
                cover: item?.cover || "",
                stream: item?.stream || "",
                status: item?.status || "later",
                sourceId: item?.sourceId || "",
                sourceName: item?.sourceName || "",
                domain: item?.domain || "",
                isFavorite: item?.isFavorite === true,
                deleted: item?.deleted === true,
                deletedAt: item?.deletedAt || "",
                addedAt: item?.addedAt || "",
                actresses: (item?.actresses || []).slice().sort()
            }))
            .sort((a, b) => {
                const keyA = `${a.slug}|${a.id}`;
                const keyB = `${b.slug}|${b.id}`;
                return keyA.localeCompare(keyB);
            });
    };

    const isDbEquivalent = (left, right) => {
        return JSON.stringify(normalizeDbForCompare(left)) === JSON.stringify(normalizeDbForCompare(right));
    };

    const fetchRemoteDb = async () => {
        const files = await listDriveFiles();
        if (!files.length) {
            return { items: [], actresses: [] };
        }

        const content = await downloadDriveFile(files[0].id);
        let parsed;
        try {
            parsed = JSON.parse(content || "[]");
        } catch (error) {
            throw new Error("雲端資料格式不正確");
        }
        // 向下相容：舊格式為純陣列
        if (Array.isArray(parsed)) {
            return { items: migrateRemoteDataIfNeeded(parsed), actresses: [] };
        }
        if (!parsed || typeof parsed !== "object") {
            throw new Error("雲端資料格式不正確");
        }
        return {
            items: migrateRemoteDataIfNeeded(Array.isArray(parsed.items) ? parsed.items : []),
            actresses: Array.isArray(parsed.actresses) ? parsed.actresses : []
        };
    };

    const saveRemoteDb = async (items, actresses = []) => {
        const content = JSON.stringify({ items, actresses });
        const files = await listDriveFiles();
        if (files.length) {
            await uploadDriveFile(files[0].id, content);
        } else {
            await createDriveFile(content);
        }
    };

    /** 合併兩份演員清單，以 id 為 key，保留較新版本 */
    const mergeActresses = (local, remote) => {
        const map = new Map();
        const upsert = (a) => {
            if (!a || !a.id) return;
            const existing = map.get(a.id);
            if (!existing) { map.set(a.id, a); return; }
            const ta = new Date(existing.updatedAt || 0).getTime();
            const tb = new Date(a.updatedAt || 0).getTime();
            if (tb > ta) map.set(a.id, a);
        };
        local.forEach(upsert);
        remote.forEach(upsert);
        return Array.from(map.values());
    };

    const mergeDb = (local, remote) => {
        const map = new Map();
        const getFreshness = (item) => {
            if (!item) return 0;
            const timestamp = new Date(item.updatedAt || item.addedAt || 0).getTime();
            return Number.isNaN(timestamp) ? 0 : timestamp;
        };
        const upsert = (item) => {
            if (!item) return;
            // 新数据结构：使用 slug 作为唯一键
            const key = item.slug || "";
            const existing = map.get(key);
            if (!existing) {
                map.set(key, item);
                return;
            }
            // 保留更新时间较新的版本；时间相同时保留先写入的一方（本機優先）
            const a = getFreshness(existing);
            const b = getFreshness(item);
            if (b > a) {
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

    const runDriveSync = async ({ interactive = true, silent = false, reason = "manual" } = {}) => {
        if (syncInFlight) {
            return { localUpdated: false, remoteUpdated: false, skipped: true };
        }

        syncInFlight = true;
        if (!silent) {
            setSyncStatus("同步中", "running");
        }

        try {
            await ensureAuth({ interactive });

            const local = getDb();
            const localActresses = getActresses();
            const remote = await fetchRemoteDb();
            const merged = mergeDb(local, remote.items);
            const mergedActresses = mergeActresses(localActresses, remote.actresses);

            const localNeedsUpdate = !isDbEquivalent(local, merged);
            const actressesNeedLocalUpdate = JSON.stringify(localActresses.map(a=>a.id).sort()) !== JSON.stringify(mergedActresses.map(a=>a.id).sort()) ||
                localActresses.some((a, i) => {
                    const m = mergedActresses.find(x => x.id === a.id);
                    return !m || m.name !== a.name;
                });
            const remoteNeedsUpdate = !isDbEquivalent(remote.items, merged) ||
                JSON.stringify((remote.actresses||[]).map(a=>a.id).sort()) !== JSON.stringify(mergedActresses.map(a=>a.id).sort());

            if (localNeedsUpdate) {
                setDb(merged);
                const listPage = document.body?.dataset?.avList;
                if (listPage) renderList(listPage);
            }

            if (actressesNeedLocalUpdate) {
                setActresses(mergedActresses);
                if (document.body?.dataset?.avPage === "actress") renderActressList();
            }

            if (remoteNeedsUpdate) {
                await saveRemoteDb(merged, mergedActresses);
            }

            syncDirty = false;
            setLastSyncAt(new Date().toISOString());

            const msg = localNeedsUpdate || remoteNeedsUpdate
                ? `${localNeedsUpdate ? "本機已更新" : "本機最新"}，${remoteNeedsUpdate ? "雲端已更新" : "雲端最新"}`
                : "資料已是最新";
            setSyncStatus(msg, "success");
            return { localUpdated: localNeedsUpdate, remoteUpdated: remoteNeedsUpdate, skipped: false };
        } catch (error) {
            if (!interactive && reason.startsWith("auto")) {
                setSyncStatus("自動同步略過，等待登入", "warning");
            } else if (!interactive) {
                setSyncStatus("啟動同步略過，等待登入", "warning");
            } else {
                setSyncStatus(`同步失敗：${error.message}`, "error");
            }
            throw error;
        } finally {
            syncInFlight = false;
        }
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

    // ============= 演員資料庫 =============
    const getActresses = () => {
        try {
            const raw = localStorage.getItem(ACTRESS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    };

    const setActresses = (data) => {
        localStorage.setItem(ACTRESS_KEY, JSON.stringify(data));
    };

    /** 新增演員（若已存在同名則回傳現有），回傳演員物件 */
    const saveActress = (name) => {
        const trimmed = (name || "").trim();
        if (!trimmed) return null;
        const db = getActresses();
        let existing = db.find((a) => a.name === trimmed);
        if (existing) return existing;
        const newActress = {
            id: (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`),
            name: trimmed,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        db.push(newActress);
        setActresses(db);
        return newActress;
    };

    /** 將演員 id 連結到指定影片 */
    const linkActressToItem = (itemId, actressId) => {
        const db = getDb();
        const item = db.find((e) => e.id === itemId);
        if (!item) return;
        if (!item.actresses) item.actresses = [];
        if (!item.actresses.includes(actressId)) {
            item.actresses.push(actressId);
            item.updatedAt = new Date().toISOString();
            setDb(db);
            markDirty();
        }
    };

    /** 解除指定影片與演員的連結 */
    const unlinkActressFromItem = (itemId, actressId) => {
        const db = getDb();
        const item = db.find((e) => e.id === itemId);
        if (!item || !item.actresses) return;
        item.actresses = item.actresses.filter((aid) => aid !== actressId);
        item.updatedAt = new Date().toISOString();
        setDb(db);
        markDirty();
    };

    /** 掃描已知演員名稱，自動將符合條件的演員連結到指定影片 */
    const autoTagActresses = (itemId) => {
        const db = getDb();
        const item = db.find((e) => e.id === itemId);
        if (!item || !item.title) return;
        const actresses = getActresses();
        if (!actresses.length) return;
        if (!item.actresses) item.actresses = [];
        let changed = false;
        for (const actress of actresses) {
            if (item.title.includes(actress.name) && !item.actresses.includes(actress.id)) {
                item.actresses.push(actress.id);
                changed = true;
            }
        }
        if (changed) {
            item.updatedAt = new Date().toISOString();
            setDb(db);
        }
    };

    /** 將標題切詞，過濾掉片碼格式與過短的詞 */
    const tokenizeTitle = (title) => {
        if (!title) return [];
        return title.split(/[\s　、。，,・]+/)
            .map((t) => t.trim())
            .filter((t) => t.length >= 2 && !/^[A-Z0-9\-]+$/i.test(t));
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

    const getPrimaryMarkdownSection = (text) => {
        if (!text) return "";
        const markers = ["\n###### 推薦", "\n## 猜你喜歡", "\n##### 關於"];
        let endIndex = text.length;
        for (const marker of markers) {
            const markerIndex = text.indexOf(marker);
            if (markerIndex > -1 && markerIndex < endIndex) {
                endIndex = markerIndex;
            }
        }
        return text.slice(0, endIndex);
    };

    const findMetaFromMarkdown = (text, fallbackTitle) => {
        const titleLine = text.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
        const headingLine = text.match(/^####\s+(.+)$/m)?.[1]?.trim();
        const title = titleLine || headingLine || fallbackTitle;
        const primarySection = getPrimaryMarkdownSection(text);

        // 策略 1: 尋找 preview.jpg (完整解析度)
        let cover = primarySection.match(/https?:\/\/assets-cdn\.jable\.tv\/contents\/videos_screenshots\/\d+\/\d+\/preview\.jpg/i)?.[0];
        
        // 策略 2: 尋找任何 jable.tv 的圖片 URL (包括縮圖)
        if (!cover) {
            const thumbMatch = primarySection.match(/https?:\/\/assets-cdn\.jable\.tv\/contents\/videos_screenshots\/(\d+)\/(\d+)\/320x180\/1\.jpg/i);
            if (thumbMatch) {
                // 轉換縮圖 URL 為完整 preview.jpg
                cover = `https://assets-cdn.jable.tv/contents/videos_screenshots/${thumbMatch[1]}/${thumbMatch[2]}/preview.jpg`;
            }
        }
        
        // 策略 3: 尋找任何 assets-cdn 的 jpg 圖片
        if (!cover) {
            cover = primarySection.match(/https?:\/\/assets-cdn\.jable\.tv\/[^\s"'<>]*\.jpg/i)?.[0] || "";
        }
        
        // 策略 4: 尋找 Markdown 圖片語法中的 URL
        if (!cover) {
            const mdImgMatch = primarySection.match(/!\[[^\]]*\]\((https?:\/\/[^)]+\.jpg)\)/i);
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
        let normalizedTargetUrl = targetUrl;
        try {
            const parsed = new URL(targetUrl);
            if (/^jable\.(tv|tw)$/i.test(parsed.hostname.replace(/^www\./, ""))) {
                parsed.protocol = "http:";
                normalizedTargetUrl = parsed.toString();
            }
        } catch (error) {
            normalizedTargetUrl = targetUrl;
        }

        const proxyUrl = `https://r.jina.ai/${normalizedTargetUrl}`;
        console.log(`[Jina] Fetching ${normalizedTargetUrl}`);
        
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
            console.log(`[Jina] Fetched ${normalizedTargetUrl}, content length: ${text.length}`);
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
            const now = new Date().toISOString();
            const wasDeleted = exists.deleted === true;
            // 若影片曾被刪除，重新加入時恢復
            if (wasDeleted) {
                exists.deleted = false;
                delete exists.deletedAt;
            }

            // 重新新增同片時，更新可變動的中繼資料（包含封面）
            exists.code = item.code || exists.code;
            exists.url = item.url || exists.url;
            exists.title = item.title || exists.title;
            exists.cover = item.cover || exists.cover;
            exists.stream = item.stream || exists.stream || "";
            exists.sourceId = item.sourceId || exists.sourceId;
            exists.sourceName = item.sourceName || exists.sourceName;
            exists.domain = item.domain || exists.domain;

            exists.status = item.status;
            exists.isFavorite = exists.isFavorite || false;
            if (wasDeleted) {
                // 重新加入時視為新資料，便於排序與同步判斷
                exists.addedAt = item.addedAt || now;
            }
            exists.updatedAt = now;
            if (exists.cover) {
                brokenCoverCache.delete(exists.id);
            }
            setDb(db);
            return {
                saved: false,
                message: wasDeleted
                    ? `已重新加入「${exists.title}」，並更新最新封面`
                    : `已更新「${exists.title}」資料與封面`
            };
        }
        
        // 影片不存在，新增
        const newItem = {
            ...item,
            id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
            isFavorite: false,
            updatedAt: item.addedAt || new Date().toISOString()
        };
        const next = [newItem, ...db];
        setDb(next);
        // 新增後自動比對已知演員名稱
        autoTagActresses(newItem.id);
        return { saved: true, message: "已新增至清單" };
    };

    const toggleFavorite = (id) => {
        const db = getDb();
        const item = db.find((entry) => entry.id === id);
        if (!item) return;
        
        item.isFavorite = !item.isFavorite;
        item.updatedAt = new Date().toISOString();
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
        item.updatedAt = new Date().toISOString();
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
            // favorite 页面显示所有 isFavorite=true 且未被刪除的项目
            filtered = db.filter((item) => item.deleted !== true && item.isFavorite === true);
        } else {
            // later/watched 页面按 status 过滤，排除已刪除
            filtered = db.filter((item) => item.deleted !== true && item.status === status);
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
        // 取得演員對照表，供 token 標記使用
        const actressNameToId = new Map(getActresses().map((a) => [a.name, a.id]));
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
                    ${(() => {
                        const tokens = tokenizeTitle(item.title);
                        if (!tokens.length) return "";
                        const itemActressIds = new Set(item.actresses || []);
                        const btns = tokens.map((t) => {
                            const aid = actressNameToId.get(t);
                            const tagged = aid && itemActressIds.has(aid);
                            const safeT = t.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                            return `<button type="button" class="btn-token${tagged ? " is-tagged" : ""}" data-action="tag-actress" data-item-id="${item.id}" data-name="${safeT}" title="${tagged ? "已標記演員" : "新增為演員"}">${safeT}</button>`;
                        }).join("");
                        return `<div class="av-title-tokens">${btns}</div>`;
                    })()}
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
        const syncButton = $("#av-sync-run");
        const autoButton = $("#av-sync-auto-btn");
        if (!syncButton || !autoButton) return;

        const waitForGis = () => {
            if (window.google?.accounts?.oauth2) {
                googleTokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: DRIVE_SCOPE,
                    callback: () => {}
                });

                updateAutoSyncButtonLabel();
                updateLastSyncText();
                setSyncStatus("待命", "idle");

                if (lastSyncRefreshTimer) {
                    window.clearInterval(lastSyncRefreshTimer);
                }
                lastSyncRefreshTimer = window.setInterval(updateLastSyncText, 60000);

                if (getAutoSync()) {
                    runDriveSync({ interactive: false, silent: true, reason: "auto-startup" })
                        .catch((error) => {
                            console.warn("[Drive sync] startup skipped", error.message);
                        });
                }
                return;
            }
            setTimeout(waitForGis, 300);
        };

        setSyncStatus("載入 Google 驗證中", "running");
        waitForGis();

        syncButton.addEventListener("click", async () => {
            try {
                await runDriveSync({ interactive: true, silent: false, reason: "manual" });
            } catch (error) {
                console.error("[Drive sync] manual sync failed", error);
            }
        });

        autoButton.addEventListener("click", async () => {
            const nextValue = !getAutoSync();
            setAutoSync(nextValue);
            updateAutoSyncButtonLabel();

            if (!nextValue) {
                if (syncTimer) {
                    window.clearTimeout(syncTimer);
                    syncTimer = null;
                }
                setSyncStatus("自動同步已關閉", "idle");
                return;
            }

            setSyncStatus("自動同步已開啟", "success");
            try {
                await runDriveSync({ interactive: false, silent: true, reason: "auto-toggle" });
            } catch (error) {
                console.warn("[Drive sync] auto-toggle initial sync skipped", error.message);
            }
        });
    };

    const deleteItem = (id) => {
        const db = getDb();
        const item = db.find((entry) => entry.id === id);
        if (!item) return;
        // 使用 tombstone 標記刪除，而非直接移除，確保同步時刪除操作能正確勝過雲端舊資料
        const now = new Date().toISOString();
        item.deleted = true;
        item.deletedAt = now;
        item.updatedAt = now;
        setDb(db);
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
                    // 圖片能載入，寫入新封面並更新時間戳供同步判斷
                    const db = getDb();
                    const dbItem = db.find((entry) => entry.id === item.id);
                    if (dbItem) {
                        console.log(`[fixItemCover] 更新封面為: ${meta.cover}`);
                        dbItem.cover = meta.cover;
                        dbItem.updatedAt = new Date().toISOString();
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
                } else if (action === "tag-actress") {
                    const itemId = actionElement.dataset.itemId;
                    const name = actionElement.dataset.name;
                    if (!itemId || !name) return;
                    const actress = saveActress(name);
                    if (actress) {
                        linkActressToItem(itemId, actress.id);
                        renderList(status);
                    }
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

    const initMobileSwipeNavigation = () => {
        const pageOrder = ["index.html", "later.html", "watched.html", "favorite.html", "actress.html"];
        const path = window.location.pathname || "";
        const currentPage = path.split("/").pop() || "index.html";
        const currentIndex = pageOrder.indexOf(currentPage);

        if (currentIndex === -1) return;
        if (!window.matchMedia("(max-width: 900px)").matches) return;

        let startX = 0;
        let startY = 0;
        let startTarget = null;

        const isInteractiveTarget = (target) => {
            if (!(target instanceof Element)) return false;
            return Boolean(target.closest("a, button, input, textarea, select, label, .btn, .nav-link, [data-action]"));
        };

        const goToIndex = (targetIndex) => {
            if (targetIndex < 0 || targetIndex >= pageOrder.length) return;
            const nextPage = pageOrder[targetIndex];
            if (nextPage === currentPage) return;

            const body = document.body;
            const direction = targetIndex > currentIndex ? "left" : "right";
            if (body) {
                body.classList.add(`av-swipe-out-${direction}`);
            }
            storeSwipeTransitionDirection(direction);
            window.setTimeout(() => {
                window.location.href = nextPage;
            }, 180);
        };

        document.addEventListener("touchstart", (event) => {
            const touch = event.changedTouches?.[0];
            if (!touch) return;
            startX = touch.clientX;
            startY = touch.clientY;
            startTarget = event.target;
        }, { passive: true });

        document.addEventListener("touchend", (event) => {
            const touch = event.changedTouches?.[0];
            if (!touch) return;
            if (isInteractiveTarget(startTarget)) return;

            const deltaX = touch.clientX - startX;
            const deltaY = touch.clientY - startY;
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);

            if (absX < 70) return;
            if (absX <= absY * 1.2) return;

            if (deltaX < 0) {
                goToIndex(currentIndex + 1);
            } else {
                goToIndex(currentIndex - 1);
            }
        }, { passive: true });
    };

    // ============= 演員頁面 =============
    const ACTRESS_VIEW_KEY = "avActressViewMode";
    const ACTRESS_SORT_KEY = "avActressSortMode";
    const getActressViewMode = () => localStorage.getItem(ACTRESS_VIEW_KEY) || "list";
    const setActressViewMode = (v) => localStorage.setItem(ACTRESS_VIEW_KEY, v);
    const getActressSortMode = () => localStorage.getItem(ACTRESS_SORT_KEY) || "count";
    const setActressSortMode = (v) => localStorage.setItem(ACTRESS_SORT_KEY, v);

    /** 依目前排序模式排列演員陣列（修改原陣列並回傳） */
    const sortActresses = (actresses, db, sortMode) => {
        return [...actresses].sort((a, b) => {
            if (sortMode === "name") {
                return a.name.localeCompare(b.name, "zh-Hant");
            }
            // 預設：依片數降序，同數時依名稱
            const ca = db.filter((item) => item.actresses?.includes(a.id)).length;
            const cb = db.filter((item) => item.actresses?.includes(b.id)).length;
            return cb - ca || a.name.localeCompare(b.name, "zh-Hant");
        });
    };

    const renderActressList = () => {
        const container = document.getElementById("av-actress-list");
        const empty = document.getElementById("av-actress-empty");
        if (!container) return;

        const actresses = getActresses();
        const db = getDb().filter((item) => item.deleted !== true);
        const viewMode = getActressViewMode();
        const sortMode = getActressSortMode();

        // 更新工具列按鈕狀態
        document.querySelectorAll("[data-actress-view]").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.actressView === viewMode);
        });
        document.querySelectorAll("[data-actress-sort]").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.actressSort === sortMode);
        });

        if (!actresses.length) {
            container.innerHTML = "";
            if (empty) empty.classList.remove("d-none");
            return;
        }
        if (empty) empty.classList.add("d-none");

        // 搜尋過濾（保持搜尋框現有輸入）
        const searchInput = document.getElementById("av-actress-search");
        const q = (searchInput?.value || "").trim().toLowerCase();

        const sorted = sortActresses(actresses, db, sortMode);
        const filtered = q ? sorted.filter((a) => a.name.toLowerCase().includes(q)) : sorted;

        if (viewMode === "tab") {
            // ===== 頁籤模式 =====
            // 左側列表 / 右側影片面板
            const activeId = container.dataset.activeActress || (filtered[0]?.id || "");
            const activeActress = filtered.find((a) => a.id === activeId) || filtered[0];

            const tabItems = filtered.map((actress) => {
                const count = db.filter((item) => item.actresses?.includes(actress.id)).length;
                const isActive = actress.id === activeActress?.id;
                return `<div class="actress-tab-item${isActive ? " is-active" : ""}" data-action="select-actress" data-id="${actress.id}" role="button" tabindex="0">
                    <i class="bi bi-person-circle actress-avatar"></i>
                    <div class="actress-tab-meta">
                        <span class="actress-name">${actress.name}</span>
                        <span class="actress-count">${count} 部</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-icon actress-delete-btn" data-action="delete-actress" data-id="${actress.id}" title="刪除演員"><i class="bi bi-person-dash"></i></button>
                </div>`;
            }).join("");

            const panelFilms = activeActress
                ? db.filter((item) => item.actresses?.includes(activeActress.id))
                : [];
            const filmRows = panelFilms.length
                ? panelFilms.map((film) => {
                    const cover = film.cover || PLACEHOLDER_COVER;
                    const safeTitle = (film.title || film.code).replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    const statusLabel = film.status === "watched" ? "看過" : "稍後";
                    return `<div class="actress-film-row">
                        <img src="${cover}" class="actress-film-thumb" alt="" loading="lazy">
                        <div class="actress-film-info">
                            <div class="actress-film-title">${safeTitle}</div>
                            <div class="actress-film-code">${film.code} <span class="badge rounded-pill badge-status ms-1">${statusLabel}</span></div>
                        </div>
                        <a href="${film.url}" target="_blank" rel="noopener" class="btn btn-sm btn-icon" title="前往"><i class="bi bi-link-45deg"></i></a>
                    </div>`;
                }).join("")
                : `<div class="text-muted px-3 py-2 small">目前沒有影片</div>`;

            container.innerHTML = `<div class="actress-tab-layout">
                <div class="actress-tab-sidebar">${tabItems}</div>
                <div class="actress-tab-panel">
                    <div class="actress-tab-panel-title">
                        <i class="bi bi-person-circle me-2"></i>${activeActress?.name || ""}
                        <span class="actress-count ms-2">${panelFilms.length} 部</span>
                    </div>
                    ${filmRows}
                </div>
            </div>`;
            container.dataset.activeActress = activeActress?.id || "";
        } else {
            // ===== 列表模式 =====
            container.innerHTML = filtered.map((actress) => {
                const films = db.filter((item) => item.actresses?.includes(actress.id));
                const filmRows = films.length
                    ? films.map((film) => {
                        const cover = film.cover || PLACEHOLDER_COVER;
                        const safeTitle = (film.title || film.code).replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        const statusLabel = film.status === "watched" ? "看過" : "稍後";
                        return `<div class="actress-film-row">
                            <img src="${cover}" class="actress-film-thumb" alt="" loading="lazy">
                            <div class="actress-film-info">
                                <div class="actress-film-title">${safeTitle}</div>
                                <div class="actress-film-code">${film.code} <span class="badge rounded-pill badge-status ms-1">${statusLabel}</span></div>
                            </div>
                            <a href="${film.url}" target="_blank" rel="noopener" class="btn btn-sm btn-icon" title="前往"><i class="bi bi-link-45deg"></i></a>
                        </div>`;
                    }).join("")
                    : `<div class="text-muted px-3 py-2 small">目前沒有影片</div>`;

                return `<div class="actress-card" id="actress-${actress.id}">
                    <div class="actress-header" data-action="toggle-actress" data-id="${actress.id}" role="button" tabindex="0">
                        <i class="bi bi-person-circle actress-avatar"></i>
                        <span class="actress-name">${actress.name}</span>
                        <span class="actress-count">${films.length} 部</span>
                        <button type="button" class="btn btn-sm btn-icon actress-delete-btn" data-action="delete-actress" data-id="${actress.id}" title="刪除演員"><i class="bi bi-person-dash"></i></button>
                        <i class="bi bi-chevron-down actress-chevron"></i>
                    </div>
                    <div class="actress-films" id="actress-panel-${actress.id}" style="display:none;">
                        ${filmRows}
                    </div>
                </div>`;
            }).join("");
        }
    };

    const initActressPage = () => {
        renderActressList();

        // --- 手動新增演員表單 ---
        const addForm = document.getElementById("av-actress-add-form");
        const addInput = document.getElementById("av-actress-add-input");
        if (addForm && addInput) {
            addForm.addEventListener("submit", (event) => {
                event.preventDefault();
                const name = addInput.value.trim();
                if (!name) return;
                saveActress(name);
                addInput.value = "";
                renderActressList();
                markDirty();
            });
        }

        // --- 搜尋 ---
        const searchInput = document.getElementById("av-actress-search");
        if (searchInput) {
            searchInput.addEventListener("input", () => renderActressList());
        }

        // --- 視圖 / 排序切換 ---
        document.addEventListener("click", (event) => {
            const viewBtn = event.target.closest("[data-actress-view]");
            if (viewBtn) {
                setActressViewMode(viewBtn.dataset.actressView);
                renderActressList();
                return;
            }
            const sortBtn = event.target.closest("[data-actress-sort]");
            if (sortBtn) {
                setActressSortMode(sortBtn.dataset.actressSort);
                renderActressList();
            }
        });

        // --- 列表互動 ---
        const list = document.getElementById("av-actress-list");
        if (!list) return;

        list.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const actionEl = target.closest("[data-action]");
            if (!actionEl) return;
            const action = actionEl.dataset.action;

            if (action === "toggle-actress") {
                const id = actionEl.dataset.id;
                const panel = document.getElementById(`actress-panel-${id}`);
                if (!panel) return;
                const isOpen = panel.style.display !== "none";
                panel.style.display = isOpen ? "none" : "";
                const chevron = actionEl.querySelector(".actress-chevron");
                if (chevron) {
                    chevron.classList.toggle("bi-chevron-down", isOpen);
                    chevron.classList.toggle("bi-chevron-up", !isOpen);
                }
            } else if (action === "select-actress") {
                // 頁籤模式：切換已選演員
                const id = actionEl.closest("[data-id]")?.dataset.id || actionEl.dataset.id;
                if (!id) return;
                list.dataset.activeActress = id;
                renderActressList();
            } else if (action === "delete-actress") {
                event.stopPropagation();
                const id = actionEl.dataset.id;
                if (!id) return;
                const name = actionEl.closest("[data-id]")?.querySelector(".actress-name")?.textContent || "";
                if (!window.confirm(`確定要刪除演員「${name}」嗎？（影片不會被刪除）`)) return;
                setActresses(getActresses().filter((a) => a.id !== id));
                const db = getDb().map((item) => {
                    if (item.actresses?.includes(id)) {
                        item.actresses = item.actresses.filter((aid) => aid !== id);
                        item.updatedAt = new Date().toISOString();
                    }
                    return item;
                });
                setDb(db);
                markDirty();
                renderActressList();
            }
        });

        // 鍵盤支援
        list.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const actionEl = event.target.closest("[data-action='toggle-actress'], [data-action='select-actress']");
            if (actionEl) {
                event.preventDefault();
                actionEl.click();
            }
        });
    };

    const initPage = () => {
        applySwipeEnterTransition();

        // 检测并执行迁移
        if (needsMigration()) {
            console.log("[Migration] 检测到旧版数据结构，开始迁移...");
            migrateToNewStructure();
        }
        
        const listPage = document.body?.dataset?.avList;
        const avPage = document.body?.dataset?.avPage;
        if (avPage === "actress") {
            initActressPage();
        } else if (listPage) {
            initListPage(listPage);
        } else {
            initForm();
        }
        initGoogleSync();
        initMobileSwipeNavigation();
    };

    document.addEventListener("DOMContentLoaded", initPage);
})();
