// ═══════════════════════════════════════════════
// DATA LAYER — Fan Identity Demo Template
// Config-driven: globals from client-config.js + presets/mlb.js
// Load order: client-config.js → presets/mlb.js → data.js
// ═══════════════════════════════════════════════

// Deterministic variance — same pattern as Belmont, no Math.random()
function deterministicVariance(key, salt = 0) {
  let h = salt;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFFFF;
  return 0.88 + ((h >>> 0) % 240) / 1000;
}

function weightedPick(items, weights, seed) {
  const total = weights.reduce((a, b) => a + b, 0);
  let h = seed;
  for (let i = 0; i < 3; i++) h = (h * 1664525 + 1013904223) & 0xFFFFFFFF;
  const r = (h >>> 0) % total;
  let cum = 0;
  for (let i = 0; i < items.length; i++) { cum += weights[i]; if (r < cum) return items[i]; }
  return items[items.length - 1];
}

// Build GAMES array from SERIES_SCHEDULE (defined in client-config.js)
function buildGames() {
  const games = [];
  let id = 1;
  const openingDate = SERIES_SCHEDULE[0].start;

  for (const s of SERIES_SCHEDULE) {
    const startDate = new Date(s.start + 'T12:00:00');
    for (let g = 0; g < s.n; g++, id++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + g);
      const dateStr  = d.toISOString().slice(0, 10);
      const day_type = SCHEDULE_PRESET.dayTypeClassifier(dateStr, s.tier, g, openingDate);
      const promo_type  = g === 0 ? s.promo      : null;
      const promo_label = g === 0 ? s.promoLabel : null;

      games.push({
        id:                `G${String(id).padStart(3, '0')}`,
        date:              dateStr,
        opponent:          s.opp,
        opponent_league:   s.lg,
        is_division_rival: s.rival,
        day_type,
        game_tier:         s.tier,
        promo_type,
        promo_label,
        month:             d.getMonth(),
      });
    }
  }
  return games;
}

const GAMES = buildGames();

console.assert(GAMES.length === SCHEDULE_PRESET.homeGames,
  `GAMES should have ${SCHEDULE_PRESET.homeGames} home games, got ${GAMES.length}`);
console.log('GAMES OK — ' + GAMES.length + ' home games, ' + new Set(GAMES.map(g => g.opponent)).size + ' opponents');

const GAME_BY_ID = Object.fromEntries(GAMES.map(g => [g.id, g]));

// ── GAME_TICKETS ──────────────────────────────────
function generateGameTickets() {
  return GAMES.map(g => {
    const base = SCHEDULE_PRESET.TIER_ATTENDANCE[g.game_tier];
    const v    = deterministicVariance(g.id, 1);
    const seasonMult = SCHEDULE_PRESET.SEASONALITY[g.month] || 0.85;
    const tickets_sold_total = Math.min(VENUE.capacity, Math.round(base * seasonMult * v));
    const stm_share   = 0.58 + deterministicVariance(g.id, 2) * 0.06 - 0.03;
    const sec_share   = g.game_tier === 'featured' ? 0.10 + deterministicVariance(g.id, 3) * 0.04
                      : g.game_tier === 'select'   ? 0.07 + deterministicVariance(g.id, 3) * 0.03
                      :                              0.04 + deterministicVariance(g.id, 3) * 0.02;
    const stm_tickets      = Math.round(tickets_sold_total * stm_share);
    const secondary_tickets = Math.round(tickets_sold_total * sec_share);
    const single_tickets    = tickets_sold_total - stm_tickets - secondary_tickets;

    const stm_avg    = 50 + Math.round(deterministicVariance(g.id, 4) * 10 - 5);
    const single_avg = 76 + Math.round(deterministicVariance(g.id, 5) * 20 - 10);
    const sec_adj    = g.game_tier === 'featured' ? 1.12 : g.game_tier === 'standard' ? 0.91 : 1.02;
    const sec_avg    = Math.round(single_avg * sec_adj);

    const gross_revenue     = stm_tickets * stm_avg + single_tickets * single_avg + secondary_tickets * sec_avg;
    const days_adv_base     = g.game_tier === 'featured' ? 28 : g.game_tier === 'select' ? 18 : 10;

    return {
      game_id:              g.id,
      date:                 g.date,
      tickets_sold_total,
      stm_tickets,
      single_tickets,
      secondary_tickets,
      gross_revenue,
      stm_revenue:          stm_tickets * stm_avg,
      single_revenue:       single_tickets * single_avg,
      secondary_revenue:    secondary_tickets * sec_avg,
      avg_ticket_value:     Math.round(gross_revenue / tickets_sold_total),
      stm_avg_value:        stm_avg,
      single_avg_value:     single_avg,
      secondary_avg_value:  sec_avg,
      secondary_market_share: parseFloat(sec_share.toFixed(3)),
      avg_days_in_advance:  days_adv_base + Math.round(deterministicVariance(g.id, 6) * 8 - 4),
      game_tier:            g.game_tier,
      day_type:             g.day_type,
      promo_type:           g.promo_type,
    };
  });
}

const GAME_TICKETS = generateGameTickets();
console.assert(GAME_TICKETS.length === SCHEDULE_PRESET.homeGames, 'GAME_TICKETS row count');

// ── GAME_SCANS ──────────────────────────────────
function generateGameScans() {
  return GAMES.map((g, i) => {
    const tkt = GAME_TICKETS[i];
    const noShowBase = g.game_tier === 'featured' ? 0.026 : g.game_tier === 'select' ? 0.038 : 0.055;
    const no_show_rate = noShowBase + deterministicVariance(g.id, 10) * 0.014 - 0.007;
    const tickets_scanned = Math.round(tkt.tickets_sold_total * (1 - no_show_rate));
    const no_show_count   = tkt.tickets_sold_total - tickets_scanned;

    // Arrival distribution with seasonal shifts — sums to 1.0
    const shift = SCHEDULE_PRESET.ARR_SEASONAL[g.month] || [0, 0, 0, 0];
    const a90p = Math.max(0.02, 0.09 + shift[0] + deterministicVariance(g.id, 11) * 0.04 - 0.02);
    const a60  = Math.max(0.05, 0.17 + shift[1] + deterministicVariance(g.id, 12) * 0.04 - 0.02);
    const a30  = Math.max(0.10, 0.30 + shift[2] + deterministicVariance(g.id, 13) * 0.04 - 0.02);
    const a0   = Math.max(0.10, 0.28 + shift[3] + deterministicVariance(g.id, 14) * 0.04 - 0.02);
    const aPost = Math.max(0.02, parseFloat((1 - a90p - a60 - a30 - a0).toFixed(3)));

    return {
      game_id:            g.id,
      date:               g.date,
      tickets_scanned,
      no_show_count,
      no_show_rate:       parseFloat(no_show_rate.toFixed(3)),
      stm_no_show_rate:   parseFloat(Math.max(0.01, SCHEDULE_PRESET.STM_NS_MONTHLY[g.month] + deterministicVariance(g.id, 15) * 0.015 - 0.005).toFixed(3)),
      single_no_show_rate: parseFloat((0.065 + deterministicVariance(g.id, 16) * 0.020).toFixed(3)),
      secondary_no_show_rate: parseFloat((0.130 + deterministicVariance(g.id, 17) * 0.030).toFixed(3)),
      arr_90plus:         parseFloat(a90p.toFixed(3)),
      arr_60to90:         parseFloat(a60.toFixed(3)),
      arr_30to60:         parseFloat(a30.toFixed(3)),
      arr_0to30:          parseFloat(a0.toFixed(3)),
      arr_post_pitch:     aPost,
      avg_tickets_per_scan: parseFloat((2.1 + deterministicVariance(g.id, 18) * 0.6 - 0.3).toFixed(2)),
      solo_scan_pct:      parseFloat((0.27 + deterministicVariance(g.id, 19) * 0.06 - 0.03).toFixed(3)),
      group_2to3_pct:     parseFloat((0.42 + deterministicVariance(g.id, 20) * 0.06 - 0.03).toFixed(3)),
      group_4plus_pct:    parseFloat((0.28 + deterministicVariance(g.id, 21) * 0.04 - 0.02).toFixed(3)),
      game_tier:          g.game_tier,
      day_type:           g.day_type,
      promo_type:         g.promo_type,
    };
  });
}

const GAME_SCANS = generateGameScans();
console.assert(GAME_SCANS.length === SCHEDULE_PRESET.homeGames, 'GAME_SCANS row count');

// ── GAME_FNB ──────────────────────────────────
const FNB_DAY_TYPE_MULT = { weekend_friday: 1.15, weeknight: 1.00, day_game: 0.88 };

function generateGameFnB() {
  return GAMES.map((g, i) => {
    const scan = GAME_SCANS[i];
    const dayMult  = FNB_DAY_TYPE_MULT[g.day_type] || 1.0;
    const percap   = SCHEDULE_PRESET.FNB_TIER_BASE_PERCAP[g.game_tier] * dayMult * deterministicVariance(g.id, 30);
    const attach   = 0.58 + deterministicVariance(g.id, 31) * 0.10 - 0.05;
    const unique_visitors_with_fnb = Math.round(scan.tickets_scanned * attach);
    const total_revenue = Math.round(scan.tickets_scanned * percap);
    return {
      game_id:              g.id,
      date:                 g.date,
      total_revenue,
      food_revenue:         Math.round(total_revenue * 0.44),
      beer_wine_revenue:    Math.round(total_revenue * (g.month >= 5 && g.month <= 7 ? 0.41 : 0.38)),
      non_alc_revenue:      Math.round(total_revenue * (g.month >= 5 && g.month <= 7 ? 0.15 : 0.18)),
      transaction_count:    Math.round(unique_visitors_with_fnb * 1.85),
      unique_visitors_with_fnb,
      avg_per_cap:          parseFloat(percap.toFixed(2)),
      fnb_attach_rate:      parseFloat(attach.toFixed(3)),
      game_tier:            g.game_tier,
      day_type:             g.day_type,
      promo_type:           g.promo_type,
    };
  });
}

const GAME_FNB = generateGameFnB();
console.assert(GAME_FNB.length === SCHEDULE_PRESET.homeGames, 'GAME_FNB row count');

const totalFnBRev = GAME_FNB.reduce((s, r) => s + r.total_revenue, 0);
console.log('GAME DATA OK — FnB season total $' + (totalFnBRev / 1e6).toFixed(1) + 'M');

// ── FNB_SUBCATS — subcategory revenue shares and avg unit prices ──
// share: fraction of parent category season revenue
// avg_price: used to derive unit count = Math.round(revenue / avg_price)
const FNB_SUBCATS = {
  food: [
    { key: 'hot_dogs',        label: 'Hot Dogs',                share: 0.28, avg_price: 8.50  },
    { key: 'nachos_dips',     label: 'Nachos & Dips',           share: 0.24, avg_price: 11.00 },
    { key: 'bbq_sandwiches',  label: 'BBQ & Sandwiches',        share: 0.20, avg_price: 14.00 },
    { key: 'pizza',           label: 'Pizza',                   share: 0.15, avg_price: 9.50  },
    { key: 'desserts_snacks', label: 'Desserts & Snacks',       share: 0.13, avg_price: 6.00  },
  ],
  beer_wine: [
    { key: 'domestic_beer',   label: 'Domestic Beer',           share: 0.42, avg_price: 10.00 },
    { key: 'craft_beer',      label: 'Craft Beer',              share: 0.31, avg_price: 13.00 },
    { key: 'hard_seltzer',    label: 'Hard Seltzer',            share: 0.14, avg_price: 11.00 },
    { key: 'wine',            label: 'Wine',                    share: 0.13, avg_price: 12.00 },
  ],
  non_alc: [
    { key: 'fountain_soda',   label: 'Fountain Soda',           share: 0.38, avg_price: 5.50  },
    { key: 'bottled_water',   label: 'Bottled Water',           share: 0.27, avg_price: 4.50  },
    { key: 'lemonade',        label: 'Lemonade',                share: 0.18, avg_price: 6.00  },
    { key: 'specialty_bev',   label: 'Specialty Beverages',     share: 0.17, avg_price: 8.00  },
  ],
};

// ── Fan Records — 3,000 fans across 3 source systems ──────────────
// Ticketing (TICKET) · Gate Scan (SCAN) · F&B Vendor (FNB)

const FNB_CATS     = ['food','beer_wine','non_alc'];
const TICKET_TYPES = ['stm','single_game','secondary'];
const TKT_WEIGHTS  = [55, 30, 15];

// 7 segments — total 3,000, linked = 960+570+390+252 = 2,172
const SEGMENTS = [
  { count: 960, sources:['TICKET','SCAN','FNB'], linked:true  },
  { count: 570, sources:['TICKET','SCAN'],       linked:true  },
  { count: 390, sources:['TICKET','FNB'],        linked:true  },
  { count: 252, sources:['SCAN','FNB'],          linked:true  },  // Dark fans — P3RL punchline
  { count: 408, sources:['TICKET'],              linked:false },
  { count: 240, sources:['SCAN'],                linked:false },
  { count: 180, sources:['FNB'],                 linked:false },
];

function generateFans() {
  const fans = [];
  let idx = 0;
  for (const seg of SEGMENTS) {
    for (let i = 0; i < seg.count; i++, idx++) {
      const seed  = idx * 7919 + 42;
      const state = weightedPick(HOME_STATES, STATE_WEIGHTS, seed);
      const hasTkt  = seg.sources.includes('TICKET');
      const hasScan = seg.sources.includes('SCAN');
      const hasFnb  = seg.sources.includes('FNB');

      const ticket_type    = hasTkt ? weightedPick(TICKET_TYPES, TKT_WEIGHTS, seed + 1) : null;
      const seat_section   = hasTkt ? weightedPick(VENUE.sections, VENUE.sectionWeights, seed + 2) : null;
      const games_purchased = hasTkt
        ? (ticket_type === 'stm' ? SCHEDULE_PRESET.homeGames : 1 + (seed % 12))
        : null;
      const ticket_spend   = hasTkt
        ? (ticket_type === 'stm'
            ? 2500 + (seed % 2500)
            : games_purchased * (55 + (seed % 80)))
        : null;
      const games_attended = hasScan
        ? (hasTkt && ticket_type === 'stm'
            ? Math.round(games_purchased * (0.78 + deterministicVariance(idx, 40) * 0.18))
            : 1 + (seed % (games_purchased || 10)))
        : null;
      const stm_utilization = (hasScan && hasTkt && ticket_type === 'stm' && games_purchased)
        ? parseFloat((games_attended / games_purchased).toFixed(3))
        : null;
      const arr_buckets = ['90plus','60to90','30to60','0to30','post_pitch'];
      const avg_arrival_bucket = arr_buckets[seed % 5];
      const avg_group_size = hasScan ? parseFloat((1.5 + deterministicVariance(idx, 41) * 2.0).toFixed(1)) : null;
      const gate_entry = (hasScan && seat_section && VENUE.gateBySectionWeights)
        ? weightedPick(VENUE.gates, VENUE.gateBySectionWeights[seat_section], seed + 99)
        : null;

      const fnb_visit_count = hasFnb
        ? (hasScan ? Math.min(games_attended || 10, 3 + (seed % 12)) : 2 + (seed % 10))
        : null;
      const fnb_spend      = hasFnb ? Math.round(fnb_visit_count * (15 + (seed % 28))) : null;
      const fnb_top_cat    = hasFnb ? FNB_CATS[seed % 3] : null;

      const total_cross_channel_spend = (ticket_spend || 0) + (fnb_spend || 0);

      fans.push({
        ticketing_fan_id:  hasTkt  ? `TKT-${String(idx+1).padStart(6,'0')}` : null,
        scan_fan_id:       hasScan ? `SCN-${String(idx+1).padStart(6,'0')}` : null,
        fnb_fan_id:        hasFnb  ? `FNB-${String(idx+1).padStart(6,'0')}` : null,
        global_fan_id:     seg.linked ? `GF-${String(idx+1).padStart(6,'0')}` : null,
        linked_sources:         seg.sources.join('|'),
        match_confidence_score: seg.linked ? parseFloat((0.82 + deterministicVariance(idx, 45) * 0.16).toFixed(2)) : null,
        ticket_type,
        ticket_spend,
        games_purchased,
        seat_section,
        ticket_state:      hasTkt  ? state : null,
        games_attended,
        stm_utilization,
        avg_arrival_bucket,
        avg_group_size,
        gate_entry,
        scan_state:        hasScan ? state : null,
        fnb_spend,
        fnb_transactions:  hasFnb ? Math.round((fnb_visit_count || 1) * (1 + (seed % 3))) : null,
        fnb_avg_transaction: hasFnb ? Math.round((fnb_spend || 0) / Math.max(1, (fnb_visit_count || 1) * (1 + (seed % 3)))) : null,
        fnb_top_category:  fnb_top_cat,
        fnb_attach_flag:   hasFnb,
        fnb_visit_count,
        total_cross_channel_spend,
        home_state:        state,
      });
    }
  }
  return fans;
}

const FANS = generateFans();

console.assert(FANS.length === 3000, 'FANS should have 3,000 records');
console.assert(FANS.filter(f => f.global_fan_id).length === 2172, `Linked fans: expected 2172, got ${FANS.filter(f=>f.global_fan_id).length}`);
const darkFans = FANS.filter(f => f.linked_sources === 'SCAN|FNB');
console.assert(darkFans.length === 252, `Dark fans (SCAN+FNB only): expected 252, got ${darkFans.length}`);
console.log(`FANS OK — 3,000 total, ${FANS.filter(f=>f.global_fan_id).length} linked, ${darkFans.length} dark fans`);

function getTop10PctThreshold() {
  const linked = FANS.filter(f => f.global_fan_id);
  const sorted = [...linked].sort((a, b) => b.total_cross_channel_spend - a.total_cross_channel_spend);
  return sorted[Math.floor(sorted.length * 0.10)]?.total_cross_channel_spend ?? 0;
}
