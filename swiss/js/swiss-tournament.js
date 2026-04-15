/**
 * 瑞士輪賽事系統核心邏輯
 * 實現瑞士制比賽的配對算法、積分計算、排名系統等功能
 */

class SwissTournament {
    constructor() {
        this.players = [];
        this.rounds = [];
        this.currentRound = 0;
        this.totalRounds = 0;
        this.isFinished = false;
        this.tournamentId = this.generateTournamentId();
        this.tournamentName = null; // 自訂名稱，若為null則使用自動生成
        this.settings = {
            byePoints: 3,        // Bye 的積分 (視為勝利)
            winPoints: 3,        // 勝利積分
            drawPoints: 1,       // 平局積分
            lossPoints: 0,       // 失敗積分
            allowDraws: false,   // 是否允許平局
            allowDoubleLoss: true, // 是否允許雙敗
            customRounds: false,   // 是否使用自訂輪數
            manualRounds: null,    // 手動設定的輪數
            enablePlayoff: false,
            playoffAdvanceCount: 4
        };
            this.playoff = null; // 複賽資料，未設定時為 null
    }

    /**
     * 生成唯一的比賽ID
     */
    generateTournamentId() {
        return 'swiss_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 初始化比賽
     * @param {string[]} playerList - 選手名稱清單
     */
    initializeTournament(playerList, tournamentSettings = {}) {
        // 更新設定
        this.settings = { ...this.settings, ...tournamentSettings };
        
        // 設定自訂名稱
        if (tournamentSettings.tournamentName && tournamentSettings.tournamentName.trim()) {
            this.tournamentName = tournamentSettings.tournamentName.trim();
        } else {
            this.tournamentName = null; // 使用自動生成
        }
        
        // 清理和驗證輸入
        const cleanPlayerList = playerList
            .map(name => name.trim())
            .filter(name => name.length > 0);

        if (cleanPlayerList.length < 2) {
            throw new Error('至少需要2名選手才能開始比賽');
        }

        // 檢查重複選手
        const uniquePlayers = [...new Set(cleanPlayerList)];
        if (uniquePlayers.length !== cleanPlayerList.length) {
            throw new Error('選手清單中有重複的名稱');
        }

        // 初始化選手資料
        this.players = uniquePlayers.map((name, index) => ({
            id: index + 1,
            name: name,
            score: 0,
            buchholz: 0,         // 戰勝對手積分 (WOScore) - 原 Buchholz 係數
            sosBuchholz: 0,      // 對手的戰勝對手積分 - 原 SOS Buchholz
            omwPercentage: 0,    // OMW% - 對手平均勝率
            oomwPercentage: 0,   // OOMW% - 平均對手勝率（對手的對手平均勝率）
            opponents: [],
            results: [],
            dropped: false,
            byeCount: 0          // 輪空次數
        }));

        // 計算比賽輪數
        if (this.settings.customRounds && this.settings.manualRounds) {
            // 使用手動設定的輪數
            this.totalRounds = Math.max(this.settings.manualRounds, 3);
        } else {
            // 使用瑞士制標準公式: ceil(log2(players))
            // 9人: ceil(log2(9)) = ceil(3.169) = 4輪
            // 8人: ceil(log2(8)) = ceil(3) = 3輪
            // 16人: ceil(log2(16)) = ceil(4) = 4輪
            this.totalRounds = Math.ceil(Math.log2(this.players.length));
            
            // 確保至少有足夠的輪數 (最少3輪)
            this.totalRounds = Math.max(this.totalRounds, 3);
        }
        
        // 重置狀態
        this.rounds = [];
        this.currentRound = 0;
        this.isFinished = false;
        this.startTime = new Date().toISOString();
            this.playoff = null; // 開始新比賽時重置複賽資料
        
        // 儲存到 localStorage
        this.saveTournament();
        
        console.log(`比賽初始化完成: ${this.players.length} 位選手, ${this.totalRounds} 輪比賽`);
    }

    /**
     * 開始新的一輪比賽
     */
    startNewRound(customPairings = null) {
        if (this.currentRound >= this.totalRounds) {
            throw new Error('比賽已經結束');
        }

        this.currentRound++;
        
        const pairings = this.generateRoundPairings(customPairings);
        
        const newRound = {
            round: this.currentRound,
            pairings: pairings,
            completed: false,
            startTime: new Date().toISOString(),
            customPairings: customPairings ? true : false
        };
        
        this.rounds.push(newRound);
        
        // 如果有 Bye，自動處理積分
        pairings.forEach(pairing => {
            if (pairing.result === 'bye') {
                this.updatePlayerScore(pairing.player1.id, this.settings.byePoints, 'bye');
            }
        });
        
        this.saveTournament();
        
        return newRound;
    }

    /**
     * 生成本輪的配對
     */
    generateRoundPairings(customPairings = null) {
        // 如果提供了自訂配對，直接使用
        if (customPairings) {
            return this.applyCustomPairings(customPairings);
        }

        const activePlayers = this.players.filter(p => !p.dropped);
        
        if (activePlayers.length === 0) {
            throw new Error('沒有可參賽的選手');
        }

        if (this.currentRound === 1) {
            return this.generateFirstRoundPairings(activePlayers);
        } else {
            return this.generateSwissPairings(activePlayers);
        }
    }

    /**
     * 第一輪隨機配對
     */
    generateFirstRoundPairings(players) {
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        const pairings = [];
        let pairId = 1;
        
        for (let i = 0; i < shuffled.length - 1; i += 2) {
            pairings.push({
                id: pairId++,
                player1: { ...shuffled[i] },
                player2: { ...shuffled[i + 1] },
                result: null,
                completed: false
            });
        }

        // 處理單數人數 (Bye)
        if (shuffled.length % 2 === 1) {
            const byePlayer = shuffled[shuffled.length - 1];
            pairings.push({
                id: pairId++,
                player1: { ...byePlayer },
                player2: null,
                result: 'bye',
                completed: true
            });
        }

        return pairings;
    }

    /**
     * 瑞士制配對算法
     */
    generateSwissPairings(players) {
        // 重新計算各種係數
        this.calculateTiebreakStats();
        
        // 依日版瑞士制同分決勝順序排序：OMW% > WOScore > OOMW%
        const sorted = [...players].sort((a, b) => {
            if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score;
            if (Math.abs(b.omwPercentage - a.omwPercentage) > 0.001) return b.omwPercentage - a.omwPercentage;
            if (Math.abs(b.buchholz - a.buchholz) > 0.001) return b.buchholz - a.buchholz;
            return b.oomwPercentage - a.oomwPercentage;
        });

        const pairings = [];
        const used = new Set();
        let pairId = 1;

        // 優先處理 Bye (給最低分且未輪空過的選手)
        if (sorted.length % 2 === 1) {
            const byeCandidate = this.findBestByeCandidate(sorted, used);
            if (byeCandidate) {
                pairings.push({
                    id: pairId++,
                    player1: { ...byeCandidate },
                    player2: null,
                    result: 'bye',
                    completed: true
                });
                used.add(byeCandidate.id);
            }
        }

        // 進行配對
        for (let i = 0; i < sorted.length; i++) {
            if (used.has(sorted[i].id)) continue;

            const player1 = sorted[i];
            const player2 = this.findBestOpponent(player1, sorted, used);

            if (player2) {
                pairings.push({
                    id: pairId++,
                    player1: { ...player1 },
                    player2: { ...player2 },
                    result: null,
                    completed: false
                });
                used.add(player1.id);
                used.add(player2.id);
            }
        }

        return pairings;
    }

    /**
     * 尋找最佳 Bye 候選人
     */
    findBestByeCandidate(sortedPlayers, used) {
        // 從最低分開始，選擇未輪空過的選手
        for (let i = sortedPlayers.length - 1; i >= 0; i--) {
            const player = sortedPlayers[i];
            if (!used.has(player.id) && player.byeCount === 0) {
                return player;
            }
        }
        
        // 如果所有人都輪空過，選擇輪空次數最少的
        let minByes = Infinity;
        let candidate = null;
        
        for (let i = sortedPlayers.length - 1; i >= 0; i--) {
            const player = sortedPlayers[i];
            if (!used.has(player.id) && player.byeCount < minByes) {
                minByes = player.byeCount;
                candidate = player;
            }
        }
        
        return candidate;
    }

    /**
     * 為選手尋找最佳對手
     */
    findBestOpponent(player, sortedPlayers, used) {
        // 首先嘗試同積分組的對手
        const sameScoreOpponents = sortedPlayers.filter(p => 
            !used.has(p.id) && 
            p.id !== player.id &&
            Math.abs(p.score - player.score) < 0.001 &&
            !player.opponents.includes(p.id)
        );

        if (sameScoreOpponents.length > 0) {
            return sameScoreOpponents[0];
        }

        // 然後嘗試相近積分的對手
        const nearScoreOpponents = sortedPlayers.filter(p => 
            !used.has(p.id) && 
            p.id !== player.id &&
            !player.opponents.includes(p.id)
        );

        if (nearScoreOpponents.length > 0) {
            return nearScoreOpponents[0];
        }

        // 最後，如果必要的話，允許重複對戰
        const anyOpponent = sortedPlayers.find(p => 
            !used.has(p.id) && 
            p.id !== player.id
        );

        return anyOpponent || null;
    }

    /**
     * 記錄比賽結果
     */
    recordMatchResult(roundIndex, pairId, result, droppedPlayers = []) {
        if (roundIndex < 0 || roundIndex >= this.rounds.length) {
            throw new Error('無效的輪次');
        }

        const round = this.rounds[roundIndex];
        const pairing = round.pairings.find(p => p.id === pairId);
        
        if (!pairing) {
            throw new Error('找不到指定的配對');
        }

        // 記錄結果
        pairing.result = result;
        pairing.completed = true;
        pairing.recordTime = new Date().toISOString();
        pairing.droppedPlayers = [...droppedPlayers];

        // 更新選手積分和對戰記錄
        if (result !== 'bye') {
            this.processMatchResult(pairing, result);
        }

        // 處理棄權選手
        droppedPlayers.forEach(playerId => {
            const player = this.players.find(p => p.id === playerId);
            if (player) {
                player.dropped = true;
                console.log(`選手 ${player.name} 已棄權`);
            }
        });

        // 檢查本輪是否完成
        this.checkRoundCompletion(roundIndex);
        
        this.saveTournament();
        return true;
    }

    /**
     * 修正比賽結果
     */
    correctMatchResult(roundIndex, pairId, newResult, newDroppedPlayers = []) {
        if (roundIndex < 0 || roundIndex >= this.rounds.length) {
            throw new Error('無效的輪次');
        }

        const round = this.rounds[roundIndex];
        const pairing = round.pairings.find(p => p.id === pairId);
        
        if (!pairing) {
            throw new Error('找不到指定的配對');
        }

        if (!pairing.completed) {
            throw new Error('此比賽尚未記錄結果');
        }

        // 記錄原始結果
        const originalResult = pairing.result;
        const originalDroppedPlayers = Array.isArray(pairing.droppedPlayers)
            ? [...pairing.droppedPlayers]
            : [];

        // 回復選手積分和狀態
        this.revertMatchResult(pairing, originalResult);
        
        // 先移除此配對原本造成的棄權狀態
        originalDroppedPlayers.forEach(playerId => {
            const player = this.players.find(p => p.id === playerId);
            if (!player) return;
            if (!this.isPlayerDroppedByOtherMatch(playerId, roundIndex, pairId)) {
                player.dropped = false;
            }
        });

        // 應用新結果
        pairing.result = newResult;
        pairing.corrected = true;
        pairing.correctionTime = new Date().toISOString();
        pairing.originalResult = originalResult;
        pairing.droppedPlayers = [...newDroppedPlayers];

        // 處理新結果
        if (newResult !== 'bye') {
            this.processMatchResult(pairing, newResult);
        }

        // 處理新的棄權選手
        newDroppedPlayers.forEach(playerId => {
            const player = this.players.find(p => p.id === playerId);
            if (player) {
                player.dropped = true;
            }
        });

        // 檢查是否需要重新計算後續輪次
        const needsRecalculation = this.checkIfRecalculationNeeded(roundIndex);
        
        this.saveTournament();
        
        return {
            success: true,
            needsRecalculation: needsRecalculation
        };
    }

    /**
     * 檢查玩家是否被其他配對標記為棄權
     */
    isPlayerDroppedByOtherMatch(playerId, excludeRoundIndex, excludePairId) {
        for (let r = 0; r < this.rounds.length; r++) {
            const round = this.rounds[r];
            if (!round || !Array.isArray(round.pairings)) continue;

            for (const pairing of round.pairings) {
                if (r === excludeRoundIndex && pairing.id === excludePairId) {
                    continue;
                }
                if (Array.isArray(pairing.droppedPlayers) && pairing.droppedPlayers.includes(playerId)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 回復比賽結果對積分的影響
     */
    revertMatchResult(pairing, result) {
        const player1 = pairing.player1;
        const player2 = pairing.player2;

        if (result === 'bye') {
            this.revertPlayerScore(player1.id, this.settings.byePoints, 'bye');
            return;
        }

        // 移除對戰關係
        this.removeOpponent(player1.id, player2.id);
        this.removeOpponent(player2.id, player1.id);

        // 回復積分
        switch (result) {
            case 'player1_win':
                this.revertPlayerScore(player1.id, this.settings.winPoints, 'win');
                this.revertPlayerScore(player2.id, this.settings.lossPoints, 'loss');
                break;
            case 'player2_win':
                this.revertPlayerScore(player1.id, this.settings.lossPoints, 'loss');
                this.revertPlayerScore(player2.id, this.settings.winPoints, 'win');
                break;
            case 'draw':
                this.revertPlayerScore(player1.id, this.settings.drawPoints, 'draw');
                this.revertPlayerScore(player2.id, this.settings.drawPoints, 'draw');
                break;
            case 'double_loss':
                this.revertPlayerScore(player1.id, this.settings.lossPoints, 'loss');
                this.revertPlayerScore(player2.id, this.settings.lossPoints, 'loss');
                break;
        }
    }

    /**
     * 回復選手積分
     */
    revertPlayerScore(playerId, points, resultType) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.score -= points;
            
            // 移除對應的結果記錄
            player.results = player.results.filter(r => 
                !(r.round === this.currentRound && r.points === points && r.resultType === resultType)
            );

            if (resultType === 'bye') {
                player.byeCount--;
            }
        }
    }

    /**
     * 移除對戰關係
     */
    removeOpponent(playerId, opponentId) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.opponents = player.opponents.filter(id => id !== opponentId);
        }
    }

    /**
     * 檢查是否需要重新計算後續輪次
     */
    checkIfRecalculationNeeded(changedRoundIndex) {
        // 如果修改的不是最新一輪，且還有後續輪次，則需要重新計算
        return changedRoundIndex < this.rounds.length - 1;
    }

    /**
     * 重新計算指定輪次之後的配對
     */
    recalculatePairingsFromRound(fromRoundIndex) {
        // 刪除指定輪次之後的所有輪次
        this.rounds = this.rounds.slice(0, fromRoundIndex + 1);
        
        // 重設當前輪次
        this.currentRound = fromRoundIndex + 1;
        
        // 重新計算各種係數
        this.calculateTiebreakStats();
        
        this.saveTournament();
        
        console.log(`已重新計算第 ${fromRoundIndex + 2} 輪之後的配對`);
        
        return true;
    }

    /**
     * 處理比賽結果
     */
    processMatchResult(pairing, result) {
        const player1 = pairing.player1;
        const player2 = pairing.player2;

        // 記錄對戰關係
        this.addOpponent(player1.id, player2.id);
        this.addOpponent(player2.id, player1.id);

        // 根據結果更新積分
        switch (result) {
            case 'player1_win':
                this.updatePlayerScore(player1.id, this.settings.winPoints, 'win');
                this.updatePlayerScore(player2.id, this.settings.lossPoints, 'loss');
                break;
            case 'player2_win':
                this.updatePlayerScore(player1.id, this.settings.lossPoints, 'loss');
                this.updatePlayerScore(player2.id, this.settings.winPoints, 'win');
                break;
            case 'draw':
                this.updatePlayerScore(player1.id, this.settings.drawPoints, 'draw');
                this.updatePlayerScore(player2.id, this.settings.drawPoints, 'draw');
                break;
            case 'double_loss':
                // 雙敗：雙方都得0分
                this.updatePlayerScore(player1.id, this.settings.lossPoints, 'loss');
                this.updatePlayerScore(player2.id, this.settings.lossPoints, 'loss');
                break;
        }
    }

    /**
     * 更新選手積分
     */
    updatePlayerScore(playerId, points, resultType) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            player.score += points;
            player.results.push({
                round: this.currentRound,
                points: points,
                resultType: resultType,
                timestamp: new Date().toISOString()
            });

            if (resultType === 'bye') {
                player.byeCount++;
            }
        }
    }

    /**
     * 添加對戰記錄
     */
    addOpponent(playerId, opponentId) {
        const player = this.players.find(p => p.id === playerId);
        if (player && !player.opponents.includes(opponentId)) {
            player.opponents.push(opponentId);
        }
    }

    /**
     * 計算同分決勝統計數據
     * - WOScore (戰勝對手積分) - 原 Buchholz 係數
     * - OMW% (對手平均勝率)
     * - OOMW% (平均對手勝率) - 對手的對手平均勝率
     */
    calculateTiebreakStats() {
        // 第一輪：計算基本數據
        this.players.forEach(player => {
            let buchholz = 0;           // WOScore - 戰勝對手積分
            let sosBuchholz = 0;        // 對手的戰勝對手積分
            let opponentMatchCount = 0; // 對手總場次
            let opponentWinCount = 0;   // 對手勝場數
            
            player.opponents.forEach(opponentId => {
                const opponent = this.players.find(p => p.id === opponentId);
                if (opponent) {
                    buchholz += opponent.score;
                    sosBuchholz += opponent.buchholz;
                    
                    // 計算對手的勝場和總場次
                    const opponentMatches = opponent.results.length;
                    const opponentWins = opponent.results.filter(r => 
                        r.resultType === 'win' || r.resultType === 'bye'
                    ).length;
                    
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
        
        // 第二輪：計算 OOMW% (需要第一輪的 OMW% 計算完成)
        this.players.forEach(player => {
            let totalOpponentOMW = 0;
            let opponentCount = 0;
            
            player.opponents.forEach(opponentId => {
                const opponent = this.players.find(p => p.id === opponentId);
                if (opponent) {
                    totalOpponentOMW += opponent.omwPercentage;
                    opponentCount++;
                }
            });
            
            // 計算 OOMW% (平均對手勝率)
            player.oomwPercentage = opponentCount > 0 ? 
                totalOpponentOMW / opponentCount : 0;
        });
    }    /**
     * 檢查輪次是否完成
     */
    checkRoundCompletion(roundIndex) {
        const round = this.rounds[roundIndex];
        const allCompleted = round.pairings.every(p => p.completed);
        
        round.completed = allCompleted;
        
        if (allCompleted) {
            round.endTime = new Date().toISOString();
            console.log(`第 ${round.round} 輪比賽完成`);
        }
    }

    /**
     * 結束比賽
     */
    finishTournament() {
        this.calculateTiebreakStats();
        this.isFinished = true;
        
        // 記錄結束時間
        this.endTime = new Date().toISOString();

        // 只有在沒有複賽（或未啟用複賽）時才直接進歷史
        const hasPendingPlayoff = this.settings?.enablePlayoff || (this.playoff && this.playoff.enabled && !this.playoff.isFinished);
        if (!hasPendingPlayoff) {
            this.saveToHistory();
        }
        
        this.saveTournament();
        console.log('比賽結束');
    }

    /**
     * 獲取最終排名
     */
    getFinalRanking() {
        this.calculateTiebreakStats();
        
        return [...this.players].sort((a, b) => {
            // 未完賽（棄權）玩家排在最後
            if (a.dropped !== b.dropped) {
                return a.dropped ? 1 : -1;
            }

            // 主要排序：積分
            if (Math.abs(b.score - a.score) > 0.001) {
                return b.score - a.score;
            }
            
            // 日版瑞士制同分決勝順序：OMW% > WOScore > OOMW%
            if (Math.abs(b.omwPercentage - a.omwPercentage) > 0.001) {
                return b.omwPercentage - a.omwPercentage;
            }
            
            if (Math.abs(b.buchholz - a.buchholz) > 0.001) {
                return b.buchholz - a.buchholz;
            }
            
            return b.oomwPercentage - a.oomwPercentage;
        }).map((player, index) => ({
            ...player,
            rank: index + 1
        }));
    }

    /**
     * 獲取目前輪次配對
     */
    getCurrentRoundPairings() {
        if (this.currentRound === 0 || this.currentRound > this.rounds.length) {
            return [];
        }
        return this.rounds[this.currentRound - 1].pairings;
    }

    /**
     * 檢查是否可以開始下一輪
     */
    canStartNextRound() {
        if (this.currentRound === 0) return true;
        if (this.currentRound >= this.totalRounds) return false;
        
        const currentRoundData = this.rounds[this.currentRound - 1];
        return currentRoundData && currentRoundData.completed;
    }

    /**
     * 儲存比賽到 localStorage（以 tournamentId 為 key）
     */
    saveTournament() {
        try {
            const data = {
                tournamentId: this.tournamentId,
                tournamentName: this.tournamentName,
                players: this.players,
                rounds: this.rounds,
                currentRound: this.currentRound,
                totalRounds: this.totalRounds,
                isFinished: this.isFinished,
                settings: this.settings,
                lastUpdate: new Date().toISOString(),
                version: '2.0',
                playoff: this.playoff
            };
            const key = `swiss_tournament_${this.tournamentId}`;
            localStorage.setItem(key, JSON.stringify(data));
            // 若賽事已完全結束，從進行中清單移除（移入歷史）；否則保持登記
            const fullyFinished = this.isFinished && (!this.playoff || this.playoff.isFinished);
            if (fullyFinished) {
                SwissTournament.unregisterTournament(this.tournamentId);
            } else {
                SwissTournament.registerTournament(this.tournamentId);
            }
            console.log('比賽資料已儲存:', this.tournamentId);
        } catch (error) {
            console.error('儲存比賽資料失敗:', error);
        }
    }

    /**
     * 從 localStorage 載入比賽（以 tournamentId 為 key）
     */
    loadTournament() {
        try {
            const key = `swiss_tournament_${this.tournamentId}`;
            const data = localStorage.getItem(key);
            if (!data) return false;

            const parsed = JSON.parse(data);
            if (!parsed.version) {
                console.warn('舊版本的比賽資料，可能需要升級');
            }

            Object.assign(this, parsed);
            if (!this.hasOwnProperty('playoff') || this.playoff === undefined) {
                this.playoff = null;
            }

            console.log('比賽資料載入成功:', this.tournamentId);
            return true;
        } catch (error) {
            console.error('載入比賽資料失敗:', error);
            return false;
        }
    }

    /**
     * 以 ID 靜態載入比賽（用於讀取卡片資訊，不影響 this.tournament）
     */
    static loadById(id) {
        try {
            const key = `swiss_tournament_${id}`;
            const data = localStorage.getItem(key);
            if (!data) return null;
            const t = new SwissTournament();
            Object.assign(t, JSON.parse(data));
            if (!t.playoff) t.playoff = null;
            return t;
        } catch (e) { return null; }
    }

    /**
     * 重置比賽回到未開賽狀態（保留賽事 ID、名稱、設定）
     */
    resetTournament() {
        const id = this.tournamentId;
        const name = this.tournamentName;
        const settings = { ...this.settings };

        this.players = [];
        this.rounds = [];
        this.currentRound = 0;
        this.totalRounds = 0;
        this.isFinished = false;
        this.playoff = null;
        this.tournamentId = id;
        this.tournamentName = name;
        this.settings = settings;

        this.saveTournament(); // 儲存為 idle 狀態
        console.log('比賽已重置為初始狀態:', id);
    }

    /**
     * 刪除比賽（從 localStorage 完全移除）
     */
    deleteTournament() {
        try {
            SwissTournament.unregisterTournament(this.tournamentId);
            localStorage.removeItem(`swiss_tournament_${this.tournamentId}`);
            console.log('比賽已刪除:', this.tournamentId);
        } catch (error) {
            console.error('刪除比賽失敗:', error);
        }
    }

    // ─── 靜態 ID 管理方法 ────────────────────────────────────────

    static getActiveTournamentIds() {
        try {
            const raw = localStorage.getItem('swiss_active_tournaments');
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    static registerTournament(id) {
        const ids = SwissTournament.getActiveTournamentIds();
        if (!ids.includes(id)) {
            ids.push(id);
            localStorage.setItem('swiss_active_tournaments', JSON.stringify(ids));
        }
    }

    static unregisterTournament(id) {
        const ids = SwissTournament.getActiveTournamentIds().filter(i => i !== id);
        localStorage.setItem('swiss_active_tournaments', JSON.stringify(ids));
    }

    /**
     * 匯出比賽資料
     */
    exportTournament() {
        return {
            tournament: {
                tournamentId: this.tournamentId,
                tournamentName: this.tournamentName,
                players: this.players,
                rounds: this.rounds,
                currentRound: this.currentRound,
                totalRounds: this.totalRounds,
                isFinished: this.isFinished,
                settings: this.settings,
                playoff: this.playoff,
                version: '2.0'
            },
            exportDate: new Date().toISOString(),
            type: 'swiss_tournament',
            appVersion: '2.0'
        };
    }

    /**
     * 匯入比賽資料
     */
    importTournament(data) {
        try {
            if (data.type !== 'swiss_tournament') {
                throw new Error('無效的比賽檔案格式');
            }
            
            const tournament = data.tournament;
            
            // 驗證必要欄位
            if (!tournament.players || !Array.isArray(tournament.players)) {
                throw new Error('選手資料無效');
            }
            
            // 恢復比賽狀態
            Object.assign(this, tournament);
            if (!this.hasOwnProperty('playoff') || this.playoff === undefined) {
                this.playoff = null;
            }
            
            // 儲存到 localStorage
            this.saveTournament();
            
            console.log('比賽資料匯入成功');
            return true;
        } catch (error) {
            console.error('匯入比賽資料失敗:', error);
            throw error;
        }
    }

    /**
     * 獲取比賽統計資訊
     */
    getStatistics() {
        const stats = {
            totalPlayers: this.players.length,
            activePlayers: this.players.filter(p => !p.dropped).length,
            droppedPlayers: this.players.filter(p => p.dropped).length,
            completedRounds: this.rounds.filter(r => r.completed).length,
            totalRounds: this.totalRounds,
            currentRound: this.currentRound,
            isFinished: this.isFinished
        };

        if (this.isFinished) {
            const ranking = this.getFinalRanking();
            stats.champion = this.playoff?.champion || ranking[0] || null;
            stats.averageScore = this.players.reduce((sum, p) => sum + p.score, 0) / this.players.length;
        }

        return stats;
    }

    /**
     * 儲存比賽到歷史記錄
     */
    saveToHistory() {
        try {
            // 啟用複賽時，必須等複賽完成才寫入歷史
            if (this.settings?.enablePlayoff && (!this.playoff || !this.playoff.isFinished)) {
                return;
            }

            const swissRanking = this.getFinalRanking();
            const finalChampion = this.playoff?.champion || (this.isFinished ? swissRanking[0] : null);
            const historyData = {
                tournamentId: this.tournamentId,
                title: this.generateTournamentTitle(),
                players: this.players,
                rounds: this.rounds,
                totalRounds: this.totalRounds,
                isFinished: this.isFinished,
                playoff: this.playoff,
                startTime: this.startTime || new Date().toISOString(),
                endTime: this.endTime,
                champion: finalChampion,
                stats: this.getStatistics(),
                version: '2.0'
            };

            // 獲取現有歷史記錄
            const existingHistory = this.getTournamentHistory();
            
            // 檢查是否已存在此比賽
            const existingIndex = existingHistory.findIndex(t => t.tournamentId === this.tournamentId);
            
            if (existingIndex >= 0) {
                // 更新現有記錄
                existingHistory[existingIndex] = historyData;
            } else {
                // 新增記錄
                existingHistory.unshift(historyData); // 最新的在前面
            }

            // 限制歷史記錄數量 (最多保留50場)
            if (existingHistory.length > 50) {
                existingHistory.splice(50);
            }

            localStorage.setItem('swiss_tournament_history', JSON.stringify(existingHistory));
            console.log('比賽已儲存到歷史記錄');
        } catch (error) {
            console.error('儲存歷史記錄失敗:', error);
        }
    }

    /**
     * 生成比賽標題
     */
    generateTournamentTitle() {
        // 如果有自訂名稱，使用自訂名稱
        if (this.tournamentName) {
            return this.tournamentName;
        }
        
        // 否則使用預設格式
        const date = new Date();
        const dateStr = date.toLocaleDateString('zh-TW');
        const timeStr = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
        return `${this.players.length}人瑞士輪 (${dateStr} ${timeStr})`;
    }

    /**
     * 獲取歷史比賽記錄
     */
    getTournamentHistory() {
        try {
            const history = localStorage.getItem('swiss_tournament_history');
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('讀取歷史記錄失敗:', error);
            return [];
        }
    }

    /**
     * 刪除歷史比賽記錄
     */
    deleteHistoryTournament(tournamentId) {
        try {
            const history = this.getTournamentHistory();
            const filteredHistory = history.filter(t => t.tournamentId !== tournamentId);
            localStorage.setItem('swiss_tournament_history', JSON.stringify(filteredHistory));
            console.log('歷史記錄已刪除');
            return true;
        } catch (error) {
            console.error('刪除歷史記錄失敗:', error);
            return false;
        }
    }

    /**
     * 清空所有歷史記錄
     */
    clearAllHistory() {
        try {
            localStorage.removeItem('swiss_tournament_history');
            console.log('所有歷史記錄已清除');
            return true;
        } catch (error) {
            console.error('清除歷史記錄失敗:', error);
            return false;
        }
    }

    /**
     * 從歷史記錄載入比賽
     */
    loadFromHistory(tournamentId) {
        try {
            const history = this.getTournamentHistory();
            const tournament = history.find(t => t.tournamentId === tournamentId);
            
            if (!tournament) {
                throw new Error('找不到指定的歷史比賽');
            }

            // 恢復比賽狀態
            Object.assign(this, tournament);
            if (!this.hasOwnProperty('playoff') || this.playoff === undefined) {
                this.playoff = null;
            }
            
            // 儲存為目前比賽
            this.saveTournament();
            
            console.log('歷史比賽載入成功');
            return true;
        } catch (error) {
            console.error('載入歷史比賽失敗:', error);
            throw error;
        }
    }

    /**
     * 生成隨機配對 (配對安排功能使用)
     */
    generateRandomPairings() {
        const activePlayers = this.players.filter(p => !p.dropped);
        
        if (activePlayers.length === 0) {
            return [];
        }
        
        // 隨機洗牌
        const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);
        const pairings = [];
        let pairId = 1;
        
        // 配對
        for (let i = 0; i < shuffled.length - 1; i += 2) {
            pairings.push({
                id: pairId++,
                player1: { ...shuffled[i] },
                player2: { ...shuffled[i + 1] },
                result: null,
                completed: false
            });
        }

        // 處理單數人數 (Bye)
        if (shuffled.length % 2 === 1) {
            const byePlayer = shuffled[shuffled.length - 1];
            pairings.push({
                id: pairId++,
                player1: { ...byePlayer },
                player2: null,
                result: 'bye',
                completed: true
            });
        }

        return pairings;
    }

    /**
     * 生成瑞士制配對 (配對安排功能使用)
     */
    generateSwissPairings() {
        const activePlayers = this.players.filter(p => !p.dropped);
        
        if (activePlayers.length === 0) {
            return [];
        }

        // 重新計算各種係數
        this.calculateTiebreakStats();
        
        // 依積分排序
        const sorted = [...activePlayers].sort((a, b) => {
            if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score;
            if (Math.abs(b.buchholz - a.buchholz) > 0.001) return b.buchholz - a.buchholz;
            return b.sosBuchholz - a.sosBuchholz;
        });

        const pairings = [];
        const used = new Set();
        let pairId = 1;

        // 優先處理 Bye
        if (sorted.length % 2 === 1) {
            const byeCandidate = this.findBestByeCandidate(sorted, used);
            if (byeCandidate) {
                pairings.push({
                    id: pairId++,
                    player1: { ...byeCandidate },
                    player2: null,
                    result: 'bye',
                    completed: true
                });
                used.add(byeCandidate.id);
            }
        }

        // 進行配對
        for (let i = 0; i < sorted.length; i++) {
            if (used.has(sorted[i].id)) continue;

            const player1 = sorted[i];
            const player2 = this.findBestOpponent(player1, sorted, used);

            if (player2) {
                pairings.push({
                    id: pairId++,
                    player1: { ...player1 },
                    player2: { ...player2 },
                    result: null,
                    completed: false
                });
                used.add(player1.id);
                used.add(player2.id);
            }
        }

        return pairings;
    }

    /**
     * 應用自訂配對
     */
    applyCustomPairings(customPairings) {
        if (!Array.isArray(customPairings)) {
            throw new Error('自訂配對必須是陣列');
        }

        // 驗證配對
        const activePlayers = this.players.filter(p => !p.dropped);
        const usedPlayerIds = new Set();
        
        for (const pairing of customPairings) {
            // 檢查選手1
            if (!pairing.player1 || !activePlayers.find(p => p.id === pairing.player1.id)) {
                const playerName = pairing.player1 ? pairing.player1.name : 'Unknown';
                throw new Error(`找不到選手: ${playerName}`);
            }
            
            if (usedPlayerIds.has(pairing.player1.id)) {
                throw new Error(`選手 ${pairing.player1.name} 被重複配對`);
            }
            usedPlayerIds.add(pairing.player1.id);
            
            // 檢查選手2 (如果不是 Bye)
            if (pairing.player2) {
                if (!activePlayers.find(p => p.id === pairing.player2.id)) {
                    throw new Error(`找不到選手: ${pairing.player2.name}`);
                }
                
                if (usedPlayerIds.has(pairing.player2.id)) {
                    throw new Error(`選手 ${pairing.player2.name} 被重複配對`);
                }
                usedPlayerIds.add(pairing.player2.id);
            }
        }

        // 檢查是否所有選手都已配對
        const notPairedPlayers = activePlayers.filter(p => !usedPlayerIds.has(p.id));
        if (notPairedPlayers.length > 0) {
            throw new Error(`以下選手尚未配對: ${notPairedPlayers.map(p => p.name).join(', ')}`);
        }

        // 重新整理配對 ID
        const finalPairings = customPairings.map((pairing, index) => ({
            ...pairing,
            id: index + 1
        }));

        return finalPairings;
    }
    /**
     * 取得比賽目前狀態碼
     * idle | setup | playing | round_complete | last_round_complete
     * swiss_complete | playoff_ready | in_playoff | finished
     */
    getStatus() {
        if (!this.players || this.players.length === 0) return 'idle';
        if (this.playoff) {
            if (this.playoff.isFinished) return 'finished';
            if (this.playoff.started) return 'in_playoff';
            if (this.isFinished && this.playoff.enabled) return 'playoff_ready';
        }
        if (this.isFinished) return 'swiss_complete';
        if (this.currentRound === 0) return 'setup';

        const round = this.rounds[this.currentRound - 1];
        if (!round) return 'setup';

        if (round.completed) {
            return this.currentRound >= this.totalRounds ? 'last_round_complete' : 'round_complete';
        }

        return 'playing';
    }

    /**
     * 設定複賽（可在瑞士輪結束前預先設定）
     */
    configurePlayoff(advanceCount, format = 'single_elimination') {
        this.playoff = {
            enabled: true,
            advanceCount: Math.max(2, advanceCount),
            format,
            started: false,
            isFinished: false,
            rounds: [],
            currentRound: 0,
            totalRounds: 0,
            bracketSize: 0,
            participants: [],
            champion: null
        };
        this.saveTournament();
    }

    cancelPlayoff() {
        this.playoff = null;
        this.saveTournament();
    }

    generateBracketSeeds(n) {
        if (n <= 1) return [1];
        if (n === 2) return [1, 2];

        const upper = this.generateBracketSeeds(n / 2);
        const result = [];
        upper.forEach(seed => {
            result.push(seed);
            result.push(n + 1 - seed);
        });
        return result;
    }

    initializePlayoff() {
        if (!this.playoff || !this.playoff.enabled) throw new Error('複賽功能未啟用');
        if (!this.isFinished) throw new Error('瑞士輪尚未結束，請先結束預賽');

        const ranking = this.getFinalRanking();
        const advanceCount = Math.min(this.playoff.advanceCount, ranking.length);
        const participants = ranking.slice(0, advanceCount).map((player, index) => ({
            id: player.id,
            name: player.name,
            score: player.score,
            swissRank: index + 1
        }));

        if (participants.length < 2) throw new Error('複賽至少需要 2 名選手');

        const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(participants.length, 2))));
        const totalRounds = Math.log2(bracketSize);
        const seeds = this.generateBracketSeeds(bracketSize);
        const allMatchesMap = {};
        const firstRoundMatchCount = bracketSize / 2;
        let matchCounter = 1;

        for (let i = 0; i < firstRoundMatchCount; i++) {
            const seed1 = seeds[i * 2] - 1;
            const seed2 = seeds[i * 2 + 1] - 1;
            const player1 = participants[seed1] || null;
            const player2 = participants[seed2] || null;
            const isBye = (player1 === null) !== (player2 === null);
            const autoWinner = isBye ? (player1 ? player1.id : player2.id) : null;

            allMatchesMap[matchCounter] = {
                id: matchCounter,
                round: 1,
                position: i,
                player1,
                player2,
                winner: autoWinner,
                completed: isBye,
                isBye,
                advancesToMatchId: null,
                advancesToSlot: i % 2 === 0 ? 1 : 2
            };
            matchCounter++;
        }

        for (let roundNumber = 2; roundNumber <= totalRounds; roundNumber++) {
            const matchesInRound = bracketSize / Math.pow(2, roundNumber);
            for (let i = 0; i < matchesInRound; i++) {
                allMatchesMap[matchCounter] = {
                    id: matchCounter,
                    round: roundNumber,
                    position: i,
                    player1: null,
                    player2: null,
                    winner: null,
                    completed: false,
                    isBye: false,
                    advancesToMatchId: null,
                    advancesToSlot: i % 2 === 0 ? 1 : 2
                };
                matchCounter++;
            }
        }

        let roundStart = 1;
        for (let roundNumber = 1; roundNumber < totalRounds; roundNumber++) {
            const currentCount = bracketSize / Math.pow(2, roundNumber);
            const nextStart = roundStart + currentCount;
            for (let i = 0; i < currentCount; i++) {
                allMatchesMap[roundStart + i].advancesToMatchId = nextStart + Math.floor(i / 2);
            }
            roundStart = nextStart;
        }

        for (let i = 1; i <= firstRoundMatchCount; i++) {
            const match = allMatchesMap[i];
            if (match.isBye && match.winner && match.advancesToMatchId != null) {
                const winnerObj = match.player1?.id === match.winner ? match.player1 : match.player2;
                const nextMatch = allMatchesMap[match.advancesToMatchId];
                if (nextMatch && winnerObj) {
                    if (match.advancesToSlot === 1) nextMatch.player1 = winnerObj;
                    else nextMatch.player2 = winnerObj;
                }
            }
        }

        const playoffRounds = [];
        for (let roundNumber = 1; roundNumber <= totalRounds; roundNumber++) {
            const matches = Object.values(allMatchesMap)
                .filter(match => match.round === roundNumber)
                .sort((a, b) => a.position - b.position);
            playoffRounds.push({
                round: roundNumber,
                matches,
                completed: matches.every(match => match.completed)
            });
        }

        const firstIncompleteIndex = playoffRounds.findIndex(round => !round.completed);
        Object.assign(this.playoff, {
            started: true,
            advanceCount,
            participants,
            bracketSize,
            totalRounds,
            rounds: playoffRounds,
            currentRound: firstIncompleteIndex >= 0 ? firstIncompleteIndex + 1 : totalRounds,
            isFinished: false,
            champion: null
        });

        this.saveTournament();
        return this.playoff;
    }

    recordPlayoffResult(matchId, winnerId) {
        if (!this.playoff || !this.playoff.started) throw new Error('複賽尚未開始');

        let targetMatch = null;
        let targetRoundIndex = -1;
        for (let i = 0; i < this.playoff.rounds.length; i++) {
            const found = this.playoff.rounds[i].matches.find(match => match.id === matchId);
            if (found) {
                targetMatch = found;
                targetRoundIndex = i;
                break;
            }
        }

        if (!targetMatch) throw new Error('找不到指定比賽');
        if (targetMatch.completed) throw new Error('此比賽已有結果');
        if (targetMatch.player1?.id !== winnerId && targetMatch.player2?.id !== winnerId) {
            throw new Error('無效的勝者');
        }

        targetMatch.winner = winnerId;
        targetMatch.completed = true;
        const winnerObj = targetMatch.player1?.id === winnerId ? targetMatch.player1 : targetMatch.player2;

        if (targetMatch.advancesToMatchId != null) {
            let nextMatch = null;
            for (const round of this.playoff.rounds) {
                nextMatch = round.matches.find(match => match.id === targetMatch.advancesToMatchId);
                if (nextMatch) break;
            }

            if (nextMatch && winnerObj) {
                if (targetMatch.advancesToSlot === 1) nextMatch.player1 = winnerObj;
                else nextMatch.player2 = winnerObj;
            }
        } else {
            this.playoff.champion = winnerObj;
            this.playoff.isFinished = true;
            this.saveToHistory();
        }

        const currentRound = this.playoff.rounds[targetRoundIndex];
        currentRound.completed = currentRound.matches.every(match => match.completed);
        if (currentRound.completed && targetRoundIndex + 1 < this.playoff.rounds.length) {
            this.playoff.currentRound = targetRoundIndex + 2;
        }

        this.saveTournament();
        return { isChampion: this.playoff.isFinished, champion: this.playoff.champion };
    }
}

// 如果在 Node.js 環境
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SwissTournament;
}
