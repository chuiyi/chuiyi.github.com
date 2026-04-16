class BeybladeTournamentApp {
    constructor() {
        this.storageKey = 'bbx_vs_tournaments';
        this.currentTournamentKey = 'bbx_vs_current_tournament';
        this.pendingPairingKey = 'bbx_vs_pending_pairing';
        this.driveAutoSyncKey = 'bbx_vs_drive_auto_sync_enabled';
        this.driveLastSyncKey = 'bbx_vs_drive_last_sync_at';
        this.driveClientId = '200098245584-ms1ekqgikfvorm7jh4akcmsc1a6ub3dp.apps.googleusercontent.com';
        this.driveSyncFileName = 'bbx_vs_sync.json';
        this.driveScopes = 'https://www.googleapis.com/auth/drive.appdata';
        this.tournaments = this.loadTournaments();
        this.currentTournamentId = localStorage.getItem(this.currentTournamentKey) || null;
        this.currentPage = 'dashboard-page';
        this.selectedMatchId = null;
        this.arenaTab = 'recorder';
        this.isHeaderMenuOpen = false;
        this.autoSwitchTimer = null;
        this.recorderFocusTimer = null;
        this.pendingNextMatchId = null;
        this.pendingPairing = null;
        this.selectedPairingSlotIndex = null;
        this.driveTokenClient = null;
        this.driveAccessToken = sessionStorage.getItem('bbx_vs_drive_access_token') || null;
        this.driveTokenExpiry = Number(sessionStorage.getItem('bbx_vs_drive_token_expiry') || 0);
        this.gisReady = false;
        this.driveAutoSyncEnabled = localStorage.getItem(this.driveAutoSyncKey) === '1';
        this.autoSyncTimer = null;
        this.lastSyncRefreshTimer = null;
        this.scoreTypes = {
            spin: { label: '旋轉勝利', defaultPoints: 1, tone: 'btn-primary' },
            ringOut: { label: '擊飛勝利', defaultPoints: 2, tone: 'secondary-tone' },
            burst: { label: '爆裂勝利', defaultPoints: 2, tone: 'tertiary-tone' },
            xtreme: { label: '極限勝利', defaultPoints: 3, tone: 'quaternary-tone' }
        };
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.ensureCurrentTournament();
        this.restorePendingPairingDraft();
        this.restoreStateFromUrl();
        // 先用 replaceState 寫入初始狀態，作為歷史堆疊的起點
        const initParams = this.buildUrlParams();
        window.history.replaceState({ page: this.currentPage }, '', `${window.location.pathname}?${initParams.toString()}`);
        this.showPageInternal(this.currentPage);
        this.updateLastSyncText();
        this.lastSyncRefreshTimer = window.setInterval(() => this.updateLastSyncText(), 60_000);

        if (this.driveAutoSyncEnabled) {
            this.startupAutoSync();
        }
    }

    cacheElements() {
        this.pages = document.querySelectorAll('.page');
        this.historyList = document.getElementById('history-list');
        this.currentTournamentCard = document.getElementById('current-tournament-card');
        this.metricTotal = document.getElementById('metric-total');
        this.metricActive = document.getElementById('metric-active');
        this.metricCompleted = document.getElementById('metric-completed');
        this.setupName = document.getElementById('tournament-name');
        this.playersInput = document.getElementById('players-input');
        this.pointsToWinInput = document.getElementById('points-to-win');
        this.scoreInputs = {
            spin: document.getElementById('score-spin'),
            ringOut: document.getElementById('score-ring-out'),
            burst: document.getElementById('score-burst'),
            xtreme: document.getElementById('score-xtreme')
        };
        this.pairingMetaStrip = document.getElementById('pairing-meta-strip');
        this.pairingReview = document.getElementById('pairing-review');
        this.pairingTitle = document.getElementById('pairing-title');
        this.pairingSubtitle = document.getElementById('pairing-subtitle');
        this.pairingGrid = document.getElementById('pairing-grid');
        this.pairingSelectionHint = document.getElementById('pairing-selection-hint');
        this.arenaTitle = document.getElementById('arena-title');
        this.arenaRoundBadge = document.getElementById('arena-round-badge');
        this.arenaSubtitle = document.getElementById('arena-subtitle');
        this.arenaSummary = document.getElementById('arena-summary');
        this.standingsTitle = document.getElementById('standings-title');
        this.standingsBody = document.getElementById('standings-body');
        this.standingsNote = document.getElementById('standings-note');
        this.mobileArenaTabs = document.querySelectorAll('.mobile-tab-btn');
        this.arenaPanels = document.querySelectorAll('.arena-tab-panel');
        this.bracketRounds = document.getElementById('bracket-rounds');
        this.matchTitle = document.getElementById('match-title');
        this.matchRecorder = document.getElementById('match-recorder');
        this.recorderPanel = document.querySelector('.recorder-panel');
        this.completedMatches = document.getElementById('completed-matches');
        this.undoScoreBtn = document.getElementById('undo-score-btn');
        this.resetMatchBtn = document.getElementById('reset-match-btn');
        this.importFileInput = document.getElementById('import-file');
        this.driveSyncBtn = document.getElementById('drive-sync-btn');
        this.autoSyncBtn = document.getElementById('auto-sync-btn');
        this.lastSyncTexts = Array.from(document.querySelectorAll('.js-last-sync-text'));
        this.syncStatusText = document.getElementById('sync-status-text');
        this.matchDetailModal = document.getElementById('match-detail-modal');
        this.matchDetailContent = document.getElementById('match-detail-content');
        this.nextMatchModal = document.getElementById('next-match-modal');
        this.nextMatchContent = document.getElementById('next-match-content');
        this.driveSyncChoiceModal = document.getElementById('drive-sync-choice-modal');
        this.headerRoot = document.querySelector('.vs-header');
        this.headerNav = document.querySelector('.header-nav');
        this.headerMenuBtn = document.getElementById('header-menu-btn');
        this.headerMenuPanel = document.getElementById('header-menu-panel');
    }

    bindEvents() {
        document.getElementById('home-title').addEventListener('click', () => this.showPage('dashboard-page'));
        document.getElementById('new-tournament-btn').addEventListener('click', () => this.openSetup());
        document.getElementById('history-btn').addEventListener('click', () => this.showPage('dashboard-page'));
        document.getElementById('create-tournament-btn').addEventListener('click', () => this.handleCreateTournament());
        document.getElementById('pairing-back-btn').addEventListener('click', () => this.returnToSetupFromPairing());
        document.getElementById('pairing-reroll-btn').addEventListener('click', () => this.rerollPendingPairings());
        document.getElementById('pairing-confirm-btn').addEventListener('click', () => this.confirmPendingPairings());
        document.getElementById('export-btn').addEventListener('click', () => this.exportCurrentTournament());
        document.getElementById('import-btn').addEventListener('click', () => this.importFileInput.click());
        document.getElementById('drive-sync-btn').addEventListener('click', () => this.handleDriveSync());
        document.getElementById('auto-sync-btn').addEventListener('click', () => this.toggleAutoDriveSync());
        this.importFileInput.addEventListener('change', (event) => this.importTournament(event.target.files[0]));
        this.undoScoreBtn.addEventListener('click', () => this.undoLastScore());
        this.resetMatchBtn.addEventListener('click', () => this.resetSelectedMatch());

        document.addEventListener('click', (event) => this.handleDocumentClick(event));
        window.addEventListener('resize', () => {
            this.updateArenaTabVisibility();
            this.updateHeaderNavMode();
        });
        window.addEventListener('popstate', (event) => {
            this.restoreStateFromUrl();
            const pageId = (event.state && event.state.page) || this.currentPage;
            this.showPageInternal(pageId);
        });
    }

    handleDocumentClick(event) {
        const action = event.target.closest('[data-action]');
        if (action) {
            const { action: actionName, id } = action.dataset;
            if (actionName === 'create') {
                this.openSetup();
            }
            if (actionName === 'resume') {
                this.openTournament(id);
            }
            if (actionName === 'delete') {
                this.deleteTournament(id);
            }
            if (actionName === 'match-select') {
                this.selectMatch(id);
            }
            if (actionName === 'score') {
                this.applyScore(action.dataset.slot, action.dataset.scoreType);
            }
            if (actionName === 'arena-tab') {
                this.setArenaTab(action.dataset.tab);
            }
            if (actionName === 'toggle-header-menu') {
                this.toggleHeaderMenu();
            }
            if (actionName === 'header-new') {
                this.openSetup();
                this.closeHeaderMenu();
            }
            if (actionName === 'header-history') {
                this.showPage('dashboard-page');
                this.closeHeaderMenu();
            }
            if (actionName === 'header-export') {
                this.exportCurrentTournament();
                this.closeHeaderMenu();
            }
            if (actionName === 'header-import') {
                this.importFileInput.click();
                this.closeHeaderMenu();
            }
            if (actionName === 'header-drive-sync') {
                this.handleDriveSync();
                this.closeHeaderMenu();
            }
            if (actionName === 'header-auto-sync') {
                this.toggleAutoDriveSync();
                this.closeHeaderMenu();
            }
            if (actionName === 'close-match-detail') {
                this.closeMatchDetailModal();
            }
            if (actionName === 'close-next-match-modal') {
                this.closeNextMatchModal();
            }
            if (actionName === 'go-next-match') {
                this.goToPendingNextMatch();
            }
            if (actionName === 'close-drive-sync-choice') {
                this.closeDriveSyncChoiceModal();
            }
            if (actionName === 'drive-sync-upload') {
                this.runDriveSyncAction('upload');
            }
            if (actionName === 'drive-sync-download') {
                this.runDriveSyncAction('download');
            }
            if (actionName === 'pairing-slot') {
                this.selectPairingSlot(Number.parseInt(action.dataset.slotIndex, 10));
            }
            return;
        }

        if (this.isHeaderMenuOpen) {
            this.closeHeaderMenu();
        }

        const completeBtn = event.target.closest('[data-complete-slot]');
        if (completeBtn) {
            this.forceCompleteMatch(completeBtn.dataset.completeSlot);
        }
    }

    showPage(pageId) {
        if (pageId === 'pairing-page' && !this.pendingPairing) {
            pageId = 'setup-page';
        }

        if (pageId === 'arena-page' && !this.getCurrentTournament()) {
            pageId = this.pendingPairing ? 'pairing-page' : 'dashboard-page';
        }

        const prevPage = this.currentPage;
        this.showPageInternal(pageId);

        // 進入不同頁面才 push，同頁面內的狀態更新用 replaceState（由 syncUrlState 處理）
        if (prevPage !== this.currentPage) {
            const params = this.buildUrlParams();
            window.history.pushState({ page: this.currentPage }, '', `${window.location.pathname}?${params.toString()}`);
        }
    }

    showPageInternal(pageId) {
        if (pageId === 'pairing-page' && !this.pendingPairing) {
            pageId = 'setup-page';
        }

        if (pageId === 'arena-page' && !this.getCurrentTournament()) {
            pageId = this.pendingPairing ? 'pairing-page' : 'dashboard-page';
        }

        this.currentPage = pageId;
        this.closeHeaderMenu();
        this.pages.forEach((page) => {
            page.classList.toggle('active', page.id === pageId);
        });

        if (pageId === 'arena-page') {
            const tournament = this.getCurrentTournament();
            if (tournament && !tournament.completed) {
                this.selectFirstUnfinishedMatch(tournament, false);
            } else {
                this.ensureSelectedMatch();
                if (!this.arenaTab) {
                    this.setDefaultArenaTab();
                }
            }
        }

        this.render();

        if (pageId === 'arena-page') {
            const tournament = this.getCurrentTournament();
            if (tournament && !tournament.completed && this.arenaTab === 'recorder') {
                this.focusRecorderPanel();
            }
        }
    }

    setDefaultArenaTab() {
        const tournament = this.getCurrentTournament();
        this.arenaTab = tournament && !tournament.completed ? 'recorder' : 'standings';
        this.updateArenaTabVisibility();
    }

    setArenaTab(tabName) {
        if (!tabName) {
            return;
        }

        this.arenaTab = tabName;
        this.updateArenaTabVisibility();
        this.syncUrlState();
    }

    openSetup() {
        this.clearPendingPairingDraft();
        this.selectedPairingSlotIndex = null;
        this.resetSetupForm();
        this.showPage('setup-page');
    }

    selectFirstUnfinishedMatch(tournament, persist = true) {
        const nextMatchId = this.findFirstUnfinishedMatchId(tournament) || this.findFirstAvailableMatchId(tournament);
        if (!nextMatchId) {
            return;
        }

        this.selectedMatchId = nextMatchId;
        tournament.selectedMatchId = nextMatchId;
        if (persist) {
            this.updateTournament(tournament);
        }
    }

    findFirstUnfinishedMatchId(tournament) {
        for (const round of tournament.bracket) {
            for (const match of round.matches) {
                if (match.status !== 'completed') {
                    return match.id;
                }
            }
        }
        return null;
    }

    updateArenaTabVisibility() {
        const activeTab = this.arenaTab || 'recorder';

        this.mobileArenaTabs.forEach((button) => {
            const isActive = button.dataset.tab === activeTab;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        this.arenaPanels.forEach((panel) => {
            const matches = panel.dataset.arenaPanel === activeTab;
            panel.classList.toggle('arena-panel-active', matches);
            panel.hidden = !matches;
        });
    }

    updateHeaderNavMode() {
        if (!this.headerNav || !this.headerRoot) {
            return;
        }

        const wasCollapsed = this.headerRoot.classList.contains('menu-collapsed');
        if (wasCollapsed) {
            this.headerRoot.classList.remove('menu-collapsed');
        }

        const items = Array.from(this.headerNav.children);
        if (!items.length) {
            return;
        }

        const tops = items.map((item) => Math.round(item.getBoundingClientRect().top));
        const wraps = new Set(tops).size > 1;
        const isNarrow = window.matchMedia('(max-width: 760px)').matches;
        const shouldCollapse = wraps || isNarrow;

        this.headerRoot.classList.toggle('menu-collapsed', shouldCollapse);
        if (!shouldCollapse) {
            this.closeHeaderMenu();
        }
    }

    toggleHeaderMenu() {
        if (!this.headerRoot.classList.contains('menu-collapsed')) {
            return;
        }

        this.isHeaderMenuOpen = !this.isHeaderMenuOpen;
        this.headerRoot.classList.toggle('menu-open', this.isHeaderMenuOpen);
        this.headerMenuBtn.setAttribute('aria-expanded', this.isHeaderMenuOpen ? 'true' : 'false');
        this.headerMenuPanel.hidden = !this.isHeaderMenuOpen;
    }

    closeHeaderMenu() {
        this.isHeaderMenuOpen = false;
        if (this.headerRoot) {
            this.headerRoot.classList.remove('menu-open');
        }
        if (this.headerMenuBtn) {
            this.headerMenuBtn.setAttribute('aria-expanded', 'false');
        }
        if (this.headerMenuPanel) {
            this.headerMenuPanel.hidden = true;
        }
    }

    restorePendingPairingDraft() {
        try {
            const raw = window.sessionStorage.getItem(this.pendingPairingKey);
            this.pendingPairing = raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('讀取配對草稿失敗', error);
            this.pendingPairing = null;
        }
    }

    savePendingPairingDraft() {
        if (!this.pendingPairing) {
            window.sessionStorage.removeItem(this.pendingPairingKey);
            return;
        }

        this.pendingPairing.updatedAt = new Date().toISOString();
        window.sessionStorage.setItem(this.pendingPairingKey, JSON.stringify(this.pendingPairing));
        this.scheduleAutoDriveSync('save-pending-pairing');
    }

    clearPendingPairingDraft() {
        const hadDraft = Boolean(this.pendingPairing);
        this.pendingPairing = null;
        this.selectedPairingSlotIndex = null;
        window.sessionStorage.removeItem(this.pendingPairingKey);
        if (hadDraft) {
            this.scheduleAutoDriveSync('clear-pending-pairing');
        }
    }

    restoreStateFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const page = params.get('page');
        const tournamentId = params.get('tournament');
        const tab = params.get('tab');
        const matchId = params.get('match');
        const validPages = new Set(['dashboard-page', 'setup-page', 'pairing-page', 'arena-page']);
        const validTabs = new Set(['recorder', 'bracket', 'standings', 'completed']);

        if (tournamentId && this.tournaments.some((tournament) => tournament.id === tournamentId)) {
            this.currentTournamentId = tournamentId;
        }

        if (validTabs.has(tab)) {
            this.arenaTab = tab;
        }

        if (matchId) {
            this.selectedMatchId = matchId;
        }

        if (validPages.has(page)) {
            this.currentPage = page;
        }

        if (this.currentPage === 'pairing-page' && !this.pendingPairing) {
            this.currentPage = 'setup-page';
        }

        if (this.currentPage === 'arena-page' && !this.getCurrentTournament()) {
            this.currentPage = this.pendingPairing ? 'pairing-page' : 'dashboard-page';
        }
    }

    buildUrlParams() {
        const params = new URLSearchParams();
        params.set('page', this.currentPage);

        if (this.currentPage === 'arena-page' && this.currentTournamentId) {
            params.set('tournament', this.currentTournamentId);
            params.set('tab', this.arenaTab || 'recorder');
            if (this.selectedMatchId) {
                params.set('match', this.selectedMatchId);
            }
        } else if (this.currentPage === 'dashboard-page' && this.currentTournamentId) {
            params.set('tournament', this.currentTournamentId);
        } else if (this.currentPage === 'pairing-page' && this.pendingPairing) {
            params.set('draft', this.pendingPairing.id);
        }

        return params;
    }

    syncUrlState() {
        const params = this.buildUrlParams();
        const nextUrl = `${window.location.pathname}?${params.toString()}`;
        // 同頁面內細節變更（tab、match）用 replaceState，不新增歷史
        window.history.replaceState({ page: this.currentPage }, '', nextUrl);
    }

    loadTournaments() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            console.warn('讀取戰鬥陀螺賽事資料失敗', error);
            return [];
        }
    }

    saveTournaments() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.tournaments));
        if (this.currentTournamentId) {
            localStorage.setItem(this.currentTournamentKey, this.currentTournamentId);
        } else {
            localStorage.removeItem(this.currentTournamentKey);
        }

        this.scheduleAutoDriveSync('save-tournaments');
    }

    updateDriveSyncToggleLabel() {
        const label = `自動同步：${this.driveAutoSyncEnabled ? '開' : '關'}`;
        if (this.autoSyncBtn) {
            this.autoSyncBtn.textContent = label;
        }

        const menuAutoSyncBtn = document.querySelector('[data-action="header-auto-sync"]');
        if (menuAutoSyncBtn) {
            menuAutoSyncBtn.textContent = label;
        }

        this.updateLastSyncText();
    }

    setDriveSyncStatus(message, tone = 'idle') {
        if (!this.syncStatusText) {
            return;
        }

        this.syncStatusText.textContent = `同步狀態：${message}`;
        this.syncStatusText.classList.remove('is-idle', 'is-running', 'is-success', 'is-warning', 'is-error');
        this.syncStatusText.classList.add(`is-${tone}`);
    }

    getLastDriveSyncAt() {
        return localStorage.getItem(this.driveLastSyncKey) || null;
    }

    setLastDriveSyncAt(value) {
        localStorage.setItem(this.driveLastSyncKey, value);
        this.updateLastSyncText();
    }

    formatRelativeTime(value) {
        if (!value) {
            return '尚未同步';
        }

        const timestamp = new Date(value).getTime();
        if (Number.isNaN(timestamp)) {
            return '尚未同步';
        }

        const diffMs = Date.now() - timestamp;
        if (diffMs < 60_000) {
            return '剛剛';
        }

        const diffMinutes = Math.floor(diffMs / 60_000);
        if (diffMinutes < 60) {
            return `${diffMinutes} 分鐘前`;
        }

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) {
            return `${diffHours} 小時前`;
        }

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} 天前`;
    }

    updateLastSyncText() {
        const label = `上次同步：${this.formatRelativeTime(this.getLastDriveSyncAt())}`;
        this.lastSyncTexts.forEach((element) => {
            element.textContent = label;
        });
    }

    async toggleAutoDriveSync() {
        const nextValue = !this.driveAutoSyncEnabled;

        if (nextValue) {
            const hasConfig = await this.ensureDriveConfig();
            if (!hasConfig) {
                return;
            }
        }

        this.driveAutoSyncEnabled = nextValue;
        localStorage.setItem(this.driveAutoSyncKey, this.driveAutoSyncEnabled ? '1' : '0');
        this.updateDriveSyncToggleLabel();
        this.setDriveSyncStatus(this.driveAutoSyncEnabled ? '自動同步已開啟' : '自動同步已關閉', this.driveAutoSyncEnabled ? 'success' : 'idle');

        if (this.driveAutoSyncEnabled) {
            this.scheduleAutoDriveSync('toggle-enable');
        } else if (this.autoSyncTimer) {
            window.clearTimeout(this.autoSyncTimer);
            this.autoSyncTimer = null;
        }
    }

    scheduleAutoDriveSync(reason) {
        if (!this.driveAutoSyncEnabled) {
            return;
        }

        if (this.autoSyncTimer) {
            window.clearTimeout(this.autoSyncTimer);
        }

        this.setDriveSyncStatus('已排程自動同步', 'running');

        this.autoSyncTimer = window.setTimeout(async () => {
            this.autoSyncTimer = null;
            try {
                this.setDriveSyncStatus('自動同步中', 'running');
                await this.syncWithDrive({ interactive: false, source: `auto:${reason}` });
                this.setDriveSyncStatus('自動同步完成', 'success');
            } catch (error) {
                // 靜默模式若授權失敗，直接略過本次，不打擾使用者。
                console.warn(`自動同步略過（${reason}）：${error.message}`);
                this.setDriveSyncStatus('自動同步略過，等待登入', 'warning');
            }
        }, 1200);
    }

    async loadExternalScript(src) {
        if (document.querySelector(`script[src="${src}"]`)) {
            return;
        }

        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`載入腳本失敗：${src}`));
            document.head.appendChild(script);
        });
    }

    async initGoogleClients() {
        await this.loadExternalScript('https://accounts.google.com/gsi/client');

        if (!this.gisReady) {
            this.driveTokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: this.driveClientId,
                scope: this.driveScopes,
                callback: () => {}
            });
            this.gisReady = true;
        }
    }

    async ensureDriveConfig() {
        return true;
    }

    isDriveTokenValid() {
        return Boolean(this.driveAccessToken) && Date.now() < (this.driveTokenExpiry - 60_000);
    }

    async ensureDriveAccessToken(options = {}) {
        const interactive = options.interactive !== false;

        if (this.isDriveTokenValid()) {
            return this.driveAccessToken;
        }

        await this.initGoogleClients();

        return new Promise((resolve, reject) => {
            this.driveTokenClient.callback = (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                this.driveAccessToken = response.access_token;
                const expiresInMs = Number(response.expires_in || 3600) * 1000;
                this.driveTokenExpiry = Date.now() + expiresInMs;
                sessionStorage.setItem('bbx_vs_drive_access_token', this.driveAccessToken);
                sessionStorage.setItem('bbx_vs_drive_token_expiry', String(this.driveTokenExpiry));

                if (options.redirectToDashboardOnMobile && window.matchMedia('(max-width: 760px)').matches && this.currentPage !== 'dashboard-page') {
                    this.showPage('dashboard-page');
                }

                resolve(this.driveAccessToken);
            };

            if (interactive) {
                this.driveTokenClient.requestAccessToken({ prompt: this.driveAccessToken ? '' : 'consent' });
            } else {
                this.driveTokenClient.requestAccessToken({ prompt: 'none' });
            }
        });
    }

    async driveFetch(url, options = {}) {
        const headers = {
            Authorization: `Bearer ${this.driveAccessToken}`,
            ...(options.headers || {})
        };
        return window.fetch(url, { ...options, headers });
    }

    async findDriveSyncFileId() {
        const query = `name='${this.driveSyncFileName}' and trashed=false and 'appDataFolder' in parents`;
        const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=1&q=${encodeURIComponent(query)}`;
        const response = await this.driveFetch(url);
        if (!response.ok) {
            throw new Error(`Drive list failed (${response.status})`);
        }
        const data = await response.json();
        return data.files?.[0]?.id || null;
    }

    buildLocalSyncPayload() {
        return {
            version: 1,
            syncedAt: new Date().toISOString(),
            currentTournamentId: this.currentTournamentId,
            pendingPairing: this.pendingPairing,
            tournaments: this.tournaments
        };
    }

    getComparableTime(value) {
        const timestamp = new Date(value || 0).getTime();
        return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    getTournamentFreshness(tournament) {
        return Math.max(
            this.getComparableTime(tournament?.updatedAt),
            this.getComparableTime(tournament?.createdAt)
        );
    }

    getDraftFreshness(draft) {
        return Math.max(
            this.getComparableTime(draft?.updatedAt),
            this.getComparableTime(draft?.createdAt)
        );
    }

    mergeTournamentCollections(localTournaments = [], remoteTournaments = []) {
        const mergedMap = new Map();

        const upsert = (tournament) => {
            if (!tournament?.id) {
                return;
            }

            const existing = mergedMap.get(tournament.id);
            if (!existing || this.getTournamentFreshness(tournament) >= this.getTournamentFreshness(existing)) {
                mergedMap.set(tournament.id, tournament);
            }
        };

        localTournaments.forEach(upsert);
        remoteTournaments.forEach(upsert);

        return Array.from(mergedMap.values());
    }

    normalizeSyncPayload(payload) {
        const normalizedTournaments = [...(payload?.tournaments || [])]
            .map((tournament) => ({ ...tournament }))
            .sort((left, right) => String(left.id).localeCompare(String(right.id)));

        return {
            currentTournamentId: payload?.currentTournamentId || null,
            pendingPairing: payload?.pendingPairing || null,
            tournaments: normalizedTournaments
        };
    }

    isSyncPayloadEquivalent(leftPayload, rightPayload) {
        return JSON.stringify(this.normalizeSyncPayload(leftPayload)) === JSON.stringify(this.normalizeSyncPayload(rightPayload));
    }

    mergeSyncPayloads(localPayload, remotePayload) {
        if (!remotePayload) {
            return {
                ...localPayload,
                tournaments: [...localPayload.tournaments]
            };
        }

        const mergedTournaments = this.mergeTournamentCollections(localPayload.tournaments, remotePayload.tournaments);
        const mergedTournamentIds = new Set(mergedTournaments.map((tournament) => tournament.id));

        const localDraftFreshness = this.getDraftFreshness(localPayload.pendingPairing);
        const remoteDraftFreshness = this.getDraftFreshness(remotePayload.pendingPairing);
        const mergedPendingPairing = localDraftFreshness >= remoteDraftFreshness
            ? (localPayload.pendingPairing || remotePayload.pendingPairing || null)
            : (remotePayload.pendingPairing || localPayload.pendingPairing || null);

        const localCurrentId = mergedTournamentIds.has(localPayload.currentTournamentId) ? localPayload.currentTournamentId : null;
        const remoteCurrentId = mergedTournamentIds.has(remotePayload.currentTournamentId) ? remotePayload.currentTournamentId : null;

        let mergedCurrentTournamentId = localCurrentId || remoteCurrentId || null;
        if (localCurrentId && remoteCurrentId && localCurrentId !== remoteCurrentId) {
            const localCurrent = mergedTournaments.find((tournament) => tournament.id === localCurrentId);
            const remoteCurrent = mergedTournaments.find((tournament) => tournament.id === remoteCurrentId);
            mergedCurrentTournamentId = this.getTournamentFreshness(localCurrent) >= this.getTournamentFreshness(remoteCurrent)
                ? localCurrentId
                : remoteCurrentId;
        }

        return {
            version: Math.max(Number(localPayload.version || 1), Number(remotePayload.version || 1)),
            syncedAt: new Date().toISOString(),
            currentTournamentId: mergedCurrentTournamentId,
            pendingPairing: mergedPendingPairing,
            tournaments: mergedTournaments
        };
    }

    applyMergedSyncPayload(payload) {
        this.tournaments = payload.tournaments || [];
        this.currentTournamentId = payload.currentTournamentId || null;
        this.pendingPairing = payload.pendingPairing || null;
        this.selectedMatchId = null;
        this.selectedPairingSlotIndex = null;
        this.saveTournaments();
        this.savePendingPairingDraft();
        this.ensureCurrentTournament();
    }

    navigateAfterSync(payload) {
        // 根據同步後的狀態決定要跳到哪一頁
        let targetPage = 'dashboard-page';

        if (payload.pendingPairing) {
            targetPage = 'pairing-page';
        } else if (payload.currentTournamentId) {
            const tournament = this.tournaments.find((t) => t.id === payload.currentTournamentId);
            if (tournament && !tournament.completed) {
                targetPage = 'arena-page';
            }
        }

        this.showPageInternal(targetPage);
        const params = this.buildUrlParams();
        window.history.replaceState({ page: this.currentPage }, '', `${window.location.pathname}?${params.toString()}`);
    }

    async startupAutoSync() {
        this.setDriveSyncStatus('啟動同步中', 'running');
        try {
            const result = await this.syncWithDrive({
                interactive: false,
                source: 'startup',
                navigateAfterApply: true
            });
            this.setDriveSyncStatus(
                result.localUpdated ? '啟動同步完成，本機已更新' : '啟動同步完成，資料已是最新',
                'success'
            );
        } catch (error) {
            console.warn('啟動同步略過：', error.message);
            this.setDriveSyncStatus('啟動同步略過，等待登入', 'warning');
        }
    }

    async fetchDriveSyncPayload() {
        const fileId = await this.findDriveSyncFileId();
        if (!fileId) {
            return null;
        }

        const response = await this.driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
        if (!response.ok) {
            throw new Error(`下載失敗（${response.status}）`);
        }

        const payload = await response.json();
        if (!payload || !Array.isArray(payload.tournaments)) {
            throw new Error('雲端資料格式不正確。');
        }

        return payload;
    }

    async uploadDriveSyncData(payload = this.buildLocalSyncPayload()) {

        const fileId = await this.findDriveSyncFileId();
        const metadata = fileId
            ? { name: this.driveSyncFileName }
            : { name: this.driveSyncFileName, mimeType: 'application/json', parents: ['appDataFolder'] };

        const boundary = 'bbx_sync_boundary';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;
        const multipartBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(payload) +
            closeDelimiter;

        const uploadUrl = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

        const response = await this.driveFetch(uploadUrl, {
            method: fileId ? 'PATCH' : 'POST',
            headers: {
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
        });

        if (!response.ok) {
            throw new Error(`Drive upload failed (${response.status})`);
        }

        this.setLastDriveSyncAt(new Date().toISOString());
    }

    async syncWithDrive(options = {}) {
        const interactive = options.interactive !== false;
        await this.ensureDriveAccessToken({ interactive, redirectToDashboardOnMobile: options.redirectToDashboardOnMobile });

        const localPayload = this.buildLocalSyncPayload();
        const remotePayload = await this.fetchDriveSyncPayload();
        const mergedPayload = this.mergeSyncPayloads(localPayload, remotePayload);

        const localNeedsUpdate = !this.isSyncPayloadEquivalent(localPayload, mergedPayload);
        const remoteNeedsUpdate = !remotePayload || !this.isSyncPayloadEquivalent(remotePayload, mergedPayload);

        if (localNeedsUpdate) {
            this.applyMergedSyncPayload(mergedPayload);
            if (options.navigateAfterApply) {
                this.navigateAfterSync(mergedPayload);
            }
        }

        if (remoteNeedsUpdate) {
            await this.uploadDriveSyncData(mergedPayload);
        } else {
            this.setLastDriveSyncAt(new Date().toISOString());
        }

        return {
            localUpdated: localNeedsUpdate,
            remoteUpdated: remoteNeedsUpdate,
            mergedPayload
        };
    }

    async handleDriveSync() {
        try {
            const hasConfig = await this.ensureDriveConfig();
            if (!hasConfig) {
                return;
            }

            this.setDriveSyncStatus('手動同步中', 'running');
            const result = await this.syncWithDrive({ interactive: true, redirectToDashboardOnMobile: true, source: 'manual' });
            const messages = [];
            if (result.localUpdated) messages.push('本機已更新');
            if (result.remoteUpdated) messages.push('雲端已更新');
            this.setDriveSyncStatus(messages.length ? messages.join('，') : '資料已是最新', 'success');
            window.alert(messages.length ? `Google Drive 同步完成：${messages.join('，')}` : 'Google Drive 同步完成，資料已是最新。');
        } catch (error) {
            this.setDriveSyncStatus(`同步失敗：${error.message}`, 'error');
            window.alert(`Google Drive 同步失敗：${error.message}`);
        }
    }

    openDriveSyncChoiceModal() {
        if (!this.driveSyncChoiceModal) {
            return;
        }
        this.driveSyncChoiceModal.hidden = false;
    }

    closeDriveSyncChoiceModal() {
        if (!this.driveSyncChoiceModal) {
            return;
        }
        this.driveSyncChoiceModal.hidden = true;
    }

    async runDriveSyncAction(action) {
        try {
            if (action === 'upload') {
                await this.uploadDriveSyncData();
                window.alert('Google Drive 同步上傳完成。');
            } else if (action === 'download') {
                await this.downloadDriveSyncData();
                window.alert('Google Drive 同步下載完成。');
            }
        } catch (error) {
            window.alert(`Google Drive 同步失敗：${error.message}`);
        } finally {
            this.closeDriveSyncChoiceModal();
        }
    }

    ensureCurrentTournament() {
        if (!this.tournaments.length) {
            this.currentTournamentId = null;
            return;
        }

        const current = this.getCurrentTournament();
        if (current) {
            return;
        }

        const liveTournament = this.tournaments.find((tournament) => !tournament.completed);
        this.currentTournamentId = liveTournament ? liveTournament.id : this.tournaments[0].id;
    }

    getCurrentTournament() {
        return this.tournaments.find((tournament) => tournament.id === this.currentTournamentId) || null;
    }

    updateTournament(updatedTournament) {
        const index = this.tournaments.findIndex((tournament) => tournament.id === updatedTournament.id);
        if (index === -1) {
            this.tournaments.unshift(updatedTournament);
        } else {
            this.tournaments[index] = updatedTournament;
        }
        this.currentTournamentId = updatedTournament.id;
        updatedTournament.updatedAt = new Date().toISOString();
        this.saveTournaments();
    }

    handleCreateTournament() {
        const playerNames = this.parsePlayers(this.playersInput.value);
        const uniquePlayers = [...new Set(playerNames)];

        if (uniquePlayers.length < 2) {
            window.alert('至少需要 2 位不重複參賽者。');
            return;
        }

        if (uniquePlayers.length !== playerNames.length) {
            window.alert('參賽者名單不可重複。');
            return;
        }

        const settings = {
            pointsToWin: this.normalizeNumber(this.pointsToWinInput.value, 4, 1, 15),
            scoreValues: {
                spin: this.normalizeNumber(this.scoreInputs.spin.value, this.scoreTypes.spin.defaultPoints, 1, 9),
                ringOut: this.normalizeNumber(this.scoreInputs.ringOut.value, this.scoreTypes.ringOut.defaultPoints, 1, 9),
                burst: this.normalizeNumber(this.scoreInputs.burst.value, this.scoreTypes.burst.defaultPoints, 1, 9),
                xtreme: this.normalizeNumber(this.scoreInputs.xtreme.value, this.scoreTypes.xtreme.defaultPoints, 1, 9)
            }
        };

        this.pendingPairing = this.createPendingPairingDraft({
            name: this.setupName.value.trim() || this.generateDefaultTournamentName(),
            players: uniquePlayers,
            settings
        });
        this.selectedPairingSlotIndex = null;
        this.savePendingPairingDraft();
        this.showPage('pairing-page');
    }

    createPendingPairingDraft({ name, players, settings }) {
        const bracketSize = this.getBracketSize(players.length);
        const draftPlayers = players.map((playerName, index) => ({
            id: this.generateId('draft_player'),
            name: playerName,
            seed: index + 1
        }));

        return {
            id: this.generateId('pairing'),
            name,
            createdAt: new Date().toISOString(),
            settings,
            players: draftPlayers,
            bracketSize,
            slotPlayerIds: this.buildRandomizedSlots(draftPlayers, bracketSize),
            stage: 'review'
        };
    }

    createTournamentData({ name, players, settings, slotPlayerIds = null }) {
        const tournamentPlayers = players.map((player, index) => ({
            id: typeof player === 'string' ? this.generateId('player') : (player.id || this.generateId('player')),
            name: typeof player === 'string' ? player : player.name,
            seed: typeof player === 'string' ? index + 1 : (player.seed || index + 1),
            eliminated: false
        }));

        const bracket = this.buildBracket(tournamentPlayers, settings.pointsToWin, slotPlayerIds);
        const tournament = {
            id: this.generateId('bbx'),
            name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completed: false,
            winnerId: null,
            currentRound: 1,
            activeMatchId: null,
            selectedMatchId: null,
            players: tournamentPlayers,
            settings,
            bracket,
            notes: {
                playoffEnabled: false
            }
        };

        this.resolveBracketProgression(tournament);
        return tournament;
    }

    buildBracket(players, pointsToWin, slotPlayerIds = null) {
        const totalRounds = Math.ceil(Math.log2(players.length));
        const bracketSize = 2 ** totalRounds;
        const slotMap = new Map(players.map((player) => [player.id, player]));
        const slots = slotPlayerIds
            ? slotPlayerIds.map((playerId) => (playerId ? slotMap.get(playerId) || null : null))
            : this.getSeedOrder(bracketSize).map((seedNumber) => players[seedNumber - 1] || null);
        const bracket = [];

        for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber += 1) {
            const matchesInRound = bracketSize / (2 ** roundNumber);
            const matches = [];

            for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex += 1) {
                let player1Id = null;
                let player2Id = null;
                let status = 'waiting';
                let winnerId = null;
                let log = [];
                let score1 = 0;
                let score2 = 0;
                let resultType = null;

                if (roundNumber === 1) {
                    player1Id = slots[matchIndex * 2]?.id || null;
                    player2Id = slots[(matchIndex * 2) + 1]?.id || null;

                    if (player1Id && player2Id) {
                        status = 'pending';
                    } else if (player1Id || player2Id) {
                        status = 'completed';
                        winnerId = player1Id || player2Id;
                        resultType = 'bye';
                    }
                }

                matches.push({
                    id: this.generateId(`match_r${roundNumber}`),
                    roundNumber,
                    matchNumber: matchIndex + 1,
                    player1Id,
                    player2Id,
                    score1,
                    score2,
                    targetPoints: pointsToWin,
                    status,
                    winnerId,
                    resultType,
                    completedAt: status === 'completed' ? new Date().toISOString() : null,
                    log
                });
            }

            bracket.push({
                roundNumber,
                roundLabel: this.getRoundLabel(totalRounds, roundNumber),
                matches
            });
        }

        return bracket;
    }

    getBracketSize(playerCount) {
        return 2 ** Math.ceil(Math.log2(playerCount));
    }

    buildRandomizedSlots(players, bracketSize) {
        const pool = [...players.map((player) => player.id), ...Array.from({ length: bracketSize - players.length }, () => null)];
        const byes = pool.filter((item) => item === null).length;
        const participantIds = this.shuffleArray(pool.filter((item) => item !== null));
        const totalMatches = bracketSize / 2;

        const byeMatchIndices = this.shuffleArray(Array.from({ length: totalMatches }, (_, index) => index)).slice(0, byes);
        const byeMatchSet = new Set(byeMatchIndices);

        const slots = new Array(bracketSize).fill(null);
        let participantCursor = 0;

        for (let matchIndex = 0; matchIndex < totalMatches; matchIndex += 1) {
            const leftSlot = matchIndex * 2;
            const rightSlot = leftSlot + 1;
            if (byeMatchSet.has(matchIndex)) {
                const byeOnLeft = Math.random() < 0.5;
                if (byeOnLeft) {
                    slots[leftSlot] = null;
                    slots[rightSlot] = participantIds[participantCursor] || null;
                } else {
                    slots[leftSlot] = participantIds[participantCursor] || null;
                    slots[rightSlot] = null;
                }
                participantCursor += 1;
                continue;
            }

            slots[leftSlot] = participantIds[participantCursor] || null;
            slots[rightSlot] = participantIds[participantCursor + 1] || null;
            participantCursor += 2;
        }

        return slots;
    }

    shuffleArray(items) {
        const cloned = [...items];
        for (let index = cloned.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [cloned[index], cloned[randomIndex]] = [cloned[randomIndex], cloned[index]];
        }
        return cloned;
    }

    getSeedOrder(size) {
        let seeds = [1, 2];
        while (seeds.length < size) {
            const next = [];
            const sum = (seeds.length * 2) + 1;
            seeds.forEach((seed) => {
                next.push(seed);
                next.push(sum - seed);
            });
            seeds = next;
        }
        return seeds;
    }

    getRoundLabel(totalRounds, roundNumber) {
        const remaining = 2 ** (totalRounds - roundNumber + 1);
        if (remaining === 2) return '冠軍戰';
        if (remaining === 4) return '準決賽';
        if (remaining === 8) return '8 強';
        if (remaining === 16) return '16 強';
        return `第 ${roundNumber} 輪`;
    }

    resolveBracketProgression(tournament) {
        tournament.bracket.forEach((round, roundIndex) => {
            round.matches.forEach((match, matchIndex) => {
                if (match.status === 'completed' && match.winnerId) {
                    this.propagateWinner(tournament, roundIndex, matchIndex, match.winnerId);
                }
            });
        });

        this.promoteNextAvailableMatch(tournament);
        tournament.currentRound = this.findCurrentRoundNumber(tournament);
        tournament.selectedMatchId = tournament.activeMatchId || this.findFirstAvailableMatchId(tournament);
    }

    findCurrentRoundNumber(tournament) {
        const activeRound = tournament.bracket.find((round) => round.matches.some((match) => ['active', 'pending'].includes(match.status)));
        if (activeRound) {
            return activeRound.roundNumber;
        }

        const completedRounds = tournament.bracket.filter((round) => round.matches.every((match) => match.status === 'completed'));
        return completedRounds.length || 1;
    }

    findFirstAvailableMatchId(tournament) {
        for (const round of tournament.bracket) {
            const match = round.matches.find((item) => ['active', 'pending', 'completed'].includes(item.status));
            if (match) {
                return match.id;
            }
        }
        return null;
    }

    promoteNextAvailableMatch(tournament) {
        let activeMatch = this.findMatchByStatus(tournament, 'active');
        if (activeMatch) {
            tournament.activeMatchId = activeMatch.id;
            return;
        }

        const nextPending = this.findMatchByStatus(tournament, 'pending');
        if (nextPending) {
            nextPending.status = 'active';
            tournament.activeMatchId = nextPending.id;
            return;
        }

        tournament.activeMatchId = null;
        const finalRound = tournament.bracket[tournament.bracket.length - 1];
        const finalMatch = finalRound?.matches[0];
        if (finalMatch?.winnerId) {
            tournament.completed = true;
            tournament.winnerId = finalMatch.winnerId;
        }
    }

    findMatchByStatus(tournament, status) {
        for (const round of tournament.bracket) {
            const match = round.matches.find((item) => item.status === status);
            if (match) {
                return match;
            }
        }
        return null;
    }

    propagateWinner(tournament, roundIndex, matchIndex, winnerId) {
        const currentRound = tournament.bracket[roundIndex];
        const currentMatch = currentRound.matches[matchIndex];
        currentMatch.winnerId = winnerId;

        const winnerPlayer = this.getPlayerById(tournament, winnerId);
        if (winnerPlayer) {
            winnerPlayer.eliminated = false;
        }

        const loserId = currentMatch.player1Id === winnerId ? currentMatch.player2Id : currentMatch.player1Id;
        if (loserId) {
            const loser = this.getPlayerById(tournament, loserId);
            if (loser) {
                loser.eliminated = true;
            }
        }

        if (roundIndex === tournament.bracket.length - 1) {
            tournament.completed = true;
            tournament.winnerId = winnerId;
            tournament.activeMatchId = null;
            return;
        }

        const nextRound = tournament.bracket[roundIndex + 1];
        const nextMatchIndex = Math.floor(matchIndex / 2);
        const nextMatch = nextRound.matches[nextMatchIndex];
        const targetSlot = matchIndex % 2 === 0 ? 'player1Id' : 'player2Id';

        nextMatch[targetSlot] = winnerId;
        if (nextMatch.player1Id && nextMatch.player2Id && nextMatch.status === 'waiting') {
            nextMatch.status = 'pending';
        }
    }

    openTournament(tournamentId) {
        const tournament = this.tournaments.find((item) => item.id === tournamentId);
        if (!tournament) {
            return;
        }

        this.currentTournamentId = tournamentId;
        this.arenaTab = tournament.completed ? 'standings' : 'recorder';
        this.selectedMatchId = tournament.selectedMatchId || tournament.activeMatchId || this.findFirstAvailableMatchId(tournament);
        this.saveTournaments();
        this.showPage('arena-page');
    }

    deleteTournament(tournamentId) {
        const tournament = this.tournaments.find((item) => item.id === tournamentId);
        if (!tournament) {
            return;
        }

        const confirmed = window.confirm(`確定刪除賽事「${tournament.name}」？此操作無法復原。`);
        if (!confirmed) {
            return;
        }

        this.tournaments = this.tournaments.filter((item) => item.id !== tournamentId);
        if (this.currentTournamentId === tournamentId) {
            this.currentTournamentId = null;
            this.selectedMatchId = null;
            this.ensureCurrentTournament();
        }
        this.saveTournaments();
        this.render();
    }

    selectMatch(matchId) {
        const tournament = this.getCurrentTournament();
        if (!tournament) {
            return;
        }

        const selected = this.findMatch(tournament, matchId);
        if (!selected) {
            return;
        }

        if (selected.match.status === 'waiting') {
            return;
        }

        if (selected.match.status === 'completed') {
            this.openMatchDetailModal(tournament, selected.match);
            return;
        }

        this.selectedMatchId = matchId;
        tournament.selectedMatchId = matchId;
        this.updateTournament(tournament);
        this.render();

        if (this.arenaTab === 'bracket') {
            if (this.autoSwitchTimer) {
                window.clearTimeout(this.autoSwitchTimer);
            }
            this.autoSwitchTimer = window.setTimeout(() => {
                this.setArenaTab('recorder');
                this.focusRecorderPanel();
                this.autoSwitchTimer = null;
            }, 500);
        }
    }

    ensureSelectedMatch() {
        const tournament = this.getCurrentTournament();
        if (!tournament) {
            this.selectedMatchId = null;
            return;
        }

        const preferred = this.selectedMatchId || tournament.selectedMatchId || tournament.activeMatchId;
        const selected = preferred ? this.findMatch(tournament, preferred) : null;
        if (selected && selected.match.status !== 'waiting') {
            this.selectedMatchId = selected.match.id;
            return;
        }

        this.selectedMatchId = tournament.activeMatchId || this.findFirstAvailableMatchId(tournament);
        tournament.selectedMatchId = this.selectedMatchId;
        this.updateTournament(tournament);
    }

    applyScore(slot, scoreType) {
        const tournament = this.getCurrentTournament();
        if (!tournament || tournament.completed) {
            return;
        }

        const selected = this.findMatch(tournament, this.selectedMatchId);
        if (!selected) {
            return;
        }

        const { match } = selected;
        if (!['active', 'pending'].includes(match.status)) {
            return;
        }

        const playerId = slot === 'player1' ? match.player1Id : match.player2Id;
        if (!playerId) {
            return;
        }

        if (match.status === 'pending') {
            match.status = 'active';
            tournament.activeMatchId = match.id;
        }

        const points = tournament.settings.scoreValues[scoreType];
        const playerName = this.getPlayerName(tournament, playerId);

        match.log.push({
            turn: match.log.length + 1,
            playerId,
            playerName,
            slot,
            scoreType,
            label: this.scoreTypes[scoreType].label,
            points,
            recordedAt: new Date().toISOString()
        });

        if (slot === 'player1') {
            match.score1 += points;
        } else {
            match.score2 += points;
        }

        if (match.score1 >= match.targetPoints || match.score2 >= match.targetPoints) {
            const winnerSlot = match.score1 >= match.targetPoints ? 'player1' : 'player2';
            this.completeMatch(tournament, selected.roundIndex, selected.matchIndex, winnerSlot, scoreType);
        }

        tournament.selectedMatchId = match.id;
        this.updateTournament(tournament);
        this.render();
    }

    forceCompleteMatch(slot) {
        const tournament = this.getCurrentTournament();
        if (!tournament || tournament.completed) {
            return;
        }

        const selected = this.findMatch(tournament, this.selectedMatchId);
        if (!selected || !selected.match[`${slot}Id`]) {
            return;
        }

        this.completeMatch(tournament, selected.roundIndex, selected.matchIndex, slot, 'manual');
        this.updateTournament(tournament);
        this.render();
    }

    completeMatch(tournament, roundIndex, matchIndex, winnerSlot, resultType) {
        const match = tournament.bracket[roundIndex].matches[matchIndex];
        const winnerId = match[`${winnerSlot}Id`];
        if (!winnerId) {
            return;
        }

        match.status = 'completed';
        match.winnerId = winnerId;
        match.resultType = resultType;
        match.completedAt = new Date().toISOString();

        if (tournament.activeMatchId === match.id) {
            tournament.activeMatchId = null;
        }

        this.propagateWinner(tournament, roundIndex, matchIndex, winnerId);
        this.promoteNextAvailableMatch(tournament);
        tournament.currentRound = this.findCurrentRoundNumber(tournament);
        this.pendingNextMatchId = tournament.activeMatchId || null;
        tournament.selectedMatchId = match.id;
        this.selectedMatchId = match.id;
        this.openNextMatchModal(tournament, match, this.pendingNextMatchId);
    }

    undoLastScore() {
        const tournament = this.getCurrentTournament();
        if (!tournament) {
            return;
        }

        const selected = this.findMatch(tournament, this.selectedMatchId);
        if (!selected) {
            return;
        }

        const { match } = selected;
        if (match.status === 'completed' || !match.log.length) {
            return;
        }

        const lastEvent = match.log.pop();
        if (lastEvent.slot === 'player1') {
            match.score1 = Math.max(0, match.score1 - lastEvent.points);
        } else {
            match.score2 = Math.max(0, match.score2 - lastEvent.points);
        }

        if (!match.log.length) {
            match.status = 'active';
        }

        this.updateTournament(tournament);
        this.render();
    }

    resetSelectedMatch() {
        const tournament = this.getCurrentTournament();
        if (!tournament) {
            return;
        }

        const selected = this.findMatch(tournament, this.selectedMatchId);
        if (!selected) {
            return;
        }

        const { match } = selected;
        if (match.status === 'completed') {
            window.alert('已完成的對戰無法直接重置。若需要更改，請先告訴我要怎麼處理回溯流程。');
            return;
        }

        match.score1 = 0;
        match.score2 = 0;
        match.log = [];
        match.status = match.player1Id && match.player2Id ? 'active' : 'waiting';
        tournament.activeMatchId = match.id;
        this.updateTournament(tournament);
        this.render();
    }

    findMatch(tournament, matchId) {
        for (let roundIndex = 0; roundIndex < tournament.bracket.length; roundIndex += 1) {
            const matchIndex = tournament.bracket[roundIndex].matches.findIndex((match) => match.id === matchId);
            if (matchIndex !== -1) {
                return {
                    roundIndex,
                    matchIndex,
                    match: tournament.bracket[roundIndex].matches[matchIndex]
                };
            }
        }
        return null;
    }

    getPlayerById(tournament, playerId) {
        return tournament.players.find((player) => player.id === playerId) || null;
    }

    getPlayerName(tournament, playerId) {
        return this.getPlayerById(tournament, playerId)?.name || 'BYE';
    }

    getSourceMatchForSlot(tournament, match, slot) {
        const roundIndex = (match.roundNumber || 1) - 1;
        if (roundIndex <= 0) {
            return null;
        }

        const currentRound = tournament.bracket[roundIndex];
        const prevRound = tournament.bracket[roundIndex - 1];
        if (!currentRound || !prevRound) {
            return null;
        }

        const matchIndex = currentRound.matches.findIndex((item) => item.id === match.id);
        if (matchIndex === -1) {
            return null;
        }

        const sourceIndex = slot === 'player1' ? matchIndex * 2 : (matchIndex * 2) + 1;
        return prevRound.matches[sourceIndex] || null;
    }

    getMatchSlotDisplay(tournament, match, slot) {
        const playerId = slot === 'player1' ? match.player1Id : match.player2Id;
        const otherPlayerId = slot === 'player1' ? match.player2Id : match.player1Id;
        const player = playerId ? this.getPlayerById(tournament, playerId) : null;

        if (player) {
            const score = slot === 'player1' ? match.score1 : match.score2;
            return {
                name: player.name,
                meta: `選手 ${player.seed} / ${score} 分`,
                isBye: false
            };
        }

        // 只有首輪且單邊已有選手時，才視為 BYE/輪空。
        if (match.roundNumber === 1 && otherPlayerId) {
            return {
                name: 'BYE/輪空',
                meta: '自動晉級位',
                isBye: true
            };
        }

        if (match.roundNumber > 1) {
            const sourceMatch = this.getSourceMatchForSlot(tournament, match, slot);
            if (sourceMatch) {
                return {
                    name: `第${sourceMatch.roundNumber}輪 對戰${sourceMatch.matchNumber} 勝者`,
                    meta: '待定',
                    isBye: false
                };
            }
        }

        return {
            name: '待定',
            meta: '-',
            isBye: false
        };
    }

    getMatchParticipantName(tournament, match, slot) {
        return this.getMatchSlotDisplay(tournament, match, slot).name;
    }

    focusRecorderPanel() {
        if (!this.recorderPanel) {
            return;
        }

        if (this.recorderFocusTimer) {
            window.clearTimeout(this.recorderFocusTimer);
        }

        this.recorderPanel.classList.remove('focus-recorder-panel');
        const targetTop = Math.max(window.scrollY + this.recorderPanel.getBoundingClientRect().top, 0);
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
        void this.recorderPanel.offsetWidth;
        this.recorderPanel.classList.add('focus-recorder-panel');
        this.recorderFocusTimer = window.setTimeout(() => {
            this.recorderPanel.classList.remove('focus-recorder-panel');
            this.recorderFocusTimer = null;
        }, 650);
    }

    openMatchDetailModal(tournament, match) {
        if (!this.matchDetailModal || !this.matchDetailContent) {
            return;
        }

        this.matchDetailContent.innerHTML = this.renderMatchDetailContent(tournament, match);
        this.matchDetailModal.hidden = false;
    }

    closeMatchDetailModal() {
        if (!this.matchDetailModal) {
            return;
        }
        this.matchDetailModal.hidden = true;
    }

    openNextMatchModal(tournament, completedMatch, nextMatchId) {
        if (!this.nextMatchModal || !this.nextMatchContent) {
            return;
        }

        const nextMatch = nextMatchId ? this.findMatch(tournament, nextMatchId)?.match || null : null;
        this.nextMatchContent.innerHTML = this.renderNextMatchPrompt(tournament, completedMatch, nextMatch);
        this.nextMatchModal.hidden = false;
    }

    closeNextMatchModal() {
        if (!this.nextMatchModal) {
            return;
        }
        this.nextMatchModal.hidden = true;
        this.pendingNextMatchId = null;
    }

    goToPendingNextMatch() {
        const tournament = this.getCurrentTournament();
        if (!tournament || !this.pendingNextMatchId) {
            this.closeNextMatchModal();
            return;
        }

        const nextMatch = this.findMatch(tournament, this.pendingNextMatchId);
        if (!nextMatch) {
            this.closeNextMatchModal();
            return;
        }

        this.selectedMatchId = nextMatch.match.id;
        tournament.selectedMatchId = nextMatch.match.id;
        this.updateTournament(tournament);
        this.closeNextMatchModal();
        this.setArenaTab('recorder');
        this.render();
        this.focusRecorderPanel();
    }

    renderNextMatchPrompt(tournament, completedMatch, nextMatch) {
        const completedRoundLabel = tournament.bracket[completedMatch.roundNumber - 1]?.roundLabel || `第 ${completedMatch.roundNumber} 輪`;
        if (!nextMatch) {
            return `
                <div class="next-match-summary">
                    <p class="next-match-copy">${this.escapeHtml(completedRoundLabel)} 已完成，目前沒有下一場可直接記錄。</p>
                    <div class="history-meta-row">
                        <span class="history-meta">最終比分 ${completedMatch.score1} : ${completedMatch.score2}</span>
                    </div>
                    <div class="next-match-actions">
                        <button class="btn btn-primary" data-action="close-next-match-modal">知道了</button>
                    </div>
                </div>
            `;
        }

        const nextRoundLabel = tournament.bracket[nextMatch.roundNumber - 1]?.roundLabel || `第 ${nextMatch.roundNumber} 輪`;
        return `
            <div class="next-match-summary">
                <p class="next-match-copy">此場對戰已完成，是否接著記錄下一場？</p>
                <div class="match-detail-summary">
                    <div class="match-detail-scorecard">
                        <span>${this.escapeHtml(this.getMatchParticipantName(tournament, nextMatch, 'player1'))}</span>
                        <strong>${nextMatch.score1}</strong>
                    </div>
                    <div class="match-detail-score-separator">vs</div>
                    <div class="match-detail-scorecard">
                        <span>${this.escapeHtml(this.getMatchParticipantName(tournament, nextMatch, 'player2'))}</span>
                        <strong>${nextMatch.score2}</strong>
                    </div>
                </div>
                <div class="history-meta-row">
                    <span class="history-meta">下一場：第 ${nextMatch.roundNumber} 輪（${this.escapeHtml(nextRoundLabel)}）</span>
                    <span class="history-meta">對戰 ${nextMatch.matchNumber}</span>
                    <span class="history-meta">先 ${nextMatch.targetPoints} 分</span>
                </div>
                <div class="next-match-actions">
                    <button class="btn btn-secondary" data-action="close-next-match-modal">稍後再記</button>
                    <button class="btn btn-primary" data-action="go-next-match">前往下一場</button>
                </div>
            </div>
        `;
    }

    renderMatchDetailContent(tournament, match) {
        const roundLabel = tournament.bracket[match.roundNumber - 1]?.roundLabel || `第 ${match.roundNumber} 輪`;
        return `
            <div class="match-detail-summary">
                <div class="match-detail-scorecard">
                    <span>${this.escapeHtml(this.getMatchParticipantName(tournament, match, 'player1'))}</span>
                    <strong>${match.score1}</strong>
                </div>
                <div class="match-detail-score-separator">vs</div>
                <div class="match-detail-scorecard">
                    <span>${this.escapeHtml(this.getMatchParticipantName(tournament, match, 'player2'))}</span>
                    <strong>${match.score2}</strong>
                </div>
            </div>
            <div class="history-meta-row">
                <span class="history-meta">第 ${match.roundNumber} 輪（${this.escapeHtml(roundLabel)}）</span>
                <span class="history-meta">先 ${match.targetPoints} 分</span>
                <span class="history-meta">狀態：${match.status === 'completed' ? '已完成' : '未完成'}</span>
            </div>
            <div class="match-log modal-match-log">
                ${match.log.length ? match.log.map((entry) => this.renderTimelineItem(entry)).join('') : '<div class="empty-note">此對戰尚未有得分紀錄。</div>'}
            </div>
        `;
    }

    resetSetupForm() {
        this.setupName.value = '';
        this.playersInput.value = '';
        this.pointsToWinInput.value = '4';
        this.scoreInputs.spin.value = '1';
        this.scoreInputs.ringOut.value = '2';
        this.scoreInputs.burst.value = '2';
        this.scoreInputs.xtreme.value = '3';
    }

    render() {
        this.updateDriveSyncToggleLabel();
        this.renderDashboard();
        this.renderPairingPage();
        this.renderArena();
        this.updateHeaderNavMode();
        this.syncUrlState();
    }

    renderDashboard() {
        const tournaments = [...this.tournaments].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        const current = this.getCurrentTournament();
        const activeCount = tournaments.filter((tournament) => !tournament.completed).length;

        this.metricTotal.textContent = String(tournaments.length);
        this.metricActive.textContent = String(activeCount);
        this.metricCompleted.textContent = String(tournaments.filter((tournament) => tournament.completed).length);

        this.currentTournamentCard.className = current
            ? `status-card ${current.completed ? 'status-finished' : 'status-live'}`
            : 'status-card status-idle';
        this.currentTournamentCard.innerHTML = current ? this.renderCurrentTournamentMarkup(current) : this.renderIdleCurrentMarkup();

        if (!tournaments.length) {
            this.historyList.innerHTML = '<div class="empty-history">尚未有任何戰鬥陀螺賽事記錄。</div>';
            return;
        }

        this.historyList.innerHTML = tournaments.map((tournament) => this.renderHistoryCard(tournament)).join('');
    }

    renderPairingPage() {
        if (!this.pairingReview || !this.pairingGrid || !this.pairingSelectionHint) {
            return;
        }

        const draft = this.pendingPairing;
        if (!draft) {
            this.pairingGrid.innerHTML = '<div class="empty-history">尚未建立配對草稿，請先回到上一頁建立賽事。</div>';
            this.pairingSelectionHint.textContent = '請先建立賽事';
            return;
        }

        const roundCount = Math.ceil(Math.log2(draft.players.length));
        const totalMatches = draft.slotPlayerIds.length / 2;
        const byeCount = draft.slotPlayerIds.filter((id) => !id).length;
        if (this.pairingMetaStrip) {
            this.pairingMetaStrip.innerHTML = [
                { label: '賽事', value: draft.name, tone: 'chip-neutral' },
                { label: '參賽人數', value: `${draft.players.length} 人`, tone: 'chip-neutral' },
                { label: '預估輪數', value: `${roundCount} 輪`, tone: 'chip-neutral' },
                { label: '首輪對戰', value: `${totalMatches - byeCount} 場${byeCount ? ` +${byeCount} 輪空` : ''}`, tone: 'chip-neutral' },
                { label: '勝利門檻', value: `先取 ${draft.settings.pointsToWin} 分`, tone: 'chip-rule' },
                { label: '旋轉', value: `${draft.settings.scoreValues.spin} 分`, tone: 'chip-score' },
                { label: '擊飛', value: `${draft.settings.scoreValues.ringOut} 分`, tone: 'chip-score' },
                { label: '爆裂', value: `${draft.settings.scoreValues.burst} 分`, tone: 'chip-score' },
                { label: '極限', value: `${draft.settings.scoreValues.xtreme} 分`, tone: 'chip-score' },
            ].map(({ label, value, tone }) => `<span class="arena-meta-chip ${tone}">${label}：${this.escapeHtml(value)}</span>`).join('');
        }

        this.pairingTitle.textContent = `${draft.name} — 首輪配對`;
        this.pairingSubtitle.textContent = `共 ${draft.players.length} 位參賽者，確認配對後即可開賽。`;
        this.pairingSelectionHint.textContent = this.selectedPairingSlotIndex === null
            ? '點選任兩位選手即可交換位置'
            : '已選定第一位選手，再點另一位即可完成交換';
        this.pairingGrid.innerHTML = this.renderPairingGrid(draft);
    }

    renderPairingGrid(draft) {
        const rounds = [];
        for (let index = 0; index < draft.slotPlayerIds.length; index += 2) {
            rounds.push({
                matchNumber: (index / 2) + 1,
                slotIndexes: [index, index + 1]
            });
        }

        return rounds.map((item) => `
            <article class="pairing-card">
                <div class="pairing-card-head">
                    <h4>首輪對戰 ${item.matchNumber}</h4>
                    <span class="match-status-pill pill-pending">待確認</span>
                </div>
                <div class="pairing-slot-list">
                    ${item.slotIndexes.map((slotIndex) => this.renderPairingSlot(draft, slotIndex)).join('')}
                </div>
            </article>
        `).join('');
    }

    renderPairingSlot(draft, slotIndex) {
        const playerId = draft.slotPlayerIds[slotIndex] || null;
        const player = playerId ? draft.players.find((entry) => entry.id === playerId) || null : null;
        const isSelected = this.selectedPairingSlotIndex === slotIndex;
        const isBye = !player;

        return `
            <button
                type="button"
                class="pairing-slot-btn ${isSelected ? 'is-selected' : ''} ${isBye ? 'is-empty' : ''}"
                data-action="pairing-slot"
                data-slot-index="${slotIndex}"
            >
                <span class="pairing-slot-top">${player ? this.escapeHtml(player.name) : 'BYE/輪空'}</span>
                <span class="pairing-slot-bottom">${player ? `選手 ${player.seed}` : '可與任一選手交換'}</span>
            </button>
        `;
    }

    selectPairingSlot(slotIndex) {
        const draft = this.pendingPairing;
        if (!draft || Number.isNaN(slotIndex) || slotIndex < 0 || slotIndex >= draft.slotPlayerIds.length) {
            return;
        }

        if (this.selectedPairingSlotIndex === null) {
            this.selectedPairingSlotIndex = slotIndex;
            this.render();
            return;
        }

        if (this.selectedPairingSlotIndex === slotIndex) {
            this.selectedPairingSlotIndex = null;
            this.render();
            return;
        }

        const firstIndex = this.selectedPairingSlotIndex;
        [draft.slotPlayerIds[firstIndex], draft.slotPlayerIds[slotIndex]] = [draft.slotPlayerIds[slotIndex], draft.slotPlayerIds[firstIndex]];
        this.selectedPairingSlotIndex = null;
        this.savePendingPairingDraft();
        this.render();
    }

    rerollPendingPairings() {
        if (!this.pendingPairing) {
            return;
        }

        this.pendingPairing.slotPlayerIds = this.buildRandomizedSlots(this.pendingPairing.players, this.pendingPairing.bracketSize);
        this.selectedPairingSlotIndex = null;
        this.savePendingPairingDraft();
        this.render();
    }

    returnToSetupFromPairing() {
        if (this.pendingPairing) {
            this.setupName.value = this.pendingPairing.name;
            this.playersInput.value = this.pendingPairing.players.map((player) => player.name).join('\n');
            this.pointsToWinInput.value = String(this.pendingPairing.settings.pointsToWin);
            this.scoreInputs.spin.value = String(this.pendingPairing.settings.scoreValues.spin);
            this.scoreInputs.ringOut.value = String(this.pendingPairing.settings.scoreValues.ringOut);
            this.scoreInputs.burst.value = String(this.pendingPairing.settings.scoreValues.burst);
            this.scoreInputs.xtreme.value = String(this.pendingPairing.settings.scoreValues.xtreme);
        }
        this.showPage('setup-page');
    }

    confirmPendingPairings() {
        if (!this.pendingPairing) {
            return;
        }

        const tournament = this.createTournamentData({
            name: this.pendingPairing.name,
            players: this.pendingPairing.players,
            settings: this.pendingPairing.settings,
            slotPlayerIds: this.pendingPairing.slotPlayerIds
        });

        this.updateTournament(tournament);
        this.selectedMatchId = tournament.activeMatchId;
        this.arenaTab = 'recorder';
        this.clearPendingPairingDraft();
        this.resetSetupForm();
        this.showPage('arena-page');
    }

    renderCurrentTournamentMarkup(tournament) {
        const winner = tournament.winnerId ? this.getPlayerName(tournament, tournament.winnerId) : '尚未決出';
        const statusClass = tournament.completed ? 'status-finished' : 'status-live';
        const statusText = tournament.completed ? '已完成賽事' : `進行中，第 ${tournament.currentRound} 輪`;
        return `
            <div class="status-visual">
                <span class="status-orb"></span>
            </div>
            <div class="status-copy">
                <p class="status-title">${this.escapeHtml(tournament.name)}</p>
                <p class="status-desc">${statusText}，${tournament.players.length} 位參賽者，勝利門檻 ${tournament.settings.pointsToWin} 分，冠軍：${this.escapeHtml(winner)}</p>
            </div>
            <div class="status-actions">
                <button class="btn btn-primary" data-action="resume" data-id="${tournament.id}">進入記分</button>
                <button class="btn btn-secondary" data-action="delete" data-id="${tournament.id}">刪除賽事</button>
            </div>
        `;
    }

    renderIdleCurrentMarkup() {
        return `
            <div class="status-visual">
                <span class="status-orb"></span>
            </div>
            <div class="status-copy">
                <p class="status-title">尚未建立賽事</p>
                <p class="status-desc">建立賽事後，系統會自動產生單淘汰賽程並持續保存記錄。</p>
            </div>
            <div class="status-actions">
                <button class="btn btn-primary" data-action="create">建立賽事</button>
            </div>
        `;
    }

    renderHistoryCard(tournament) {
        const winner = tournament.winnerId ? this.getPlayerName(tournament, tournament.winnerId) : '待決';
        const badgeClass = tournament.completed ? 'badge-finished' : 'badge-live';
        const badgeText = tournament.completed ? 'Finished' : 'Live';
        return `
            <article class="history-card">
                <div>
                    <div class="history-head">
                        <h4 class="history-title">${this.escapeHtml(tournament.name)}</h4>
                        <span class="history-badge ${badgeClass}">${badgeText}</span>
                    </div>
                    <div class="history-meta-row">
                        <span class="history-meta">${this.formatDate(tournament.updatedAt)}</span>
                        <span class="history-meta">${tournament.players.length} 人</span>
                        <span class="history-meta">先 ${tournament.settings.pointsToWin} 分</span>
                        <span class="history-meta">冠軍：${this.escapeHtml(winner)}</span>
                    </div>
                </div>
                <div class="history-actions">
                    <button class="btn btn-primary" data-action="resume" data-id="${tournament.id}">${tournament.completed ? '查看賽事' : '繼續記分'}</button>
                    <button class="btn btn-secondary" data-action="delete" data-id="${tournament.id}">刪除</button>
                </div>
            </article>
        `;
    }

    renderArena() {
        const tournament = this.getCurrentTournament();
        if (!tournament) {
            this.arenaTitle.textContent = '賽事中控台';
            if (this.arenaRoundBadge) {
                this.arenaRoundBadge.hidden = true;
            }
            this.arenaSubtitle.textContent = '尚未建立賽事。';
            this.arenaSummary.innerHTML = '';
            this.standingsTitle.textContent = '即時戰績表';
            this.standingsBody.innerHTML = '<tr><td colspan="8">建立賽事後，這裡會顯示所有玩家的勝敗狀況與排名。</td></tr>';
            this.standingsNote.textContent = '即時戰績會顯示每位玩家的勝場、待賽場次與淘汰狀態。';
            this.bracketRounds.innerHTML = '<div class="empty-note">建立賽事後，這裡會顯示單淘汰賽程。</div>';
            this.matchTitle.textContent = '尚未選擇對戰';
            this.matchRecorder.innerHTML = '<p>建立或載入賽事後，請從左側選擇可記錄的對戰。</p>';
            this.completedMatches.innerHTML = '<div class="empty-history">目前沒有已完成對戰。</div>';
            this.updateArenaTabVisibility();
            return;
        }

        this.ensureSelectedMatch();
        const selected = this.findMatch(tournament, this.selectedMatchId);
        this.arenaTitle.textContent = tournament.name;
        if (this.arenaRoundBadge) {
            this.arenaRoundBadge.hidden = false;
            this.arenaRoundBadge.textContent = tournament.completed ? '已完成' : `第 ${tournament.currentRound} 輪`;
            this.arenaRoundBadge.classList.toggle('is-finished', tournament.completed);
        }
        this.arenaSubtitle.textContent = tournament.completed
            ? `冠軍：${this.getPlayerName(tournament, tournament.winnerId)}`
            : '';
        this.arenaSummary.innerHTML = this.renderArenaSummary(tournament);
        this.renderStandings(tournament);
        this.bracketRounds.innerHTML = tournament.bracket.map((round) => this.renderRoundColumn(tournament, round)).join('');
        this.renderRecorder(tournament, selected?.match || null);
        this.renderCompletedMatches(tournament);
        this.undoScoreBtn.disabled = !selected?.match || selected.match.status === 'completed' || !selected.match.log.length;
        this.resetMatchBtn.disabled = !selected?.match || selected.match.status === 'completed';
        this.updateArenaTabVisibility();
    }

    renderArenaSummary(tournament) {
        const summaryItems = [
            { label: '參賽人數', value: `${tournament.players.length} 人`, tone: 'chip-neutral' },
            { label: '勝利門檻', value: `${tournament.settings.pointsToWin} 分`, tone: 'chip-rule' }
        ];

        return summaryItems.map((item) => `
            <span class="arena-meta-chip ${item.tone}">${item.label}:${this.escapeHtml(item.value)}</span>
        `).join('');
    }

    deriveStandings(tournament) {
        const totalRounds = tournament.bracket.length;
        const finalMatch = tournament.bracket[totalRounds - 1]?.matches[0] || null;
        const runnerUpId = tournament.completed && finalMatch?.winnerId
            ? [finalMatch.player1Id, finalMatch.player2Id].find((id) => id && id !== finalMatch.winnerId) || null
            : null;

        const rows = tournament.players.map((player) => ({
            id: player.id,
            name: player.name,
            seed: player.seed,
            wins: 0,
            losses: 0,
            byes: 0,
            pendingMatches: 0,
            nextMatchText: '待定',
            eliminationRound: null,
            latestRoundSeen: 0,
            placementScore: 0,
            statusText: '待命'
        }));

        const rowMap = new Map(rows.map((row) => [row.id, row]));

        tournament.bracket.forEach((round) => {
            round.matches.forEach((match) => {
                const row1 = match.player1Id ? rowMap.get(match.player1Id) : null;
                const row2 = match.player2Id ? rowMap.get(match.player2Id) : null;

                if (row1) {
                    row1.latestRoundSeen = Math.max(row1.latestRoundSeen, round.roundNumber);
                }
                if (row2) {
                    row2.latestRoundSeen = Math.max(row2.latestRoundSeen, round.roundNumber);
                }

                if (match.status !== 'completed' || !match.winnerId) {
                    if (match.player1Id) {
                        const participant1 = rowMap.get(match.player1Id);
                        if (participant1) participant1.pendingMatches += 1;
                    }
                    if (match.player2Id) {
                        const participant2 = rowMap.get(match.player2Id);
                        if (participant2) participant2.pendingMatches += 1;
                    }
                    return;
                }

                if (match.resultType === 'bye') {
                    const byeRow = rowMap.get(match.winnerId);
                    if (byeRow) {
                        byeRow.byes += 1;
                        byeRow.wins += 1;
                        byeRow.latestRoundSeen = Math.max(byeRow.latestRoundSeen, round.roundNumber);
                    }
                    return;
                }

                if (!row1 || !row2) {
                    return;
                }

                const loserId = match.player1Id === match.winnerId ? match.player2Id : match.player1Id;
                const winnerRow = rowMap.get(match.winnerId);
                const loserRow = loserId ? rowMap.get(loserId) : null;

                if (winnerRow) {
                    winnerRow.wins += 1;
                }
                if (loserRow) {
                    loserRow.losses += 1;
                    loserRow.eliminationRound = round.roundNumber;
                }
            });
        });

        rows.forEach((row) => {
            const isChampion = tournament.winnerId === row.id;
            const isRunnerUp = runnerUpId === row.id;
            const isEliminated = row.eliminationRound !== null;
            const progressRound = row.latestRoundSeen || 1;
            const nextMatch = this.findUpcomingMatchForPlayer(tournament, row.id);

            if (nextMatch) {
                row.nextMatchText = `${tournament.bracket[nextMatch.roundNumber - 1]?.roundLabel || `第${nextMatch.roundNumber}輪`} / 對戰${nextMatch.matchNumber}`;
            } else if (isChampion) {
                row.nextMatchText = '已奪冠';
            } else if (isEliminated) {
                row.nextMatchText = '賽程結束';
            } else if (tournament.completed) {
                row.nextMatchText = '賽程結束';
            } else {
                row.nextMatchText = '等待上一輪結果';
            }

            if (isChampion) {
                row.statusText = '冠軍';
                row.placementScore = 100000;
            } else if (isRunnerUp) {
                row.statusText = '亞軍';
                row.placementScore = 90000;
            } else if (tournament.completed && isEliminated) {
                row.statusText = `止步${tournament.bracket[row.eliminationRound - 1]?.roundLabel || `第 ${row.eliminationRound} 輪`}`;
                row.placementScore = (row.eliminationRound * 1000) + (row.wins * 100) - row.losses;
            } else if (!tournament.completed && !isEliminated) {
                row.statusText = progressRound >= tournament.currentRound ? '晉級中' : '待出賽';
                row.placementScore = 80000 + (row.wins * 100) - row.losses;
            } else if (!tournament.completed && isEliminated) {
                row.statusText = `止步${tournament.bracket[row.eliminationRound - 1]?.roundLabel || `第 ${row.eliminationRound} 輪`}`;
                row.placementScore = (row.eliminationRound * 1000) + (row.wins * 100) - row.losses;
            } else {
                row.statusText = '未出賽';
                row.placementScore = row.wins * 100 - row.losses;
            }
        });

        rows.sort((left, right) => {
            if (right.placementScore !== left.placementScore) return right.placementScore - left.placementScore;
            if (right.wins !== left.wins) return right.wins - left.wins;
            if (left.losses !== right.losses) return left.losses - right.losses;
            if (left.pendingMatches !== right.pendingMatches) return left.pendingMatches - right.pendingMatches;
            return left.seed - right.seed;
        });

        return rows.map((row, index) => ({
            ...row,
            rank: index + 1
        }));
    }

    renderStandings(tournament) {
        const standings = this.deriveStandings(tournament);
        this.standingsTitle.textContent = tournament.completed ? '最終排名' : '即時戰績表';
        this.standingsNote.textContent = tournament.completed
            ? '最終排名會顯示每位玩家的勝場、尚未進行場次（若有）與淘汰結果。'
            : '即時戰績會顯示每位玩家目前幾勝、下一場是否待賽與是否淘汰。';

        this.standingsBody.innerHTML = standings.map((row) => `
            <tr>
                <td class="rank-cell">${row.rank}</td>
                <td>
                    <div class="player-cell">
                        <strong>${this.escapeHtml(row.name)}</strong>
                        <span>選手 ${row.seed}</span>
                    </div>
                </td>
                <td><span class="standings-status ${this.getStandingsStatusClass(row.statusText)}">${this.escapeHtml(row.statusText)}</span></td>
                <td>${row.wins}</td>
                <td>${row.losses}</td>
                <td>${row.byes}</td>
                <td>${row.pendingMatches}</td>
                <td>${this.escapeHtml(row.nextMatchText)}</td>
            </tr>
        `).join('');
    }

    findUpcomingMatchForPlayer(tournament, playerId) {
        for (const round of tournament.bracket) {
            const target = round.matches.find((match) => {
                const isParticipant = match.player1Id === playerId || match.player2Id === playerId;
                return isParticipant && match.status !== 'completed';
            });
            if (target) {
                return target;
            }
        }
        return null;
    }

    getStandingsStatusClass(statusText) {
        if (statusText === '冠軍') return 'status-champion';
        if (statusText === '亞軍') return 'status-runner-up';
        if (statusText === '晉級中') return 'status-alive';
        if (statusText === '待出賽') return 'status-pending';
        return 'status-eliminated';
    }

    renderRoundColumn(tournament, round) {
        return `
            <section class="round-card">
                <h4 class="round-title">${this.escapeHtml(round.roundLabel)}</h4>
                <div class="round-matches">
                    ${round.matches.map((match) => this.renderMatchCard(tournament, match)).join('')}
                </div>
            </section>
        `;
    }

    renderMatchCard(tournament, match) {
        const isSelected = match.id === this.selectedMatchId;
        const isInteractive = match.status !== 'waiting';
        const classes = ['match-card'];
        if (isInteractive) {
            classes.push('selectable');
        }
        if (isSelected) classes.push('active-match');
        if (match.status === 'completed') classes.push('completed-match');
        if (match.status === 'waiting') classes.push('waiting-match');

        const statusClassMap = {
            active: 'pill-active',
            pending: 'pill-pending',
            completed: 'pill-completed',
            waiting: 'pill-waiting'
        };

        const statusTextMap = {
            active: '進行中',
            pending: '未對戰',
            completed: '已完成',
            waiting: '等待對手'
        };

        const scoreText = match.player1Id && match.player2Id
            ? `${match.score1} : ${match.score2}`
            : '-';

        const players = [
            this.renderMatchPlayerLine(tournament, match, 'player1'),
            this.renderMatchPlayerLine(tournament, match, 'player2')
        ].join('');

        const cardActionAttrs = isInteractive
            ? `data-action="match-select" data-id="${match.id}"`
            : '';

        return `
            <article class="${classes.join(' ')}" ${cardActionAttrs}>
                <div class="match-card-head">
                    <h5 class="round-match-title">對戰 ${match.matchNumber}</h5>
                    <span class="match-status-pill ${statusClassMap[match.status]}">${statusTextMap[match.status]}</span>
                </div>
                <div class="round-match-meta">
                    <span class="match-meta">先 ${match.targetPoints} 分</span>
                    <span class="match-meta">比分 ${scoreText}</span>
                </div>
                <div class="round-match-players">
                    ${players}
                </div>
            </article>
        `;
    }

    renderMatchPlayerLine(tournament, match, slot) {
        const playerId = slot === 'player1' ? match.player1Id : match.player2Id;
        const winnerId = match.winnerId;
        const slotDisplay = this.getMatchSlotDisplay(tournament, match, slot);
        const classes = ['player-line'];
        if (winnerId && playerId === winnerId) {
            classes.push('winner-line');
        }
        if (slotDisplay.isBye) {
            classes.push('bye-line');
        }

        return `
            <div class="${classes.join(' ')}">
                <span class="player-name">${this.escapeHtml(slotDisplay.name)}</span>
                <span class="player-seed">${this.escapeHtml(slotDisplay.meta)}</span>
            </div>
        `;
    }

    renderRecorder(tournament, match) {
        if (!match) {
            this.matchTitle.textContent = '尚未選擇對戰';
            this.matchRecorder.className = 'match-recorder empty-state';
            this.matchRecorder.innerHTML = '<p>請從左側點選可用對戰，開始記錄單場得分。</p>';
            return;
        }

        this.matchTitle.textContent = `${this.getMatchParticipantName(tournament, match, 'player1')} vs ${this.getMatchParticipantName(tournament, match, 'player2')}`;
        this.matchRecorder.className = 'match-recorder';
        this.matchRecorder.innerHTML = `
            <div class="recorder-shell">
                <div class="match-meta">
                    <span class="match-status-pill ${match.status === 'completed' ? 'pill-completed' : 'pill-active'}">${match.status === 'completed' ? '已完成' : (match.status === 'active' ? '進行中' : '未對戰')}</span>
                    <span class="match-meta">${this.escapeHtml(tournament.bracket[match.roundNumber - 1].roundLabel)} / 對戰 ${match.matchNumber}</span>
                    <span class="match-meta">勝利門檻 ${match.targetPoints} 分</span>
                </div>

                ${match.status === 'completed' ? `<div class="recorder-complete-notice">此對局已完成，最終比分 ${match.score1} : ${match.score2}</div>` : ''}

                <div class="recorder-scoreboard">
                    ${this.renderScorePanel(tournament, match, 'player1')}
                    ${this.renderScorePanel(tournament, match, 'player2')}
                </div>

                <div class="panel score-panel">
                    <div class="panel-header">
                        <div>
                            <p class="panel-kicker">Score Timeline</p>
                            <h3>本場紀錄</h3>
                        </div>
                    </div>
                    <div class="match-log">
                        ${match.log.length ? match.log.map((entry) => this.renderTimelineItem(entry)).join('') : '<div class="empty-note">此對戰尚未有得分紀錄。</div>'}
                    </div>
                </div>
            </div>
        `;
    }

    renderScorePanel(tournament, match, slot) {
        const playerId = slot === 'player1' ? match.player1Id : match.player2Id;
        const scoreValue = slot === 'player1' ? match.score1 : match.score2;
        const player = playerId ? this.getPlayerById(tournament, playerId) : null;
        const disabled = !playerId || match.status === 'completed';
        const panelClass = slot === 'player1' ? 'player-panel-active' : '';

        return `
            <div class="score-panel ${panelClass}">
                <div class="match-card-head">
                    <div>
                        <p class="match-player-name">${this.escapeHtml(this.getMatchParticipantName(tournament, match, slot))}</p>
                        <span class="score-tag">${player ? `選手 ${player.seed}` : '等待對手'}</span>
                    </div>
                    <strong class="match-score-value">${scoreValue}</strong>
                </div>

                <div class="score-pill-row">
                    <span class="score-pill">目標 ${match.targetPoints} 分</span>
                    <span class="score-pill">目前差 ${Math.max(match.targetPoints - scoreValue, 0)} 分</span>
                </div>

                <div class="player-score-actions">
                    ${Object.entries(this.scoreTypes).map(([scoreType, meta]) => `
                        <button
                            class="btn score-action-btn ${meta.tone}"
                            data-action="score"
                            data-slot="${slot}"
                            data-score-type="${scoreType}"
                            ${disabled ? 'disabled' : ''}
                        >
                            ${meta.label}
                            <small>+${tournament.settings.scoreValues[scoreType]} 分</small>
                        </button>
                    `).join('')}
                </div>

                <div class="score-actions">
                    <button class="btn btn-secondary" data-complete-slot="${slot}" ${disabled ? 'disabled' : ''}>直接判定勝方</button>
                </div>
            </div>
        `;
    }

    renderTimelineItem(entry) {
        return `
            <article class="timeline-item">
                <div class="timeline-main">
                    <span class="timeline-turn">${entry.turn}</span>
                    <div class="timeline-copy">
                        <strong>${this.escapeHtml(entry.playerName)}</strong>
                        <span>${entry.label} +${entry.points} 分</span>
                    </div>
                </div>
                <span class="timeline-time">${this.formatTime(entry.recordedAt)}</span>
            </article>
        `;
    }

    renderCompletedMatches(tournament) {
        const completed = tournament.bracket.flatMap((round) => round.matches.filter((match) => match.status === 'completed' && match.player1Id && match.player2Id));
        if (!completed.length) {
            this.completedMatches.innerHTML = '<div class="empty-history">目前沒有已完成對戰。</div>';
            return;
        }

        this.completedMatches.innerHTML = completed.slice().reverse().map((match) => {
            const winnerName = this.getPlayerName(tournament, match.winnerId);
            const loserId = match.player1Id === match.winnerId ? match.player2Id : match.player1Id;
            const loserName = this.getPlayerName(tournament, loserId);
            const roundLabel = tournament.bracket[match.roundNumber - 1]?.roundLabel || `第 ${match.roundNumber} 輪`;
            return `
                <article class="completed-card">
                    <div class="completed-row">
                        <h4 class="completed-title">${this.escapeHtml(winnerName)} 擊敗 ${this.escapeHtml(loserName)}</h4>
                        <span class="history-badge badge-finished">Done</span>
                    </div>
                    <div class="history-meta-row">
                        <span class="history-meta">第 ${match.roundNumber} 輪（${this.escapeHtml(roundLabel)}）</span>
                        <span class="history-meta">${match.score1} : ${match.score2}</span>
                    </div>
                </article>
            `;
        }).join('');
    }

    exportCurrentTournament() {
        const tournament = this.getCurrentTournament();
        if (!tournament) {
            window.alert('目前沒有可匯出的賽事。');
            return;
        }

        const blob = new Blob([JSON.stringify(tournament, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${tournament.name.replace(/\s+/g, '_') || 'bbx_tournament'}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    importTournament(file) {
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const imported = JSON.parse(reader.result);
                if (!imported || !Array.isArray(imported.players) || !Array.isArray(imported.bracket)) {
                    throw new Error('格式不正確');
                }

                imported.id = this.generateId('bbx');
                imported.name = imported.name || this.generateDefaultTournamentName();
                imported.updatedAt = new Date().toISOString();
                imported.createdAt = imported.createdAt || new Date().toISOString();
                this.updateTournament(imported);
                this.selectedMatchId = imported.selectedMatchId || imported.activeMatchId || this.findFirstAvailableMatchId(imported);
                this.showPage('arena-page');
            } catch (error) {
                window.alert(`匯入失敗：${error.message}`);
            } finally {
                this.importFileInput.value = '';
            }
        };
        reader.readAsText(file);
    }

    parsePlayers(value) {
        return value
            .split('\n')
            .map((name) => name.trim())
            .filter(Boolean);
    }

    normalizeNumber(value, fallback, min, max) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) {
            return fallback;
        }
        return Math.min(max, Math.max(min, parsed));
    }

    generateDefaultTournamentName() {
        const date = new Date();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `BBX 對戰賽 ${date.getFullYear()}-${month}-${day}`;
    }

    formatDate(value) {
        return new Date(value).toLocaleString('zh-TW', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatTime(value) {
        return new Date(value).toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    generateId(prefix) {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return `${prefix}_${window.crypto.randomUUID()}`;
        }
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new BeybladeTournamentApp();
    app.init();
});