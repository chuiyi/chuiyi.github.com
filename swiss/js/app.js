/**
 * 瑞士輪賽事系統主應用程式
 * 處理 UI 互動、頁面切換、事件監聽等功能
 */

class SwissTournamentApp {
    constructor() {
        this.tournament = new SwissTournament(); // 目前進行中的比賽（進入某場賽事後設定）
        this.currentPage = 'tournament-history';
        this.displayModeStorageKey = 'swiss_display_mode';
        this.arrangementSwapSelection = null;
        this.historyPlayoffViewerTournament = null;
        this.init();
    }

    /**
     * 初始化應用程式
     */
    init() {
        console.log('瑞士輪比賽系統啟動');
        this.setupEventListeners();
        this.applySavedDisplayMode();
        this.migrateOldStorage();       // 從舊的 swiss_tournament_current 遷移
        this.loadAllActiveTournaments(); // 載入所有進行中賽事 ID
        this.showPage('tournament-history');
        this.updateCurrentTournamentCard();
        this.updateHistoryList();
    }

    /**
     * 遷移舊版 swiss_tournament_current 到新的 ID-based 格式
     */
    migrateOldStorage() {
        try {
            const oldData = localStorage.getItem('swiss_tournament_current');
            if (!oldData) return;
            const parsed = JSON.parse(oldData);
            if (parsed && parsed.tournamentId) {
                const newKey = `swiss_tournament_${parsed.tournamentId}`;
                if (!localStorage.getItem(newKey)) {
                    localStorage.setItem(newKey, oldData);
                    SwissTournament.registerTournament(parsed.tournamentId);
                    console.log('已遷移舊賽事資料:', parsed.tournamentId);
                }
            }
            localStorage.removeItem('swiss_tournament_current');
        } catch (e) {
            console.warn('遷移舊資料失敗，已跳過:', e);
        }
    }

    /**
     * 載入所有進行中的賽事 ID（供首頁顯示用）
     */
    loadAllActiveTournaments() {
        // ID 已在 localStorage 的 swiss_active_tournaments 中管理
        // 這裡只需要確保 this.tournament 的 tournamentId 仍有效
        const ids = SwissTournament.getActiveTournamentIds();
        console.log('目前進行中的賽事:', ids.length, '場');
    }

    /**
     * 設定事件監聽器
     */
    setupEventListeners() {
        // 選手輸入區域事件
        const playersTextarea = document.getElementById('players-textarea');
        if (playersTextarea) {
            playersTextarea.addEventListener('input', () => {
                this.updatePlayerPreview();
            });
        }

        // 開始比賽按鈕
        const startBtn = document.getElementById('start-tournament');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startTournament();
            });
        }

        // 輪次控制按鈕
        const finishRoundBtn = document.getElementById('finish-round');
        if (finishRoundBtn) {
            finishRoundBtn.addEventListener('click', () => {
                this.finishRound();
            });
        }

        const nextRoundBtn = document.getElementById('next-round');
        if (nextRoundBtn) {
            nextRoundBtn.addEventListener('click', () => {
                this.nextRound();
            });
        }

        const finishTournamentBtn = document.getElementById('finish-tournament');
        if (finishTournamentBtn) {
            finishTournamentBtn.addEventListener('click', () => {
                this.finishTournament();
            });
        }

        // 新比賽按鈕
        const newTournamentBtn = document.getElementById('new-tournament');
        if (newTournamentBtn) {
            newTournamentBtn.addEventListener('click', () => {
                this.newTournament();
            });
        }

        // 匯出/匯入功能
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportTournament();
            });
        }

        // 歷史比賽按鈕
        const historyBtn = document.getElementById('history-btn');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => {
                this.showTournamentHistory();
            });
        }

        const projectorModeBtn = document.getElementById('projector-mode-btn');
        if (projectorModeBtn) {
            projectorModeBtn.addEventListener('click', () => {
                this.toggleProjectorMode();
            });
        }

        const homeTitle = document.getElementById('home-title');
        if (homeTitle) {
            homeTitle.addEventListener('click', () => {
                this.showTournamentHistory();
            });
        }

        const importBtn = document.getElementById('import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                document.getElementById('import-file').click();
            });
        }

        const importFile = document.getElementById('import-file');
        if (importFile) {
            importFile.addEventListener('change', (e) => {
                this.importTournament(e.target.files[0]);
            });
        }

        const exportResultBtn = document.getElementById('export-result');
        if (exportResultBtn) {
            exportResultBtn.addEventListener('click', () => {
                this.exportResult();
            });
        }

        const clearAllHistoryBtn = document.getElementById('clear-all-history');
        if (clearAllHistoryBtn) {
            clearAllHistoryBtn.addEventListener('click', () => {
                this.clearAllHistory();
            });
        }

        // 快速動作按鈕
        const startNewTournamentBtn = document.getElementById('start-new-tournament');
        if (startNewTournamentBtn) {
            startNewTournamentBtn.addEventListener('click', () => {
                this.newTournament();
            });
        }

        const importTournamentBtn = document.getElementById('import-tournament');
        if (importTournamentBtn) {
            importTournamentBtn.addEventListener('click', () => {
                document.getElementById('import-file').click();
            });
        }

        // 查看歷史輪次按鈕
        const viewPreviousRoundsBtn = document.getElementById('view-previous-rounds');
        if (viewPreviousRoundsBtn) {
            viewPreviousRoundsBtn.addEventListener('click', () => {
                this.showPreviousRounds();
            });
        }

        // 比賽設定事件
        const customRoundsCheckbox = document.getElementById('custom-rounds');
        if (customRoundsCheckbox) {
            customRoundsCheckbox.addEventListener('change', (e) => {
                this.toggleCustomRounds(e.target.checked);
            });
        }

        const roundsInput = document.getElementById('rounds-input');
        if (roundsInput) {
            roundsInput.addEventListener('input', () => {
                this.updateRoundsPreview();
            });
        }

        const enablePlayoffCheckbox = document.getElementById('enable-playoff');
        if (enablePlayoffCheckbox) {
            enablePlayoffCheckbox.addEventListener('change', (e) => {
                this.togglePlayoffSettings(e.target.checked);
            });
        }

        const startFirstRoundBtn = document.getElementById('start-first-round');
        if (startFirstRoundBtn) {
            startFirstRoundBtn.addEventListener('click', () => {
                this.showPairingArrangement();
            });
        }

        const editTournamentSettingsBtn = document.getElementById('edit-tournament-settings');
        if (editTournamentSettingsBtn) {
            editTournamentSettingsBtn.addEventListener('click', () => {
                this.populateSetupFormFromTournament();
                this.showPage('tournament-setup');
            });
        }

        // 重新計算配對按鈕
        const recalculateBtn = document.getElementById('recalculate-pairings');
        if (recalculateBtn) {
            recalculateBtn.addEventListener('click', () => {
                this.recalculatePairings();
            });
        }

        // 通知關閉按鈕
        const notificationClose = document.getElementById('notification-close');
        if (notificationClose) {
            notificationClose.addEventListener('click', () => {
                this.hideNotification();
            });
        }

        // 對戰安排相關事件
        const randomPairingBtn = document.getElementById('random-pairing');
        if (randomPairingBtn) {
            randomPairingBtn.addEventListener('click', () => {
                this.randomizePairings();
            });
        }

        const manualPairingBtn = document.getElementById('manual-pairing');
        if (manualPairingBtn) {
            manualPairingBtn.addEventListener('click', () => {
                this.toggleManualPairing();
            });
        }

        const autoPairingBtn = document.getElementById('auto-pairing');
        if (autoPairingBtn) {
            autoPairingBtn.addEventListener('click', () => {
                this.generateAutoPairings();
            });
        }

        const addPlayerArrangementBtn = document.getElementById('add-player-arrangement');
        if (addPlayerArrangementBtn) {
            addPlayerArrangementBtn.addEventListener('click', () => {
                this.openAddPlayerModal();
            });
        }

        const confirmPairingsBtn = document.getElementById('confirm-pairings');
        if (confirmPairingsBtn) {
            confirmPairingsBtn.addEventListener('click', () => {
                this.confirmPairings();
            });
        }

        const saveManualPairingsBtn = document.getElementById('save-manual-pairings');
        if (saveManualPairingsBtn) {
            saveManualPairingsBtn.addEventListener('click', () => {
                this.saveManualPairings();
            });
        }

        const cancelManualPairingsBtn = document.getElementById('cancel-manual-pairings');
        if (cancelManualPairingsBtn) {
            cancelManualPairingsBtn.addEventListener('click', () => {
                this.cancelManualPairing();
            });
        }

        const clearManualPairingsBtn = document.getElementById('clear-manual-pairings');
        if (clearManualPairingsBtn) {
            clearManualPairingsBtn.addEventListener('click', () => {
                this.clearManualPairings();
            });
        }

        const confirmAddPlayerBtn = document.getElementById('confirm-add-player');
        if (confirmAddPlayerBtn) {
            confirmAddPlayerBtn.addEventListener('click', () => {
                this.confirmAddPlayer();
            });
        }

        const addPlayerNameInput = document.getElementById('add-player-name');
        if (addPlayerNameInput) {
            addPlayerNameInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.confirmAddPlayer();
                }
            });
        }
    }

    applySavedDisplayMode() {
        let savedMode = null;
        try {
            savedMode = localStorage.getItem(this.displayModeStorageKey);
        } catch (error) {
            console.warn('讀取顯示模式設定失敗:', error);
        }

        this.setProjectorMode(savedMode === 'projector', false);
    }

    toggleProjectorMode() {
        const enabled = !document.body.classList.contains('projector-mode');
        this.setProjectorMode(enabled, true);
        this.showNotification(enabled ? '已切換為投影模式' : '已切換為一般模式', 'info');
    }

    setProjectorMode(enabled, persist = true) {
        document.body.classList.toggle('projector-mode', enabled);

        const projectorModeBtn = document.getElementById('projector-mode-btn');
        if (projectorModeBtn) {
            const labelSpan = projectorModeBtn.querySelector('span');
            if (labelSpan) {
                labelSpan.textContent = enabled ? '一般模式' : '投影模式';
            }
            projectorModeBtn.classList.toggle('active', enabled);
            projectorModeBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        }

        if (!persist) return;

        try {
            localStorage.setItem(this.displayModeStorageKey, enabled ? 'projector' : 'default');
        } catch (error) {
            console.warn('儲存顯示模式設定失敗:', error);
        }
    }

    /**
     * 進入特定賽事（載入資料到 this.tournament 並導航）
     */
    enterTournament(id) {
        const t = SwissTournament.loadById(id);
        if (!t) {
            this.showNotification('找不到指定賽事', 'error');
            return;
        }
        this.tournament = t;
        this.loadExistingTournament();
    }

    /**
     * 根據目前 this.tournament 狀態導航到對應頁面
     */
    loadExistingTournament() {
        const status = this.tournament.getStatus();
        if (status === 'finished' || status === 'in_playoff') {
            this.showPlayoffBracket();
        } else if (status === 'playoff_ready') {
            this.showPlayoffSetup();
        } else if (status === 'swiss_complete') {
            this.displayFinalRanking();
            this.showPage('final-ranking');
        } else if (status === 'playing' || status === 'round_complete' || status === 'last_round_complete') {
            this.displayCurrentRound();
        } else if (status === 'setup') {
            this.displayTournamentInfo();
        } else {
            // idle: 回到設定頁讓使用者輸入選手
            document.getElementById('players-textarea').value = '';
            this.populateSetupFormFromTournament();
            this.updatePlayerPreview();
            this.showPage('tournament-setup');
        }
    }

    /**
     * 更新選手預覽
     */
    updatePlayerPreview() {
        const playersText = document.getElementById('players-textarea').value.trim();
        const playerList = playersText.split('\n').filter(line => line.trim());
        
        const playerCountSpan = document.getElementById('player-count-preview');
        const roundsSpan = document.getElementById('rounds-preview');
        const startBtn = document.getElementById('start-tournament');
        
        if (playerCountSpan) {
            playerCountSpan.textContent = `${playerList.length} 位選手`;
        }
        
        if (roundsSpan) {
            this.updateRoundsPreview();
        }
        
        if (startBtn) {
            startBtn.disabled = playerList.length < 2;
        }
    }

    /**
     * 更新輪數預覽
     */
    updateRoundsPreview() {
        const playersText = document.getElementById('players-textarea').value.trim();
        const playerList = playersText.split('\n').filter(line => line.trim());
        const roundsSpan = document.getElementById('rounds-preview');
        const customRoundsCheckbox = document.getElementById('custom-rounds');
        const roundsInput = document.getElementById('rounds-input');
        
        if (!roundsSpan) return;
        
        let rounds = 0;
        if (playerList.length >= 2) {
            if (customRoundsCheckbox && customRoundsCheckbox.checked && roundsInput && roundsInput.value) {
                rounds = parseInt(roundsInput.value) || 0;
            } else {
                // 使用修正後的瑞士輪公式
                rounds = Math.max(Math.ceil(Math.log2(playerList.length)), 3);
            }
        }
        
        roundsSpan.textContent = `${rounds} 輪比賽`;
        this.updatePlayoffAdvanceOptions(playerList.length);
    }

    /**
     * 切換自訂輪數選項
     */
    toggleCustomRounds(enabled) {
        const container = document.querySelector('.rounds-input-container');
        if (container) {
            container.style.display = enabled ? 'block' : 'none';
        }
        this.updateRoundsPreview();
    }

    togglePlayoffSettings(enabled) {
        const container = document.getElementById('playoff-settings-inline');
        if (container) {
            container.style.display = enabled ? 'block' : 'none';
        }
        this.updatePlayoffAdvanceOptions();
    }

    updatePlayoffAdvanceOptions(playerCount = null) {
        const select = document.getElementById('playoff-advance-count-setup');
        const checkbox = document.getElementById('enable-playoff');
        if (!select || !checkbox) return;

        const inferredCount = playerCount ?? document.getElementById('players-textarea')?.value.trim().split('\n').filter(line => line.trim()).length ?? 0;
        const previousValue = parseInt(select.value || this.tournament.settings.playoffAdvanceCount || '4', 10);
        const maxPower = inferredCount >= 2 ? Math.min(16, 2 ** Math.floor(Math.log2(inferredCount))) : 0;

        select.innerHTML = '';
        if (!checkbox.checked || maxPower < 2) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = inferredCount < 2 ? '至少 2 人後可設定' : '請先啟用複賽';
            select.appendChild(option);
            select.disabled = true;
            return;
        }

        select.disabled = false;
        for (let count = 2; count <= maxPower; count *= 2) {
            const option = document.createElement('option');
            option.value = count;
            option.textContent = `取 ${count} 強`;
            option.selected = count === Math.min(previousValue, maxPower);
            select.appendChild(option);
        }
    }

    populateSetupFormFromTournament() {
        const playersTextarea = document.getElementById('players-textarea');
        const nameEl = document.getElementById('tournament-name');
        const allowDrawsEl = document.getElementById('allow-draws');
        const allowDoubleLossEl = document.getElementById('allow-double-loss');
        const customRoundsEl = document.getElementById('custom-rounds');
        const roundsInputEl = document.getElementById('rounds-input');
        const enablePlayoffEl = document.getElementById('enable-playoff');
        const advanceSelectEl = document.getElementById('playoff-advance-count-setup');

        if (playersTextarea) {
            playersTextarea.value = (this.tournament.players || []).map(player => player.name).join('\n');
        }
        if (nameEl) nameEl.value = this.tournament.tournamentName || '';
        if (allowDrawsEl) allowDrawsEl.checked = !!this.tournament.settings.allowDraws;
        if (allowDoubleLossEl) allowDoubleLossEl.checked = !!this.tournament.settings.allowDoubleLoss;
        if (customRoundsEl) customRoundsEl.checked = !!this.tournament.settings.customRounds;
        if (roundsInputEl) roundsInputEl.value = this.tournament.settings.manualRounds || '';
        if (enablePlayoffEl) enablePlayoffEl.checked = !!this.tournament.settings.enablePlayoff;

        this.toggleCustomRounds(!!this.tournament.settings.customRounds);
        this.togglePlayoffSettings(!!this.tournament.settings.enablePlayoff);

        if (advanceSelectEl && this.tournament.settings.playoffAdvanceCount) {
            advanceSelectEl.value = String(this.tournament.settings.playoffAdvanceCount);
        }

        this.updatePlayerPreview();
    }

    /**
     * 開始比賽
     */
    startTournament() {
        try {
            this.showLoading(true);
            
            const playerText = document.getElementById('players-textarea').value.trim();
            if (!playerText) {
                throw new Error('請輸入選手清單！');
            }

            const playerList = playerText.split('\n').filter(line => line.trim());
            
            // 讀取比賽設定
            const tournamentSettings = this.getTournamentSettings();
            
            this.tournament.initializeTournament(playerList, tournamentSettings);
            if (tournamentSettings.enablePlayoff && tournamentSettings.playoffAdvanceCount) {
                this.tournament.configurePlayoff(tournamentSettings.playoffAdvanceCount, 'single_elimination');
            }
            this.updateCurrentTournamentCard();
            
            this.displayTournamentInfo();
            this.showNotification('比賽初始化完成！請安排第一輪配對', 'success');
            
            // 短暫顯示資訊頁面後跳轉到對戰安排頁面
            setTimeout(() => {
                this.showPairingArrangement();
            }, 2000);
            
        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 讀取比賽設定
     */
    getTournamentSettings() {
        const tournamentNameEl = document.getElementById('tournament-name');
        const tournamentName = tournamentNameEl ? tournamentNameEl.value.trim() : '';
        
        const allowDrawsEl = document.getElementById('allow-draws');
        const allowDraws = allowDrawsEl ? allowDrawsEl.checked : false;
        
        const allowDoubleLossEl = document.getElementById('allow-double-loss');
        const allowDoubleLoss = allowDoubleLossEl ? allowDoubleLossEl.checked : false;
        
        const customRoundsEl = document.getElementById('custom-rounds');
        const customRounds = customRoundsEl ? customRoundsEl.checked : false;
        
        const roundsInputEl = document.getElementById('rounds-input');
        const manualRounds = customRounds ? (roundsInputEl ? parseInt(roundsInputEl.value) || null : null) : null;

        const enablePlayoffEl = document.getElementById('enable-playoff');
        const enablePlayoff = enablePlayoffEl ? enablePlayoffEl.checked : false;

        const playoffAdvanceEl = document.getElementById('playoff-advance-count-setup');
        const playoffAdvanceCount = enablePlayoff ? (playoffAdvanceEl ? parseInt(playoffAdvanceEl.value) || null : null) : null;
        
        return {
            tournamentName,
            allowDraws,
            allowDoubleLoss,
            customRounds,
            manualRounds,
            enablePlayoff,
            playoffAdvanceCount
        };
    }

    /**
     * 根據設定生成比賽結果選項
     */
    getMatchResultOptions(player1Name, player2Name) {
        const options = [
            { value: 'player1_win', text: `${player1Name} 勝 (3分)` },
            { value: 'player2_win', text: `${player2Name} 勝 (3分)` }
        ];

        // 根據設定添加平局選項
        if (this.tournament.settings.allowDraws) {
            options.splice(1, 0, { value: 'draw', text: '平局 (各1分)' });
        }

        // 根據設定添加雙敗選項
        if (this.tournament.settings.allowDoubleLoss) {
            options.push({ value: 'double_loss', text: '雙敗 (各0分)' });
        }

        return options;
    }

    /**
     * 顯示比賽資訊
     */
    displayTournamentInfo() {
        // 更新比賽標題
        const titleElement = document.getElementById('tournament-info-title');
        if (titleElement) {
            titleElement.textContent = this.tournament.generateTournamentTitle();
        }
        
        document.getElementById('player-count').textContent = this.tournament.players.length;
        document.getElementById('round-count').textContent = this.tournament.totalRounds;
        document.getElementById('current-round').textContent = this.tournament.currentRound;

        // 顯示選手清單
        const playersDisplay = document.getElementById('players-display');
        playersDisplay.innerHTML = '';
        
        this.tournament.players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = `player-card ${player.dropped ? 'dropped' : ''}`;
            playerCard.innerHTML = `
                <div class="player-name">${this.escapeHtml(player.name)}</div>
                <div class="player-score">積分: ${player.score}</div>
            `;
            playersDisplay.appendChild(playerCard);
        });

        const infoActions = document.getElementById('tournament-info-actions');
        const playoffSummary = document.getElementById('tournament-info-playoff-summary');
        if (infoActions) {
            const summary = this.tournament.settings.enablePlayoff && this.tournament.settings.playoffAdvanceCount
                ? `已設定複賽：取 ${this.tournament.settings.playoffAdvanceCount} 強`
                : '未啟用複賽';
            infoActions.setAttribute('data-playoff-summary', summary);
            if (playoffSummary) {
                playoffSummary.textContent = summary;
            }
        }

        this.showPage('tournament-info');
    }

    /**
     * 顯示目前輪次
     */
    displayCurrentRound() {
        if (this.tournament.currentRound === 0) return;
        
        const pairings = this.tournament.getCurrentRoundPairings();
        const roundTitle = document.getElementById('round-title');
        
        if (roundTitle) {
            roundTitle.textContent = `第 ${this.tournament.currentRound} 輪配對`;
        }
        
        // 更新摘要統計
        this.updateRoundSummary(pairings);
        
        // 顯示比賽列表
        this.displayMatchesList(pairings);

        this.updateRoundControls();
        this.showPage('pairing-section');
    }

    /**
     * 更新輪次摘要
     */
    updateRoundSummary(pairings) {
        const completedSpan = document.getElementById('matches-completed');
        const totalSpan = document.getElementById('total-matches');
        const playersCountSpan = document.getElementById('active-players-count');
        
        if (completedSpan && totalSpan) {
            const completed = pairings.filter(p => p.completed).length;
            completedSpan.textContent = completed;
            totalSpan.textContent = pairings.length;
        }

        if (playersCountSpan) {
            const activePlayers = this.tournament.players.filter(p => !p.dropped).length;
            playersCountSpan.textContent = activePlayers;
        }

        // 檢查是否需要顯示重新計算按鈕
        const recalculateBtn = document.getElementById('recalculate-pairings');
        if (recalculateBtn) {
            const hasCorrections = pairings.some(p => p.corrected);
            const hasLaterRounds = this.tournament.currentRound < this.tournament.rounds.length;
            recalculateBtn.style.display = hasCorrections && hasLaterRounds ? 'inline-block' : 'none';
        }
    }

    /**
     * 顯示比賽列表
     */
    displayMatchesList(pairings) {
        const listContent = document.getElementById('matches-list-content');
        if (!listContent) return;

        listContent.innerHTML = '';

        // 將配對分為一般對戰和BYE，BYE排在最後
        const regularMatches = pairings.filter(p => p.player2 !== null);
        const byeMatches = pairings.filter(p => p.player2 === null);
        
        // 先顯示一般對戰
        regularMatches.forEach((pairing, index) => {
            const matchRow = this.createMatchRow(pairing, index + 1);
            listContent.appendChild(matchRow);
        });
        
        // 再顯示BYE對戰
        byeMatches.forEach(pairing => {
            const matchRow = this.createMatchRow(pairing, null);
            listContent.appendChild(matchRow);
        });
    }

    /**
     * 創建比賽行
     */
    createMatchRow(pairing, displayNumber = null) {
        const row = document.createElement('div');
        row.className = `match-row ${pairing.completed ? 'completed' : 'pending'} ${pairing.corrected ? 'corrected' : ''}`;
        row.dataset.matchId = pairing.id;
        const visibleNumber = pairing.player2 === null ? 'BYE' : (displayNumber ?? pairing.id);

        const showRecord = this.tournament.currentRound > 1;

        if (pairing.player2 === null) {
            // Bye 的情況
            const p1Record = showRecord ? this.getPlayerRecordBadge(pairing.player1.id) : '';
            row.innerHTML = `
                <div class="match-col-number">
                    <span class="match-number">${visibleNumber}</span>
                    ${pairing.corrected ? '<span class="correction-badge">已修正</span>' : ''}
                </div>
                <div class="match-col-players">
                    <div class="player bye-player">${this.escapeHtml(pairing.player1.name)}${p1Record}</div>
                    <div class="vs-bye">BYE</div>
                </div>
                <div class="match-col-result">
                    <span class="result-text completed">輪空 (3分)</span>
                </div>
            `;
        } else {
            const isCompleted = pairing.completed;
            const resultText = this.getPairingResultText(pairing);
            const p1Record = showRecord ? this.getPlayerRecordBadge(pairing.player1.id) : '';
            const p2Record = showRecord ? this.getPlayerRecordBadge(pairing.player2.id) : '';
            
            row.innerHTML = `
                <div class="match-col-number">
                    <span class="match-number">${visibleNumber}</span>
                    ${pairing.corrected ? '<span class="correction-badge">已修正</span>' : ''}
                </div>
                <div class="match-col-players">
                    <button onclick="app.openQuickResultPicker(${pairing.id}, 1)" class="player-action-btn player ${pairing.result === 'player1_win' ? 'winner' : ''}">${this.escapeHtml(pairing.player1.name)}${p1Record}</button>
                    <div class="vs">VS</div>
                    <button onclick="app.openQuickResultPicker(${pairing.id}, 2)" class="player-action-btn player ${pairing.result === 'player2_win' ? 'winner' : ''}">${this.escapeHtml(pairing.player2.name)}${p2Record}</button>
                </div>
                <div class="match-col-result">
                    <span class="result-text ${isCompleted ? 'completed' : 'pending'}">${resultText}</span>
                </div>
            `;
        }

        return row;
    }

    getPlayerRecordBadge(playerId) {
        const player = this.tournament.players.find(p => p.id === playerId);
        if (!player || !player.results || player.results.length === 0) return '';
        const wins = player.results.filter(r => r.resultType === 'win' || r.resultType === 'bye').length;
        const losses = player.results.filter(r => r.resultType === 'loss').length;
        const doubleLosses = player.results.filter(r => r.resultType === 'double_loss').length;
        const text = `${wins}/${losses}/${doubleLosses}`;
        return ` <span class="player-record-badge">${text}</span>`;
    }

    getPairingResultText(pairing) {
        if (!pairing || !pairing.result) return '點選選手記錄';
        if (pairing.result === 'bye') return '輪空';
        if (pairing.result === 'draw') return '平局';
        if (pairing.result === 'double_loss') return '雙敗';
        if (pairing.result === 'player1_win') return `${pairing.player1.name} 勝`;
        if (pairing.result === 'player2_win') return `${pairing.player2.name} 勝`;
        return '已記錄';
    }

    openQuickResultPicker(pairId, focusPlayer) {
        const pairing = this.tournament.getCurrentRoundPairings().find(p => p.id === pairId);
        if (!pairing || pairing.player2 === null) return;

        this.quickResultContext = { pairId, focusPlayer };

        const focus = focusPlayer === 1 ? pairing.player1 : pairing.player2;
        const opponent = focusPlayer === 1 ? pairing.player2 : pairing.player1;
        const currentText = this.getPairingResultText(pairing);

        const title = document.getElementById('quick-result-title');
        const current = document.getElementById('quick-result-current');
        const options = document.getElementById('quick-result-options');

        if (title) {
            title.textContent = `${pairing.player1.name} vs ${pairing.player2.name}`;
        }
        if (current) {
            current.textContent = `目前結果：${currentText}`;
        }

        const focusWinItem = {
            action: 'win',
            title: `${focus.name} 勝`,
            desc: `記錄 ${focus.name} 獲勝`
        };
        const opponentWinItem = {
            action: 'lose',
            title: `${opponent.name} 勝`,
            desc: `記錄 ${opponent.name} 獲勝`
        };
        const topRowItems = focusPlayer === 1
            ? [focusWinItem, opponentWinItem]
            : [opponentWinItem, focusWinItem];

        const actionItems = [
            ...topRowItems,
            {
                action: 'double_loss',
                title: '雙敗',
                desc: '雙方都記為敗場'
            },
            {
                action: 'drop',
                title: `${focus.name} 棄權`,
                desc: `直接判定 ${focus.name} 棄權`
            }
        ];

        if (this.tournament.settings.allowDraws) {
            actionItems.splice(2, 0, {
                action: 'draw',
                title: '平局',
                desc: '雙方各得 1 分'
            });
        }

        options.innerHTML = actionItems.map(item => `
            <button class="quick-result-option" onclick="app.applyQuickResultSelection('${item.action}')">
                <span class="quick-result-option-title">${this.escapeHtml(item.title)}</span>
                <span class="quick-result-option-desc">${this.escapeHtml(item.desc)}</span>
            </button>
        `).join('');

        this.showModal('quick-result-modal');
    }

    applyQuickResultSelection(action) {
        if (!this.quickResultContext) return;

        const { pairId, focusPlayer } = this.quickResultContext;
        const pairing = this.tournament.getCurrentRoundPairings().find(p => p.id === pairId);
        if (!pairing || pairing.player2 === null) return;

        let result = null;
        let droppedPlayers = [];

        switch (action) {
            case 'win':
                result = focusPlayer === 1 ? 'player1_win' : 'player2_win';
                break;
            case 'lose':
                result = focusPlayer === 1 ? 'player2_win' : 'player1_win';
                break;
            case 'draw':
                result = 'draw';
                break;
            case 'double_loss':
                result = 'double_loss';
                break;
            case 'drop':
                result = focusPlayer === 1 ? 'player2_win' : 'player1_win';
                droppedPlayers = [focusPlayer === 1 ? pairing.player1.id : pairing.player2.id];
                break;
            default:
                return;
        }

        if (pairing.completed) {
            this.correctMatchResult(pairId, result, droppedPlayers);
        } else {
            this.recordResult(pairId, result, droppedPlayers);
        }

        this.closeModal('quick-result-modal');
        this.quickResultContext = null;
    }

    /**
     * 創建結果按鈕
     */
    createResultButtons(pairing) {
        const options = this.getMatchResultOptions(pairing.player1.name, pairing.player2.name);
        
        return options.map(option => {
            let buttonClass = 'btn-result';
            if (option.value === 'player1_win' || option.value === 'player2_win') {
                buttonClass += ' win';
            } else if (option.value === 'draw') {
                buttonClass += ' draw';
            } else if (option.value === 'double_loss') {
                buttonClass += ' loss';
            }
            
            let buttonText = '';
            if (option.value === 'player1_win') {
                buttonText = this.escapeHtml(pairing.player1.name) + ' 勝';
            } else if (option.value === 'player2_win') {
                buttonText = this.escapeHtml(pairing.player2.name) + ' 勝';
            } else if (option.value === 'draw') {
                buttonText = '平局';
            } else if (option.value === 'double_loss') {
                buttonText = '雙敗';
            }
            
            return `
                <button onclick="app.recordResult(${pairing.id}, '${option.value}')" class="${buttonClass}">
                    ${buttonText}
                </button>
            `;
        }).join('');
    }

    /**
     * 取得詳細結果文字
     */
    getDetailedResultText(result) {
        if (!result) return '待記錄';
        
        switch (result) {
            case 'bye': return '輪空 (3分)';
            case 'draw': return '平局 (各1分)';
            case 'player1_win': return 'P1 勝 (3分)';
            case 'player2_win': return 'P2 勝 (3分)';
            case 'double_loss': return '雙敗 (各0分)';
            default: return '未知結果';
        }
    }

    /**
     * 記錄比賽結果
     */
    recordResult(pairId, result, droppedPlayers = []) {
        try {
            const roundIndex = this.tournament.currentRound - 1;
            this.tournament.recordMatchResult(roundIndex, pairId, result, droppedPlayers);
            this.displayCurrentRound();
            this.showNotification('結果已記錄', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    /**
     * 編輯比賽結果
     */
    editMatchResult(pairId) {
        const pairing = this.tournament.getCurrentRoundPairings().find(p => p.id === pairId);
        if (!pairing || !pairing.completed) return;
        
        const currentResult = pairing.result;
        this.showEditResultModal(pairId, currentResult);
    }

    /**
     * 修正比賽結果
     */
    correctMatchResult(pairId, newResult, newDroppedPlayers = []) {
        try {
            this.showLoading(true);
            const roundIndex = this.tournament.currentRound - 1;
            const result = this.tournament.correctMatchResult(roundIndex, pairId, newResult, newDroppedPlayers);
            
            this.displayCurrentRound();
            
            if (result.needsRecalculation) {
                this.showNotification('結果已修正，建議重新計算後續輪次的配對', 'warning');
            } else {
                this.showNotification('結果已修正', 'success');
            }
        } catch (error) {
            this.showNotification('修正失敗: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 重新計算配對
     */
    recalculatePairings() {
        if (!confirm('重新計算將會刪除目前輪次之後的所有比賽記錄，確定要繼續嗎？')) return;
        
        try {
            this.showLoading(true);
            const currentRoundIndex = this.tournament.currentRound - 1;
            this.tournament.recalculatePairingsFromRound(currentRoundIndex);
            this.displayCurrentRound();
            this.showNotification('配對已重新計算', 'success');
        } catch (error) {
            this.showNotification('重新計算失敗: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 顯示棄權對話框
     */
    /**
     * 取得結果文字
     */
    getResultText(result) {
        if (!result) return '未完成';
        if (result === 'bye') return '輪空';
        if (result === 'draw') return '平局 (各1分)';
        if (result === 'player1_win') return 'P1 勝 (3分)';
        if (result === 'player2_win') return 'P2 勝 (3分)';
        if (result === 'double_loss') return '雙敗 (各0分)';
        return '未知';
    }

    /**
     * 更新輪次控制按鈕
     */
    updateRoundControls() {
        const round = this.tournament.rounds[this.tournament.currentRound - 1];
        const allCompleted = round && round.completed;
        const isLastRound = this.tournament.currentRound >= this.tournament.totalRounds;
        
        // 檢查是否有未完成的比賽
        const unfinishedMatches = round ? round.pairings.filter(p => !p.completed && p.result !== 'bye') : [];
        const hasUnfinished = unfinishedMatches.length > 0;
        
        const finishRoundBtn = document.getElementById('finish-round');
        const nextRoundBtn = document.getElementById('next-round');
        const finishTournamentBtn = document.getElementById('finish-tournament');
        
        if (finishRoundBtn) {
            if (allCompleted) {
                finishRoundBtn.style.display = 'none';
            } else {
                finishRoundBtn.style.display = 'inline-block';
                finishRoundBtn.disabled = hasUnfinished;
                finishRoundBtn.title = hasUnfinished ? 
                    `還有 ${unfinishedMatches.length} 場比賽未完成` : 
                    '結束本輪';
            }
        }
        
        if (nextRoundBtn) {
            nextRoundBtn.style.display = allCompleted && !isLastRound ? 'inline-block' : 'none';
        }
        
        if (finishTournamentBtn) {
            finishTournamentBtn.style.display = allCompleted && isLastRound ? 'inline-block' : 'none';
        }
    }

    /**
     * 結束本輪
     */
    finishRound() {
        const round = this.tournament.rounds[this.tournament.currentRound - 1];
        const unfinishedMatches = round.pairings.filter(p => !p.completed && p.result !== 'bye');
        
        if (unfinishedMatches.length > 0) {
            // 顯示未完成的比賽清單
            const unfinishedList = unfinishedMatches.map(p => {
                const player1 = p.player1.name;
                const player2 = p.player2 ? p.player2.name : 'BYE';
                return `• ${player1} vs ${player2}`;
            }).join('\n');
            
            alert(`無法結束本輪，還有以下 ${unfinishedMatches.length} 場比賽未完成：\n\n${unfinishedList}\n\n請先完成所有比賽結果記錄。`);
            return;
        }
        
        // 所有比賽都已完成
        this.displayCurrentRound();
        this.showNotification(`第 ${this.tournament.currentRound} 輪結束`, 'success');
    }

    /**
     * 下一輪
     */
    nextRound() {
        try {
            this.showLoading(true);
            this.showPairingArrangement();
            this.showNotification(`準備第 ${this.tournament.currentRound + 1} 輪配對`, 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 結束比賽
     */
    finishTournament() {
        if (!confirm('確定要結束比賽嗎？結束後將無法再添加輪次。')) return;
        
        try {
            this.showLoading(true);
            this.tournament.finishTournament();
                this.updateCurrentTournamentCard();

                if (this.tournament.playoff && this.tournament.playoff.enabled) {
                    this.showPlayoffSetup();
                    this.showNotification('瑞士輪已結束，請確認複賽設定', 'success');
                } else {
                    this.displayFinalRanking();
                    this.showPage('final-ranking');
                    this.showNotification('比賽結束！已自動儲存到歷史記錄', 'success');
                }
        } catch (error) {
            this.showNotification(error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 顯示最終排名
     */
    displayFinalRanking() {
        const ranking = this.tournament.getFinalRanking();
        const stats = this.tournament.getStatistics();
        
        // 顯示比賽摘要
        const summaryDiv = document.getElementById('tournament-summary');
        if (summaryDiv) {
            summaryDiv.innerHTML = `
                <div class="tournament-stats">
                    <div class="stat-card">
                        <div class="stat-icon">🏆</div>
                        <div class="stat-content">
                            <span class="stat-label">冠軍</span>
                            <span class="stat-value">${this.escapeHtml(stats.champion ? stats.champion.name : '未知')}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">👥</div>
                        <div class="stat-content">
                            <span class="stat-label">參賽人數</span>
                            <span class="stat-value">${stats.totalPlayers}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">🎯</div>
                        <div class="stat-content">
                            <span class="stat-label">比賽輪數</span>
                            <span class="stat-value">${stats.completedRounds}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 生成排名表格
        const tableHtml = `
            <table class="ranking-table">
                <thead>
                    <tr>
                        <th class="rank">排名</th>
                        <th>選手</th>
                        <th>總積分</th>
                        <th>OMW%</th>
                        <th>戰勝對手積分</th>
                        <th>OOMW%</th>
                        <th>勝場</th>
                        <th>平局</th>
                        <th>敗場</th>
                        <th>輪空</th>
                        <th>狀態</th>
                    </tr>
                </thead>
                <tbody>
                    ${ranking.map((player) => {
                        const wins = player.results.filter(r => r.resultType === 'win').length;
                        const draws = player.results.filter(r => r.resultType === 'draw').length;
                        const losses = player.results.filter(r => r.resultType === 'loss').length;
                        const byes = player.results.filter(r => r.resultType === 'bye').length;
                        
                        let rankClass = '';
                        if (player.rank === 1) rankClass = 'first';
                        else if (player.rank === 2) rankClass = 'second';
                        else if (player.rank === 3) rankClass = 'third';
                        
                        return `
                            <tr>
                                <td class="rank ${rankClass}">${player.rank}</td>
                                <td>${this.escapeHtml(player.name)}</td>
                                <td>${player.score}</td>
                                <td>${(player.omwPercentage || 0).toFixed(1)}%</td>
                                <td>${player.buchholz.toFixed(1)}</td>
                                <td>${(player.oomwPercentage || 0).toFixed(1)}%</td>
                                <td>${wins}</td>
                                <td>${draws}</td>
                                <td>${losses}</td>
                                <td>${byes}</td>
                                <td>${player.dropped ? '已棄權' : '完賽'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        const rankingTableDiv = document.getElementById('ranking-table');
        if (rankingTableDiv) {
            rankingTableDiv.innerHTML = tableHtml;
        }

        // 添加詳細計分說明
        this.displayScoringDetails(ranking, stats);

        const finalActionsBar = document.getElementById('final-actions-bar');
        if (finalActionsBar) {
            const status = this.tournament.getStatus();
            const playoffConfigured = !!this.tournament.playoff?.enabled;
            const canConfigurePlayoff = status === 'swiss_complete' || status === 'playoff_ready';

            finalActionsBar.innerHTML = `
                ${canConfigurePlayoff && this.tournament.settings.enablePlayoff ? '<button id="final-playoff-setup" class="btn btn-warning">複賽設定</button>' : ''}
                ${status === 'playoff_ready' && playoffConfigured ? '<button id="final-start-playoff" class="btn btn-danger">開始複賽</button>' : ''}
                <button id="new-tournament" class="btn btn-primary">開始新比賽</button>
                <button id="export-result" class="btn btn-secondary">匯出結果</button>
            `;

            document.getElementById('final-playoff-setup')?.addEventListener('click', () => this.showPlayoffSetup());
            document.getElementById('final-start-playoff')?.addEventListener('click', () => this.startPlayoff());
            document.getElementById('new-tournament')?.addEventListener('click', () => this.newTournament());
            document.getElementById('export-result')?.addEventListener('click', () => this.exportResult());
        }
    }

    /**
     * 顯示詳細計分說明
     */
    displayScoringDetails(ranking, stats) {
        const scoringDetailsDiv = document.getElementById('scoring-details');
        if (!scoringDetailsDiv) return;

        // 生成計分規則說明
        const scoringRules = this.generateScoringRulesHtml();
        
        // 生成統計分析
        const statisticsHtml = this.generateStatisticsHtml(ranking, stats);
        
        // 生成前三名詳細分析
        const topPlayersAnalysis = this.generateTopPlayersAnalysisHtml(ranking);

        scoringDetailsDiv.innerHTML = `
            <div class="scoring-details-container">
                ${scoringRules}
                ${statisticsHtml}
                ${topPlayersAnalysis}
            </div>
        `;
    }

    /**
     * 生成計分規則說明
     */
    generateScoringRulesHtml() {
        const rules = [
            { label: '勝利', points: '3分', description: '擊敗對手獲得' },
            { label: '平局', points: '1分', description: '與對手和局各得', available: this.tournament.settings.allowDraws },
            { label: '失敗', points: '0分', description: '被對手擊敗' },
            { label: '輪空', points: '3分', description: '該輪次無對手自動獲得' },
            { label: '雙敗', points: '0分', description: '雙方都被判負', available: this.tournament.settings.allowDoubleLoss }
        ];

        const availableRules = rules.filter(rule => rule.available !== false);

        return `
            <div class="scoring-rules-section">
                <h4>計分規則</h4>
                <div class="rules-grid">
                    ${availableRules.map(rule => `
                        <div class="rule-item">
                            <div class="rule-label">${rule.label}</div>
                            <div class="rule-points">${rule.points}</div>
                            <div class="rule-description">${rule.description}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="tiebreak-rules">
                    <h5>同分決勝規則（日版瑞士制）</h5>
                    <ol>
                        <li><strong>總積分</strong> - 主要排名依據</li>
                        <li><strong>OMW%（對手平均勝率）</strong> - 對手的勝率平均值</li>
                        <li><strong>戰勝對手積分（WOScore）</strong> - 所有對手的總積分（對手強度）</li>
                        <li><strong>OOMW%（平均對手勝率）</strong> - 對手的對手平均勝率</li>
                    </ol>
                </div>
            </div>
        `;
    }

    /**
     * 生成統計分析
     */
    generateStatisticsHtml(ranking, stats) {
        // 計算各種統計數據
        const scoreDistribution = this.calculateScoreDistribution(ranking);
        const averageScore = ranking.reduce((sum, p) => sum + p.score, 0) / ranking.length;
        const averageWOScore = ranking.reduce((sum, p) => sum + p.buchholz, 0) / ranking.length;
        const averageOMW = ranking.reduce((sum, p) => sum + (p.omwPercentage || 0), 0) / ranking.length;
        const averageOOMW = ranking.reduce((sum, p) => sum + (p.oomwPercentage || 0), 0) / ranking.length;
        const totalMatches = stats.completedRounds * ranking.length / 2;
        
        // 計算比賽結果分佈
        const resultDistribution = this.calculateResultDistribution(ranking);

        return `
            <div class="statistics-section">
                <h4>比賽統計</h4>
                <div class="stats-grid">
                    <div class="stat-group">
                        <h5>積分統計</h5>
                        <div class="stat-row">
                            <span class="stat-label">平均積分:</span>
                            <span class="stat-value">${averageScore.toFixed(1)}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">最高積分:</span>
                            <span class="stat-value">${Math.max(...ranking.map(p => p.score))}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">最低積分:</span>
                            <span class="stat-value">${Math.min(...ranking.map(p => p.score))}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">平均戰勝對手積分:</span>
                            <span class="stat-value">${averageWOScore.toFixed(1)}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">平均 OMW%:</span>
                            <span class="stat-value">${averageOMW.toFixed(1)}%</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">平均 OOMW%:</span>
                            <span class="stat-value">${averageOOMW.toFixed(1)}%</span>
                        </div>
                    </div>
                    
                    <div class="stat-group">
                        <h5>比賽結果</h5>
                        ${Object.entries(resultDistribution).map(([type, count]) => `
                            <div class="stat-row">
                                <span class="stat-label">${this.getResultTypeLabel(type)}:</span>
                                <span class="stat-value">${count} 場</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="stat-group">
                        <h5>積分分佈</h5>
                        ${Object.entries(scoreDistribution).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).map(([score, count]) => `
                            <div class="stat-row">
                                <span class="stat-label">${score} 分:</span>
                                <span class="stat-value">${count} 人</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 生成前三名詳細分析
     */
    generateTopPlayersAnalysisHtml(ranking) {
        const topPlayers = ranking.slice(0, 3);
        
        return `
            <div class="top-players-section">
                <h4>前三名詳細分析</h4>
                <div class="top-players-grid">
                    ${topPlayers.map((player, index) => {
                        const opponents = this.getPlayerOpponents(player);
                        const opponentStrengthAvg = opponents.length > 0 ? 
                            opponents.reduce((sum, opp) => sum + opp.score, 0) / opponents.length : 0;
                        
                        return `
                            <div class="player-analysis-card rank-${index + 1}">
                                <div class="player-rank-badge">${index + 1}</div>
                                <div class="player-analysis-content">
                                    <h5>${this.escapeHtml(player.name)}</h5>
                                    <div class="analysis-stats">
                                        <div class="analysis-row">
                                            <span>總積分:</span>
                                            <span class="highlight">${player.score}</span>
                                        </div>
                                        <div class="analysis-row">
                                            <span>OMW%:</span>
                                            <span>${(player.omwPercentage || 0).toFixed(1)}%</span>
                                        </div>
                                        <div class="analysis-row">
                                            <span>戰勝對手積分:</span>
                                            <span>${player.buchholz.toFixed(1)}</span>
                                        </div>
                                        <div class="analysis-row">
                                            <span>OOMW%:</span>
                                            <span>${(player.oomwPercentage || 0).toFixed(1)}%</span>
                                        </div>
                                        <div class="analysis-row">
                                            <span>對手平均積分:</span>
                                            <span>${opponentStrengthAvg.toFixed(1)}</span>
                                        </div>
                                        <div class="analysis-row">
                                            <span>勝率:</span>
                                            <span>${this.calculateWinRate(player)}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * 計算積分分佈
     */
    calculateScoreDistribution(ranking) {
        const distribution = {};
        ranking.forEach(player => {
            const score = player.score;
            distribution[score] = (distribution[score] || 0) + 1;
        });
        return distribution;
    }

    /**
     * 計算比賽結果分佈
     */
    calculateResultDistribution(ranking) {
        const distribution = {
            win: 0,
            draw: 0,
            loss: 0,
            bye: 0
        };
        
        ranking.forEach(player => {
            player.results.forEach(result => {
                if (distribution.hasOwnProperty(result.resultType)) {
                    distribution[result.resultType]++;
                }
            });
        });
        
        return distribution;
    }

    /**
     * 獲取結果類型標籤
     */
    getResultTypeLabel(type) {
        const labels = {
            win: '勝利',
            draw: '平局',
            loss: '失敗',
            bye: '輪空'
        };
        return labels[type] || type;
    }

    /**
     * 獲取選手對手列表
     */
    getPlayerOpponents(player) {
        const opponents = [];
        this.tournament.rounds.forEach(round => {
            const pairing = round.pairings.find(p => 
                p.player1.id === player.id || (p.player2 && p.player2.id === player.id)
            );
            if (pairing && pairing.completed) {
                if (pairing.player1.id === player.id && pairing.player2) {
                    opponents.push(pairing.player2);
                } else if (pairing.player2 && pairing.player2.id === player.id) {
                    opponents.push(pairing.player1);
                }
            }
        });
        return opponents;
    }

    /**
     * 計算勝率
     */
    calculateWinRate(player) {
        const totalGames = player.results.filter(r => r.resultType !== 'bye').length;
        const wins = player.results.filter(r => r.resultType === 'win').length;
        return totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
    }

    /**
     * 新比賽（建立全新獨立的 SwissTournament）
     */
    newTournament() {
        this.tournament = new SwissTournament();
        this.populateSetupFormFromTournament();
        this.showPage('tournament-setup');
    }

    /**
     * 匯出比賽
     */
    exportTournament() {
        try {
            const data = this.tournament.exportTournament();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `swiss_tournament_${this.tournament.tournamentId}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification('比賽資料匯出成功', 'success');
        } catch (error) {
            this.showNotification('匯出失敗: ' + error.message, 'error');
        }
    }

    /**
     * 匯入比賽（建立新的獨立賽事）
     */
    importTournament(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const t = new SwissTournament();
                t.importTournament(data); // 內部會呼叫 saveTournament → 自動 register
                this.tournament = t;
                this.updateCurrentTournamentCard();
                this.loadExistingTournament();
                this.showNotification('比賽匯入成功！', 'success');
            } catch (error) {
                this.showNotification('匯入失敗: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    /**
     * 匯出結果
     */
    exportResult() {
        this.exportTournament();
    }

    /**
     * 顯示頁面
     */
    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
        }
    }

    /**
     * 顯示載入中
     */
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * 顯示通知
     */
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const messageSpan = document.getElementById('notification-message');
        
        if (notification && messageSpan) {
            messageSpan.textContent = message;
            notification.className = `notification ${type}`;
            notification.style.display = 'flex';
            
            // 自動隱藏
            setTimeout(() => {
                this.hideNotification();
            }, 3000);
        }
    }

    /**
     * 隱藏通知
     */
    hideNotification() {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.style.display = 'none';
        }
    }

    /**
     * HTML 轉義
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 顯示歷史比賽
     */
    showTournamentHistory() {
        this.updateCurrentTournamentCard();
        this.updateHistoryList();
        this.showPage('tournament-history');
    }

    /**
     * 更新目前賽事區塊（支援多場賽事同時進行）
     * 在首頁顯示所有進行中的賽事卡片
     */
    updateCurrentTournamentCard() {
        const grid = document.getElementById('active-tournaments-grid');
        if (!grid) return;

        const tournaments = SwissTournament.getActiveTournamentIds()
            .map(id => SwissTournament.loadById(id))
            .filter(Boolean)
            .sort((a, b) => new Date(b.lastUpdate || 0) - new Date(a.lastUpdate || 0));
        let html = '';

        tournaments.forEach(t => {
            html += this.renderActiveTournamentCard(t);
        });

        if (!html) {
            html = `
                <div class="no-active-tournaments">
                    <div class="no-tournaments-icon">🏆</div>
                    <div class="no-tournaments-text">尚無進行中的賽事</div>
                    <div class="no-tournaments-hint">點擊「開啟新比賽」開始</div>
                </div>
            `;
        }

        grid.innerHTML = html;
    }

    /**
     * 產生單一賽事卡片 HTML
     */
    renderActiveTournamentCard(t) {
        const id = t.tournamentId;
        const status = t.getStatus();

        const statusLabels = {
            idle:               { label: '未開賽',   cls: 'badge-idle',    icon: '⏳' },
            setup:              { label: '等待開賽', cls: 'badge-setup',   icon: '⏳' },
            playing:            { label: '比賽中',   cls: 'badge-playing', icon: '⚔️' },
            round_complete:     { label: '輪次結束', cls: 'badge-warning', icon: '⏸' },
            last_round_complete:{ label: '最終輪結束',cls:'badge-warning', icon: '🏁' },
            swiss_complete:     { label: '瑞士輪完成',cls:'badge-success', icon: '🏆' },
            playoff_ready:      { label: '複賽就緒', cls: 'badge-playoff', icon: '🔥' },
            in_playoff:         { label: '複賽中',   cls: 'badge-playoff', icon: '⚡' },
            finished:           { label: '已結束',   cls: 'badge-finished',icon: '🎊' }
        };

        const sl = statusLabels[status] || statusLabels.idle;
        const baseTitle = status === 'idle' && !t.tournamentName ? '未命名賽事' : t.generateTournamentTitle();
        const title = this.escapeHtml(baseTitle);

        let desc = '';
        switch (status) {
            case 'idle':       desc = '尚未輸入選手，點選進入設定'; break;
            case 'setup':      desc = `${t.players.length} 位選手 · 共 ${t.totalRounds} 輪`; break;
            case 'playing': {
                const rd = t.rounds[t.currentRound - 1];
                const done = rd ? rd.pairings.filter(p => p.completed).length : 0;
                const total = rd ? rd.pairings.length : 0;
                desc = `第 ${t.currentRound}/${t.totalRounds} 輪 · ${done}/${total} 場完成`;
                break;
            }
            case 'round_complete':
                desc = `第 ${t.currentRound} 輪完成 → 準備第 ${t.currentRound + 1} 輪`;
                break;
            case 'last_round_complete':
                desc = '所有輪次完成，請確認結果';
                break;
            case 'swiss_complete': {
                const r = t.getFinalRanking();
                desc = r.length > 0 ? `第一名：${this.escapeHtml(r[0].name)}（${r[0].score}分）` : '瑞士輪完成';
                break;
            }
            case 'playoff_ready':
                desc = `晉級 ${t.playoff.advanceCount} 強 · 單淘汰制`;
                break;
            case 'in_playoff':
                desc = `複賽第 ${t.playoff.currentRound}/${t.playoff.totalRounds} 輪`;
                break;
            case 'finished': {
                const ch = t.playoff?.champion;
                desc = ch ? `冠軍：${this.escapeHtml(ch.name)}` : '比賽已結束';
                break;
            }
        }

        return `
            <div class="active-tournament-card card-status-${status}">
                <div class="atc-header">
                    <span class="status-badge ${sl.cls}">${sl.icon} ${sl.label}</span>
                    <button class="atc-delete-btn" onclick="app.deleteTournamentById('${id}')" title="刪除賽事">✕</button>
                </div>
                <div class="atc-title">${title}</div>
                <div class="atc-desc">${desc}</div>
                <div class="atc-actions">
                    <button class="btn btn-primary atc-enter-btn" onclick="app.enterTournament('${id}')">進入賽事</button>
                    <button class="btn btn-outline-warning atc-reset-btn" onclick="app.resetTournamentById('${id}')">重置</button>
                </div>
            </div>
        `;
    }

    /**
     * 更新歷史比賽列表
     */
    updateHistoryList() {
        const listContainer = document.getElementById('history-tournaments-list');
        if (!listContainer) return;

        const history = this.tournament.getTournamentHistory();
        
        if (history.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <p>暫無歷史比賽記錄</p>
                    <small>完成的比賽會自動儲存到這裡</small>
                </div>
            `;
            return;
        }

        const historyHtml = history.map(tournament => `
            <div class="tournament-card history" data-tournament-id="${tournament.tournamentId}">
                <div class="tournament-info">
                    <div class="tournament-title">
                        ${this.escapeHtml(tournament.title)}
                    </div>
                    <div class="tournament-details">
                        <span class="status ${tournament.isFinished ? 'finished' : 'incomplete'}">
                            ${tournament.isFinished ? '已完成' : '未完成'}
                        </span>
                        <span class="players-count">${tournament.players.length} 位選手</span>
                        <span class="rounds-info">${tournament.stats.completedRounds}/${tournament.totalRounds} 輪</span>
                        <span class="history-playoff-summary">${this.getTournamentPlayoffSummary(tournament)}</span>
                        <span class="date">${new Date(tournament.endTime || tournament.startTime).toLocaleString('zh-TW')}</span>
                    </div>
                </div>
                <div class="tournament-actions">
                    <button onclick="app.loadHistoryTournament('${tournament.tournamentId}')" class="btn btn-secondary">
                        載入
                    </button>
                    <button onclick="app.exportHistoryTournament('${tournament.tournamentId}')" class="btn btn-secondary">
                        匯出
                    </button>
                    <button onclick="app.viewTournamentResults('${tournament.tournamentId}')" class="btn btn-info">
                        檢視結果
                    </button>
                    <button onclick="app.deleteHistoryTournament('${tournament.tournamentId}')" class="btn btn-danger">
                        刪除
                    </button>
                </div>
            </div>
        `).join('');

        listContainer.innerHTML = historyHtml;
    }

    getTournamentPlayoffSummary(tournament) {
        const advanceCount = tournament.playoff?.advanceCount || tournament.settings?.playoffAdvanceCount || null;
        const enabled = !!(tournament.playoff?.enabled || tournament.settings?.enablePlayoff || advanceCount);

        if (!enabled) {
            return '無複賽';
        }

        return advanceCount ? `有複賽 · 取 ${advanceCount} 強` : '有複賽';
    }

    /**
     * 繼續目前比賽（根據狀態導航到正確頁面）
     */
    continueCurrent() {
        const status = this.tournament.getStatus();
        switch (status) {
            case 'finished':
            case 'in_playoff':
                this.showPlayoffBracket();
                break;
            case 'playoff_ready':
                this.showPlayoffSetup();
                break;
            case 'swiss_complete':
                this.displayFinalRanking();
                this.showPage('final-ranking');
                break;
            case 'playing':
            case 'round_complete':
            case 'last_round_complete':
                this.displayCurrentRound();
                break;
            case 'setup':
                this.displayTournamentInfo();
                break;
            default:
                this.showPage('tournament-setup');
        }
    }

    /**
     * 重置比賽（回到未開賽狀態，保留賽事名稱和 ID）
     */
    resetCurrent() {
        const name = this.tournament.generateTournamentTitle();
        if (!confirm(`確定要重置「${name}」？比賽資料（選手、輪次、結果）將全部清空，賽事名稱保留。`)) return;

        this.tournament.resetTournament();
        this.showPage('tournament-history');
        this.updateCurrentTournamentCard();
        this.showNotification('比賽已重置為未開賽狀態', 'info');
    }

    /**
     * 頁面上的「重置比賽」按鈕（由賽事 ID 操作）
     */
    resetTournamentById(id) {
        const t = SwissTournament.loadById(id);
        if (!t) return;
        const name = t.generateTournamentTitle();
        if (!confirm(`確定要重置「${name}」？比賽資料將清空，賽事名稱保留。`)) return;

        t.resetTournament();
        // 如果目前進入的正是這場賽事，同步更新 this.tournament
        if (this.tournament.tournamentId === id) {
            this.tournament = t;
        }
        this.updateCurrentTournamentCard();
        this.showNotification('比賽已重置為未開賽狀態', 'info');
    }

    /**
     * 刪除指定賽事（完全移除，不可回復）
     */
    deleteTournamentById(id) {
        const t = SwissTournament.loadById(id);
        if (!t) return;
        const name = t.generateTournamentTitle();
        if (!confirm(`確定要刪除「${name}」？此操作無法復原。`)) return;

        t.deleteTournament();
        // 如果刪的是目前進入的賽事，重置 this.tournament
        if (this.tournament.tournamentId === id) {
            this.tournament = new SwissTournament();
        }
        this.updateCurrentTournamentCard();
        this.showNotification('賽事已刪除', 'warning');
    }

    /**
     * 載入歷史比賽（建立新的獨立賽事，不覆蓋現有賽事）
     */
    loadHistoryTournament(tournamentId) {
        try {
            const t = new SwissTournament();
            t.loadFromHistory(tournamentId); // 內部呼叫 saveTournament → 自動 register
            this.tournament = t;
            this.updateCurrentTournamentCard();
            this.loadExistingTournament();
            this.showNotification('歷史比賽已載入為新賽事', 'success');
        } catch (error) {
            this.showNotification('載入失敗: ' + error.message, 'error');
        }
    }

    /**
     * 檢視歷史比賽結果
     */
    viewTournamentResults(tournamentId) {
        try {
            console.log('檢視比賽結果，ID:', tournamentId);
            
            const history = this.tournament.getTournamentHistory();
            console.log('歷史記錄數量:', history.length);
            
            const tournamentData = history.find(t => t.tournamentId === tournamentId);
            
            if (!tournamentData) {
                console.error('找不到比賽記錄，ID:', tournamentId);
                this.showNotification('找不到指定的比賽記錄', 'error');
                return;
            }

            console.log('找到比賽記錄:', tournamentData.title);
            
            // 直接顯示結果頁面，不需要載入到當前比賽狀態
            this.displayHistoryResults(tournamentData);
            
        } catch (error) {
            console.error('檢視比賽結果失敗:', error);
            this.showNotification('檢視比賽結果失敗: ' + error.message, 'error');
        }
    }

    /**
     * 顯示歷史比賽結果
     */
    displayHistoryResults(tournament) {
        console.log('顯示歷史比賽結果:', tournament.title);
        
        try {
            // 建立結果模態窗口
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = 'history-results-modal';
            modal.innerHTML = `
                <div class="modal-content history-results-modal">
                    <div class="modal-header">
                        <h3>${this.escapeHtml(tournament.title || '未命名比賽')} - 比賽結果</h3>
                        <button class="modal-close" onclick="app.closeModal('history-results-modal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="results-content">
                            ${this.generateHistoryResultsContent(tournament)}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="app.closeModal('history-results-modal')">關閉</button>
                    </div>
                </div>
            `;
            
            console.log('模態窗口已創建，準備添加到 body');
            document.body.appendChild(modal);
            console.log('模態窗口已添加到 body');
            
            // 確保模態窗口立即顯示
            this.historyPlayoffViewerTournament = tournament;
            setTimeout(() => {
                modal.classList.add('show');
                this.renderHistoryPlayoffViewer(tournament);
                console.log('模態窗口顯示類別已添加');
            }, 10);
            
        } catch (error) {
            console.error('顯示結果模態窗口失敗:', error);
            this.showNotification('顯示結果失敗: ' + error.message, 'error');
        }
    }

    /**
     * 生成歷史比賽結果內容
     */
    generateHistoryResultsContent(tournament) {
        console.log('生成結果內容，比賽資料:', tournament);
        
        try {
            // 確保基本資料存在
            if (!tournament.players || !Array.isArray(tournament.players)) {
                return '<div class="error">比賽資料不完整：缺少選手資訊</div>';
            }
            
            // 重新計算 Buchholz 係數
            const players = [...tournament.players];
            
            // 確保每個選手都有必要的屬性
            players.forEach(player => {
                if (!player.opponents) player.opponents = [];
                if (!player.results) player.results = [];
                if (typeof player.score !== 'number') player.score = 0;
                
                let buchholz = 0;
                let sosBuchholz = 0;
                let opponentMatchCount = 0;
                let opponentWinCount = 0;
                
                player.opponents.forEach(opponentId => {
                    const opponent = players.find(p => p.id === opponentId);
                    if (opponent) {
                        buchholz += (opponent.score || 0);
                        sosBuchholz += (opponent.buchholz || 0);
                        
                        // 計算對手的勝場和總場次
                        const opponentMatches = opponent.results?.length || 0;
                        const opponentWins = opponent.results?.filter(r => 
                            r.resultType === 'win' || r.resultType === 'bye'
                        ).length || 0;
                        
                        opponentMatchCount += opponentMatches;
                        opponentWinCount += opponentWins;
                    }
                });
                
                player.buchholz = buchholz;
                player.sosBuchholz = sosBuchholz;
                
                // 計算 OMW% (對手平均勝率)
                player.omwPercentage = opponentMatchCount > 0 ? 
                    (opponentWinCount / opponentMatchCount) * 100 : 0;
            });
            
            // 第二輪：計算 OOMW%
            players.forEach(player => {
                let totalOpponentOMW = 0;
                let opponentCount = 0;
                
                player.opponents.forEach(opponentId => {
                    const opponent = players.find(p => p.id === opponentId);
                    if (opponent) {
                        totalOpponentOMW += (opponent.omwPercentage || 0);
                        opponentCount++;
                    }
                });
                
                // 計算 OOMW% (平均對手勝率)
                player.oomwPercentage = opponentCount > 0 ? 
                    totalOpponentOMW / opponentCount : 0;
            });
            
            // 排序選手（與日版瑞士制邏輯一致）
            const sortedPlayers = players.sort((a, b) => {
                if (a.dropped !== b.dropped) return a.dropped ? 1 : -1;
                if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score;
                if (Math.abs(b.omwPercentage - a.omwPercentage) > 0.001) return b.omwPercentage - a.omwPercentage;
                if (Math.abs(b.buchholz - a.buchholz) > 0.001) return b.buchholz - a.buchholz;
                return b.oomwPercentage - a.oomwPercentage;
            });
            
            // 添加排名
            let currentRank = 1;
            sortedPlayers.forEach((player, index) => {
                if (index > 0) {
                    const prevPlayer = sortedPlayers[index - 1];
                    if (player.dropped !== prevPlayer.dropped ||
                        player.score !== prevPlayer.score || 
                        Math.abs(player.buchholz - prevPlayer.buchholz) > 0.001 ||
                        Math.abs(player.sosBuchholz - prevPlayer.sosBuchholz) > 0.001) {
                        currentRank = index + 1;
                    }
                }
                player.rank = currentRank;
            });
            
            // 生成統計資料
            const stats = {
                champion: tournament.playoff?.champion || tournament.champion || sortedPlayers.find(player => !player.dropped) || sortedPlayers[0],
                totalPlayers: players.length,
                completedRounds: tournament.stats?.completedRounds || tournament.rounds?.length || 0
            };

            // 比賽摘要（與 displayFinalRanking 一致）
            const summarySection = `
                <div class="tournament-stats">
                    <div class="stat-card">
                        <div class="stat-icon">🏆</div>
                        <div class="stat-content">
                            <span class="stat-label">冠軍</span>
                            <span class="stat-value">${this.escapeHtml(stats.champion ? stats.champion.name : '未知')}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">👥</div>
                        <div class="stat-content">
                            <span class="stat-label">參賽人數</span>
                            <span class="stat-value">${stats.totalPlayers}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">🎯</div>
                        <div class="stat-content">
                            <span class="stat-label">比賽輪數</span>
                            <span class="stat-value">${stats.completedRounds}</span>
                        </div>
                    </div>
                </div>
            `;

            // 排名表格（與 displayFinalRanking 一致）
            const rankingSection = `
                <div class="ranking-section">
                    <h4>最終排名</h4>
                    <table class="ranking-table">
                        <thead>
                            <tr>
                                <th class="rank">排名</th>
                                <th>選手</th>
                                <th>總積分</th>
                                <th>OMW%</th>
                                <th>戰勝對手積分</th>
                                <th>OOMW%</th>
                                <th>勝場</th>
                                <th>平局</th>
                                <th>敗場</th>
                                <th>輪空</th>
                                <th>狀態</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedPlayers.map((player) => {
                                const wins = player.results?.filter(r => r.resultType === 'win').length || 0;
                                const draws = player.results?.filter(r => r.resultType === 'draw').length || 0;
                                const losses = player.results?.filter(r => r.resultType === 'loss').length || 0;
                                const byes = player.results?.filter(r => r.resultType === 'bye').length || 0;
                                
                                let rankClass = '';
                                if (player.rank === 1) rankClass = 'first';
                                else if (player.rank === 2) rankClass = 'second';
                                else if (player.rank === 3) rankClass = 'third';
                                
                                return `
                                    <tr>
                                        <td class="rank ${rankClass}">${player.rank}</td>
                                        <td>${this.escapeHtml(player.name)}</td>
                                        <td>${player.score}</td>
                                        <td>${player.omwPercentage?.toFixed(1) || '0.0'}%</td>
                                        <td>${player.buchholz.toFixed(1)}</td>
                                        <td>${player.oomwPercentage?.toFixed(1) || '0.0'}%</td>
                                        <td>${wins}</td>
                                        <td>${draws}</td>
                                        <td>${losses}</td>
                                        <td>${byes}</td>
                                        <td>${player.dropped ? '已棄權' : '完賽'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            // 各輪對戰結果
            const roundsSection = this.generateHistoryRoundsSection(tournament);
            const playoffSection = this.generateHistoryPlayoffSection(tournament);

            return summarySection + rankingSection + roundsSection + playoffSection;
            
        } catch (error) {
            console.error('生成歷史結果內容時發生錯誤:', error);
            return '<div class="error">載入比賽結果時發生錯誤: ' + error.message + '</div>';
        }
    }

    /**
     * 生成歷史比賽各輪結果部分
     */
    generateHistoryRoundsSection(tournament) {
        if (!tournament.rounds || tournament.rounds.length === 0) {
            return '<div class="rounds-section"><h4>各輪對戰結果</h4><p>暫無對戰記錄</p></div>';
        }

        return `
            <div class="rounds-section">
                <h4>各輪對戰結果</h4>
                <div class="rounds-container">
                    ${tournament.rounds.map((round, roundIndex) => `
                        <div class="round-result">
                            <h5>第 ${roundIndex + 1} 輪</h5>
                            <div class="round-matches">
                                ${(round.pairings || []).map(pairing => {
                                    if (!pairing.player2) {
                                        // BYE 情況
                                        return `<div class="match-result bye">
                                            ${this.escapeHtml(pairing.player1.name)} 輪空
                                        </div>`;
                                    } else {
                                        // 一般對戰
                                        let resultText = '';
                                        switch (pairing.result) {
                                            case 'player1_win':
                                                resultText = `${this.escapeHtml(pairing.player1.name)} 勝 ${this.escapeHtml(pairing.player2.name)}`;
                                                break;
                                            case 'player2_win':
                                                resultText = `${this.escapeHtml(pairing.player2.name)} 勝 ${this.escapeHtml(pairing.player1.name)}`;
                                                break;
                                            case 'draw':
                                                resultText = `${this.escapeHtml(pairing.player1.name)} 平 ${this.escapeHtml(pairing.player2.name)}`;
                                                break;
                                            case 'double_loss':
                                                resultText = `${this.escapeHtml(pairing.player1.name)} 對 ${this.escapeHtml(pairing.player2.name)} (雙敗)`;
                                                break;
                                            default:
                                                resultText = `${this.escapeHtml(pairing.player1.name)} vs ${this.escapeHtml(pairing.player2.name)} (未完成)`;
                                        }
                                        return `<div class="match-result">${resultText}</div>`;
                                    }
                                }).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    generateHistoryPlayoffSection(tournament) {
        const playoff = tournament.playoff;
        if (!playoff || !Array.isArray(playoff.rounds) || playoff.rounds.length === 0) {
            return '';
        }

        const playoffTitle = playoff.isFinished ? '複賽結果（已完成）' : '複賽結果（進行中）';
        const playoffSummary = this.getTournamentPlayoffSummary(tournament);

        return `
            <div class="rounds-section playoff-results-section" data-view="bracket">
                <div class="playoff-results-header">
                    <div class="playoff-results-heading">
                        <h4>${playoffTitle}</h4>
                        <div class="playoff-results-meta">
                            <span class="playoff-meta-chip">${playoffSummary}</span>
                            <span class="playoff-meta-chip">單淘汰</span>
                            <span class="playoff-meta-chip">${playoff.isFinished ? '已完成' : `進行至第 ${playoff.currentRound || 1} 輪`}</span>
                        </div>
                    </div>
                    <div class="playoff-view-toggle">
                        <button type="button" class="btn btn-secondary active" data-view="bracket" onclick="app.toggleHistoryPlayoffView('bracket', this)">樹狀圖</button>
                        <button type="button" class="btn btn-secondary" data-view="list" onclick="app.toggleHistoryPlayoffView('list', this)">列表</button>
                    </div>
                </div>
                <div class="history-playoff-panel history-playoff-bracket" data-view="bracket">
                    ${this.renderHistoryPlayoffBracket(playoff, tournament)}
                </div>
                <div class="history-playoff-panel history-playoff-list" data-view="list" hidden>
                    <div class="rounds-container playoff-history-rounds">
                        ${playoff.rounds.map((round, roundIndex) => `
                            <div class="round-result playoff-round-result compact">
                                <h5>${this.getPlayoffRoundLabel(round, roundIndex, playoff.totalRounds)}</h5>
                                <div class="round-matches compact">
                                    ${(round.matches || []).map(match => `<div class="match-result${match.isBye ? ' bye' : ''}">${this.getHistoryPlayoffMatchText(match)}</div>`).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    getPlayoffRoundLabel(round, roundIndex, totalRounds) {
        return roundIndex === totalRounds - 1 ? '決賽' : `複賽第 ${round.round} 輪`;
    }

    getHistoryPlayoffMatchText(match) {
        const player1Name = match.player1 ? this.escapeHtml(match.player1.name) : '待定';
        const player2Name = match.player2 ? this.escapeHtml(match.player2.name) : '待定';

        if (match.isBye) {
            const winner = match.player1 ? this.escapeHtml(match.player1.name) : this.escapeHtml(match.player2?.name || '待定');
            return `${winner} BYE 自動晉級`;
        }

        if (match.completed) {
            const winnerName = match.player1?.id === match.winner ? player1Name : player2Name;
            const loserName = winnerName === player1Name ? player2Name : player1Name;
            return `${winnerName} 勝 ${loserName}`;
        }

        return `${player1Name} vs ${player2Name} (未完成)`;
    }

    getHistoryPlayoffViewerId(tournament) {
        return `history-playoff-bracket-viewer-${tournament.tournamentId || 'active'}`;
    }

    renderHistoryPlayoffBracket(playoff, tournament) {
        return `
            <div class="history-playoff-bracket-container">
                <div id="${this.getHistoryPlayoffViewerId(tournament)}" class="brackets-viewer esports-bracket-viewer history-playoff-viewer"></div>
            </div>
        `;
    }

    getPlayoffViewerStatus(match) {
        if (match.completed) return 4;
        if (match.player1 && match.player2) return 2;
        if (match.player1 || match.player2) return 1;
        return 0;
    }

    createPlayoffViewerOpponent(player, winnerId = null, fallbackId = null, fallbackName = null, bracketPosition = null) {
        const participantId = player?.id ?? fallbackId ?? null;
        if (participantId === null) {
            return { id: null };
        }

        const opponent = {
            id: participantId,
        };

        if (bracketPosition !== null) {
            opponent.position = bracketPosition;
        }

        if (winnerId && participantId === winnerId) {
            opponent.result = 'win';
            opponent.score = 1;
        } else if (winnerId) {
            opponent.result = 'loss';
            opponent.score = 0;
        }

        if (fallbackName) {
            opponent.name = fallbackName;
        }

        return opponent;
    }

    buildPlayoffViewerData(playoff, stageName) {
        const tournamentId = 1;
        const stageId = 0;
        const groupId = 0;
        const firstRoundNumber = playoff.rounds?.[0]?.round ?? 1;
        const roundIds = new Map((playoff.rounds || []).map((round, index) => [round.round, index]));
        const participants = [];
        const participantIds = new Set();
        const ensureParticipant = (id, name) => {
            if (id == null || participantIds.has(id)) return;
            participantIds.add(id);
            participants.push({
                id,
                tournament_id: tournamentId,
                name
            });
        };

        (playoff.participants || []).forEach(player => {
            if (!player || participantIds.has(player.id)) return;
            ensureParticipant(player.id, player.name);
        });

        (playoff.rounds || []).forEach(round => {
            (round.matches || []).forEach(match => {
                [match.player1, match.player2].forEach(player => {
                    if (!player || participantIds.has(player.id)) return;
                    ensureParticipant(player.id, player.name);
                });
            });
        });

        const matches = (playoff.rounds || []).flatMap(round =>
            (round.matches || []).map((match, index) => {
                const hasOneMissingOpponent = !!((match.player1 && !match.player2) || (!match.player1 && match.player2));
                const bye1Id = hasOneMissingOpponent && !match.player1 ? -(match.id * 10 + 1) : null;
                const bye2Id = hasOneMissingOpponent && !match.player2 ? -(match.id * 10 + 2) : null;
                const isFirstPlayoffRound = round.round === firstRoundNumber;
                const matchSlotBase = ((match.position ?? index) * 2) + 1;

                if (bye1Id !== null) ensureParticipant(bye1Id, 'BYE');
                if (bye2Id !== null) ensureParticipant(bye2Id, 'BYE');

                return {
                    id: match.id,
                    number: (match.position ?? index) + 1,
                    stage_id: stageId,
                    group_id: groupId,
                    round_id: roundIds.get(round.round) ?? index,
                    child_count: 0,
                    status: this.getPlayoffViewerStatus(match),
                    opponent1: this.createPlayoffViewerOpponent(
                        match.player1,
                        match.completed ? match.winner : null,
                        bye1Id,
                        bye1Id !== null ? 'BYE' : null,
                        isFirstPlayoffRound ? matchSlotBase : null
                    ),
                    opponent2: this.createPlayoffViewerOpponent(
                        match.player2,
                        match.completed ? match.winner : null,
                        bye2Id,
                        bye2Id !== null ? 'BYE' : null,
                        isFirstPlayoffRound ? matchSlotBase + 1 : null
                    ),
                };
            })
        );

        return {
            participants,
            stages: [{
                id: stageId,
                tournament_id: tournamentId,
                name: stageName,
                type: 'single_elimination',
                number: 1,
                settings: {
                    size: playoff.bracketSize || Math.max(2, (playoff.participants || []).length),
                    seedOrdering: ['natural'],
                    matchesChildCount: 0
                }
            }],
            matches,
            matchGames: []
        };
    }

    renderPlayoffViewerToSelector(playoff, selector, options = {}) {
        if (!window.bracketsViewer) {
            throw new Error('brackets-viewer 尚未載入');
        }

        const { readonly = false, title = 'Playoff' } = options;
        const data = this.buildPlayoffViewerData(playoff, title);

        window.bracketsViewer.render({
            stages: data.stages,
            matches: data.matches,
            matchGames: data.matchGames,
            participants: data.participants,
        }, {
            clear: true,
            selector,
            participantOriginPlacement: 'before',
            separatedChildCountLabel: true,
            showSlotsOrigin: false,
            showLowerBracketSlotsOrigin: false,
            highlightParticipantOnHover: true,
            showPopoverOnMatchLabelClick: false,
            onMatchClick: readonly ? undefined : (match) => this.handlePlayoffViewerMatchClick(match.id),
            customRoundName: ({ roundNumber, roundCount }) => {
                if (roundNumber === roundCount) return '決賽';
                if (roundNumber === roundCount - 1) return '四強';
                return `第 ${roundNumber} 輪`;
            }
        });
    }

    renderHistoryPlayoffViewer(tournament) {
        if (!tournament?.playoff?.rounds?.length) return;
        const selector = `#${this.getHistoryPlayoffViewerId(tournament)}`;
        const target = document.querySelector(selector);
        if (!target) return;
        this.renderPlayoffViewerToSelector(tournament.playoff, selector, {
            readonly: true,
            title: tournament.title || '歷史複賽'
        });
    }

    handlePlayoffViewerMatchClick(matchId) {
        const playoff = this.tournament.playoff;
        if (!playoff?.started) return;

        const targetMatch = playoff.rounds.flatMap(round => round.matches).find(match => match.id === matchId);
        if (!targetMatch || targetMatch.completed || !targetMatch.player1 || !targetMatch.player2) return;

        const choice = prompt(`${targetMatch.player1.name} vs ${targetMatch.player2.name}\n輸入 1 或 2 選擇勝者`, '1');
        if (choice !== '1' && choice !== '2') return;

        const winnerId = choice === '1' ? targetMatch.player1.id : targetMatch.player2.id;
        this.recordPlayoffWinner(matchId, winnerId);
    }

    toggleHistoryPlayoffView(mode, triggerEl = null) {
        const section = document.querySelector('#history-results-modal .playoff-results-section');
        if (!section) return;

        section.setAttribute('data-view', mode);

        section.querySelectorAll('.playoff-view-toggle .btn').forEach(button => {
            button.classList.toggle('active', button.dataset.view === mode);
        });

        section.querySelectorAll('.history-playoff-panel').forEach(panel => {
            panel.hidden = panel.dataset.view !== mode;
        });

        if (mode === 'bracket' && this.historyPlayoffViewerTournament) {
            setTimeout(() => this.renderHistoryPlayoffViewer(this.historyPlayoffViewerTournament), 0);
        }

        if (triggerEl instanceof HTMLElement) {
            triggerEl.blur();
        }
    }

    /**
     * 匯出歷史比賽
     */
    exportHistoryTournament(tournamentId) {
        try {
            const history = this.tournament.getTournamentHistory();
            const tournament = history.find(t => t.tournamentId === tournamentId);
            
            if (!tournament) {
                throw new Error('找不到指定的歷史比賽');
            }

            const data = {
                tournament: tournament,
                exportDate: new Date().toISOString(),
                type: 'swiss_tournament',
                appVersion: '1.0'
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `swiss_tournament_${tournamentId}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showNotification('歷史比賽匯出成功', 'success');
        } catch (error) {
            this.showNotification('匯出失敗: ' + error.message, 'error');
        }
    }

    /**
     * 刪除歷史比賽
     */
    deleteHistoryTournament(tournamentId) {
        if (!confirm('確定要刪除這場歷史比賽嗎？此操作無法復原。')) return;
        
        try {
            this.tournament.deleteHistoryTournament(tournamentId);
            this.updateHistoryList();
            this.showNotification('歷史比賽已刪除', 'success');
        } catch (error) {
            this.showNotification('刪除失敗: ' + error.message, 'error');
        }
    }

    /**
     * 清空所有歷史記錄
     */
    clearAllHistory() {
        if (!confirm('確定要清空所有歷史比賽記錄嗎？此操作無法復原。')) return;
        
        try {
            this.tournament.clearAllHistory();
            this.updateHistoryList();
            this.showNotification('所有歷史記錄已清除', 'success');
        } catch (error) {
            this.showNotification('清除失敗: ' + error.message, 'error');
        }
    }

    /**
     * 顯示模態視窗
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * 關閉模態視窗
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            
            // 如果是歷史結果模態窗口，則從 DOM 中移除
            if (modalId === 'history-results-modal') {
                this.historyPlayoffViewerTournament = null;
                setTimeout(() => {
                    modal.remove();
                }, 300); // 等待動畫完成
            }
        }
    }

    /**
     * 顯示棄權設定模態視窗
     */
    showDropDialog(pairId) {
        const pairing = this.tournament.getCurrentRoundPairings().find(p => p.id === pairId);
        if (!pairing) return;

        const modal = document.getElementById('drop-modal');
        const message = document.getElementById('drop-modal-message');
        const options = document.getElementById('drop-options');
        
        // 設定訊息
        if (pairing.player2 === null) {
            message.textContent = `${pairing.player1.name} 已是 BYE，無需設定棄權`;
            options.innerHTML = '';
            this.showModal('drop-modal');
            return;
        }

        message.textContent = '請選擇棄權的選手：';
        
        // 生成選項
        options.innerHTML = `
            <div class="drop-option" onclick="app.selectDropOption(this, '${pairing.player1.id}')">
                <input type="radio" name="drop-player" value="${pairing.player1.id}" id="drop-${pairing.player1.id}">
                <label for="drop-${pairing.player1.id}">${this.escapeHtml(pairing.player1.name)} 棄權</label>
            </div>
            <div class="drop-option" onclick="app.selectDropOption(this, '${pairing.player2.id}')">
                <input type="radio" name="drop-player" value="${pairing.player2.id}" id="drop-${pairing.player2.id}">
                <label for="drop-${pairing.player2.id}">${this.escapeHtml(pairing.player2.name)} 棄權</label>
            </div>
            <div class="drop-option" onclick="app.selectDropOption(this, 'both')">
                <input type="radio" name="drop-player" value="both" id="drop-both">
                <label for="drop-both">雙方都棄權 (雙敗，各得0分)</label>
            </div>
        `;

        // 設定確認按鈕事件
        const confirmBtn = document.getElementById('confirm-drop');
        confirmBtn.onclick = () => this.confirmDrop(pairId);

        this.showModal('drop-modal');
    }

    /**
     * 選擇棄權選項
     */
    selectDropOption(element, value) {
        // 移除其他選項的選中狀態
        document.querySelectorAll('.drop-option').forEach(opt => opt.classList.remove('selected'));
        // 設定當前選項為選中
        element.classList.add('selected');
        element.querySelector('input[type="radio"]').checked = true;
    }

    /**
     * 確認棄權
     */
    confirmDrop(pairId) {
        const selectedOption = document.querySelector('input[name="drop-player"]:checked');
        if (!selectedOption) {
            this.showNotification('請選擇棄權的選手', 'error');
            return;
        }

        const pairing = this.tournament.getCurrentRoundPairings().find(p => p.id === pairId);
        if (!pairing) return;

        try {
            const roundIndex = this.tournament.currentRound - 1;
            
            if (selectedOption.value === pairing.player1.id) {
                this.tournament.recordMatchResult(roundIndex, pairId, 'player2_win', [pairing.player1.id]);
            } else if (selectedOption.value === pairing.player2.id) {
                this.tournament.recordMatchResult(roundIndex, pairId, 'player1_win', [pairing.player2.id]);
            } else if (selectedOption.value === 'both') {
                this.tournament.recordMatchResult(roundIndex, pairId, 'double_loss', [pairing.player1.id, pairing.player2.id]);
            }

            this.displayCurrentRound();
            this.closeModal('drop-modal');
            this.showNotification('棄權設定完成', 'success');
        } catch (error) {
            this.showNotification('設定失敗: ' + error.message, 'error');
        }
    }

    /**
     * 選擇結果選項
     */
    selectResultOption(element, value) {
        // 移除其他選項的選中狀態
        document.querySelectorAll('.result-option').forEach(opt => opt.classList.remove('selected'));
        // 設定當前選項為選中
        element.classList.add('selected');
        element.querySelector('input[type="radio"]').checked = true;
    }

    /**
     * 確認修改結果
     */
    confirmEditResult(pairId) {
        const selectedOption = document.querySelector('input[name="edit-result"]:checked');
        if (!selectedOption) {
            this.showNotification('請選擇比賽結果', 'error');
            return;
        }

        try {
            this.correctMatchResult(pairId, selectedOption.value);
            this.closeModal('edit-result-modal');
        } catch (error) {
            this.showNotification('修改失敗: ' + error.message, 'error');
        }
    }

    /**
     * 顯示歷史輪次頁面
     */
    showPreviousRounds() {
        this.generateRoundsTabs();
        this.showPage('previous-rounds');
    }

    /**
     * 生成輪次標籤
     */
    generateRoundsTabs() {
        const tabsContainer = document.getElementById('rounds-tabs');
        if (!tabsContainer) return;

        tabsContainer.innerHTML = '';

        for (let i = 1; i <= this.tournament.currentRound; i++) {
            const tab = document.createElement('button');
            tab.className = 'round-tab';
            tab.textContent = `第 ${i} 輪`;
            tab.onclick = () => this.selectHistoricalRound(i);
            
            // 如果是當前輪次，標記為活動狀態
            if (i === this.tournament.currentRound) {
                tab.classList.add('active');
            }
            
            tabsContainer.appendChild(tab);
        }

        // 預設選擇當前輪次
        if (this.tournament.currentRound > 0) {
            this.selectHistoricalRound(this.tournament.currentRound);
        }
    }

    /**
     * 選擇歷史輪次
     */
    selectHistoricalRound(roundNumber) {
        // 更新標籤狀態
        document.querySelectorAll('.round-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');

        // 顯示該輪次的資訊
        this.displayHistoricalRound(roundNumber);
    }

    /**
     * 顯示歷史輪次詳情
     */
    displayHistoricalRound(roundNumber) {
        const round = this.tournament.rounds[roundNumber - 1];
        if (!round) return;

        // 更新標題和描述
        const titleElement = document.getElementById('selected-round-title');
        const descriptionElement = document.getElementById('selected-round-description');
        
        if (titleElement) {
            titleElement.textContent = `第 ${roundNumber} 輪`;
        }
        
        if (descriptionElement) {
            const completedMatches = round.pairings.filter(p => p.completed).length;
            const totalMatches = round.pairings.length;
            const isCurrentRound = roundNumber === this.tournament.currentRound;
            
            descriptionElement.textContent = `${completedMatches}/${totalMatches} 場比賽已完成` + 
                (isCurrentRound ? ' (當前輪次)' : '');
        }

        // 顯示比賽列表
        this.displayHistoricalMatches(round, roundNumber);
    }

    /**
     * 顯示歷史比賽列表
     */
    displayHistoricalMatches(round, roundNumber) {
        const matchesContainer = document.getElementById('selected-round-matches');
        if (!matchesContainer) return;

        matchesContainer.innerHTML = '';

        // 將配對分為一般對戰和BYE，BYE排在最後
        const regularMatches = round.pairings.filter(p => p.player2 !== null);
        const byeMatches = round.pairings.filter(p => p.player2 === null);
        const allMatches = [...regularMatches, ...byeMatches];

        allMatches.forEach(pairing => {
            const matchRow = this.createHistoricalMatchRow(pairing, roundNumber);
            matchesContainer.appendChild(matchRow);
        });
    }

    /**
     * 創建歷史比賽行
     */
    createHistoricalMatchRow(pairing, roundNumber) {
        const row = document.createElement('div');
        row.className = `historical-match-row ${pairing.completed ? 'completed' : 'pending'} ${pairing.player2 === null ? 'bye' : ''}`;

        const player1Name = pairing.player1.name;
        const player2Name = pairing.player2 ? pairing.player2.name : '輪空';
        const resultText = this.getHistoricalResultText(pairing);
        const playersText = pairing.player2
            ? `${this.escapeHtml(player1Name)} vs ${this.escapeHtml(player2Name)}`
            : `${this.escapeHtml(player1Name)} 輪空`;

        row.innerHTML = `
            <div class="historical-match-info">
                <div class="historical-match-players">
                    ${playersText}
                </div>
                <div class="historical-match-result">
                    ${resultText}
                </div>
            </div>
            <div class="historical-match-actions">
                ${this.createHistoricalMatchActions(pairing, roundNumber)}
            </div>
        `;

        return row;
    }

    /**
     * 創建歷史比賽操作按鈕
     */
    createHistoricalMatchActions(pairing, roundNumber) {
        const isCurrentRound = roundNumber === this.tournament.currentRound;
        const isCompleted = pairing.completed;
        const isBye = pairing.player2 === null;

        if (isBye) {
            return '<span class="text-muted">BYE (無需操作)</span>';
        }

        let actions = [];

        if (isCompleted) {
            actions.push(`
                <button class="btn btn-sm btn-warning" onclick="app.editHistoricalResult(${pairing.id}, ${roundNumber})">
                    修改結果
                </button>
            `);
        } else if (isCurrentRound) {
            actions.push(`
                <button class="btn btn-sm btn-primary" onclick="app.recordHistoricalResult(${pairing.id})">
                    記錄結果
                </button>
            `);
        }

        return actions.join('');
    }

    /**
     * 記錄歷史結果 (實際上是當前輪次)
     */
    recordHistoricalResult(pairId) {
        // 切換回當前輪次頁面並聚焦到對應比賽
        this.showPage('pairing-section');
        // 可以在這裡添加高亮顯示對應比賽的邏輯
    }

    /**
     * 修改歷史結果
     */
    editHistoricalResult(pairId, roundNumber) {
        const round = this.tournament.rounds[roundNumber - 1];
        const pairing = round.pairings.find(p => p.id === pairId);
        if (!pairing || !pairing.completed) return;

        const currentResult = pairing.result;
        
        // 使用相同的修改結果模態視窗，但修改確認邏輯
        this.showEditResultModal(pairId, currentResult, roundNumber);
    }

    /**
     * 修改 showEditResultModal 以支援歷史輪次
     */
    showEditResultModal(pairId, currentResult, roundNumber = null) {
        const targetRound = roundNumber ? roundNumber - 1 : this.tournament.currentRound - 1;
        const round = this.tournament.rounds[targetRound];
        const pairing = round.pairings.find(p => p.id === pairId);
        if (!pairing) return;

        const modal = document.getElementById('edit-result-modal');
        const message = document.getElementById('edit-modal-message');
        const options = document.getElementById('edit-result-options');
        
        const roundText = roundNumber ? `第 ${roundNumber} 輪` : '當前輪次';
        const player2Name = pairing.player2 ? pairing.player2.name : '輪空';
        message.textContent = `修改 ${roundText} ${pairing.player1.name} vs ${player2Name} 的比賽結果：`;
        
        // 生成結果選項
        const resultOptions = this.getMatchResultOptions(pairing.player1.name, player2Name);
        
        options.innerHTML = resultOptions.map((option, index) => `
            <div class="result-option ${option.value === currentResult ? 'selected' : ''}" 
                 onclick="app.selectResultOption(this, '${option.value}')">
                <input type="radio" name="edit-result" value="${option.value}" id="edit-${option.value}-${index}"
                       ${option.value === currentResult ? 'checked' : ''}>
                <label for="edit-${option.value}-${index}">${option.text}</label>
            </div>
        `).join('');

        // 設定確認按鈕事件
        const confirmBtn = document.getElementById('confirm-edit');
        confirmBtn.onclick = () => {
            if (roundNumber) {
                this.confirmEditHistoricalResult(pairId, roundNumber);
            } else {
                this.confirmEditResult(pairId);
            }
        };

        this.showModal('edit-result-modal');
    }

    /**
     * 確認修改歷史結果
     */
    confirmEditHistoricalResult(pairId, roundNumber) {
        const selectedOption = document.querySelector('input[name="edit-result"]:checked');
        if (!selectedOption) {
            this.showNotification('請選擇比賽結果', 'error');
            return;
        }

        try {
            const roundIndex = roundNumber - 1;
            this.tournament.correctMatchResult(roundIndex, pairId, selectedOption.value);
            
            // 重新顯示歷史輪次
            this.displayHistoricalRound(roundNumber);
            
            // 如果修改的不是當前輪次，可能需要重新計算後續配對
            if (roundNumber < this.tournament.currentRound) {
                this.showNotification('歷史結果已修改，建議重新計算後續輪次的配對', 'warning');
            } else {
                this.showNotification('比賽結果已修改', 'success');
            }
            
            this.closeModal('edit-result-modal');
        } catch (error) {
            this.showNotification('修改失敗: ' + error.message, 'error');
        }
    }

    /**
     * 獲取歷史比賽詳細結果文字
     */
    getHistoricalResultText(pairing) {
        if (!pairing) {
            return '<span class="status-unknown">無效配對</span>';
        }
        
        if (!pairing.completed) {
            return '<span class="status-pending">等待結果</span>';
        }
        
        if (pairing.player2 === null) {
            return '<span class="status-bye">BYE (自動獲勝)</span>';
        }

        const result = pairing.result;
        const p1Name = pairing.player1.name;
        const p2Name = pairing.player2.name;

        switch (result) {
            case 'player1_win':
                return `<span class="status-win">${this.escapeHtml(p1Name)} 獲勝</span>`;
            case 'player2_win':
                return `<span class="status-loss">${this.escapeHtml(p2Name)} 獲勝</span>`;
            case 'draw':
                return '<span class="status-draw">平手</span>';
            case 'double_loss':
                return '<span class="status-double-loss">雙敗</span>';
            case 'bye':
                return '<span class="status-bye">BYE (輪空)</span>';
            default:
                return '<span class="status-unknown">未知結果</span>';
        }
    }

    /**
     * 顯示對戰安排頁面
     */
    showPairingArrangement() {
        this.updateArrangementHeader();
        this.manualPairingMode = false;
        this.arrangementSwapSelection = null;

        try {
            if (this.tournament.currentRound === 0) {
                this.tempPairings = this.tournament.generateRandomPairings();
            } else {
                this.tempPairings = this.tournament.generateSwissPairings();
            }
        } catch (error) {
            this.showNotification('生成配對失敗: ' + error.message, 'error');
            this.tempPairings = [];
        }

        this.displayArrangementPreview();

        const manualInterface = document.getElementById('manual-pairing-interface');
        if (manualInterface) {
            manualInterface.style.display = 'none';
        }

        this.showPage('pairing-arrangement');
    }

    updateArrangementHeader() {
        const titleElement = document.getElementById('arrangement-title');
        const descriptionElement = document.getElementById('arrangement-description');
        const activePlayers = this.tournament.players.filter(player => !player.dropped).length;

        if (titleElement) {
            titleElement.textContent = `第 ${this.tournament.currentRound + 1} 輪對戰安排`;
        }

        if (descriptionElement) {
            descriptionElement.textContent = `${activePlayers} 位選手參與，請確認對戰配對`;
        }

        const isInitialArrangement = this.tournament.currentRound === 0;
        const randomPairingBtn = document.getElementById('random-pairing');
        const addPlayerBtn = document.getElementById('add-player-arrangement');

        if (randomPairingBtn) {
            randomPairingBtn.style.display = isInitialArrangement ? 'inline-block' : 'none';
        }

        if (addPlayerBtn) {
            addPlayerBtn.style.display = isInitialArrangement ? 'inline-block' : 'none';
        }
    }

    createPlayerSnapshot(player) {
        return {
            id: player.id,
            name: player.name,
            score: player.score,
            buchholz: player.buchholz || 0,
            sosBuchholz: player.sosBuchholz || 0,
            omwPercentage: player.omwPercentage || 0,
            oomwPercentage: player.oomwPercentage || 0,
            dropped: !!player.dropped,
            byeCount: player.byeCount || 0,
            results: Array.isArray(player.results) ? [...player.results] : []
        };
    }

    getOrderedArrangementPlayers() {
        const activePlayerMap = new Map(
            this.tournament.players
                .filter(player => !player.dropped)
                .map(player => [player.id, this.createPlayerSnapshot(player)])
        );
        const orderedPlayers = [];

        const appendPlayer = (playerId) => {
            if (!activePlayerMap.has(playerId)) return;
            if (orderedPlayers.some(player => player.id === playerId)) return;
            orderedPlayers.push(this.createPlayerSnapshot(activePlayerMap.get(playerId)));
        };

        (this.tempPairings || []).forEach(pairing => {
            if (pairing.player1) appendPlayer(pairing.player1.id);
            if (pairing.player2) appendPlayer(pairing.player2.id);
        });

        this.tournament.players
            .filter(player => !player.dropped)
            .forEach(player => appendPlayer(player.id));

        return orderedPlayers;
    }

    buildOrderedPairings(players) {
        const pairings = [];
        let pairingId = 1;

        for (let index = 0; index < players.length - 1; index += 2) {
            pairings.push({
                id: pairingId++,
                player1: this.createPlayerSnapshot(players[index]),
                player2: this.createPlayerSnapshot(players[index + 1]),
                result: null,
                completed: false
            });
        }

        if (players.length % 2 === 1) {
            pairings.push({
                id: pairingId++,
                player1: this.createPlayerSnapshot(players[players.length - 1]),
                player2: null,
                result: 'bye',
                completed: true
            });
        }

        return pairings;
    }

    refreshArrangementState() {
        this.updateArrangementHeader();
        this.displayArrangementPreview();
        this.updateCurrentTournamentCard();
        this.tournament.saveTournament();

        if (this.manualPairingMode) {
            this.initializeManualPairing();
        }
    }

    recalculateTournamentRounds() {
        if (this.tournament.settings.customRounds && this.tournament.settings.manualRounds) {
            this.tournament.totalRounds = Math.max(this.tournament.settings.manualRounds, 3);
            return;
        }

        this.tournament.totalRounds = Math.max(Math.ceil(Math.log2(this.tournament.players.length)), 3);
    }

    displayArrangementPreview() {
        const pairings = this.tempPairings || this.tournament.getCurrentRoundPairings();
        const matchesContainer = document.getElementById('arrangement-matches');
        if (!matchesContainer) return;

        matchesContainer.innerHTML = '';

        const regularMatches = pairings.filter(pairing => pairing.player2 !== null);
        const byeMatches = pairings.filter(pairing => pairing.player2 === null);
        const allMatches = [...regularMatches, ...byeMatches];

        allMatches.forEach((pairing, index) => {
            matchesContainer.appendChild(this.createArrangementMatchRow(pairing, pairing.player2 === null ? null : index + 1));
        });
    }

    createArrangementMatchRow(pairing, displayNumber = null) {
        const row = document.createElement('div');
        row.className = `arrangement-match ${pairing.player2 === null ? 'bye' : ''}`;
        row.dataset.matchId = pairing.id;
        const visibleNumber = pairing.player2 === null ? 'BYE' : (displayNumber ?? pairing.id);

        if (pairing.player2 === null) {
            row.innerHTML = `
                <div class="arrangement-match-number">${visibleNumber}</div>
                <div class="arrangement-players">
                    ${this.renderArrangementPlayerControl(pairing, 1, pairing.player1)}
                </div>
                <div class="arrangement-score">積分: ${pairing.player1.score}</div>
                <div class="arrangement-actions"><span class="auto-result">輪空</span></div>
            `;
        } else {
            row.innerHTML = `
                <div class="arrangement-match-number">${visibleNumber}</div>
                <div class="arrangement-players">
                    ${this.renderArrangementPlayerControl(pairing, 1, pairing.player1)}
                    <div class="arrangement-vs">VS</div>
                    ${this.renderArrangementPlayerControl(pairing, 2, pairing.player2)}
                </div>
                <div class="arrangement-score">${pairing.player1.score} : ${pairing.player2.score}</div>
            `;
        }

        return row;
    }

    renderArrangementPlayerControl(pairing, slot, player) {
        const selection = this.arrangementSwapSelection;
        const isSelected = selection
            && selection.pairingId === pairing.id
            && selection.slot === slot;
        const selectedClass = isSelected ? ' selected' : '';
        const canEditInitialArrangement = this.tournament.currentRound === 0;

        return `
            <div class="arrangement-player-slot${selectedClass}">
                <button type="button" class="arrangement-player arrangement-player-button${selectedClass}" onclick="app.handleArrangementPlayerSelect(${pairing.id}, ${slot})">
                    ${this.escapeHtml(player.name)}
                </button>
                ${canEditInitialArrangement ? `<button type="button" class="arrangement-player-remove" onclick="event.stopPropagation(); app.confirmRemoveArrangementPlayer(${player.id})" title="取消玩家">×</button>` : ''}
            </div>
        `;
    }

    handleArrangementPlayerSelect(pairingId, slot) {
        const pairing = (this.tempPairings || []).find(item => item.id === pairingId);
        if (!pairing) return;

        const key = slot === 1 ? 'player1' : 'player2';
        const player = pairing[key];
        if (!player) return;

        if (!this.arrangementSwapSelection) {
            this.arrangementSwapSelection = { pairingId, slot, playerId: player.id };
            this.displayArrangementPreview();
            this.showNotification(`已選取 ${player.name}，請再點另一位選手進行交換`, 'info');
            return;
        }

        const sameSelection = this.arrangementSwapSelection.pairingId === pairingId
            && this.arrangementSwapSelection.slot === slot;

        if (sameSelection) {
            this.arrangementSwapSelection = null;
            this.displayArrangementPreview();
            this.showNotification('已取消交換', 'info');
            return;
        }

        this.swapArrangementPlayers(this.arrangementSwapSelection, { pairingId, slot, playerId: player.id });
    }

    swapArrangementPlayers(firstSelection, secondSelection) {
        const firstPairing = (this.tempPairings || []).find(pairing => pairing.id === firstSelection.pairingId);
        const secondPairing = (this.tempPairings || []).find(pairing => pairing.id === secondSelection.pairingId);
        if (!firstPairing || !secondPairing) return;

        const firstKey = firstSelection.slot === 1 ? 'player1' : 'player2';
        const secondKey = secondSelection.slot === 1 ? 'player1' : 'player2';

        const tempPlayer = firstPairing[firstKey];
        firstPairing[firstKey] = secondPairing[secondKey];
        secondPairing[secondKey] = tempPlayer;

        this.arrangementSwapSelection = null;
        this.displayArrangementPreview();
        this.showNotification('已交換兩位選手的位置', 'success');
    }

    confirmRemoveArrangementPlayer(playerId) {
        if (this.tournament.currentRound !== 0) {
            this.showNotification('只有初始對戰安排可以取消玩家', 'warning');
            return;
        }

        const player = this.tournament.players.find(item => item.id === playerId);
        if (!player) return;

        if (this.tournament.players.length <= 2) {
            this.showNotification('至少需要保留 2 位玩家才能開始比賽', 'error');
            return;
        }

        if (!confirm(`確定要取消 ${player.name} 的參賽並從本次對戰安排移除嗎？`)) {
            return;
        }

        this.tournament.players = this.tournament.players.filter(item => item.id !== playerId);
        this.arrangementSwapSelection = null;
        this.recalculateTournamentRounds();

        const shouldRandomize = confirm(`已移除 ${player.name}。是否要重新隨機配對？`);
        if (shouldRandomize) {
            this.tempPairings = this.tournament.generateRandomPairings();
        } else {
            this.tempPairings = this.buildOrderedPairings(this.getOrderedArrangementPlayers());
        }

        this.refreshArrangementState();
        this.showNotification(`${player.name} 已移出對戰安排`, 'success');
    }

    randomizePairings() {
        if (!confirm('確定要重新進行隨機配對嗎？這將會覆蓋當前的配對安排。')) return;

        try {
            this.showLoading(true);
            this.tempPairings = this.tournament.generateRandomPairings();
            this.displayArrangementPreview();
            this.showNotification('已重新生成隨機配對', 'success');
        } catch (error) {
            this.showNotification('重新配對失敗: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    toggleManualPairing() {
        const manualInterface = document.getElementById('manual-pairing-interface');
        if (!manualInterface) return;

        this.manualPairingMode = !this.manualPairingMode;

        if (this.manualPairingMode) {
            manualInterface.style.display = 'block';
            this.initializeManualPairing();
            this.showNotification('已進入手動配對模式', 'info');
        } else {
            manualInterface.style.display = 'none';
            this.showNotification('已退出手動配對模式', 'info');
        }
    }

    initializeManualPairing() {
        this.manualPairings = [];
        this.selectedPlayers = [];
        this.displayAvailablePlayers();
        this.displayManualMatches();
    }

    displayAvailablePlayers() {
        const container = document.getElementById('available-players-list');
        if (!container) return;

        const availablePlayers = this.tournament.players.filter(player => !player.dropped);
        const pairedPlayerIds = new Set();
        this.manualPairings.forEach(pair => {
            pairedPlayerIds.add(pair.player1.id);
            if (pair.player2) pairedPlayerIds.add(pair.player2.id);
        });

        const unpairedPlayers = availablePlayers.filter(player => !pairedPlayerIds.has(player.id));
        container.innerHTML = '';

        unpairedPlayers.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'manual-player';
            playerCard.dataset.playerId = player.id;

            const playerName = document.createElement('span');
            playerName.className = 'player-name';
            playerName.textContent = player.name;

            const playerScore = document.createElement('span');
            playerScore.className = 'player-score';
            playerScore.textContent = `(${player.score}分)`;

            playerCard.appendChild(playerName);
            playerCard.appendChild(playerScore);
            playerCard.onclick = () => this.selectPlayer(player);

            if (this.selectedPlayers.some(selected => selected.id === player.id)) {
                playerCard.classList.add('selected');
            }

            container.appendChild(playerCard);
        });

        if (unpairedPlayers.length === 1) {
            this.addByeMatch(unpairedPlayers[0]);
        }
    }

    selectPlayer(player) {
        const existingIndex = this.selectedPlayers.findIndex(selected => selected.id === player.id);
        if (existingIndex !== -1) {
            this.selectedPlayers.splice(existingIndex, 1);
        } else {
            this.selectedPlayers.push(player);
        }

        if (this.selectedPlayers.length === 2) {
            this.createManualMatch(this.selectedPlayers[0], this.selectedPlayers[1]);
            this.selectedPlayers = [];
        }

        this.displayAvailablePlayers();
    }

    createManualMatch(player1, player2) {
        this.manualPairings.push({
            id: this.manualPairings.length + 1,
            player1,
            player2,
            completed: false,
            result: null
        });

        this.displayManualMatches();
        this.displayAvailablePlayers();
    }

    addByeMatch(player) {
        const alreadyExists = this.manualPairings.some(match => match.player1.id === player.id || match.player2?.id === player.id);
        if (alreadyExists) return;

        this.manualPairings.push({
            id: this.manualPairings.length + 1,
            player1: player,
            player2: null,
            completed: true,
            result: 'bye'
        });

        this.displayManualMatches();
        this.displayAvailablePlayers();
    }

    displayManualMatches() {
        const container = document.getElementById('manual-matches-list');
        if (!container) return;

        container.innerHTML = '';
        this.manualPairings.forEach(match => {
            const matchItem = document.createElement('div');
            matchItem.className = 'manual-match-item';

            if (match.player2 === null) {
                matchItem.innerHTML = `
                    <div class="manual-match-players">
                        <div class="manual-match-player">${this.escapeHtml(match.player1.name)}</div>
                        <div class="manual-match-vs">BYE</div>
                    </div>
                    <div class="manual-match-actions">
                        <button class="btn-remove-match" onclick="app.removeManualMatch(${match.id})">移除</button>
                    </div>
                `;
            } else {
                matchItem.innerHTML = `
                    <div class="manual-match-players">
                        <div class="manual-match-player">${this.escapeHtml(match.player1.name)}</div>
                        <div class="manual-match-vs">VS</div>
                        <div class="manual-match-player">${this.escapeHtml(match.player2.name)}</div>
                    </div>
                    <div class="manual-match-actions">
                        <button class="btn-remove-match" onclick="app.removeManualMatch(${match.id})">移除</button>
                    </div>
                `;
            }

            container.appendChild(matchItem);
        });
    }

    removeManualMatch(matchId) {
        this.manualPairings = this.manualPairings.filter(match => match.id !== matchId);
        this.manualPairings.forEach((match, index) => {
            match.id = index + 1;
        });

        this.displayManualMatches();
        this.displayAvailablePlayers();
    }

    saveManualPairings() {
        const availablePlayers = this.tournament.players.filter(player => !player.dropped);
        const pairedPlayerIds = new Set();
        this.manualPairings.forEach(pair => {
            pairedPlayerIds.add(pair.player1.id);
            if (pair.player2) pairedPlayerIds.add(pair.player2.id);
        });

        const unpairedPlayers = availablePlayers.filter(player => !pairedPlayerIds.has(player.id));
        if (unpairedPlayers.length > 0) {
            this.showNotification(`還有 ${unpairedPlayers.length} 位選手未配對`, 'error');
            return;
        }

        this.tempPairings = [...this.manualPairings];
        this.displayArrangementPreview();
        this.toggleManualPairing();
        this.showNotification('手動配對已保存', 'success');
    }

    cancelManualPairing() {
        this.toggleManualPairing();
        this.showNotification('已取消手動配對', 'info');
    }

    clearManualPairings() {
        if (!confirm('確定要清空所有手動配對嗎？')) return;
        this.manualPairings = [];
        this.selectedPlayers = [];
        this.displayManualMatches();
        this.displayAvailablePlayers();
        this.showNotification('已清空所有配對', 'info');
    }

    generateAutoPairings() {
        try {
            this.showLoading(true);
            this.tempPairings = this.tournament.currentRound === 0
                ? this.tournament.generateRandomPairings()
                : this.tournament.generateSwissPairings();
            this.displayArrangementPreview();
            this.showNotification('已重新生成自動配對', 'success');
        } catch (error) {
            this.showNotification('自動配對失敗: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    openAddPlayerModal() {
        if (this.tournament.currentRound !== 0) {
            this.showNotification('只有初始對戰安排可以新增玩家', 'warning');
            return;
        }

        const input = document.getElementById('add-player-name');
        if (input) {
            input.value = '';
        }

        this.showModal('add-player-modal');
        setTimeout(() => input?.focus(), 50);
    }

    confirmAddPlayer() {
        if (this.tournament.currentRound !== 0) {
            this.showNotification('只有初始對戰安排可以新增玩家', 'warning');
            return;
        }

        const input = document.getElementById('add-player-name');
        if (!input) return;

        const playerName = input.value.trim();
        if (!playerName) {
            this.showNotification('請輸入玩家名稱', 'warning');
            input.focus();
            return;
        }

        const duplicated = this.tournament.players.some(player => player.name === playerName);
        if (duplicated) {
            this.showNotification('玩家名稱不可重複', 'error');
            input.focus();
            return;
        }

        const nextPlayerId = this.tournament.players.reduce((maxId, player) => Math.max(maxId, player.id), 0) + 1;
        this.tournament.players.push({
            id: nextPlayerId,
            name: playerName,
            score: 0,
            buchholz: 0,
            sosBuchholz: 0,
            omwPercentage: 0,
            oomwPercentage: 0,
            opponents: [],
            results: [],
            dropped: false,
            byeCount: 0
        });

        this.arrangementSwapSelection = null;
        this.recalculateTournamentRounds();

        const shouldRandomize = confirm(`已新增 ${playerName}。是否要重新隨機配對？`);
        if (shouldRandomize) {
            this.tempPairings = this.tournament.generateRandomPairings();
        } else {
            this.tempPairings = this.buildOrderedPairings(this.getOrderedArrangementPlayers());
        }

        this.closeModal('add-player-modal');
        this.refreshArrangementState();
        this.showNotification(`${playerName} 已加入對戰安排`, 'success');
    }

    confirmPairings() {
        try {
            this.tournament.startNewRound(this.tempPairings);
            this.tempPairings = null;
            this.updateCurrentTournamentCard();
            this.displayCurrentRound();
            this.showNotification('對局安排已確認，比賽開始！', 'success');
        } catch (error) {
            this.showNotification('確認配對失敗: ' + error.message, 'error');
        }
    }

    showPlayoffSetup() {
        if (!this.tournament.isFinished) {
            this.showNotification('請先結束瑞士輪預賽', 'error');
            return;
        }

        const ranking = this.tournament.getFinalRanking();
        const advanceSelect = document.getElementById('playoff-advance-count');
        const preview = document.getElementById('playoff-preview');
        if (!advanceSelect || !preview) {
            this.showNotification('複賽頁面尚未準備完成', 'error');
            return;
        }

        const maxAdvance = Math.max(2, Math.min(16, ranking.length));
        const existingValue = this.tournament.playoff?.advanceCount || Math.min(8, maxAdvance);

        advanceSelect.innerHTML = '';
        for (let count = 2; count <= maxAdvance; count *= 2) {
            const option = document.createElement('option');
            option.value = count;
            option.textContent = `取 ${count} 強`;
            option.selected = count === existingValue;
            advanceSelect.appendChild(option);
        }

        const updatePreview = () => {
            const advanceCount = parseInt(advanceSelect.value, 10);
            const qualified = ranking.slice(0, advanceCount);
            preview.innerHTML = `
                <div class="playoff-preview-summary">預計晉級 ${advanceCount} 強，採單淘汰制</div>
                <div class="playoff-preview-list">
                    ${qualified.map((player, index) => `
                        <div class="playoff-preview-player">
                            <span class="seed-badge">#${index + 1}</span>
                            <span>${this.escapeHtml(player.name)}</span>
                            <span class="preview-score">${player.score} 分</span>
                        </div>
                    `).join('')}
                </div>
            `;
        };

        advanceSelect.onchange = updatePreview;
        updatePreview();
        this.showPage('playoff-setup');
    }

    savePlayoffSettings() {
        try {
            const advanceCount = parseInt(document.getElementById('playoff-advance-count')?.value || '0', 10);
            if (!advanceCount) throw new Error('請選擇晉級人數');

            this.tournament.configurePlayoff(advanceCount, 'single_elimination');
            this.updateCurrentTournamentCard();
            this.showTournamentHistory();
            this.showNotification(`已設定複賽：取 ${advanceCount} 強`, 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    showPlayoffBracket() {
        const bracketBoard = document.getElementById('playoff-bracket-board');
        const summary = document.getElementById('playoff-summary');
        if (!bracketBoard || !summary) {
            this.showNotification('複賽頁面尚未準備完成', 'error');
            return;
        }

        const playoff = this.tournament.playoff;
        if (!playoff) {
            this.showNotification('尚未設定複賽', 'warning');
            this.showPlayoffSetup();
            return;
        }

        if (!playoff.started) {
            this.showPlayoffSetup();
            return;
        }

        const championText = playoff.champion ? `冠軍：${playoff.champion.name}` : `目前進行到第 ${playoff.currentRound} 輪`;
        summary.innerHTML = `
            <div class="playoff-summary-card">
                <div class="summary-title">${this.escapeHtml(this.tournament.generateTournamentTitle())}</div>
                <div class="summary-meta">取 ${playoff.advanceCount} 強 · 單淘汰制 · ${championText}</div>
            </div>
        `;

        this.showPage('playoff-bracket');
        this.renderPlayoffViewerToSelector(playoff, '#playoff-bracket-board', {
            readonly: false,
            title: this.tournament.generateTournamentTitle()
        });
    }

    renderPlayoffMatch(match, options = {}) {
        const { readonly = false, headerLabel = `Match ${match.id}` } = options;
        const player1Name = match.player1 ? this.escapeHtml(match.player1.name) : '待定';
        const player2Name = match.player2 ? this.escapeHtml(match.player2.name) : '待定';
        const player1Seed = match.player1?.swissRank ? `#${match.player1.swissRank}` : '';
        const player2Seed = match.player2?.swissRank ? `#${match.player2.swissRank}` : '';
        const winnerName = match.completed
            ? this.escapeHtml((match.player1?.id === match.winner ? match.player1?.name : match.player2?.name) || '')
            : '';

        const statusContent = match.isBye
            ? '<div class="bracket-status auto">BYE 自動晉級</div>'
            : match.completed
                ? `<div class="bracket-status done">WINNER ${winnerName}</div>`
                : '<div class="bracket-status pending">等待上一場結果</div>';

        const actions = (!readonly && !match.completed && match.player1 && match.player2)
            ? `
                <div class="bracket-actions">
                    <button class="btn btn-sm btn-primary" onclick="app.recordPlayoffWinner(${match.id}, ${match.player1.id})">${player1Name} 勝</button>
                    <button class="btn btn-sm btn-primary" onclick="app.recordPlayoffWinner(${match.id}, ${match.player2.id})">${player2Name} 勝</button>
                </div>
            `
            : statusContent;

        return `
            <div class="bracket-match ${match.completed ? 'completed' : 'pending'} ${match.isBye ? 'bye' : ''}">
                <div class="bracket-match-header">${headerLabel}</div>
                <div class="bracket-player ${match.winner === match.player1?.id ? 'winner' : ''}">
                    <span class="player-seed">${player1Seed || '&nbsp;'}</span>
                    <span class="player-name">${player1Name}</span>
                </div>
                <div class="bracket-player ${match.winner === match.player2?.id ? 'winner' : ''}">
                    <span class="player-seed">${player2Seed || '&nbsp;'}</span>
                    <span class="player-name">${player2Name}</span>
                </div>
                ${actions}
            </div>
        `;
    }

    recordPlayoffWinner(matchId, winnerId) {
        try {
            const result = this.tournament.recordPlayoffResult(matchId, winnerId);
            this.showPlayoffBracket();
            this.updateCurrentTournamentCard();
            if (result.isChampion) {
                this.showNotification(`比賽結束，冠軍為 ${result.champion.name}`, 'success');
            } else {
                this.showNotification('已記錄複賽結果', 'success');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    startPlayoff() {
        try {
            this.tournament.initializePlayoff();
            this.showPlayoffBracket();
            this.updateCurrentTournamentCard();
            this.showNotification('複賽已開始', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }
}

// 全域變數，供 HTML 中的 onclick 使用
let app;

// 當 DOM 載入完成後初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    app = new SwissTournamentApp();
    console.log('瑞士輪賽事系統已載入完成');
});