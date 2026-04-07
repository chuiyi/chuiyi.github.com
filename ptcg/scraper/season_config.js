'use strict';

const DEFAULT_SEASON_LABEL = '2025-26';

// 集中管理賽季設定：下個賽季只需修改這裡。
const SEASON_CONFIG = {
  '2025-26': {
    startDate: '09-01-2025',
    seasonText: '2025-26',
  },
};

function normalizeSeasonLabel(label) {
  return String(label || '').trim();
}

function resolveSeasonDefaults(requestedLabel) {
  const envLabel = normalizeSeasonLabel(process.env.PTCG_SEASON_LABEL);
  const cliLabel = normalizeSeasonLabel(requestedLabel);
  const seasonLabel = cliLabel || envLabel || DEFAULT_SEASON_LABEL;

  const config = SEASON_CONFIG[seasonLabel];
  if (!config) {
    const available = Object.keys(SEASON_CONFIG).join(', ');
    throw new Error(`Unknown season label: ${seasonLabel}. Available: ${available}`);
  }

  return {
    seasonLabel,
    startDate: config.startDate,
    seasonText: config.seasonText || seasonLabel,
  };
}

module.exports = {
  DEFAULT_SEASON_LABEL,
  SEASON_CONFIG,
  resolveSeasonDefaults,
};
