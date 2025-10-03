/**
 * 瑞士輪比賽系統主應用程式
 * 處理 UI 互動、頁面切換、事件監聽等功能
 */

class SwissTournamentApp {
    constructor() {
        this.tournament = new SwissTournament();
        this.currentPage = 'tournament-history'; // 預設顯示歷史頁面
        this.init();
    }

    /**
     * 初始化應用程式
     */
    init() {
        console.log('瑞士輪比賽系統啟動');
        this.setupEventListeners();
        this.loadExistingTournament();
        this.showPage(this.currentPage);
        // 如果預設頁面是歷史頁面，初始化歷史資料
        if (this.currentPage === 'tournament-history') {
            this.updateHistoryList();
        }
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

        // 歷史比賽功能
        const continueCurrentBtn = document.getElementById('continue-current');
        if (continueCurrentBtn) {
            continueCurrentBtn.addEventListener('click', () => {
                this.continueCurrent();
            });
        }

        const resetCurrentBtn = document.getElementById('reset-current');
        if (resetCurrentBtn) {
            resetCurrentBtn.addEventListener('click', () => {
                this.resetCurrent();
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
                this.showPage('tournament-setup');
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
    }

    /**
     * 載入現有比賽
     */
    loadExistingTournament() {
        if (this.tournament.loadTournament()) {
            if (this.tournament.isFinished) {
                this.currentPage = 'final-ranking';
                this.displayFinalRanking();
            } else if (this.tournament.players.length > 0) {
                if (this.tournament.currentRound > 0) {
                    this.currentPage = 'pairing-section';
                    this.displayCurrentRound();
                } else {
                    this.currentPage = 'tournament-info';
                    this.displayTournamentInfo();
                }
            }
            this.showNotification('載入了先前的比賽資料', 'success');
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
        
        return {
            tournamentName,
            allowDraws,
            allowDoubleLoss,
            customRounds,
            manualRounds
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

        this.showPage('tournament-info');
    }

    /**
     * 顯示目前輪次
     */
    displayCurrentRound() {
        if (this.tournament.currentRound === 0) return;
        
        const pairings = this.tournament.getCurrentRoundPairings();
        const roundTitle = document.getElementById('round-title');
        const roundDescription = document.getElementById('round-description');
        
        if (roundTitle) {
            roundTitle.textContent = `Round ${this.tournament.currentRound} 配對`;
        }
        
        if (roundDescription) {
            const activePlayers = this.tournament.players.filter(p => !p.dropped).length;
            roundDescription.textContent = `${activePlayers} 位選手參與，請記錄每場比賽的結果`;
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
        
        if (completedSpan && totalSpan) {
            const completed = pairings.filter(p => p.completed).length;
            completedSpan.textContent = completed;
            totalSpan.textContent = pairings.length;
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
        regularMatches.forEach(pairing => {
            const matchRow = this.createMatchRow(pairing);
            listContent.appendChild(matchRow);
        });
        
        // 再顯示BYE對戰
        byeMatches.forEach(pairing => {
            const matchRow = this.createMatchRow(pairing);
            listContent.appendChild(matchRow);
        });
    }

    /**
     * 創建比賽行
     */
    createMatchRow(pairing) {
        const row = document.createElement('div');
        row.className = `match-row ${pairing.completed ? 'completed' : 'pending'} ${pairing.corrected ? 'corrected' : ''}`;
        row.dataset.matchId = pairing.id;

        if (pairing.player2 === null) {
            // Bye 的情況
            row.innerHTML = `
                <div class="match-col-number">
                    <span class="match-number">${pairing.id}</span>
                    ${pairing.corrected ? '<span class="correction-badge">已修正</span>' : ''}
                </div>
                <div class="match-col-players">
                    <div class="player bye-player">${this.escapeHtml(pairing.player1.name)}</div>
                    <div class="vs-bye">BYE</div>
                </div>
                <div class="match-col-result">
                    <span class="result-text completed">輪空 (3分)</span>
                </div>
                <div class="match-col-actions">
                    <span class="auto-result">自動完成</span>
                </div>
            `;
        } else {
            const isCompleted = pairing.completed;
            const resultText = this.getResultText(pairing.result);
            
            row.innerHTML = `
                <div class="match-col-number">
                    <span class="match-number">${pairing.id}</span>
                    ${pairing.corrected ? '<span class="correction-badge">已修正</span>' : ''}
                </div>
                <div class="match-col-players">
                    <div class="player ${pairing.result === 'player1_win' ? 'winner' : ''}">${this.escapeHtml(pairing.player1.name)}</div>
                    <div class="vs">VS</div>
                    <div class="player ${pairing.result === 'player2_win' ? 'winner' : ''}">${this.escapeHtml(pairing.player2.name)}</div>
                </div>
                <div class="match-col-result">
                    <span class="result-text ${isCompleted ? 'completed' : 'pending'}">${resultText}</span>
                </div>
                <div class="match-col-actions">
                    ${this.createMatchActions(pairing)}
                </div>
            `;
        }

        return row;
    }

    /**
     * 創建比賽操作按鈕
     */
    createMatchActions(pairing) {
        const isCompleted = pairing.completed;
        
        if (isCompleted) {
            return `
                <button onclick="app.editMatchResult(${pairing.id})" class="btn-action edit">
                    修改
                </button>
            `;
        } else {
            const resultButtons = this.createResultButtons(pairing);
            return `
                <div class="result-buttons">
                    ${resultButtons}
                    <button onclick="app.showDropDialog(${pairing.id})" class="btn-result drop">
                        棄權
                    </button>
                </div>
            `;
        }
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
    recordResult(pairId, result) {
        try {
            const roundIndex = this.tournament.currentRound - 1;
            this.tournament.recordMatchResult(roundIndex, pairId, result);
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
        if (result === 'bye') return 'Bye';
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
            this.displayFinalRanking();
            this.showPage('final-ranking');
            this.showNotification('比賽結束！已自動儲存到歷史記錄', 'success');
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
                                <td>${player.buchholz.toFixed(1)}</td>
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
     * 新比賽
     */
    newTournament() {
        if (!confirm('確定要開始新比賽嗎？目前的比賽資料將會清除。')) return;
        
        this.tournament.resetTournament();
        document.getElementById('players-textarea').value = '';
        this.updatePlayerPreview();
        this.showPage('tournament-setup');
        this.showNotification('已清除比賽資料，可以開始新比賽', 'success');
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
     * 匯入比賽
     */
    importTournament(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.tournament.importTournament(data);
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
     * 更新目前比賽卡片
     */
    updateCurrentTournamentCard() {
        const card = document.getElementById('current-tournament-card');
        const continueBtn = document.getElementById('continue-current');
        const resetBtn = document.getElementById('reset-current');
        
        if (!card) return;

        if (this.tournament.players.length > 0) {
            const stats = this.tournament.getStatistics();
            const status = this.tournament.isFinished ? '已完成' : 
                         this.tournament.currentRound > 0 ? `進行中 (第${this.tournament.currentRound}輪)` : '已設定';
            
            card.innerHTML = `
                <div class="tournament-info">
                    <div class="tournament-title">
                        ${this.escapeHtml(this.tournament.generateTournamentTitle())}
                    </div>
                    <div class="tournament-details">
                        <span class="status ${this.tournament.isFinished ? 'finished' : 'active'}">${status}</span>
                        <span class="players-count">${stats.totalPlayers} 位選手</span>
                        <span class="rounds-info">${stats.completedRounds}/${stats.totalRounds} 輪</span>
                        ${this.tournament.isFinished && stats.champion ? 
                          `<span class="champion">冠軍: ${this.escapeHtml(stats.champion.name)}</span>` : ''}
                    </div>
                </div>
                <div class="tournament-actions">
                    <button id="continue-current" class="btn btn-primary" ${this.tournament.isFinished ? 'style="display: none;"' : ''}>
                        ${this.tournament.currentRound > 0 ? '繼續比賽' : '查看比賽'}
                    </button>
                    <button id="reset-current" class="btn btn-warning">
                        重置比賽
                    </button>
                </div>
            `;
            
            // 重新綁定事件
            const newContinueBtn = document.getElementById('continue-current');
            const newResetBtn = document.getElementById('reset-current');
            
            if (newContinueBtn) {
                newContinueBtn.addEventListener('click', () => this.continueCurrent());
            }
            if (newResetBtn) {
                newResetBtn.addEventListener('click', () => this.resetCurrent());
            }
        } else {
            card.innerHTML = `
                <div class="tournament-info">
                    <div class="tournament-title">無進行中的比賽</div>
                    <div class="tournament-details">請開始新比賽</div>
                </div>
                <div class="tournament-actions">
                    <button onclick="app.showPage('tournament-setup')" class="btn btn-primary">
                        開始新比賽
                    </button>
                </div>
            `;
        }
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
                        ${tournament.champion ? 
                          `<span class="champion">冠軍: ${this.escapeHtml(tournament.champion.name)}</span>` : ''}
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

    /**
     * 繼續目前比賽
     */
    continueCurrent() {
        if (this.tournament.isFinished) {
            this.showPage('final-ranking');
        } else if (this.tournament.currentRound > 0) {
            this.showPage('pairing-section');
        } else {
            this.showPage('tournament-info');
        }
    }

    /**
     * 重置目前比賽
     */
    resetCurrent() {
        if (!confirm('確定要重置目前的比賽嗎？所有比賽資料將會清除。')) return;
        
        this.tournament.resetTournament();
        this.updateCurrentTournamentCard();
        this.showNotification('目前比賽已重置', 'success');
    }

    /**
     * 載入歷史比賽
     */
    loadHistoryTournament(tournamentId) {
        if (!confirm('載入歷史比賽會覆蓋目前的比賽資料，確定要繼續嗎？')) return;
        
        try {
            this.tournament.loadFromHistory(tournamentId);
            this.loadExistingTournament();
            this.showNotification('歷史比賽載入成功', 'success');
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
            setTimeout(() => {
                modal.classList.add('show');
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
                    if (player.score !== prevPlayer.score || 
                        Math.abs(player.buchholz - prevPlayer.buchholz) > 0.001 ||
                        Math.abs(player.sosBuchholz - prevPlayer.sosBuchholz) > 0.001) {
                        currentRank = index + 1;
                    }
                }
                player.rank = currentRank;
            });
            
            // 生成統計資料
            const stats = {
                champion: sortedPlayers[0],
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

            return summarySection + rankingSection + roundsSection;
            
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
        const player2Name = pairing.player2 ? pairing.player2.name : 'BYE';
        const resultText = this.getHistoricalResultText(pairing);

        row.innerHTML = `
            <div class="historical-match-info">
                <div class="historical-match-players">
                    ${this.escapeHtml(player1Name)} vs ${this.escapeHtml(player2Name)}
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
        const player2Name = pairing.player2 ? pairing.player2.name : 'BYE';
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
        const titleElement = document.getElementById('arrangement-title');
        const descriptionElement = document.getElementById('arrangement-description');
        
        if (titleElement) {
            titleElement.textContent = `第 ${this.tournament.currentRound + 1} 輪對戰安排`;
        }
        
        if (descriptionElement) {
            const activePlayers = this.tournament.players.filter(p => !p.dropped).length;
            descriptionElement.textContent = `${activePlayers} 位選手參與，請確認對戰配對`;
        }

        // 顯示/隱藏重新隨機配對按鈕（僅第一輪顯示）
        const randomPairingBtn = document.getElementById('random-pairing');
        if (randomPairingBtn) {
            randomPairingBtn.style.display = (this.tournament.currentRound === 0) ? 'inline-block' : 'none';
        }

        // 初始化手動配對狀態
        this.manualPairingMode = false;
        
        // 生成初始配對建議
        try {
            if (this.tournament.currentRound === 0) {
                // 第一輪：生成隨機配對
                this.tempPairings = this.tournament.generateRandomPairings();
            } else {
                // 後續輪次：生成瑞士制配對
                this.tempPairings = this.tournament.generateSwissPairings();
            }
        } catch (error) {
            this.showNotification('生成配對失敗: ' + error.message, 'error');
            this.tempPairings = [];
        }

        // 顯示當前配對預覽
        this.displayArrangementPreview();
        
        // 隱藏手動配對界面
        const manualInterface = document.getElementById('manual-pairing-interface');
        if (manualInterface) {
            manualInterface.style.display = 'none';
        }

        this.showPage('pairing-arrangement');
    }

    /**
     * 顯示配對預覽
     */
    displayArrangementPreview() {
        const pairings = this.tempPairings || this.tournament.getCurrentRoundPairings();
        const matchesContainer = document.getElementById('arrangement-matches');
        
        if (!matchesContainer) return;

        matchesContainer.innerHTML = '';

        // 將配對分為一般對戰和BYE，BYE排在最後
        const regularMatches = pairings.filter(p => p.player2 !== null);
        const byeMatches = pairings.filter(p => p.player2 === null);
        const allMatches = [...regularMatches, ...byeMatches];

        allMatches.forEach(pairing => {
            const matchRow = this.createArrangementMatchRow(pairing);
            matchesContainer.appendChild(matchRow);
        });
    }

    /**
     * 創建對戰安排行
     */
    createArrangementMatchRow(pairing) {
        const row = document.createElement('div');
        row.className = `arrangement-match ${pairing.player2 === null ? 'bye' : ''}`;
        row.dataset.matchId = pairing.id;

        if (pairing.player2 === null) {
            // BYE 的情況
            row.innerHTML = `
                <div class="arrangement-match-number">${pairing.id}</div>
                <div class="arrangement-players">
                    <div class="arrangement-player bye-player">${this.escapeHtml(pairing.player1.name)}</div>
                    <div class="arrangement-vs">BYE</div>
                </div>
                <div class="arrangement-score">
                    積分: ${pairing.player1.score}
                </div>
                <div class="arrangement-actions">
                    <span class="auto-result">輪空</span>
                </div>
            `;
        } else {
            row.innerHTML = `
                <div class="arrangement-match-number">${pairing.id}</div>
                <div class="arrangement-players">
                    <div class="arrangement-player">${this.escapeHtml(pairing.player1.name)}</div>
                    <div class="arrangement-vs">VS</div>
                    <div class="arrangement-player">${this.escapeHtml(pairing.player2.name)}</div>
                </div>
                <div class="arrangement-score">
                    ${pairing.player1.score} : ${pairing.player2.score}
                </div>
            `;
        }

        return row;
    }

    /**
     * 重新隨機配對
     */
    randomizePairings() {
        if (!confirm('確定要重新進行隨機配對嗎？這將會覆蓋當前的配對安排。')) return;

        try {
            this.showLoading(true);
            
            // 重新生成隨機配對
            const newPairings = this.tournament.generateRandomPairings();
            this.tempPairings = newPairings;
            
            this.displayArrangementPreview();
            this.showNotification('已重新生成隨機配對', 'success');
        } catch (error) {
            this.showNotification('重新配對失敗: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 切換手動配對模式
     */
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

    /**
     * 初始化手動配對
     */
    initializeManualPairing() {
        // 重置手動配對狀態
        this.manualPairings = [];
        this.selectedPlayers = [];

        // 顯示可配對選手
        this.displayAvailablePlayers();
        this.displayManualMatches();
    }

    /**
     * 顯示可配對選手
     */
    displayAvailablePlayers() {
        const container = document.getElementById('available-players-list');
        if (!container) return;

        // 獲取所有未棄權的選手
        const availablePlayers = this.tournament.players.filter(p => !p.dropped);
        
        // 移除已經在手動配對中的選手
        const pairedPlayerIds = new Set();
        this.manualPairings.forEach(pair => {
            pairedPlayerIds.add(pair.player1.id);
            if (pair.player2) pairedPlayerIds.add(pair.player2.id);
        });

        const unpairedPlayers = availablePlayers.filter(p => !pairedPlayerIds.has(p.id));

        container.innerHTML = '';

        unpairedPlayers.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'manual-player';
            playerCard.dataset.playerId = player.id;
            
            // 添加選手名稱和積分
            const playerName = document.createElement('span');
            playerName.className = 'player-name';
            playerName.textContent = player.name;
            
            const playerScore = document.createElement('span');
            playerScore.className = 'player-score';
            playerScore.textContent = `(${player.score}分)`;
            
            playerCard.appendChild(playerName);
            playerCard.appendChild(playerScore);
            playerCard.onclick = () => this.selectPlayer(player);
            
            // 如果選手已被選中，添加選中樣式
            if (this.selectedPlayers.some(p => p.id === player.id)) {
                playerCard.classList.add('selected');
            }

            container.appendChild(playerCard);
        });

        // 如果只剩一個選手，自動設為BYE
        if (unpairedPlayers.length === 1) {
            this.addByeMatch(unpairedPlayers[0]);
        }
    }

    /**
     * 選擇選手進行配對
     */
    selectPlayer(player) {
        const existingIndex = this.selectedPlayers.findIndex(p => p.id === player.id);
        
        if (existingIndex !== -1) {
            // 取消選擇
            this.selectedPlayers.splice(existingIndex, 1);
        } else {
            // 添加選擇
            this.selectedPlayers.push(player);
        }

        // 如果選中了兩個選手，自動創建配對
        if (this.selectedPlayers.length === 2) {
            this.createManualMatch(this.selectedPlayers[0], this.selectedPlayers[1]);
            this.selectedPlayers = [];
        }

        this.displayAvailablePlayers();
    }

    /**
     * 創建手動配對
     */
    createManualMatch(player1, player2) {
        const matchId = this.manualPairings.length + 1;
        
        this.manualPairings.push({
            id: matchId,
            player1: player1,
            player2: player2,
            completed: false,
            result: null
        });

        this.displayManualMatches();
        this.displayAvailablePlayers();
    }

    /**
     * 添加BYE配對
     */
    addByeMatch(player) {
        const matchId = this.manualPairings.length + 1;
        
        this.manualPairings.push({
            id: matchId,
            player1: player,
            player2: null,
            completed: true,
            result: 'bye'
        });

        this.displayManualMatches();
        this.displayAvailablePlayers();
    }

    /**
     * 顯示手動配對列表
     */
    displayManualMatches() {
        const container = document.getElementById('manual-matches-list');
        if (!container) return;

        container.innerHTML = '';

        this.manualPairings.forEach(match => {
            const matchItem = document.createElement('div');
            matchItem.className = 'manual-match-item';
            
            if (match.player2 === null) {
                // BYE 配對
                matchItem.innerHTML = `
                    <div class="manual-match-players">
                        <div class="manual-match-player">${this.escapeHtml(match.player1.name)}</div>
                        <div class="manual-match-vs">BYE</div>
                    </div>
                    <div class="manual-match-actions">
                        <button class="btn-remove-match" onclick="app.removeManualMatch(${match.id})">
                            移除
                        </button>
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
                        <button class="btn-remove-match" onclick="app.removeManualMatch(${match.id})">
                            移除
                        </button>
                    </div>
                `;
            }

            container.appendChild(matchItem);
        });
    }

    /**
     * 移除手動配對
     */
    removeManualMatch(matchId) {
        this.manualPairings = this.manualPairings.filter(match => match.id !== matchId);
        
        // 重新編號
        this.manualPairings.forEach((match, index) => {
            match.id = index + 1;
        });

        this.displayManualMatches();
        this.displayAvailablePlayers();
    }

    /**
     * 保存手動配對
     */
    saveManualPairings() {
        // 檢查是否所有選手都已配對
        const availablePlayers = this.tournament.players.filter(p => !p.dropped);
        const pairedPlayerIds = new Set();
        
        this.manualPairings.forEach(pair => {
            pairedPlayerIds.add(pair.player1.id);
            if (pair.player2) pairedPlayerIds.add(pair.player2.id);
        });

        const unpairedPlayers = availablePlayers.filter(p => !pairedPlayerIds.has(p.id));
        
        if (unpairedPlayers.length > 0) {
            this.showNotification(`還有 ${unpairedPlayers.length} 位選手未配對`, 'error');
            return;
        }

        // 應用手動配對到比賽系統
        this.tempPairings = [...this.manualPairings];
        this.displayArrangementPreview();
        
        // 退出手動配對模式
        this.toggleManualPairing();
        
        this.showNotification('手動配對已保存', 'success');
    }

    /**
     * 取消手動配對
     */
    cancelManualPairing() {
        this.toggleManualPairing();
        this.showNotification('已取消手動配對', 'info');
    }

    /**
     * 清空手動配對
     */
    clearManualPairings() {
        if (!confirm('確定要清空所有手動配對嗎？')) return;
        
        this.manualPairings = [];
        this.selectedPlayers = [];
        this.displayManualMatches();
        this.displayAvailablePlayers();
        this.showNotification('已清空所有配對', 'info');
    }

    /**
     * 生成自動配對
     */
    generateAutoPairings() {
        try {
            this.showLoading(true);
            
            // 重新生成瑞士輪配對
            const newPairings = this.tournament.generateSwissPairings();
            this.tempPairings = newPairings;
            
            this.displayArrangementPreview();
            this.showNotification('已重新生成自動配對', 'success');
        } catch (error) {
            this.showNotification('自動配對失敗: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 確認對局安排
     */
    confirmPairings() {
        try {
            // 開始新的輪次，使用臨時配對（如果存在）
            const customPairings = this.tempPairings;
            this.tournament.startNewRound(customPairings);
            
            // 清除臨時配對
            this.tempPairings = null;

            // 跳轉到對局頁面
            this.displayCurrentRound();
            this.showNotification('對局安排已確認，比賽開始！', 'success');
        } catch (error) {
            this.showNotification('確認配對失敗: ' + error.message, 'error');
        }
    }
}

// 全域變數，供 HTML 中的 onclick 使用
let app;

// 當 DOM 載入完成後初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    app = new SwissTournamentApp();
    console.log('瑞士輪比賽系統已載入完成');
});