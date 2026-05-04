// ═══════════════════════════════════════════════
// NHL SPORT PRESET — Chicago Blackhawks
// ═══════════════════════════════════════════════

const SCHEDULE_PRESET = {
  sport:        'nhl',
  homeGames:    41,
  activeMonths: [9, 10, 11, 0, 1, 2, 3],  // Oct–Apr (0-indexed)

  // Attendance ceiling by game tier — United Center cap 19,717
  TIER_ATTENDANCE: { featured: 19400, select: 18200, standard: 16800 },

  // FnB per-cap base by tier (arena concessions: shorter games than MLB, strong bar spend)
  FNB_TIER_BASE_PERCAP: { featured: 31.50, select: 27.00, standard: 22.50 },

  // Seasonality index per month (0=Jan…11=Dec); zeros = off-season
  SEASONALITY: [
    0.88,  // Jan  (0)  — post-holiday; playoff race builds
    0.91,  // Feb  (1)  — rivalry month, Trade Deadline excitement
    0.90,  // Mar  (2)  — playoff push or late-season fade
    0.86,  // Apr  (3)  — final stretch; low if out of contention
    0,     // May  (4)  — off-season
    0,     // Jun  (5)  — off-season
    0,     // Jul  (6)  — off-season
    0,     // Aug  (7)  — off-season
    0,     // Sep  (8)  — off-season
    1.00,  // Oct  (9)  — season opener excitement
    0.96,  // Nov (10)  — strong; early standings matter
    0.92,  // Dec (11)  — holiday; cold Chicago but loyal fanbase
  ],

  // Arrival shift deltas by month [90+min, 60–90, 30–60, 0–30]
  // NHL fans tend to arrive closer to puck drop than baseball; cold months push later
  ARR_SEASONAL: [
    [-0.02, 0.01, 0.01, 0.01],  // Jan  — cold, lean later
    [ 0.01, 0.01, 0.00,-0.01],  // Feb  — rivalry games pull fans early
    [ 0.00, 0.00, 0.00, 0.00],  // Mar  — baseline
    [-0.01, 0.00, 0.01, 0.01],  // Apr  — late season; casual fans arrive last-minute
    [ 0.00, 0.00, 0.00, 0.00],  // May  — off
    [ 0.00, 0.00, 0.00, 0.00],  // Jun  — off
    [ 0.00, 0.00, 0.00, 0.00],  // Jul  — off
    [ 0.00, 0.00, 0.00, 0.00],  // Aug  — off
    [ 0.00, 0.00, 0.00, 0.00],  // Sep  — off
    [ 0.07, 0.04,-0.04,-0.05],  // Oct  — home opener energy, arrive early
    [ 0.03, 0.02,-0.02,-0.02],  // Nov  — baseline strength
    [-0.03,-0.01, 0.02, 0.02],  // Dec  — winter cold, slight late drift
  ],

  // Monthly STM no-show rate base (NHL: fewer games, strong commitment; ~4–7%)
  STM_NS_MONTHLY: [
    0.052,  // Jan
    0.038,  // Feb
    0.048,  // Mar
    0.062,  // Apr
    0, 0, 0, 0, 0,  // off-season
    0.022,  // Oct (9)  — opener excitement, near-zero no-shows
    0.035,  // Nov (10) — baseline
    0.055,  // Dec (11) — holiday conflicts, cold-weather deterrent
  ],

  // Series entry shape for SERIES_SCHEDULE in client-config.js
  seriesShape: '{ start, opp, lg, rival, n, tier, promo, promoLabel }',

  dayTypeClassifier(dateStr, seriesTier, gameIndex, openingDate) {
    const d = new Date(dateStr + 'T12:00:00');
    const dow = d.getDay(); // 0=Sun
    if (dateStr === openingDate) return 'day_game';
    // NHL: Fri/Sat/Sun primetime → weekend; Tue–Thu → weeknight
    if (dow === 0 || dow === 5 || dow === 6) return 'weekend_friday';
    return 'weeknight';
  },
};

if (typeof module !== 'undefined') module.exports = SCHEDULE_PRESET;
