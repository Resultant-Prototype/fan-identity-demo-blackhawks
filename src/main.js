// ═══════════════════════════════════════════════
// TAB NAVIGATION
// ═══════════════════════════════════════════════
function switchTab(tabId) {
  STATE.activeTab = tabId;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
  renderTab(tabId);
}
document.querySelectorAll('.tab-btn').forEach(btn =>
  btn.addEventListener('click', () => switchTab(btn.dataset.tab))
);

// ═══════════════════════════════════════════════
// BAN RENDERING
// ═══════════════════════════════════════════════
function renderBANs(containerId, banDefs) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = banDefs.map(({ label, value, lead, tooltip, delta, deltaLabel }) => `
    <div class="ban-card ${lead ? 'lead' : ''}"
         ${tooltip ? `data-tooltip="${tooltip}"` : ''}>
      <div class="ban-label">${label}</div>
      <div class="ban-value">${value}</div>
      ${delta !== undefined ? `<div class="ban-delta ${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}%${deltaLabel ? ' ' + deltaLabel : ''}</div>` : ''}
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════
// MATCH BANNER — computed from FANS data
// ═══════════════════════════════════════════════
function updateMatchBanner() {
  const linked   = FANS.filter(f => f.global_fan_id);
  const tktOnly  = FANS.filter(f => f.linked_sources === 'TICKET').length;
  const scanOnly = FANS.filter(f => f.linked_sources === 'SCAN').length;
  const fnbOnly  = FANS.filter(f => f.linked_sources === 'FNB').length;
  const avgConf  = linked.reduce((s, f) => s + (f.match_confidence_score || 0), 0) / linked.length;

  const el = id => document.getElementById(id);
  if (el('match-linked-count'))  el('match-linked-count').textContent  = linked.length.toLocaleString();
  if (el('match-confidence'))    el('match-confidence').innerHTML      = `<strong>Match confidence:</strong> ${Math.round(avgConf * 100)}%`;
  if (el('match-tkt-only'))      el('match-tkt-only').innerHTML        = `<strong>Ticket-only:</strong> ${tktOnly.toLocaleString()}`;
  if (el('match-scan-only'))     el('match-scan-only').innerHTML       = `<strong>Scan-only:</strong> ${scanOnly.toLocaleString()}`;
  if (el('match-fnb-only'))      el('match-fnb-only').innerHTML        = `<strong>F&amp;B-only:</strong> ${fnbOnly.toLocaleString()}`;
}

// ═══════════════════════════════════════════════
// GLOBAL FILTER: OPPONENT + SEASON AVG TOGGLE
// ═══════════════════════════════════════════════

// Populate opponent dropdown from GAMES (sorted alpha, unique)
(function populateOpponentSelect() {
  const opponents = [...new Set(GAMES.map(g => g.opponent))].sort();
  const sel = document.getElementById('g-opponent');
  opponents.forEach(opp => {
    const opt = document.createElement('option');
    opt.value = opp;
    opt.textContent = opp;
    sel.appendChild(opt);
  });
})();

function updateSeasonAvgVisibility() {
  const group = document.getElementById('g-seasonAvg-group');
  if (group) group.style.display = STATE.opponent === 'all' ? 'none' : '';
}

document.getElementById('g-opponent').addEventListener('change', e => {
  STATE.opponent = e.target.value;
  updateSeasonAvgVisibility();
  renderTab(STATE.activeTab);
});

document.getElementById('g-seasonAvg').addEventListener('change', e => {
  STATE.showSeasonAvg = e.target.checked;
  renderTab(STATE.activeTab);
});

// ═══════════════════════════════════════════════
// TAB FILTER WIRING
// ═══════════════════════════════════════════════
const FILTER_KEY_MAP = {}; // elId → stateKey, populated by wireFilter calls below

function wireFilter(elId, stateTab, stateKey) {
  FILTER_KEY_MAP[elId] = stateKey;
  const el = document.getElementById(elId);
  if (!el) return;
  el.addEventListener('change', () => {
    STATE[stateTab][stateKey] = el.value;
    renderTab(STATE.activeTab);
  });
}

// Tab 1 — Gate Access
wireFilter('t1-dateRange', 'tab1', 'dateRange');
wireFilter('t1-dayType',   'tab1', 'dayType');
wireFilter('t1-promo',     'tab1', 'promo');

// Tab 2 — Ticket Sales
wireFilter('t2-dateRange',   'tab2', 'dateRange');
wireFilter('t2-dayType',     'tab2', 'dayType');
wireFilter('t2-ticketType',  'tab2', 'ticketType');

// Tab 3 — Food & Beverage
wireFilter('t3-dateRange',   'tab3', 'dateRange');
wireFilter('t3-dayType',     'tab3', 'dayType');
wireFilter('t3-fnbCategory', 'tab3', 'fnbCategory');

document.getElementById('t3-back-link').addEventListener('click', e => {
  e.preventDefault();
  STATE.tab3.fnbDrilldown = null;
  renderTab3();
});

// Tab 4 — Fan Identity
wireFilter('t4-dateRange',    'tab4', 'dateRange');
wireFilter('t4-segment',      'tab4', 'segment');
wireFilter('t4-linkedStatus', 'tab4', 'linkedStatus');

// ═══════════════════════════════════════════════
// RESET BUTTONS
// ═══════════════════════════════════════════════
const TAB_DEFAULTS = {
  tab1: { dateRange: 'full_season', dayType: 'all', promo: 'all', gate: null },
  tab2: { dateRange: 'full_season', dayType: 'all', ticketType: 'all' },
  tab3: { dateRange: 'full_season', dayType: 'all', fnbCategory: 'all', fnbDrilldown: null },
  tab4: { dateRange: 'full_season', segment: 'all_linked', linkedStatus: 'linked_only' },
};

function resetTab(tabId) {
  Object.assign(STATE[tabId], TAB_DEFAULTS[tabId]);
  document.querySelectorAll(`#${tabId} .filter-select`).forEach(sel => {
    const key = FILTER_KEY_MAP[sel.id];
    if (key === undefined) return;
    sel.value = STATE[tabId][key] ?? 'all';
  });
  renderTab(tabId);
}

document.getElementById('t1-reset').addEventListener('click', () => resetTab('tab1'));

// Gate click-to-filter on Tab 1 gate heatmap
document.addEventListener('click', evt => {
  const marker = evt.target.closest('#t1-gateHeatmap .gate-marker');
  if (!marker) return;
  const gate = marker.dataset.gate;
  STATE.tab1.gate = STATE.tab1.gate === gate ? null : gate;
  renderTab1();
});
document.getElementById('t2-reset').addEventListener('click', () => resetTab('tab2'));
document.getElementById('t3-reset').addEventListener('click', () => resetTab('tab3'));
document.getElementById('t4-reset').addEventListener('click', () => resetTab('tab4'));

// ═══════════════════════════════════════════════
// EXPORT BUTTONS (CSV)
// ═══════════════════════════════════════════════
function showExportEmpty() {
  const msg = document.createElement('div');
  msg.textContent = 'No data to export — adjust your filters.';
  msg.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#C0111F;color:#fff;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.2);';
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 3000);
}

function downloadCSV(rows, filename) {
  if (!rows.length) { showExportEmpty(); return; }
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

document.getElementById('t1-export').addEventListener('click', () => {
  const { focused } = filterGames(STATE.tab1);
  downloadCSV(getScanRows(focused.map(g => g.id)), 'rangers-gate-access.csv');
});
document.getElementById('t2-export').addEventListener('click', () => {
  const { focused } = filterGames(STATE.tab2);
  downloadCSV(getTicketRows(focused.map(g => g.id)), 'rangers-ticket-sales.csv');
});
document.getElementById('t3-export').addEventListener('click', () => {
  const { focused } = filterGames(STATE.tab3);
  downloadCSV(getFnbRows(focused.map(g => g.id)), 'rangers-fnb.csv');
});
document.getElementById('t4-export').addEventListener('click', () => {
  downloadCSV(filterFans(STATE.tab4, 'tab4'), 'rangers-fan-identity.csv');
});

// ═══════════════════════════════════════════════
// RENDER DISPATCHER
// ═══════════════════════════════════════════════
function renderTab(tabId) {
  if (tabId === 'tab1') renderTab1();
  else if (tabId === 'tab2') renderTab2();
  else if (tabId === 'tab3') renderTab3();
  else if (tabId === 'tab4') renderTab4();
}

// ── Initial startup checks ──
(function smokeTest() {
  const errors = [];
  const hg = SCHEDULE_PRESET.homeGames;
  if (GAMES.length !== hg)                                    errors.push(`GAMES: expected ${hg}, got ${GAMES.length}`);
  if (GAME_TICKETS.length !== hg)                             errors.push(`GAME_TICKETS: expected ${hg}`);
  if (GAME_SCANS.length !== hg)                               errors.push(`GAME_SCANS: expected ${hg}`);
  if (GAME_FNB.length !== hg)                                 errors.push(`GAME_FNB: expected ${hg}`);
  if (FANS.length !== 3000)                                    errors.push(`FANS: expected 3000, got ${FANS.length}`);
  if (FANS.filter(f => f.global_fan_id).length !== 2172)      errors.push(`Linked fans: expected 2172`);
  if (FANS.filter(f => f.linked_sources === 'SCAN|FNB').length !== 252) errors.push(`Dark fans: expected 252`);
  if (filterGames(STATE.tab1).focused.length === 0)           errors.push('filterGames returns empty on default state');
  if (filterFans(STATE.tab4, 'tab4').length === 0)            errors.push('filterFans tab4 returns empty');
  if (errors.length) {
    console.error('SMOKE TEST FAILURES:', errors);
  } else {
    console.log('✓ All startup checks passed');
  }
})();

// ── Initial render ──
renderTab('tab1');
updateMatchBanner();
