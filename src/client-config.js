// ═══════════════════════════════════════════════
// CLIENT CONFIG — Indy Rezzers (template placeholder)
// Edit this file to adapt the demo for a new client.
// Then run: node build.js
// ═══════════════════════════════════════════════

// ── TEAM IDENTITY ──────────────────────────────
const TEAM = {
  sport:           'mlb',        // 'mlb' | 'nfl' | 'nba' | 'nhl'
  orgName:         'Indy Rezzers Baseball Club',
  shortName:       'Indy Rezzers',
  logoFile:        'Wordmark_1CR_White_750px.png',
  stmLabel:        'Season Ticket Member',
  ticketingVendor: 'Ticketmaster',
  scanVendor:      'Gate Scan',
  fnbVendor:       'Delaware North',
};

// ── BRAND ──────────────────────────────────────
// navy* shades are used in sequential chart color scales.
// accentSoft = accent at ~55% opacity as rgba string.
const BRAND = {
  navy:        '#1B2A4A',
  navyMid:     '#2E4A7A',
  navySoft:    '#4A6FA8',
  navyPale:    '#8AAED4',
  navyGhost:   '#C5D8EE',
  accent:      '#00A896',
  accentLight: '#E6F7F5',
  accentSoft:  'rgba(0,168,150,0.55)',
  accentRed:   '#D85F52',
  navyRgb:     '27,42,74',  // RGB of navy for D3 rgba() color scale
};

// ── VENUE ──────────────────────────────────────
const VENUE = {
  name:     'Rezzer Field',
  capacity: 38000,
  sections: ['Club Level', 'Field Level', 'Main Level', 'Upper Level', 'Outfield'],
  sectionWeights: [15, 80, 120, 100, 65],
  gates:    ['North Entry', 'Northeast Entry', 'East Entry', 'South Entry', 'West Entry'],
  // Set gateBySectionWeights to an object keyed by section name when adding a stadium SVG.
  // Each key maps to an integer weight array aligned with VENUE.gates.
  // Example: { 'Club Level': [10, 20, 30, 20, 20], ... }
  gateBySectionWeights: null,
};

// ── UPCOMING PACING ─────────────────────────────
// Purpose-built snapshot for the Ticket Pacing chart (Tab 2).
// Reference date: 2025-07-14. Update per-client per season.
// target: days>=17 → 78%, days>=4 → 70%, days<4 → 88%
const UPCOMING_PACING = [
  // Kansas City Royals (Jul 18–20) — days 4–6, target 70%
  { opponent:'Kansas City Royals',   date:'2025-07-18', daysUntil:4,  pctSold:71 },
  { opponent:'Kansas City Royals',   date:'2025-07-19', daysUntil:5,  pctSold:62 },
  { opponent:'Kansas City Royals',   date:'2025-07-20', daysUntil:6,  pctSold:53 },
  // Los Angeles Dodgers (Jul 25–27) — days 11–13, target 70%
  { opponent:'Los Angeles Dodgers',  date:'2025-07-25', daysUntil:11, pctSold:82 },
  { opponent:'Los Angeles Dodgers',  date:'2025-07-26', daysUntil:12, pctSold:69 },
  { opponent:'Los Angeles Dodgers',  date:'2025-07-27', daysUntil:13, pctSold:58 },
  // New York Yankees (Aug 1–4) — days 18–21, target 78%
  { opponent:'New York Yankees',     date:'2025-08-01', daysUntil:18, pctSold:94 },
  { opponent:'New York Yankees',     date:'2025-08-02', daysUntil:19, pctSold:85 },
  { opponent:'New York Yankees',     date:'2025-08-03', daysUntil:20, pctSold:74 },
  { opponent:'New York Yankees',     date:'2025-08-04', daysUntil:21, pctSold:62 },
  // Minnesota Twins (Aug 11–12) — days 28–29, target 78%
  { opponent:'Minnesota Twins',      date:'2025-08-11', daysUntil:28, pctSold:81 },
  { opponent:'Minnesota Twins',      date:'2025-08-12', daysUntil:29, pctSold:44 },  // ← at risk
];

// ── SCHEDULE ───────────────────────────────────
// 26 series, n-values sum to 81 home games.
// See SCHEDULE_PRESET.seriesShape for field definitions.
// AL Central rivals: Cleveland Guardians, Detroit Tigers,
//                   Chicago White Sox, Minnesota Twins
const SERIES_SCHEDULE = [
  // March / April — 21 games
  { start:'2025-03-31', opp:'Chicago Cubs',          lg:'NL', rival:false, n:3, tier:'featured', promo:'giveaway',    promoLabel:'Opening Day Bobblehead Giveaway' },
  { start:'2025-04-04', opp:'New York Yankees',      lg:'AL', rival:false, n:3, tier:'featured', promo:'giveaway',    promoLabel:'Replica Championship Banner Night' },
  { start:'2025-04-08', opp:'Cleveland Guardians',   lg:'AL', rival:true,  n:3, tier:'featured', promo:'theme_night', promoLabel:'Rivalry Night' },
  { start:'2025-04-14', opp:'Detroit Tigers',        lg:'AL', rival:true,  n:3, tier:'select',   promo:null,          promoLabel:null },
  { start:'2025-04-18', opp:'Milwaukee Brewers',     lg:'NL', rival:false, n:3, tier:'select',   promo:'theme_night', promoLabel:'Faith & Family Night' },
  { start:'2025-04-22', opp:'Chicago White Sox',     lg:'AL', rival:true,  n:3, tier:'select',   promo:'giveaway',    promoLabel:'Retro Jersey Giveaway' },
  { start:'2025-04-25', opp:'Minnesota Twins',       lg:'AL', rival:true,  n:3, tier:'select',   promo:null,          promoLabel:null },
  // May — 13 games
  { start:'2025-05-05', opp:'Kansas City Royals',    lg:'AL', rival:false, n:3, tier:'select',   promo:'theme_night', promoLabel:'College Night' },
  { start:'2025-05-09', opp:'Cleveland Guardians',   lg:'AL', rival:true,  n:3, tier:'featured', promo:'giveaway',    promoLabel:'Season Ticket Member Bobblehead Night' },
  { start:'2025-05-16', opp:'Detroit Tigers',        lg:'AL', rival:true,  n:3, tier:'select',   promo:null,          promoLabel:null },
  { start:'2025-05-23', opp:'Baltimore Orioles',     lg:'AL', rival:false, n:4, tier:'select',   promo:'giveaway',    promoLabel:'Replica Banner Giveaway' },
  // June — 13 games
  { start:'2025-06-06', opp:'Pittsburgh Pirates',    lg:'NL', rival:false, n:3, tier:'select',   promo:'giveaway',    promoLabel:'Youth Baseball Cap Giveaway' },
  { start:'2025-06-09', opp:'Toronto Blue Jays',     lg:'AL', rival:false, n:3, tier:'standard', promo:null,          promoLabel:null },
  { start:'2025-06-13', opp:'Chicago White Sox',     lg:'AL', rival:true,  n:3, tier:'standard', promo:'theme_night', promoLabel:'Star Wars Night' },
  { start:'2025-06-20', opp:'Minnesota Twins',       lg:'AL', rival:true,  n:4, tier:'standard', promo:'giveaway',    promoLabel:'Starting Pitcher Bobblehead' },
  // July — 12 games
  { start:'2025-07-03', opp:'Cleveland Guardians',   lg:'AL', rival:true,  n:3, tier:'featured', promo:'theme_night', promoLabel:'July 4th Fireworks Spectacular' },
  { start:'2025-07-07', opp:'Detroit Tigers',        lg:'AL', rival:true,  n:3, tier:'select',   promo:'giveaway',    promoLabel:'Custom Tumbler Giveaway' },
  { start:'2025-07-18', opp:'Kansas City Royals',    lg:'AL', rival:false, n:3, tier:'select',   promo:'theme_night', promoLabel:'Soccer Night' },
  { start:'2025-07-25', opp:'Los Angeles Dodgers',   lg:'NL', rival:false, n:3, tier:'standard', promo:'giveaway',    promoLabel:'Garden Flag Giveaway' },
  // August — 13 games
  { start:'2025-08-01', opp:'New York Yankees',      lg:'AL', rival:false, n:4, tier:'featured', promo:'giveaway',    promoLabel:'Player Replica Ring Night' },
  { start:'2025-08-11', opp:'Minnesota Twins',       lg:'AL', rival:true,  n:3, tier:'standard', promo:'theme_night', promoLabel:'Back-to-School Night' },
  { start:'2025-08-18', opp:'Cleveland Guardians',   lg:'AL', rival:true,  n:3, tier:'featured', promo:'giveaway',    promoLabel:'Pitcher Bobblehead Night' },
  { start:'2025-08-25', opp:'St. Louis Cardinals',   lg:'NL', rival:false, n:3, tier:'standard', promo:null,          promoLabel:null },
  // September — 9 games
  { start:'2025-09-05', opp:'Detroit Tigers',        lg:'AL', rival:true,  n:3, tier:'select',   promo:'theme_night', promoLabel:'Fan Appreciation Weekend' },
  { start:'2025-09-12', opp:'Kansas City Royals',    lg:'AL', rival:false, n:3, tier:'select',   promo:null,          promoLabel:null },
  { start:'2025-09-22', opp:'Cleveland Guardians',   lg:'AL', rival:true,  n:3, tier:'featured', promo:'giveaway',    promoLabel:'Season Finale Poster Giveaway' },
];

// ── FAN GEOGRAPHY ──────────────────────────────
// Indy Rezzers: Indiana-heavy fan base
const HOME_STATES   = ['IN','IL','OH','KY','MI','TN','FL','NY','CA','TX'];
const STATE_WEIGHTS = [200,  40,  25,  20,  18,  12,   8,   6,   5,   5];

// Build.js requires this; browser ignores the guard
if (typeof module !== 'undefined') {
  module.exports = { TEAM, BRAND, VENUE, UPCOMING_PACING, SERIES_SCHEDULE, HOME_STATES, STATE_WEIGHTS };
}
