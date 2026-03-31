/**
 * PTCG 情報站 - 前端資料載入與渲染模組
 * 從 /ptcg/data/ 目錄讀取 JSON 資料並渲染各頁面
 */

'use strict';

const PTCG = (() => {

    // ─── 設定 ────────────────────────────────────────────────
    const DATA_BASE = './data/';

    // 牌型對應顏色（CSS 漸層）
    const DECK_COLORS = {
        '攻擊': ['#dc2626', '#f97316'],
        '控制': ['#1d4ed8', '#7c3aed'],
        '封鎖': ['#7c3aed', '#ec4899'],
        '擴散': ['#16a34a', '#0ea5e9'],
    };

    // 賽事等級對應 badge class / 文字
    const TOURNAMENT_TYPE_MAP = {
        'UBL':        { cls: 'badge-rlc', label: '高級球' },
        'PREMIERE':   { cls: 'badge-pc',  label: '紀念球' },
        'MASTERBALL': { cls: 'badge-spr', label: '大師球' },
    };

    const PLAYER_LEVELS = ['master', 'senior', 'junior'];
    const PLAYER_LEVEL_LABELS = {
        master: '大師組',
        senior: '少年組',
        junior: '孩童組',
    };

    // ─── 資料載入 ─────────────────────────────────────────────

    async function fetchJSON(file) {
        const resp = await fetch(DATA_BASE + file);
        if (!resp.ok) throw new Error(`無法載入 ${file} (HTTP ${resp.status})`);
        return resp.json();
    }

    async function fetchText(file) {
        const resp = await fetch(DATA_BASE + file);
        if (!resp.ok) throw new Error(`無法載入 ${file} (HTTP ${resp.status})`);
        return resp.text();
    }

    // ─── 工具函式 ─────────────────────────────────────────────

    function getRankBadge(rank) {
        if (rank === 1) return `<span class="rank-badge rank-1">1</span>`;
        if (rank === 2) return `<span class="rank-badge rank-2">2</span>`;
        if (rank === 3) return `<span class="rank-badge rank-3">3</span>`;
        return `<span class="rank-badge rank-n">${rank}</span>`;
    }

    function getWinrateClass(rate) {
        if (rate >= 60) return 'winrate-good';
        if (rate >= 45) return 'winrate-avg';
        return 'winrate-low';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '--';
        const d = new Date(dateStr);
        return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
    }

    function parseDateTimeValue(dateStr) {
        const normalized = String(dateStr || '').trim();
        if (!normalized) return null;

        const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
        if (match) {
            const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
            return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
        }

        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function formatUpdatedAt(dateStr) {
        const d = parseDateTimeValue(dateStr);
        if (!d) return '--';
        return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    function escapeHtml(str) {
        const el = document.createElement('div');
        el.textContent = str ?? '';
        return el.innerHTML;
    }

    function parseCsvText(text) {
        const rows = [];
        let row = [];
        let cell = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i += 1) {
            const ch = text[i];
            const next = text[i + 1];

            if (ch === '"') {
                if (inQuotes && next === '"') {
                    cell += '"';
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (ch === ',' && !inQuotes) {
                row.push(cell);
                cell = '';
                continue;
            }

            if ((ch === '\n' || ch === '\r') && !inQuotes) {
                if (ch === '\r' && next === '\n') {
                    i += 1;
                }
                row.push(cell);
                if (row.some(value => value.length > 0)) {
                    rows.push(row);
                }
                row = [];
                cell = '';
                continue;
            }

            cell += ch;
        }

        if (cell.length > 0 || row.length > 0) {
            row.push(cell);
            if (row.some(value => value.length > 0)) {
                rows.push(row);
            }
        }

        return rows;
    }

    function parsePointsValue(points) {
        const match = String(points || '').match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    }

    function parseDateFromTournamentTitle(title) {
        const match = String(title || '').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
        if (!match) return '';
        const year = match[1];
        const month = String(parseInt(match[2], 10)).padStart(2, '0');
        const day = String(parseInt(match[3], 10)).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseSeasonFromTournamentTitle(title) {
        const match = String(title || '').match(/(\d{4})-(\d{2})/);
        if (!match) return '';
        const startYear = parseInt(match[1], 10);
        const endYearSuffix = parseInt(match[2], 10);
        const endYear = startYear >= 2000 ? Math.floor(startYear / 100) * 100 + endYearSuffix : startYear + 1;
        return `${startYear}-${String(endYear).padStart(4, '0')}`;
    }

    function parseLevelFromTournamentTitle(title) {
        const text = String(title || '');
        if (text.includes('大師組')) return 'master';
        if (text.includes('少年組')) return 'senior';
        if (text.includes('孩童組')) return 'junior';
        return '';
    }

    function toDateValue(dateStr) {
        if (!dateStr) return -Infinity;
        const t = Date.parse(dateStr);
        return Number.isNaN(t) ? -Infinity : t;
    }

    function normalizeTournamentRecord(item, sourceType) {
        const type = String(sourceType || item?.type || '').toUpperCase();
        const title = String(item?.title || '').trim();
        const date = String(item?.officialDate || '').trim()
            || parseDateFromTournamentTitle(title)
            || (item?.createdAt ? String(item.createdAt).slice(0, 10) : '');
        const season = parseSeasonFromTournamentTitle(title);
        const level = String(item?.level || parseLevelFromTournamentTitle(title) || '').toLowerCase();
        const round1Max = Number.isFinite(item?.round1Max) ? item.round1Max : null;
        const estimatedParticipants = round1Max && round1Max > 0 ? `${round1Max * 2}(估)` : null;
        const participants = estimatedParticipants || (Number.isFinite(item?.finalRankCount) ? item.finalRankCount : '--');
        const series = item?.series ? String(item.series) : '';

        return {
            id: String(item?.id || `${type}-${Date.now()}`),
            name: title || `${TOURNAMENT_TYPE_MAP[type]?.label || type} ${series || String(item?.id || '')}`.trim(),
            type,
            season,
            date,
            location: series ? `系列 ${series}` : '--',
            participants,
            finalRankCount: Number.isFinite(item?.finalRankCount) ? item.finalRankCount : null,
            round1Max,
            format: 'Standard',
            top8_archetypes: [],
            top8: [],
            csvFile: item?.csvFile || '',
            csvVersion: item?.csvVersion || '',
            roundCount: Number.isFinite(item?.roundCount) ? item.roundCount : 0,
            level,
            status: item?.lastStatus || '',
            error: item?.lastError || '',
            officialUrl: item?.officialUrl || '',
            top128File: item?.top128File || '',
            top128Count: Number.isFinite(item?.top128Count) ? item.top128Count : null,
            officialDate: item?.officialDate || '',
        };
    }

    function normalizeTop128OnlyRecord(item) {
        const type = String(item?.type || 'ubl').toUpperCase();
        const level = String(item?.level || '').toLowerCase();
        const levelLabel = PLAYER_LEVEL_LABELS[level] || '';
        const series = String(item?.series || '').trim();
        const season = String(item?.season || '').trim() || '2025-2026';
        const typeLabel = TOURNAMENT_TYPE_MAP[type]?.label || type;
        const name = [season.replace('-', '-').replace('-', '-'), typeLabel, series ? `系列 ${series}` : '', levelLabel]
            .filter(Boolean)
            .join(' ')
            .trim();

        return {
            id: String(item?.id || `top128-${type}-${series || Date.now()}-${level || 'unknown'}`),
            name: name || `${typeLabel} 官方 Top 128`,
            type,
            season,
            date: String(item?.officialDate || item?.date || ''),
            location: '',
            participants: Number.isFinite(item?.top128Count) ? item.top128Count : '',
            finalRankCount: null,
            round1Max: null,
            format: 'Standard',
            top8_archetypes: [],
            top8: [],
            csvFile: '',
            csvVersion: '',
            roundCount: 0,
            level,
            status: '',
            error: '',
            officialUrl: String(item?.officialUrl || ''),
            top128File: String(item?.top128File || ''),
            top128Count: Number.isFinite(item?.top128Count) ? item.top128Count : null,
            officialDate: String(item?.officialDate || item?.date || ''),
        };
    }

    async function loadTop128Manifest() {
        try {
            const data = await fetchJSON('tournaments_top128.json');
            if (!data || typeof data !== 'object' || !Array.isArray(data.TOP128)) {
                return [];
            }
            return data.TOP128;
        } catch {
            return [];
        }
    }

    async function loadUnifiedTournaments() {
        const [ublSource, premiereSource, top128Manifest] = await Promise.all([
            fetchJSON('tournaments_ubl.json'),
            fetchJSON('tournaments_premiere.json'),
            loadTop128Manifest(),
        ]);

        const ublList = Array.isArray(ublSource?.UBL) ? ublSource.UBL : [];
        const premiereList = Array.isArray(premiereSource?.PREMIERE) ? premiereSource.PREMIERE : [];
        const existingTop128Files = new Set(
            [...ublList, ...premiereList]
                .map(item => String(item?.top128File || '').trim())
                .filter(Boolean)
        );

        const top128OnlyList = top128Manifest
            .filter(item => {
                const top128File = String(item?.top128File || '').trim();
                return top128File && !existingTop128Files.has(top128File);
            })
            .map(item => normalizeTop128OnlyRecord(item));

        const tournaments = [
            ...ublList.map(item => normalizeTournamentRecord(item, 'UBL')),
            ...premiereList.map(item => normalizeTournamentRecord(item, 'PREMIERE')),
            ...top128OnlyList,
        ];

        tournaments.sort((a, b) => toDateValue(b.date) - toDateValue(a.date));
        return tournaments;
    }

    function mapDivisionLabel(division) {
        return PLAYER_LEVEL_LABELS[String(division || '').trim().toLowerCase()] || '--';
    }

    function formatRankingDate(dateStr) {
        const match = String(dateStr || '').match(/^(\d{4})(\d{2})(\d{2})$/);
        if (!match) return '資料已載入';
        return `資料截至 ${match[1]}/${match[2]}/${match[3]}`;
    }

    function getAvailablePlayerLevels(manifest) {
        return PLAYER_LEVELS.filter(level => manifest?.latest?.[level]?.file);
    }

    async function loadPlayersManifest() {
        const manifest = await fetchJSON('ranking.json');
        if (!manifest || typeof manifest !== 'object' || !manifest.latest) {
            throw new Error('ranking.json 格式不正確');
        }
        return manifest;
    }

    async function loadPlayerHistoryIndex() {
        try {
            const index = await fetchJSON('players/players.json');
            if (!index || typeof index !== 'object' || !Array.isArray(index.players)) {
                throw new Error('players/players.json 格式不正確');
            }
            return index;
        } catch (err) {
            console.warn('[PTCG] players/players.json 載入失敗，詳情按鈕將依已載入資訊顯示。', err);
            return { players: [] };
        }
    }

    function parseRankingCsvToPlayers(csvText, level) {
        const rows = parseCsvText(csvText);
        if (!rows.length) return [];

        const header = rows[0].map(value => value.trim());
        const rankIndex = header.indexOf('rank');
        const nameIndex = header.indexOf('username');
        const idIndex = header.indexOf('ptcg_id');
        const areaIndex = header.indexOf('area');
        const pointsIndex = header.indexOf('points');

        return rows.slice(1)
            .filter(cols => cols.length >= 5)
            .map(cols => {
                const points = cols[pointsIndex] || '';
                return {
                    rank: parseInt(cols[rankIndex], 10) || 0,
                    name: cols[nameIndex] || '',
                    ptcg_id: cols[idIndex] || '',
                    region: cols[areaIndex] || '',
                    division: String(level || 'master').toLowerCase(),
                    divisionLabel: mapDivisionLabel(level || 'master'),
                    score: points,
                    scoreValue: parsePointsValue(points),
                    tournaments: '',
                };
            });
    }

    async function loadPlayersFromManifest(manifest, level) {
        const entry = manifest?.latest?.[level] || null;
        if (!entry?.file) {
            return {
                players: [],
                label: mapDivisionLabel(level),
                date: '',
                file: '',
            };
        }

        const csvText = await fetchText(entry.file);
        const players = parseRankingCsvToPlayers(csvText, level);
        players.sort((a, b) => {
            if (b.scoreValue !== a.scoreValue) return b.scoreValue - a.scoreValue;
            return a.rank - b.rank;
        });

        return {
            players,
            label: entry.label || mapDivisionLabel(level),
            date: entry.date || '',
            file: entry.file,
        };
    }

    const _rankingLookupPromiseByLevel = new Map();

    async function loadRankingLookupByPtcgId(level) {
        const normalizedLevel = String(level || '').toLowerCase();
        if (!PLAYER_LEVELS.includes(normalizedLevel)) {
            return new Map();
        }

        if (_rankingLookupPromiseByLevel.has(normalizedLevel)) {
            return _rankingLookupPromiseByLevel.get(normalizedLevel);
        }

        const promise = (async () => {
            const manifest = await loadPlayersManifest();
            const entry = manifest?.latest?.[normalizedLevel];
            if (!entry?.file) {
                return new Map();
            }

            const result = await loadPlayersFromManifest(manifest, normalizedLevel);
            const lookup = new Map();
            for (const player of result.players) {
                const idKey = String(player.ptcg_id || '').trim().toLowerCase();
                if (!idKey || lookup.has(idKey)) {
                    continue;
                }
                lookup.set(idKey, {
                    name: player.name,
                    rank: player.rank,
                    score: player.score,
                    divisionLabel: player.divisionLabel,
                    ptcg_id: player.ptcg_id,
                });
            }
            return lookup;
        })();

        _rankingLookupPromiseByLevel.set(normalizedLevel, promise);
        return promise;
    }

    function showError(containerId, message) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = `
            <div class="empty-state col-12">
                <div class="empty-state-icon"><i class="bi bi-exclamation-circle"></i></div>
                <p class="mb-0">${escapeHtml(message)}</p>
                <p class="small text-muted mt-1">請確認 data/ 目錄下的 JSON 資料檔案是否存在。</p>
            </div>`;
    }

    // ─── 首頁 ─────────────────────────────────────────────────

    async function loadHomePage() {
        try {
            const [meta, tournaments, playersManifest] = await Promise.all([
                fetchJSON('meta.json'),
                loadUnifiedTournaments(),
                fetchJSON('ranking.json'),
            ]);
            const availableLevels = getAvailablePlayerLevels(playersManifest);
            const playerResults = await Promise.all(
                availableLevels.map(level => loadPlayersFromManifest(playersManifest, level))
            );
            const playersByLevel = new Map(
                playerResults.map(result => [String(result.level || '').toLowerCase(), result])
            );

            const homeLevel = availableLevels.includes('master') ? 'master' : availableLevels[0];
            const homePlayersResult = homeLevel
                ? (playersByLevel.get(homeLevel) || { players: [] })
                : { players: [] };
            const players = homePlayersResult.players || [];
            const trackedPlayersTotal = playerResults.reduce(
                (sum, result) => sum + ((result.players && result.players.length) || 0),
                0
            );

            // 統計數字
            _setStatValue('stat-tournaments', tournaments.length);
            _setStatValue('stat-players',     trackedPlayersTotal);
            _setStatValue('stat-updated',     meta.last_updated ? _shortDate(meta.last_updated) : '--');
            _setText('footer-last-update', `最後更新：${meta.last_updated || '--'}`);

            // 最近賽事（取前 3 場）
            const recent = [...tournaments].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
            _renderRecentTournaments(recent);

            // 環境牌型（取 top 8）
            const topDecks = (meta.meta_decks || []).slice(0, 8);
            _renderMetaSnapshot(topDecks);

            // 玩家排行（取 top 10）
            const topPlayers = [...players].slice(0, 10);
            _renderTopPlayersTable(topPlayers, 'top-players-body');

        } catch (err) {
            console.error('[PTCG] 首頁資料載入失敗:', err);
            showError('recent-tournaments-container', '賽事資料載入失敗，' + err.message);
            showError('meta-decks-container', '環境資料載入失敗，' + err.message);
        }
    }

    function _shortDate(dateStr) {
        const d = new Date(dateStr);
        return `${d.getMonth()+1}/${d.getDate()}`;
    }

    function _setStatValue(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    function _setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    function _renderRecentTournaments(list) {
        const container = document.getElementById('recent-tournaments-container');
        if (!container) return;

        if (!list.length) {
            container.innerHTML = '<div class="col-12"><div class="empty-state"><div class="empty-state-icon"><i class="bi bi-calendar-x"></i></div><p>尚無賽事資料</p></div></div>';
            return;
        }

        container.innerHTML = list.map(t => {
            const typeInfo = TOURNAMENT_TYPE_MAP[t.type] || { cls: 'badge-spr', label: t.type };
            const colorBar  = _buildColorBar(t.top8_archetypes || []);
            return `
            <div class="col-md-4">
                <div class="tournament-card-item h-100">
                    <span class="tournament-type-badge ${escapeHtml(typeInfo.cls)}">
                        <i class="bi bi-trophy-fill"></i> ${escapeHtml(typeInfo.label)}
                    </span>
                    <div class="tournament-name">${escapeHtml(t.name)}</div>
                    <div class="tournament-meta">
                        <span><i class="bi bi-calendar3 me-1"></i>${formatDate(t.date)}</span>
                        <span><i class="bi bi-geo-alt me-1"></i>${escapeHtml(t.location)}</span>
                        <span><i class="bi bi-people me-1"></i>${escapeHtml(_formatTournamentParticipants(t.participants))}</span>
                    </div>
                    <div class="deck-usage-bar mt-2">${colorBar}</div>
                </div>
            </div>`;
        }).join('');
    }

    function _buildColorBar(archetypes) {
        const colors = ['#1d4ed8','#dc2626','#16a34a','#7c3aed','#f59e0b','#0ea5e9','#ec4899','#94a3b8'];
        return archetypes.slice(0, 8).map((arch, i) => {
            const w = arch.pct || Math.max(5, Math.floor(100 / archetypes.length));
            return `<div class="deck-usage-segment" title="${escapeHtml(arch.name || arch)} ${w}%" style="width:${w}%; background:${colors[i % colors.length]}"></div>`;
        }).join('');
    }

    function _renderMetaSnapshot(decks) {
        const container = document.getElementById('meta-decks-container');
        if (!container) return;

        if (!decks.length) {
            container.innerHTML = '<div class="empty-state w-100"><div class="empty-state-icon"><i class="bi bi-stack"></i></div><p>尚無環境資料</p></div>';
            return;
        }

        container.innerHTML = decks.map((deck, i) => `
            <div class="meta-deck-card">
                <div class="meta-deck-rank">#${i + 1} 使用率</div>
                <div class="meta-deck-name">${escapeHtml(deck.name)}</div>
                <div class="meta-usage-bar">
                    <div class="meta-usage-fill" style="width: ${Math.min(deck.usage_pct || 0, 100)}%"></div>
                </div>
                <div class="meta-usage-label">${deck.usage_pct ?? 0}% · 勝率 ${deck.winrate ?? '--'}%</div>
            </div>
        `).join('');
    }

    function _renderTopPlayersTable(players, tbodyId) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;

        if (!players.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">尚無玩家資料</td></tr>';
            return;
        }

        tbody.innerHTML = players.map((p, i) => `
            <tr>
                <td>${getRankBadge(p.rank || i + 1)}</td>
                <td class="player-name-cell">
                    ${escapeHtml(p.name)}
                    <span>${escapeHtml(p.ptcg_id || '')}</span>
                </td>
                <td class="score-cell">${escapeHtml(String(p.score ?? '--'))}</td>
                <td class="d-none d-md-table-cell">${escapeHtml(String(p.tournaments ?? ''))}</td>
                <td class="d-none d-md-table-cell">${escapeHtml(p.divisionLabel || '--')}</td>
                <td class="d-none d-lg-table-cell">${escapeHtml(p.region || '--')}</td>
            </tr>
        `).join('');
    }

    // ─── 賽事頁 ───────────────────────────────────────────────

    let _allTournaments = [];
    let _tournamentPage = 1;
    const _PAGE_SIZE = 12;

    async function loadTournamentsPage() {
        try {
            _allTournaments = await loadUnifiedTournaments();

            const latestWithDate = _allTournaments.find(t => toDateValue(t.date) > -Infinity);

            // 更新時間
            _setText('tournament-update-time', latestWithDate?.date
                ? `資料截至 ${formatDate(latestWithDate.date)}`
                : '資料已載入');

            _bindTournamentFilters();
            _renderTournamentsList();

        } catch (err) {
            showError('tournaments-container', '賽事資料載入失敗：' + err.message);
        }
    }

    function _bindTournamentFilters() {
        document.getElementById('type-filter')?.addEventListener('change', () => { _tournamentPage = 1; _renderTournamentsList(); });
        document.getElementById('season-select')?.addEventListener('change', () => { _tournamentPage = 1; _renderTournamentsList(); });
        document.getElementById('tournament-search')?.addEventListener('input', _debounce(() => { _tournamentPage = 1; _renderTournamentsList(); }, 250));
        document.getElementById('tournaments-container')?.addEventListener('click', async (event) => {
            const btn = event.target.closest('.btn-view-tournament-detail');
            if (btn && !btn.disabled) {
                const tid = btn.dataset.tid;
                const tournament = _allTournaments.find(t => String(t.id) === String(tid));
                if (tournament) await _openTournamentDetailModal(tournament);
                return;
            }

            const btn128 = event.target.closest('.btn-view-top128');
            if (btn128 && !btn128.disabled) {
                const tid = btn128.dataset.tid;
                const tournament = _allTournaments.find(t => String(t.id) === String(tid));
                if (tournament) await _openTop128Modal(tournament);
            }
        });
    }

    function _getFilteredTournaments() {
        const typeEl   = document.querySelector('input[name="type"]:checked');
        const type     = typeEl?.value || 'UBL';
        const season   = document.getElementById('season-select')?.value || '';
        const search   = (document.getElementById('tournament-search')?.value || '').trim().toLowerCase();

        return _allTournaments.filter(t => {
            if (t.type !== type) return false;
            if (season && t.season !== season)      return false;
            if (search && !t.name.toLowerCase().includes(search) && !(t.location || '').toLowerCase().includes(search)) return false;
            return true;
        });
    }

    function _renderTournamentsList() {
        const list = _getFilteredTournaments();
        const container = document.getElementById('tournaments-container');
        if (!container) return;

        if (!list.length) {
            container.innerHTML = `<div class="empty-state col-12"><div class="empty-state-icon"><i class="bi bi-trophy"></i></div><p>無符合條件的賽事</p></div>`;
            document.getElementById('tournament-pagination').style.display = 'none';
            return;
        }

        const total  = list.length;
        const pages  = Math.ceil(total / _PAGE_SIZE);
        const sliced = list.slice((_tournamentPage - 1) * _PAGE_SIZE, _tournamentPage * _PAGE_SIZE);

        container.innerHTML = `<div class="row g-3">${sliced.map(t => _buildTournamentCard(t)).join('')}</div>`;
        _renderPagination(pages, 'tournament-pagination');
    }

    function _buildTournamentCard(t) {
        const typeInfo  = TOURNAMENT_TYPE_MAP[t.type] || { cls: 'badge-spr', label: t.type };
        const levelLabel = PLAYER_LEVEL_LABELS[t.level] || null;
        const topCount = Number.isFinite(t.top128Count) ? t.top128Count : null;
        const topCountLabel = topCount ? `${topCount}` : '--';
        const participantsText = _formatTournamentParticipants(t.participants);
        const metaParts = [];
        if (t.date) {
            metaParts.push(`<span><i class="bi bi-calendar3 me-1"></i>${formatDate(t.date)}</span>`);
        }
        if (t.location && t.location !== '--') {
            metaParts.push(`<span><i class="bi bi-geo-alt me-1"></i>${escapeHtml(t.location)}</span>`);
        }
        if (participantsText !== '--') {
            metaParts.push(`<span><i class="bi bi-people me-1"></i>${escapeHtml(participantsText)}</span>`);
        }
        const top8Html  = (t.top8 || []).map((p, i) => `
            <div class="deck-card-entry">
                <span>${getRankBadge(i+1)} <span class="ms-2">${escapeHtml(p.player)}</span></span>
                <span class="deck-tag">${escapeHtml(p.deck)}</span>
            </div>`).join('');

        return `
        <div class="col-md-6 col-xl-4">
            <div class="tournament-card-item h-100 d-flex flex-column">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div class="d-flex gap-1 flex-wrap">
                        <span class="tournament-type-badge ${escapeHtml(typeInfo.cls)}">
                            <i class="bi bi-trophy-fill"></i> ${escapeHtml(typeInfo.label)}
                        </span>
                        ${levelLabel ? `<span class="tournament-type-badge badge-level-${escapeHtml(t.level)}">${escapeHtml(levelLabel)}</span>` : ''}
                    </div>
                    ${t.season ? `<span class="tournament-meta">${escapeHtml(t.season)}</span>` : ''}
                </div>
                <div class="tournament-name">${escapeHtml(t.name)}</div>
                ${metaParts.length ? `<div class="tournament-meta mb-3">${metaParts.join('')}</div>` : ''}
                ${top8Html
                    ? `<div class="mt-auto">
                        <div style="font-size:0.78rem;color:var(--ptcg-text-muted);margin-bottom:0.4rem;">前八強</div>
                        ${top8Html}
                       </div>`
                    : t.status === 'failed'
                        ? `<div class="text-muted small mt-auto">目前無法擷取：${escapeHtml(t.error || '資料來源限制')}</div>`
                        : (!t.csvFile && !t.top128File)
                            ? `<div class="text-muted small mt-auto">待更新入賞資料</div>`
                            : ''}
                <div class="mt-3 d-flex gap-2 flex-wrap">
                    ${t.csvFile ? `<button class="btn btn-outline-ptcg btn-sm btn-tournament-action btn-view-tournament-detail" data-tid="${escapeHtml(String(t.id))}">
                        <i class="bi bi-diagram-3-fill me-1"></i>Pairing詳情
                    </button>` : ''}
                    ${t.top128File ? `<button class="btn btn-outline-ptcg btn-sm btn-tournament-action btn-view-top128" data-tid="${escapeHtml(String(t.id))}">
                        <i class="bi bi-trophy-fill me-1"></i>官方Top表 <span class="top-count-pill">${escapeHtml(topCountLabel)}</span>
                    </button>` : ''}
                </div>
            </div>
        </div>`;
    }

    function _formatTournamentParticipants(value) {
        if (value == null || value === '') return '--';
        const text = String(value).trim();
        const estimated = text.includes('(估)') || text.includes('(估計)');
        const base = text.replace(/\(估\)|\(估計\)|人/g, '').trim();
        if (!base || base === '--') return '--';
        return estimated ? `${base}人(估計)` : `${base}人`;
    }

    function _parseUnifiedTournamentCsv(rows) {
        if (rows.length <= 1) return [];

        const header = rows[0].map(value => String(value || '').trim().toLowerCase());
        if (!header.includes('record_type') || !header.includes('round')) {
            return [];
        }

        return rows.slice(1)
            .filter(cols => cols.some(value => String(value || '').trim().length > 0))
            .map(cols => {
                const record = {};
                header.forEach((name, index) => {
                    record[name] = String(cols[index] || '').trim();
                });
                return record;
            });
    }

    function _sortRoundLabel(a, b) {
        const aMatch = String(a || '').match(/round\s*(\d+)/i);
        const bMatch = String(b || '').match(/round\s*(\d+)/i);
        const aNum = aMatch ? parseInt(aMatch[1], 10) : Number.POSITIVE_INFINITY;
        const bNum = bMatch ? parseInt(bMatch[1], 10) : Number.POSITIVE_INFINITY;
        return aNum - bNum;
    }

    function _buildTournamentPlayerCell(playerId, lookup) {
        const normalizedId = String(playerId || '').trim().toLowerCase();
        const matched = normalizedId ? lookup.get(normalizedId) : null;
        const name = matched?.name || playerId || '--';
        const meta = [playerId || '--'];
        if (matched?.divisionLabel) meta.push(matched.divisionLabel);

        return `
            <div class="round-player-card">
                <div class="round-player-name">${escapeHtml(String(name))}</div>
                <div class="round-player-meta">${escapeHtml(meta.join(' · '))}</div>
            </div>`;
    }

    function _buildRoundMatchups(records) {
        const groups = new Map();

        records.forEach((record, index) => {
            const tableNo = String(record.table_no || '').trim() || `P${record.page_index || '1'}-${index + 1}`;
            const playerId = String(record.player_id || '').trim();
            const opponentId = String(record.opponent_id || '').trim();
            const idKey = [playerId, opponentId].filter(Boolean).sort().join('|') || `row-${index}`;
            const key = `${tableNo}|${idKey}`;

            if (!groups.has(key)) {
                groups.set(key, {
                    tableNo,
                    pageIndex: String(record.page_index || '').trim(),
                    rows: [],
                });
            }

            const group = groups.get(key);
            const exists = group.rows.some(row => String(row.player_id || '').trim() === playerId && String(row.opponent_id || '').trim() === opponentId);
            if (!exists) {
                group.rows.push(record);
            }
        });

        return Array.from(groups.values())
            .map(group => {
                const orderedRows = [...group.rows].sort((left, right) => {
                    const leftNo = parseInt(String(left.player_no || ''), 10);
                    const rightNo = parseInt(String(right.player_no || ''), 10);
                    if (Number.isFinite(leftNo) && Number.isFinite(rightNo)) {
                        return leftNo - rightNo;
                    }
                    return String(left.player_id || '').localeCompare(String(right.player_id || ''), 'en');
                });
                const ids = Array.from(new Set(orderedRows.flatMap(row => [String(row.player_id || '').trim(), String(row.opponent_id || '').trim()]).filter(Boolean))).slice(0, 2);
                return {
                    tableNo: group.tableNo,
                    pageIndex: group.pageIndex,
                    playerA: ids[0] || '',
                    playerB: ids[1] || '',
                };
            })
            .sort((left, right) => {
                const leftNo = parseInt(String(left.tableNo || ''), 10);
                const rightNo = parseInt(String(right.tableNo || ''), 10);
                if (Number.isFinite(leftNo) && Number.isFinite(rightNo)) {
                    return leftNo - rightNo;
                }
                return String(left.tableNo || '').localeCompare(String(right.tableNo || ''), 'en');
            });
    }

    function _buildTournamentDetailTabs(labels) {
        if (!labels.length) return '';

        return `
            <div class="tournament-detail-tabs" role="tablist" aria-label="賽事詳情切換">
                ${labels.map((label, index) => `
                    <button
                        type="button"
                        class="tournament-detail-tab ${index === 0 ? 'is-active' : ''}"
                        data-detail-tab="${escapeHtml(String(label))}"
                        aria-pressed="${index === 0 ? 'true' : 'false'}">
                        ${escapeHtml(String(label))}
                    </button>
                `).join('')}
            </div>`;
    }

    function _renderUnifiedTournamentFinalRankBody(records, lookup) {
        const finalRankRows = records
            .filter(record => String(record.record_type || '').trim().toLowerCase() === 'final_rank')
            .sort((left, right) => {
                const leftRank = parseInt(String(left.rank || ''), 10);
                const rightRank = parseInt(String(right.rank || ''), 10);
                if (Number.isFinite(leftRank) && Number.isFinite(rightRank)) {
                    return leftRank - rightRank;
                }
                return String(left.rank || '').localeCompare(String(right.rank || ''), 'en');
            });

        if (!finalRankRows.length) {
            return '<p class="text-muted mb-0">此賽事沒有 Final rank 資料。</p>';
        }

        return `
            <div class="table-responsive">
                <table class="ptcg-table mb-0">
                    <thead>
                        <tr>
                            <th width="100">賽事名次</th>
                            <th>玩家</th>
                            <th width="120">目前排名</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${finalRankRows.map(row => {
                            const tournamentRank = parseInt(String(row.rank || ''), 10);
                            const ptcgId = String(row.player_id || '').trim();
                            const matched = lookup.get(ptcgId.toLowerCase()) || null;
                            return `
                                <tr class="${Number.isFinite(tournamentRank) && tournamentRank <= 16 ? 'tournament-final-top16-row' : ''}">
                                    <td>${escapeHtml(String(row.rank || '--'))}</td>
                                    <td class="player-name-cell">
                                        ${escapeHtml(String(matched?.name || ptcgId || '--'))}
                                        <span>${escapeHtml(String(ptcgId || '--'))} · ${escapeHtml(String(matched?.divisionLabel || '--'))}</span>
                                    </td>
                                    <td>${matched?.rank ? getRankBadge(Number(matched.rank)) : '--'}</td>
                                </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    function _renderUnifiedTournamentDetailBody(tournament, records, lookup) {
        const roundRecords = records.filter(record => String(record.record_type || '').trim().toLowerCase() === 'round_pairing');
        if (!roundRecords.length) {
            return '<p class="text-muted mb-0">這份 CSV 尚未包含 round 對局資料。</p>';
        }

        const roundLabels = Array.from(new Set(roundRecords.map(record => String(record.round || '').trim()).filter(Boolean))).sort(_sortRoundLabel);
        const tabLabels = [...roundLabels, 'Final rank'];
        const sections = roundLabels.map((roundLabel, index) => {
            const matchups = _buildRoundMatchups(roundRecords.filter(record => String(record.round || '').trim() === roundLabel));
            return `
                <section class="round-detail-section tournament-detail-panel ${index === 0 ? 'is-active' : ''}" data-detail-panel="${escapeHtml(roundLabel)}">
                    <div class="round-section-heading">
                        <h6 class="mb-0">${escapeHtml(roundLabel)}</h6>
                        <span class="round-section-meta">${escapeHtml(String(matchups.length))} 桌</span>
                    </div>
                    <div class="table-responsive">
                        <table class="ptcg-table mb-0">
                            <thead>
                                <tr>
                                    <th width="100">桌次</th>
                                    <th>玩家 A</th>
                                    <th>玩家 B</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${matchups.map(matchup => `
                                    <tr>
                                        <td>
                                            ${escapeHtml(String(matchup.tableNo || '--'))}
                                            ${matchup.pageIndex ? `<div class="round-table-meta">Page ${escapeHtml(String(matchup.pageIndex))}</div>` : ''}
                                        </td>
                                        <td>${_buildTournamentPlayerCell(matchup.playerA, lookup)}</td>
                                        <td>${_buildTournamentPlayerCell(matchup.playerB, lookup)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>`;
        }).join('');

        const finalRankSection = `
            <section class="round-detail-section tournament-detail-panel" data-detail-panel="Final rank">
                <div class="round-section-heading">
                    <h6 class="mb-0">Final rank</h6>
                    <span class="round-section-meta">${escapeHtml(String(tournament.finalRankCount ?? '--'))} 人</span>
                </div>
                ${_renderUnifiedTournamentFinalRankBody(records, lookup)}
            </section>`;

        return `
            <div class="tournament-detail-summary">
                <div class="tournament-detail-chip"><span>Round 數</span><strong>${escapeHtml(String(roundLabels.length))}</strong></div>
                <div class="tournament-detail-chip"><span>Round 1 總桌次</span><strong>${escapeHtml(String(tournament.round1Max ?? '--'))}</strong></div>
                <div class="tournament-detail-chip"><span>Final Rank</span><strong>${escapeHtml(String(tournament.finalRankCount ?? '--'))}</strong></div>
            </div>
            ${_buildTournamentDetailTabs(tabLabels)}
            <div class="tournament-detail-panels">
                ${sections}
                ${finalRankSection}
            </div>`;
    }

    async function _renderLegacyTournamentDetailBody(rows, tournament) {
        if (rows.length <= 1) {
            return '<p class="text-muted mb-0">CSV 無可顯示資料。</p>';
        }

        const header = rows[0];
        const rankIndex = header.findIndex(h => String(h).trim().toLowerCase() === 'rank');
        const playerIndex = header.findIndex(h => String(h).trim().toLowerCase() === 'your name');
        const lookupLevel = tournament.level || parseLevelFromTournamentTitle(tournament.name);
        const lookup = await loadRankingLookupByPtcgId(lookupLevel);

        const allRows = rows.slice(1).map(cols => {
            const tournamentRank = cols[rankIndex] || '--';
            const tournamentId = String(cols[playerIndex] || '').trim();
            const matched = lookup.get(tournamentId.toLowerCase()) || null;

            return {
                tournamentRank,
                ptcgId: tournamentId || '--',
                matchedName: matched?.name || '--',
                matchedRank: matched?.rank ?? '--',
                divisionLabel: matched?.divisionLabel || '--',
            };
        });

        return `
            <p class="text-muted small mb-3">此賽事尚未轉換為 round 詳情格式，先顯示 Final rank 全榜。</p>
            <div class="table-responsive">
                <table class="ptcg-table mb-0">
                    <thead>
                        <tr>
                            <th width="100">賽事名次</th>
                            <th>玩家</th>
                            <th width="120">目前排名</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allRows.map(row => `
                            <tr class="${(parseInt(String(row.tournamentRank), 10) || Number.POSITIVE_INFINITY) <= 16 ? 'tournament-final-top16-row' : ''}">
                                <td>${escapeHtml(String(row.tournamentRank))}</td>
                                <td class="player-name-cell">
                                    ${escapeHtml(String(row.matchedName))}
                                    <span>${escapeHtml(String(row.ptcgId))} · ${escapeHtml(String(row.divisionLabel))}</span>
                                </td>
                                <td>${row.matchedRank === '--' ? '--' : getRankBadge(Number(row.matchedRank))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    function _bindTournamentDetailTabs(bodyEl) {
        const tabButtons = Array.from(bodyEl.querySelectorAll('[data-detail-tab]'));
        const panels = Array.from(bodyEl.querySelectorAll('[data-detail-panel]'));
        if (!tabButtons.length || !panels.length) return;

        const activate = (label) => {
            tabButtons.forEach((button) => {
                const isActive = button.dataset.detailTab === label;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
            panels.forEach((panel) => {
                panel.classList.toggle('is-active', panel.dataset.detailPanel === label);
            });
        };

        tabButtons.forEach((button) => {
            button.addEventListener('click', () => activate(button.dataset.detailTab || ''));
        });
    }

    async function _openTournamentDetailModal(tournament) {
        const modalEl = document.getElementById('tournamentDetailModal');
        const bodyEl = document.getElementById('tournamentDetailBody');
        const titleEl = document.getElementById('tournamentDetailTitle');
        if (!modalEl || !bodyEl || !titleEl) return;

        titleEl.textContent = `${tournament.name} · 詳情`;

        if (!tournament.csvFile) {
            bodyEl.innerHTML = '<p class="text-muted mb-0">此賽事尚未建立對應 CSV 檔案。</p>';
            new bootstrap.Modal(modalEl).show();
            return;
        }

        bodyEl.innerHTML = '<div class="text-center py-4"><div class="ptcg-spinner mx-auto"></div><p class="mt-3 text-muted mb-0">載入賽事詳情中...</p></div>';
        new bootstrap.Modal(modalEl).show();

        try {
            const csvText = await fetchText(`tournaments/${tournament.csvFile}`);
            const rows = parseCsvText(csvText);
            const lookupLevel = tournament.level || parseLevelFromTournamentTitle(tournament.name);
            const lookup = await loadRankingLookupByPtcgId(lookupLevel);

            const unifiedRecords = _parseUnifiedTournamentCsv(rows);
            bodyEl.innerHTML = unifiedRecords.length
                ? _renderUnifiedTournamentDetailBody(tournament, unifiedRecords, lookup)
                : await _renderLegacyTournamentDetailBody(rows, tournament);
            _bindTournamentDetailTabs(bodyEl);
        } catch (err) {
            bodyEl.innerHTML = `<p class="text-muted mb-0">載入賽事詳情失敗：${escapeHtml(err.message || '未知錯誤')}</p>`;
        }
    }

    // ─── 官方 Top 128 Modal ───────────────────────────────────

    function _parseTop128Csv(csvText) {
        const rows = parseCsvText(csvText);
        if (rows.length <= 1) return [];
        const header = rows[0].map(v => String(v || '').trim().toLowerCase());
        const idx = k => header.indexOf(k);
        const rankI = idx('rank'), pointsI = idx('points'), userI = idx('username');
        const idI = idx('player_id'), regionI = idx('region'), deckI = idx('deck_url');
        return rows.slice(1).map(cols => ({
            rank: cols[rankI] || '',
            points: cols[pointsI] || '',
            username: cols[userI] || '',
            player_id: cols[idI] || '',
            region: cols[regionI] || '',
            deck_url: cols[deckI] || '',
        })).filter(r => r.rank);
    }

    function _renderTop128Body(players) {
        if (!players.length) return '<p class="text-muted mb-0">尚無排名資料。</p>';
        return `
            <div class="table-responsive">
                <table class="ptcg-table mb-0">
                    <thead>
                        <tr>
                            <th width="70">#</th>
                            <th width="90">點數</th>
                            <th>玩家</th>
                            <th class="d-none d-sm-table-cell">區域</th>
                            <th width="70" class="d-none d-md-table-cell">牌組</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map(p => {
                            const rankNum = parseInt(p.rank, 10) || 0;
                            const rowCls = rankNum <= 8 ? 'tournament-final-top16-row' : '';
                            const deckCodeMatch = String(p.deck_url || '').match(/\/deck-build\/recipe\/([^/]+)\/?/);
                            const deckCode = deckCodeMatch ? deckCodeMatch[1] : '';
                            const deckImage = deckCode ? `https://asia.pokemon-card.com/tw/deck-img/${deckCode}.png` : '';
                            const deckLink = p.deck_url
                                ? `<a href="https://asia.pokemon-card.com${escapeHtml(p.deck_url)}" target="_blank" rel="noopener" class="deck-preview-link" aria-label="查看牌組">
                                        <span class="deck-preview-trigger"><i class="bi bi-suit-spade-fill"></i></span>
                                        ${deckImage ? `<span class="deck-preview-tooltip"><img src="${escapeHtml(deckImage)}" alt="牌組圖片"></span>` : ''}
                                   </a>`
                                : '--';
                            return `<tr class="${rowCls}">
                                <td>${rankNum <= 3 ? getRankBadge(rankNum) : escapeHtml(p.rank)}</td>
                                <td class="score-cell">${escapeHtml(p.points)} pt</td>
                                <td class="player-name-cell">
                                    ${escapeHtml(p.username)}
                                    <span>${escapeHtml(p.player_id)}</span>
                                </td>
                                <td class="d-none d-sm-table-cell">${escapeHtml(p.region)}</td>
                                <td class="d-none d-md-table-cell">${deckLink}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    async function _openTop128Modal(tournament) {
        const modalEl = document.getElementById('tournamentDetailModal');
        const bodyEl  = document.getElementById('tournamentDetailBody');
        const titleEl = document.getElementById('tournamentDetailTitle');
        if (!modalEl || !bodyEl || !titleEl) return;

        titleEl.textContent = `${tournament.name} · 官方Top表`;
        bodyEl.innerHTML = '<div class="text-center py-4"><div class="ptcg-spinner mx-auto"></div><p class="mt-3 text-muted mb-0">載入官方排名中...</p></div>';
        new bootstrap.Modal(modalEl).show();

        try {
            const csvText = await fetchText(`tournaments/${tournament.top128File}`);
            const players = _parseTop128Csv(csvText);
            bodyEl.innerHTML = `
                <div class="tournament-detail-summary mb-3">
                    <div class="tournament-detail-chip"><span>來源</span><strong>官方頁面</strong></div>
                    <div class="tournament-detail-chip"><span>筆數</span><strong>${players.length} 人</strong></div>
                    ${tournament.officialUrl ? `<div class="tournament-detail-chip"><a href="${escapeHtml(tournament.officialUrl)}" target="_blank" rel="noopener" class="text-decoration-none"><i class="bi bi-box-arrow-up-right me-1"></i>官方頁面</a></div>` : ''}
                </div>
                ${_renderTop128Body(players)}`;
        } catch (err) {
            bodyEl.innerHTML = `<p class="text-muted mb-0">載入官方 Top 128 失敗：${escapeHtml(err.message || '未知錯誤')}</p>`;
        }
    }

    // ─── 分頁 ─────────────────────────────────────────────────

    function _renderPagination(pages, containerId) {
        const nav = document.getElementById(containerId);
        if (!nav) return;

        if (pages <= 1) {
            nav.style.display = 'none';
            return;
        }

        nav.style.display = '';
        const ul = nav.querySelector('ul.ptcg-pagination');
        if (!ul) return;

        let html = '';
        for (let i = 1; i <= pages; i++) {
            html += `<li class="page-item ${i === _tournamentPage ? 'active' : ''}">
                <button class="page-link" data-page="${i}">${i}</button>
            </li>`;
        }
        ul.innerHTML = html;
        ul.querySelectorAll('[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                _tournamentPage = parseInt(btn.dataset.page, 10);
                _renderTournamentsList();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    // ─── 牌組頁 ───────────────────────────────────────────────

    let _allDecks = [];

    async function loadDecksPage() {
        try {
            _allDecks = await fetchJSON('decks.json');
            _bindDeckFilters();
            _renderDecksGrid();
        } catch (err) {
            showError('decks-container', '牌組資料載入失敗：' + err.message);
        }
    }

    function _bindDeckFilters() {
        document.getElementById('archetype-filter')?.addEventListener('change', _renderDecksGrid);
        document.getElementById('sort-select')?.addEventListener('change', _renderDecksGrid);
        document.getElementById('deck-search')?.addEventListener('input', _debounce(_renderDecksGrid, 250));
    }

    function _renderDecksGrid() {
        const archEl  = document.querySelector('input[name="arch"]:checked');
        const arch    = archEl?.value || 'all';
        const sort    = document.getElementById('sort-select')?.value || 'winrate';
        const search  = (document.getElementById('deck-search')?.value || '').trim().toLowerCase();

        let list = _allDecks.filter(d => {
            if (arch !== 'all' && d.archetype !== arch) return false;
            if (search && !d.name.toLowerCase().includes(search)) return false;
            return true;
        });

        if (sort === 'winrate')  list.sort((a, b) => (b.winrate || 0) - (a.winrate || 0));
        if (sort === 'usage')    list.sort((a, b) => (b.usage_pct || 0) - (a.usage_pct || 0));
        if (sort === 'recent')   list.sort((a, b) => new Date(b.last_seen || 0) - new Date(a.last_seen || 0));

        const container = document.getElementById('decks-container');
        if (!container) return;

        if (!list.length) {
            container.innerHTML = `<div class="empty-state w-100"><div class="empty-state-icon"><i class="bi bi-layers"></i></div><p>無符合條件的牌組</p></div>`;
            return;
        }

        container.innerHTML = list.map(d => _buildDeckCard(d)).join('');

        // 綁定點擊 → 開 Modal
        container.querySelectorAll('.deck-card-item').forEach(el => {
            el.addEventListener('click', () => {
                const deckName = el.dataset.deckName;
                const deck = _allDecks.find(d => d.name === deckName);
                if (deck) _openDeckModal(deck);
            });
        });
    }

    function _buildDeckCard(d) {
        const [c1, c2] = DECK_COLORS[d.archetype] || ['#64748b', '#94a3b8'];
        const wrCls    = getWinrateClass(d.winrate || 0);

        return `
        <div class="deck-card-item" data-deck-name="${escapeHtml(d.name)}">
            <div class="deck-card-header">
                <div class="deck-card-color-bar" style="background: linear-gradient(90deg, ${c1}, ${c2})"></div>
                <span class="deck-archetype-badge arch-${escapeHtml(d.archetype)}">${escapeHtml(d.archetype)}</span>
                <div class="deck-card-name">${escapeHtml(d.name)}</div>
                <div class="deck-card-meta">來源：${escapeHtml(d.source || '--')} · ${formatDate(d.last_seen)}</div>
            </div>
            <div class="deck-card-body">
                <div class="deck-stat-row">
                    <span class="deck-stat-label">根據賽事勝率</span>
                    <span class="deck-stat-value ${wrCls}">${d.winrate ?? '--'}%</span>
                </div>
                <div class="deck-stat-row">
                    <span class="deck-stat-label">環境使用率</span>
                    <span class="deck-stat-value">${d.usage_pct ?? '--'}%</span>
                </div>
                <div class="deck-stat-row">
                    <span class="deck-stat-label">入賞次數</span>
                    <span class="deck-stat-value">${d.top_finishes ?? '--'} 次</span>
                </div>
            </div>
        </div>`;
    }

    function _openDeckModal(deck) {
        document.getElementById('deckModalTitle').textContent = deck.name;

        const sections = { pokemon: '寶可夢 (Pokémon)', trainer: '訓練家 (Trainer)', energy: '能量 (Energy)' };
        const cardList = deck.card_list || {};

        const bodyHtml = Object.entries(sections).map(([key, label]) => {
            const entries = cardList[key] || [];
            if (!entries.length) return '';
            return `
                <div class="deck-list-section">
                    <h6>${label} (${entries.reduce((s, c) => s + (c.qty || 1), 0)})</h6>
                    ${entries.map(c => `
                        <div class="deck-card-entry">
                            <span>${escapeHtml(c.name)}</span>
                            <span class="deck-card-qty">${c.qty || 1}</span>
                        </div>`).join('')}
                </div>`;
        }).join('');

        const infoHtml = `
            <div class="row g-3 mb-4">
                <div class="col-6 col-md-3">
                    <div class="player-stat-card">
                        <div class="player-stat-value">${deck.winrate ?? '--'}%</div>
                        <div class="player-stat-label">勝率</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="player-stat-card">
                        <div class="player-stat-value">${deck.usage_pct ?? '--'}%</div>
                        <div class="player-stat-label">使用率</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="player-stat-card">
                        <div class="player-stat-value">${deck.top_finishes ?? '--'}</div>
                        <div class="player-stat-label">入賞次數</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="player-stat-card">
                        <div class="player-stat-value">${escapeHtml(deck.archetype ?? '--')}</div>
                        <div class="player-stat-label">牌型分類</div>
                    </div>
                </div>
            </div>
            ${deck.description ? `<p class="text-muted mb-4" style="font-size:0.9rem">${escapeHtml(deck.description)}</p>` : ''}`;

        document.getElementById('deckModalBody').innerHTML = infoHtml + (bodyHtml || '<p class="text-muted">此牌組尚無詳細牌表資料。</p>');
        new bootstrap.Modal(document.getElementById('deckModal')).show();
    }

    // ─── 玩家頁 ───────────────────────────────────────────────

    let _allPlayers = [];
    let _playersManifest = null;
    let _currentPlayerLevel = 'master';
    let _currentWorldPlayers = 0;
    let _playerPageSize = 200;
    let _currentPlayerPage = 1;
    const _playerHistoryAvailability = new Map();
    const _playerHistoryPromiseById = new Map();
    const _playerHistoryIndexById = new Map();

    function _setPlayerHistoryIndex(index) {
        _playerHistoryIndexById.clear();
        const players = Array.isArray(index?.players) ? index.players : [];
        for (const item of players) {
            const id = String(item?.ptcg_id || '').trim().toLowerCase();
            if (!id) continue;

            // Backward compatible: accept legacy levels[] and new level string.
            const level = String(
                item?.level
                || (Array.isArray(item?.levels) ? item.levels[0] : '')
                || ''
            ).trim().toLowerCase();
            _playerHistoryIndexById.set(id, {
                status: String(item?.status || '').trim().toLowerCase(),
                hasHistory: item?.has_history === true,
                level,
            });
        }
    }

    function _canOpenPlayerDetail(playerId) {
        const id = String(playerId || '').trim().toLowerCase();
        if (!id) return false;

        if (_playerHistoryIndexById.has(id)) {
            const item = _playerHistoryIndexById.get(id);
            if (item.hasHistory === true) return true;
            return item.status === 'ok';
        }

        return _playerHistoryAvailability.get(id) === true;
    }

    async function _loadPlayerHistory(playerId) {
        const id = String(playerId || '').trim();
        if (!id) return null;
        if (_playerHistoryPromiseById.has(id)) {
            return _playerHistoryPromiseById.get(id);
        }

        const promise = fetch(`./data/players/${id}.json`)
            .then(response => {
                if (!response.ok) {
                    _playerHistoryAvailability.set(id, false);
                    return null;
                }
                _playerHistoryAvailability.set(id, true);
                return response.json();
            })
            .catch(() => {
                _playerHistoryAvailability.set(id, false);
                return null;
            });

        _playerHistoryPromiseById.set(id, promise);
        return promise;
    }

    async function loadPlayersPage() {
        try {
            _playersManifest = await loadPlayersManifest();
            const historyIndex = await loadPlayerHistoryIndex();
            _setPlayerHistoryIndex(historyIndex);
            _initDivisionSwitch(_playersManifest);
            await _loadPlayersForLevel(_currentPlayerLevel);

            _bindPlayerFilters();
            _renderPlayersTable();

        } catch (err) {
            showError('players-full-body', '玩家資料載入失敗：' + err.message);
        }
    }

    function _bindPlayerFilters() {
        document.querySelectorAll('input[name="player-level"][data-player-level]').forEach(input => {
            input.addEventListener('change', async () => {
                if (input.disabled || !input.checked) return;
                const level = input.dataset.playerLevel;
                if (!level || level === _currentPlayerLevel) return;
                _currentPlayerLevel = level;
                _currentPlayerPage = 1;
                _setActiveDivisionButton(_currentPlayerLevel);
                await _loadPlayersForLevel(_currentPlayerLevel);
                _renderPlayersTable();
            });
        });
        document.getElementById('player-search')?.addEventListener('input', _debounce(() => {
            _currentPlayerPage = 1;
            _renderPlayersTable();
        }, 250));
        document.getElementById('player-only-detail')?.addEventListener('change', () => {
            _currentPlayerPage = 1;
            _renderPlayersTable();
        });

        document.getElementById('players-page-size')?.addEventListener('change', e => {
            const nextSize = parseInt(e.target.value, 10);
            if (!Number.isFinite(nextSize) || nextSize <= 0) return;
            _playerPageSize = nextSize;
            _currentPlayerPage = 1;
            _renderPlayersTable();
        });

        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const sort = th.dataset.sort;
                _allPlayers.sort((a, b) => {
                    if (sort === 'score') {
                        if (b.scoreValue !== a.scoreValue) return b.scoreValue - a.scoreValue;
                        return a.rank - b.rank;
                    }
                    if (sort === 'tournaments') return 0;
                    return 0;
                });
                _renderPlayersTable();
            });
        });

        document.getElementById('players-full-table')?.addEventListener('click', e => {
            const btn = e.target.closest('.btn-view-detail');
            if (!btn) return;
            const idx = parseInt(btn.dataset.idx, 10);
            const player = _getFilteredPlayers()[idx];
            if (player) _openPlayerModal(player);
        });

        document.getElementById('players-pagination')?.addEventListener('click', e => {
            const btn = e.target.closest('button[data-page]');
            if (!btn) return;
            const nextPage = parseInt(btn.dataset.page, 10);
            if (!Number.isFinite(nextPage) || nextPage < 1) return;
            _currentPlayerPage = nextPage;
            _renderPlayersTable();
        });
    }

    function _getFilteredPlayers() {
        const search   = (document.getElementById('player-search')?.value || '').trim().toLowerCase();
        const onlyDetail = document.getElementById('player-only-detail')?.checked === true;

        return _allPlayers.filter(p => {
            if (search && !p.name.toLowerCase().includes(search) && !String(p.ptcg_id || '').toLowerCase().includes(search)) return false;
            if (onlyDetail && !_canOpenPlayerDetail(p.ptcg_id)) return false;
            return true;
        });
    }
    function _initDivisionSwitch(manifest) {
        const availableLevels = getAvailablePlayerLevels(manifest);
        const defaultLevel = availableLevels.includes('master') ? 'master' : (availableLevels[0] || 'master');
        _currentPlayerLevel = defaultLevel;

        document.querySelectorAll('input[name="player-level"][data-player-level]').forEach(input => {
            const level = input.dataset.playerLevel;
            const isAvailable = availableLevels.includes(level);
            input.disabled = !isAvailable;

            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) {
                label.textContent = isAvailable
                    ? PLAYER_LEVEL_LABELS[level]
                    : `${PLAYER_LEVEL_LABELS[level]}（無資料）`;
            }
        });

        _setActiveDivisionButton(_currentPlayerLevel);
    }

    function _setActiveDivisionButton(level) {
        document.querySelectorAll('input[name="player-level"][data-player-level]').forEach(input => {
            input.checked = input.dataset.playerLevel === level;
        });
    }

    async function _loadPlayersForLevel(level) {
        const result = await loadPlayersFromManifest(_playersManifest, level);
        _allPlayers = result.players;
        _currentWorldPlayers = parseInt(_playersManifest?.latest?.[level]?.world_players, 10) || 0;

        _setText('pstat-tracked', _allPlayers.length);
        const topScore = _allPlayers.reduce((max, player) => Math.max(max, player.scoreValue || 0), 0);
        _setText('pstat-top-score', topScore ? `${topScore}pt` : '--');
        _setText('pstat-world-players', _currentWorldPlayers || '--');
        _setText('players-update-time', result.date ? formatRankingDate(result.date) : '尚無排行資料');
    }

    function _renderPlayersTable() {
        const list  = _getFilteredPlayers();
        const tbody = document.getElementById('players-full-body');
        if (!tbody) return;

        const totalItems = list.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / _playerPageSize));
        _currentPlayerPage = Math.min(Math.max(1, _currentPlayerPage), totalPages);
        const pageStart = (_currentPlayerPage - 1) * _playerPageSize;
        const pageEnd = pageStart + _playerPageSize;
        const pageList = list.slice(pageStart, pageEnd);

        if (!totalItems) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">無符合條件的玩家</td></tr>';
            _renderPlayersPagination(0, 1, 1, 0, 0);
            return;
        }

        tbody.innerHTML = pageList.map((p, i) => `
            <tr class="${_currentWorldPlayers > 0 && (p.rank || pageStart + i + 1) <= _currentWorldPlayers ? 'player-qualified-row' : ''}">
                <td>${getRankBadge(p.rank || pageStart + i + 1)}</td>
                <td class="player-name-cell">
                    ${escapeHtml(p.name)}
                    <span>${escapeHtml(p.ptcg_id || '')}</span>
                </td>
                <td class="score-cell">${escapeHtml(String(p.score ?? '--'))}</td>
                <td class="d-none d-lg-table-cell">${escapeHtml(p.divisionLabel || '--')}</td>
                <td class="d-none d-lg-table-cell">${escapeHtml(p.region || '--')}</td>
                <td>${_canOpenPlayerDetail(p.ptcg_id) ? `<button class="btn-view-detail" data-idx="${pageStart + i}"><i class="bi bi-search"></i></button>` : ''}</td>
            </tr>
        `).join('');

        _renderPlayersPagination(totalItems, totalPages, _currentPlayerPage, pageStart + 1, Math.min(pageEnd, totalItems));
    }

    function _renderPlayersPagination(totalItems, totalPages, currentPage, from, to) {
        const summary = document.getElementById('players-page-summary');
        if (summary) {
            summary.textContent = totalItems > 0
                ? `顯示第 ${from}-${to} 筆，共 ${totalItems} 筆`
                : '共 0 筆';
        }

        const pager = document.getElementById('players-pagination');
        if (!pager) return;

        const prevDisabled = currentPage <= 1;
        const nextDisabled = currentPage >= totalPages;

        // Build visible page numbers: always include first, last, and ±2 around current
        const pageNums = new Set([1, totalPages]);
        for (let p = Math.max(1, currentPage - 2); p <= Math.min(totalPages, currentPage + 2); p++) {
            pageNums.add(p);
        }
        const sorted = Array.from(pageNums).sort((a, b) => a - b);

        let pagesHtml = '';
        let prev = 0;
        for (const p of sorted) {
            if (p - prev > 1) {
                pagesHtml += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
            }
            const active = p === currentPage ? ' active' : '';
            pagesHtml += `<li class="page-item${active}"><button class="page-link" type="button" data-page="${p}"${p === currentPage ? ' disabled' : ''}>${p}</button></li>`;
            prev = p;
        }

        pager.innerHTML = `
            <li class="page-item${prevDisabled ? ' disabled' : ''}"><button class="page-link" type="button" data-page="${Math.max(1, currentPage - 1)}"${prevDisabled ? ' disabled' : ''}>上一頁</button></li>
            ${pagesHtml}
            <li class="page-item${nextDisabled ? ' disabled' : ''}"><button class="page-link" type="button" data-page="${Math.min(totalPages, currentPage + 1)}"${nextDisabled ? ' disabled' : ''}>下一頁</button></li>
        `;
    }

    async function _openPlayerModal(player) {
        document.getElementById('playerModalTitle').textContent = player.name;
        const fetchedAtEl = document.getElementById('playerModalFetchedAt');
        if (fetchedAtEl) fetchedAtEl.textContent = '';

        let top8SummaryHtml = '';
        let historyEventsHtml = '';
        let fetchedAtHtml = '';
        // 嘗試加載玩家歷史數據
        if (player.ptcg_id && _playersManifest?.season_start_from) {
            try {
                const playerHistory = await _loadPlayerHistory(player.ptcg_id);
                if (playerHistory) {
                    const seasonStart = parseDateTimeValue(_playersManifest.season_start_from);
                    if (playerHistory.fetchedAt && fetchedAtEl) {
                        fetchedAtEl.textContent = `最後更新：${formatUpdatedAt(playerHistory.fetchedAt)}`;
                    }
                    fetchedAtHtml = '';
                    
                    // 過濾出大於 season_start_from 且 lp > 0 的賽事
                    const filteredEvents = (playerHistory.participatedTournaments || [])
                        .filter(event => {
                            const eventDate = parseDateTimeValue(event.eventDateTime);
                            const lpValue = parseInt(event.lp, 10);
                            if (!eventDate || !seasonStart) return false;
                            return eventDate > seasonStart && lpValue > 0;
                        });

                    // 按 LP 降序排列，取前 8 個用於統計
                    const top8Events = filteredEvents
                        .sort((a, b) => parseInt(b.lp, 10) - parseInt(a.lp, 10))
                        .slice(0, 8);

                    // 計算前 8 場的總積分
                    if (top8Events.length > 0) {
                        const topLpValues = top8Events.map(e => parseInt(e.lp, 10));
                        const totalLp = topLpValues.reduce((sum, val) => sum + val, 0);
                        const lpCalculation = topLpValues.join('+');

                        top8SummaryHtml = `
                            <div style="background: linear-gradient(135deg, #14532d 0%, #0f766e 100%); border-radius: 12px; padding: 16px 18px; color: white; margin-bottom: 20px; box-shadow: 0 10px 24px rgba(15, 118, 110, 0.22);">
                                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                    <div class="fw-semibold" style="font-size: 0.95rem;"><i class="bi bi-lightning-charge-fill me-2"></i>前 8 場高積分賽事</div>
                                    <span class="badge" style="background: rgba(255,255,255,0.18); color: white; border: 1px solid rgba(255,255,255,0.28);">TOP 8</span>
                                </div>
                                <div style="margin-top: 10px; padding: 10px 12px; border-radius: 9px; background: rgba(255,255,255,0.12); font-size: 0.95rem; line-height: 1.5; white-space: nowrap; overflow-x: auto;">
                                    <span style="opacity: 0.82; margin-right: 8px;">${top8Events.length} 場合計</span>${escapeHtml(lpCalculation)} = <strong style="color: #fde68a;">${totalLp}分</strong>
                                </div>
                            </div>
                        `;
                    }

                    // 按日期降序排列（最新的先）
                    const sortedEvents = filteredEvents
                        .sort((a, b) => {
                            const dateA = parseDateTimeValue(a.eventDateTime);
                            const dateB = parseDateTimeValue(b.eventDateTime);
                            return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
                        });

                    if (sortedEvents.length > 0) {
                        historyEventsHtml = `
                            <h6 class="mb-3"><i class="bi bi-calendar-event me-2"></i>所有賽事紀錄 <small class="text-muted">(${sortedEvents.length} 場賽事)</small></h6>
                            <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                <table class="table table-sm table-hover mb-0">
                                    <thead class="table-light sticky-top">
                                        <tr>
                                            <th>賽事</th>
                                            <th>日期</th>
                                            <th>地點</th>
                                            <th>積分</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${sortedEvents.map((evt) => `
                                            <tr>
                                                <td>${escapeHtml(evt.activityName || '--')}</td>
                                                <td>${escapeHtml(evt.eventDateTime?.split(' ')[0] || '--')}</td>
                                                <td>${escapeHtml(evt.location || evt.address || '--')}</td>
                                                <td><strong>${escapeHtml(evt.lp)}</strong></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    } else {
                        historyEventsHtml = `<p class="text-muted mb-3">此玩家在 ${escapeHtml(_playersManifest.season_start_from)} 之後，沒有符合條件的積分賽事。</p>`;
                    }
                }
            } catch (err) {
                // 靜默失敗，玩家歷史檔案可能不存在
            }
        }

        const body = `
            <div class="row g-3 mb-4">
                <div class="col-6 col-md-3">
                    <div class="player-stat-card">
                        <div class="player-stat-value">${escapeHtml(String(player.score ?? '--'))}</div>
                        <div class="player-stat-label">本季積分</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="player-stat-card">
                        <div class="player-stat-value">${escapeHtml(String(player.ptcg_id ?? '--'))}</div>
                        <div class="player-stat-label">PTCG ID</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="player-stat-card">
                        <div class="player-stat-value">${escapeHtml(player.divisionLabel || '--')}</div>
                        <div class="player-stat-label">組別</div>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <div class="player-stat-card">
                        <div class="player-stat-value">${escapeHtml(player.region || '--')}</div>
                        <div class="player-stat-label">地區</div>
                    </div>
                </div>
            </div>
            ${top8SummaryHtml}
            ${historyEventsHtml}
            <p class="text-muted mb-0" style="font-size:0.9rem">玩家歷史檔案存在時，顯示自 ${_playersManifest?.season_start_from || '本季'} 起的所有有效賽事紀錄。</p>`;

        document.getElementById('playerModalBody').innerHTML = body;
        new bootstrap.Modal(document.getElementById('playerModal')).show();
    }

    // ─── 工具：防抖 ───────────────────────────────────────────

    function _debounce(fn, ms) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }

    // ─── 公開 API ─────────────────────────────────────────────
    return {
        loadHomePage,
        loadTournamentsPage,
        loadDecksPage,
        loadPlayersPage,
    };

})();
