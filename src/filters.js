// ═══════════════════════════════════════════════
// FILTER STATE
// ═══════════════════════════════════════════════

const STATE = {
  activeTab:     'tab1',
  opponent:      'all',       // global — 'all' | any opponent string from GAMES
  showSeasonAvg: true,        // global toggle — only relevant when opponent !== 'all'
  tab1: { dateRange: 'full_season', dayType: 'all', promo: 'all', gate: null },
  tab2: { dateRange: 'full_season', dayType: 'all', ticketType: 'all' },
  tab3: { dateRange: 'full_season', dayType: 'all', fnbCategory: 'all', fnbDrilldown: null },
  tab4: { dateRange: 'full_season', segment: 'all_linked', linkedStatus: 'linked_only' },
};

// Date range buckets — derived from GAMES so they work for any sport/season
const DATE_PRESETS = {
  full_season: () => {
    const sorted = [...GAMES].sort((a, b) => a.date.localeCompare(b.date));
    const start = new Date(sorted[0].date + 'T00:00:00');
    const end   = new Date(sorted[sorted.length - 1].date + 'T23:59:59');
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() + 1);
    return [start, end];
  },
  first_half: () => {
    const sorted = [...GAMES].sort((a, b) => a.date.localeCompare(b.date));
    const mid  = sorted[Math.floor(sorted.length / 2)].date;
    const start = new Date(sorted[0].date + 'T00:00:00');
    start.setDate(start.getDate() - 1);
    return [start, new Date(mid + 'T23:59:59')];
  },
  second_half: () => {
    const sorted = [...GAMES].sort((a, b) => a.date.localeCompare(b.date));
    const mid  = sorted[Math.floor(sorted.length / 2)].date;
    const end  = new Date(sorted[sorted.length - 1].date + 'T23:59:59');
    end.setDate(end.getDate() + 1);
    return [new Date(mid + 'T00:00:00'), end];
  },
  last_30_games: () => {
    const sorted = [...GAMES].sort((a, b) => a.date.localeCompare(b.date));
    const cutoff = sorted[Math.max(0, sorted.length - 30)].date;
    const end = new Date(sorted[sorted.length - 1].date + 'T23:59:59');
    end.setDate(end.getDate() + 1);
    return [new Date(cutoff + 'T00:00:00'), end];
  },
};

function getDateWindow(dateRange) {
  return (DATE_PRESETS[dateRange] || DATE_PRESETS.full_season)();
}

// filterGames — returns { mode, focused, baseline }
// mode='all'     → focused = all games matching tab filters, baseline = null
// mode='focused' → focused = opponent-matching games, baseline = all other games (for season avg)
function filterGames(tabFilters) {
  const [start, end] = getDateWindow(tabFilters.dateRange);

  // Apply tab-specific filters (dateRange, dayType, promo/ticketType/fnbCategory)
  let games = GAMES.filter(g => {
    const d = new Date(g.date);
    if (d < start || d > end) return false;
    if (tabFilters.dayType && tabFilters.dayType !== 'all' && g.day_type !== tabFilters.dayType) return false;
    if (tabFilters.promo && tabFilters.promo !== 'all') {
      if (tabFilters.promo === 'no_promo' && g.promo_type !== null) return false;
      if (tabFilters.promo !== 'no_promo' && g.promo_type !== tabFilters.promo) return false;
    }
    return true;
  });

  if (STATE.opponent === 'all') {
    return { mode: 'all', focused: games, baseline: null };
  }

  const focused  = games.filter(g => g.opponent === STATE.opponent);
  const baseline = games.filter(g => g.opponent !== STATE.opponent);
  return { mode: 'focused', focused, baseline };
}

// Lookup game-level data rows by game_id
function getTicketRows(gameIds) {
  const idSet = new Set(gameIds);
  return GAME_TICKETS.filter(r => idSet.has(r.game_id));
}
function getScanRows(gameIds) {
  const idSet = new Set(gameIds);
  return GAME_SCANS.filter(r => idSet.has(r.game_id));
}
function getFnbRows(gameIds) {
  const idSet = new Set(gameIds);
  return GAME_FNB.filter(r => idSet.has(r.game_id));
}

// filterFans — filters the FANS array for Tab 2, 3, 4 fan-level charts
function filterFans(tabFilters, tab) {
  return FANS.filter(f => {
    if (tab === 'tab2') {
      if (!f.ticketing_fan_id) return false;
      if (tabFilters.ticketType !== 'all' && f.ticket_type !== tabFilters.ticketType) return false;
    }
    if (tab === 'tab3') {
      if (!f.fnb_fan_id) return false;
      if (tabFilters.fnbCategory !== 'all' && f.fnb_top_category !== tabFilters.fnbCategory) return false;
    }
    if (tab === 'tab4') {
      if (tabFilters.linkedStatus === 'linked_only' && !f.global_fan_id) return false;
      if (tabFilters.segment === 'top10pct') {
        if (f.total_cross_channel_spend < getTop10PctThreshold()) return false;
      }
      if (tabFilters.segment === 'single_source') {
        if (f.linked_sources.includes('|')) return false;
      }
    }
    return true;
  });
}

// Formatting helpers (same as Belmont)
const fmt = {
  currency: n => '$' + (n >= 1_000_000 ? (n/1_000_000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(0)+'K' : n.toFixed(0)),
  pct:      n => (n * 100).toFixed(1) + '%',
  num:      n => n >= 1000 ? (n/1000).toFixed(1)+'K' : String(Math.round(n)),
};

// Smoke tests
console.assert(filterGames(STATE.tab1).focused.length === SCHEDULE_PRESET.homeGames,
  `filterGames full_season should return ${SCHEDULE_PRESET.homeGames} games, got ${filterGames(STATE.tab1).focused.length}`);
console.log('FILTERS OK');
