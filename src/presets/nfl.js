// ═══════════════════════════════════════════════
// NFL SPORT PRESET — Kansas City Chiefs
// ═══════════════════════════════════════════════

const SCHEDULE_PRESET = {
  sport:        'nfl',
  homeGames:    9,
  activeMonths: [8, 9, 10, 11, 12, 0],  // Sep–Jan (0-indexed)

  // Attendance ceiling by game tier — Arrowhead cap 76,416
  TIER_ATTENDANCE: { featured: 74200, select: 70500, standard: 67800 },

  // FnB per-cap base by tier (NFL: fewer games, bigger events, strong tailgate culture)
  FNB_TIER_BASE_PERCAP: { featured: 57.00, select: 51.50, standard: 44.50 },

  // Seasonality index per month (0=Jan…11=Dec); zeros = off-season
  SEASONALITY: [
    0.93,  // Jan  (0)  — season finale / playoff push
    0,     // Feb  (1)  — off
    0,     // Mar  (2)  — off
    0,     // Apr  (3)  — off
    0,     // May  (4)  — off
    0,     // Jun  (5)  — off
    0,     // Jul  (6)  — off
    0,     // Aug  (7)  — preseason (not counted in homeGames)
    1.00,  // Sep  (8)  — home opener excitement
    0.98,  // Oct  (9)  — strong
    0.95,  // Nov (10)  — playoff race building
    0.90,  // Dec (11)  — cold KC weather, slight dip
  ],

  // Arrival shift deltas by month [90+min, 60–90, 30–60, 0–30]
  // NFL tailgate culture → earlier arrivals than MLB baseline
  ARR_SEASONAL: [
    [ 0.05, 0.03,-0.04,-0.04],  // Jan  — playoff energy, arrive early
    [ 0.00, 0.00, 0.00, 0.00],  // Feb  — off
    [ 0.00, 0.00, 0.00, 0.00],  // Mar  — off
    [ 0.00, 0.00, 0.00, 0.00],  // Apr  — off
    [ 0.00, 0.00, 0.00, 0.00],  // May  — off
    [ 0.00, 0.00, 0.00, 0.00],  // Jun  — off
    [ 0.00, 0.00, 0.00, 0.00],  // Jul  — off
    [ 0.00, 0.00, 0.00, 0.00],  // Aug  — preseason
    [ 0.09, 0.05,-0.06,-0.07],  // Sep  — home opener, peak early arrivals
    [ 0.05, 0.03,-0.03,-0.04],  // Oct  — tailgate season peak
    [ 0.03, 0.02,-0.02,-0.02],  // Nov  — baseline
    [-0.01, 0.01, 0.00, 0.01],  // Dec  — cold weather, slightly later gate push
  ],

  // Monthly STM no-show rate base (NFL: ~3–7%; higher in Dec cold)
  STM_NS_MONTHLY: [
    0.042,  // Jan
    0, 0, 0, 0, 0, 0, 0,  // off-season
    0.028,  // Sep (8)
    0.035,  // Oct (9)
    0.042,  // Nov (10)
    0.068,  // Dec (11)
  ],

  // Series entry shape
  seriesShape: '{ start, opp, lg, rival, n, tier, promo, promoLabel }',

  dayTypeClassifier(dateStr, seriesTier, gameIndex, openingDate) {
    const d = new Date(dateStr + 'T12:00:00');
    const dow = d.getDay(); // 0=Sun
    // Monday Night / Thursday Night → weeknight; Sunday / Saturday → weekend
    if (dow === 1 || dow === 4) return 'weeknight';
    return 'weekend_friday';
  },
};

if (typeof module !== 'undefined') module.exports = SCHEDULE_PRESET;
