// ═══════════════════════════════════════════════
// CHART REGISTRY
// ═══════════════════════════════════════════════
const CHARTS = {};
function destroyChart(id) {
  if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; }
}

Chart.defaults.font.family = "'Lexend Deca', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#6B7280';

// Global tooltip polish
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10,20,50,0.96)';
Chart.defaults.plugins.tooltip.padding = { x: 12, y: 10 };
Chart.defaults.plugins.tooltip.borderColor = BRAND.accentSoft;
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleColor = '#fff';
Chart.defaults.plugins.tooltip.bodyColor = 'rgba(255,255,255,0.82)';
Chart.defaults.plugins.tooltip.footerColor = 'rgba(255,255,255,0.52)';
Chart.defaults.plugins.tooltip.cornerRadius = 6;
Chart.defaults.plugins.tooltip.caretSize = 5;
Chart.defaults.plugins.tooltip.boxPadding = 4;

const PALETTE = {
  navy:      BRAND.navy,
  navyMid:   BRAND.navyMid,
  navySoft:  BRAND.navySoft,
  navyPale:  BRAND.navyPale,
  navyGhost: BRAND.navyGhost,
  red:       BRAND.accent,
  redSoft:   BRAND.accentSoft,
  gray:      '#8B96A5',
  grayDim:   'rgba(139,150,165,0.40)',
  gray2:     '#C5CBD4',
  coral:     BRAND.accentRed,
};

// ── State choropleth map (reused by Tab 1 and Tab 4) ──────────────
function renderStateMap(containerId, stateDataMap, tooltipFn) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  const W = el.clientWidth || 600, H = el.clientHeight || 260;
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
  const projection = d3.geoAlbersUsa().fitSize([W, H], { type: 'Sphere' });
  const path = d3.geoPath().projection(projection);

  const maxVal = Math.max(1, ...Object.values(stateDataMap).map(d => d.count || 0));
  const colorScale = d3.scaleSequential([0, maxVal], t => `rgba(${BRAND.navyRgb},${0.06 + t * 0.85})`);

  d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json').then(us => {
    const features = topojson.feature(us, us.objects.states).features;
    const stateNames = {
      '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
      '12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS',
      '21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS',
      '29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY',
      '37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC',
      '46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
      '55':'WI','56':'WY',
    };
    document.querySelectorAll('.map-d3-tip').forEach(t => t.remove());
    const tip = document.createElement('div');
    tip.className = 'map-d3-tip';
    tip.style.cssText = 'position:fixed;background:rgba(10,20,50,0.97);color:rgba(255,255,255,0.92);padding:9px 13px;border-radius:6px;font-size:12px;line-height:1.6;pointer-events:none;display:none;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,0.40);border:1px solid rgba(192,17,31,0.28);';
    document.body.appendChild(tip);

    svg.selectAll('path')
      .data(features)
      .join('path')
      .attr('d', path)
      .attr('fill', d => {
        const abbr = stateNames[String(d.id).padStart(2,'0')];
        const data = stateDataMap[abbr];
        return data ? colorScale(data.count || 0) : '#EEF0F3';
      })
      .attr('stroke', '#fff').attr('stroke-width', 0.5)
      .on('mousemove', (evt, d) => {
        const abbr = stateNames[String(d.id).padStart(2,'0')];
        tip.innerHTML = tooltipFn(abbr, abbr, stateDataMap[abbr]);
        tip.style.display = 'block';
        tip.style.left = (evt.clientX + 12) + 'px';
        tip.style.top  = (evt.clientY - 28) + 'px';
      })
      .on('mouseleave', () => { tip.style.display = 'none'; });
  });
}

// ═══════════════════════════════════════════════
// TAB 1: GATE ACCESS
// ═══════════════════════════════════════════════
function renderTab1() {
  const f = STATE.tab1;
  const { mode, focused, baseline } = filterGames(f);

  const fIds = focused.map(g => g.id);
  const bIds = baseline ? baseline.map(g => g.id) : [];
  const fScans   = getScanRows(fIds);
  const fTickets = getTicketRows(fIds);
  const bScans   = baseline ? getScanRows(bIds) : [];

  // ── BANs ──
  const totalScanned   = fScans.reduce((s, r) => s + r.tickets_scanned, 0);
  const totalSold      = fTickets.reduce((s, r) => s + r.tickets_sold_total, 0);
  const avgAttendance  = fScans.length ? totalScanned / fScans.length : 0;
  const noShowRate     = totalSold > 0 ? (totalSold - totalScanned) / totalSold : 0;
  const earlyArrRate   = fScans.length
    ? fScans.reduce((s, r) => s + r.arr_90plus + r.arr_60to90, 0) / fScans.length : 0;
  const avgTixPerScan  = fScans.length
    ? fScans.reduce((s, r) => s + r.avg_tickets_per_scan, 0) / fScans.length : 0;
  const stmScanRate    = fScans.length
    ? fScans.reduce((s, r) => s + (1 - r.stm_no_show_rate), 0) / fScans.length : 0;

  const bAvgAttend   = bScans.length ? bScans.reduce((s, r) => s + r.tickets_scanned, 0) / bScans.length : 0;
  const bNoShowRate  = bScans.length ? bScans.reduce((s, r) => s + r.no_show_rate, 0) / bScans.length : 0;
  const bSTMScan     = bScans.length ? bScans.reduce((s, r) => s + (1 - r.stm_no_show_rate), 0) / bScans.length : 0;
  const bEarlyArr    = bScans.length ? bScans.reduce((s, r) => s + r.arr_90plus + r.arr_60to90, 0) / bScans.length : 0;
  const isFocused    = mode === 'focused' && bScans.length > 0;
  const deltaAttend  = isFocused && bAvgAttend   > 0 ? Math.round((avgAttendance / bAvgAttend  - 1) * 100) : undefined;
  const deltaNoShow  = isFocused && bNoShowRate  > 0 ? -Math.round((noShowRate - bNoShowRate)  * 1000) / 10 : undefined;
  const deltaSTM     = isFocused && bSTMScan     > 0 ? Math.round((stmScanRate / bSTMScan     - 1) * 100) : undefined;
  const deltaEarly   = isFocused && bEarlyArr    > 0 ? Math.round((earlyArrRate / bEarlyArr   - 1) * 100) : undefined;

  renderBANs('t1-bans', [
    { label: 'Season Attendance',          value: fmt.num(totalScanned) },
    { label: 'Avg Attendance / Game',      value: fmt.num(Math.round(avgAttendance)), delta: deltaAttend, deltaLabel: 'vs avg' },
    { label: 'No-Show Rate',               value: fmt.pct(noShowRate),                delta: deltaNoShow, deltaLabel: 'vs avg' },
    { label: 'Early Arrival Rate',         value: fmt.pct(earlyArrRate),              delta: deltaEarly,  deltaLabel: 'vs avg' },
    { label: 'Avg Tickets Per Scan',       value: avgTixPerScan.toFixed(1) },
    { label: `${TEAM.stmLabel} Scan Rate`, value: fmt.pct(stmScanRate), lead: true,   delta: deltaSTM,    deltaLabel: 'vs avg' },
  ]);

  // Full-season timeline for per-game time-series charts
  const tlGames = mode === 'focused'
    ? [...focused, ...(baseline || [])].sort((a, b) => a.date.localeCompare(b.date))
    : [...focused].sort((a, b) => a.date.localeCompare(b.date));
  const focusedSet = new Set(fIds);
  const tlScans   = mode === 'focused' ? getScanRows(tlGames.map(g => g.id))   : fScans;
  const tlTickets = mode === 'focused' ? getTicketRows(tlGames.map(g => g.id)) : fTickets;

  // ── Chart 1: Attendance vs. Tickets Sold by Game ──
  destroyChart('t1-attendanceByGame');
  const labels1    = tlGames.map(g => g.date.slice(5));
  const soldData   = tlGames.map(g => { const t = tlTickets.find(r => r.game_id === g.id); return t ? t.tickets_sold_total : 0; });
  const scanData   = tlGames.map(g => { const s = tlScans.find(r => r.game_id === g.id);   return s ? s.tickets_scanned : 0; });
  const barColors1 = tlGames.map(g =>
    mode === 'all'         ? PALETTE.navySoft :
    focusedSet.has(g.id)   ? PALETTE.redSoft  : PALETTE.grayDim
  );

  CHARTS['t1-attendanceByGame'] = new Chart(document.getElementById('t1-attendanceByGame'), {
    type: 'bar',
    data: { labels: labels1, datasets: [
      { label: mode === 'focused' ? `Sold (${STATE.opponent} highlighted)` : 'Tickets Sold',
        data: soldData, backgroundColor: barColors1, type: 'bar', borderRadius: 2 },
      { label: 'Tickets Scanned',
        data: scanData, borderColor: PALETTE.navy, backgroundColor: 'rgba(0,50,120,0.06)',
        type: 'line', pointRadius: 0, borderWidth: 2, tension: 0.2, fill: false },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            title: items => {
              const g = tlGames[items[0]?.dataIndex];
              return g ? `${g.date} vs. ${g.opponent}` : '';
            },
            afterBody: items => {
              const i = items[0]?.dataIndex;
              const s = tlScans.find(r => r.game_id === tlGames[i]?.id);
              return s ? [`No-show: ${fmt.num(s.no_show_count)}`] : [];
            },
          },
        },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 12 }, grid: { display: false } },
        y: { ticks: { callback: v => fmt.num(v) } },
      },
    },
  });

  // ── Chart 2: No-Show Rate by Game ──
  destroyChart('t1-noshowByGame');
  const seasonAvgNoShow = fScans.length ? fScans.reduce((s, r) => s + r.no_show_rate, 0) / fScans.length : 0;
  const noShowColors = tlGames.map(g => {
    const s = tlScans.find(r => r.game_id === g.id);
    if (!s) return 'rgba(0,0,0,0)';
    const above = s.no_show_rate > seasonAvgNoShow;
    if (mode === 'focused' && !focusedSet.has(g.id)) {
      return above ? 'rgba(192,17,31,0.28)' : 'rgba(139,150,165,0.25)';
    }
    return above ? PALETTE.red : PALETTE.gray;
  });

  CHARTS['t1-noshowByGame'] = new Chart(document.getElementById('t1-noshowByGame'), {
    type: 'bar',
    data: {
      labels: tlGames.map(g => g.date.slice(5)),
      datasets: [{
        label: 'No-Show Rate',
        data: tlGames.map(g => { const s = tlScans.find(r => r.game_id === g.id); return s ? s.no_show_rate : 0; }),
        backgroundColor: noShowColors,
        borderRadius: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: {
            avgLine: {
              type: 'line', yMin: seasonAvgNoShow, yMax: seasonAvgNoShow,
              borderColor: PALETTE.navy, borderWidth: 1.5, borderDash: [4, 4],
              label: {
                content: `Season avg ${fmt.pct(seasonAvgNoShow)}`,
                display: true, position: 'end',
                font: { size: 10, weight: '600', family: "'Lexend Deca'" },
                color: PALETTE.navy,
                backgroundColor: 'rgba(255,255,255,0.88)',
                padding: { x: 6, y: 3 }, borderRadius: 3,
              },
            },
          },
        },
        tooltip: {
          callbacks: {
            title: items => {
              const g = tlGames[items[0]?.dataIndex];
              return g ? `${g.date} vs. ${g.opponent}` : '';
            },
            label: ctx => {
              const diff = ctx.raw - seasonAvgNoShow;
              const sign = diff >= 0 ? '+' : '−';
              return `No-show: ${fmt.pct(ctx.raw)}  (${sign}${fmt.pct(Math.abs(diff))} vs. avg)`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 12 }, grid: { display: false } },
        y: { ticks: { callback: v => fmt.pct(v) }, max: 0.18 },
      },
    },
  });

  // ── Chart 3: Arrival Distribution ──
  destroyChart('t1-arrivalDist');
  const arrBuckets = ['arr_90plus', 'arr_60to90', 'arr_30to60', 'arr_0to30', 'arr_post_pitch'];
  const arrLabels  = ['90+ min early', '60–90 min', '30–60 min', '0–30 min', 'After first pitch'];
  const arrColors  = ['#CF0A2C', '#1A1A1A', '#4B5563', '#9CA3AF', '#D1D5DB'];
  const arrDatasets3 = [];

  if (mode === 'all') {
    const months = [...new Set(focused.map(g => g.month))].sort((a, b) => a - b);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthLabels3 = months.map(m => monthNames[m]);
    arrBuckets.forEach((bucket, bi) => {
      arrDatasets3.push({
        label: arrLabels[bi],
        data: months.map(m => {
          const rows = fScans.filter(r => {
            const g = GAME_BY_ID[r.game_id];
            return g && g.month === m;
          });
          return rows.length ? rows.reduce((s, r) => s + r[bucket], 0) / rows.length : 0;
        }),
        backgroundColor: arrColors[bi],
      });
    });
    CHARTS['t1-arrivalDist'] = new Chart(document.getElementById('t1-arrivalDist'), {
      type: 'bar',
      data: { labels: monthLabels3, datasets: arrDatasets3 },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              title: items => {
                const m = months[items[0]?.dataIndex];
                return monthNames[m] + ' — Arrival Distribution';
              },
              label: ctx => `${ctx.dataset.label}: ${fmt.pct(ctx.raw)}`,
            },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, ticks: { callback: v => fmt.pct(v) }, max: 1 },
        },
      },
    });
  } else {
    const focusedAvg = arrBuckets.map(b => fScans.length ? fScans.reduce((s, r) => s + r[b], 0) / fScans.length : 0);
    const baselineAvg = arrBuckets.map(b => bScans.length ? bScans.reduce((s, r) => s + r[b], 0) / bScans.length : 0);
    arrBuckets.forEach((_, bi) => {
      arrDatasets3.push({
        label: arrLabels[bi],
        data: [focusedAvg[bi], STATE.showSeasonAvg ? baselineAvg[bi] : null],
        backgroundColor: arrColors[bi],
        stack: 'arrival',
      });
    });
    CHARTS['t1-arrivalDist'] = new Chart(document.getElementById('t1-arrivalDist'), {
      type: 'bar',
      data: { labels: [STATE.opponent, 'Season Avg'], datasets: arrDatasets3 },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, ticks: { callback: v => fmt.pct(v) }, max: 1 },
        },
      },
    });
  }

  // ── Chart 4: No-Show Rate by Ticket Type (aggregate horizontal bar) ──
  destroyChart('t1-noshowByType');
  const stmNS    = fScans.reduce((s, r) => s + r.stm_no_show_rate, 0) / (fScans.length || 1);
  const singleNS = fScans.reduce((s, r) => s + r.single_no_show_rate, 0) / (fScans.length || 1);
  const secNS    = fScans.reduce((s, r) => s + r.secondary_no_show_rate, 0) / (fScans.length || 1);

  CHARTS['t1-noshowByType'] = new Chart(document.getElementById('t1-noshowByType'), {
    type: 'bar',
    data: {
      labels: [TEAM.stmLabel, 'Single Game', 'Secondary Market'],
      datasets: [{
        label: 'No-Show Rate',
        data: [stmNS, singleNS, secNS],
        backgroundColor: ['#00897B', '#6B7280', '#CF0A2C'],
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const ratio = ctx.dataIndex === 2 ? (secNS / stmNS).toFixed(1) : null;
              return ratio
                ? `${fmt.pct(ctx.raw)} — ${ratio}× the ${TEAM.stmLabel} rate`
                : fmt.pct(ctx.raw);
            },
          },
        },
      },
      scales: {
        x: { ticks: { callback: v => fmt.pct(v) } },
        y: { grid: { display: false } },
      },
    },
  });

  // ── Chart 5: STM Scan Rate by Month ──
  destroyChart('t1-stmScanRate');
  const months5 = [...new Set(focused.map(g => g.month))].sort((a, b) => a - b);
  const monthNames5 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const stmByMonth = months5.map(m => {
    const rows = fScans.filter(r => { const g = GAME_BY_ID[r.game_id]; return g && g.month === m; });
    return rows.length ? rows.reduce((s, r) => s + (1 - r.stm_no_show_rate), 0) / rows.length : 0;
  });

  CHARTS['t1-stmScanRate'] = new Chart(document.getElementById('t1-stmScanRate'), {
    type: 'line',
    data: {
      labels: months5.map(m => monthNames5[m]),
      datasets: [{
        label: `${TEAM.stmLabel} Scan Rate`,
        data: stmByMonth,
        borderColor: PALETTE.navy,
        backgroundColor: `rgba(0,50,120,0.07)`,
        fill: true, pointRadius: 4, borderWidth: 2, tension: 0.3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: {
            targetLine: {
              type: 'line', yMin: 0.95, yMax: 0.95,
              borderColor: '#6B7280', borderWidth: 1.5, borderDash: [4, 4],
              label: {
                content: '95% target',
                display: true, position: 'end',
                font: { size: 9, weight: '600', family: "'Lexend Deca'" },
                color: '#6B7280',
                backgroundColor: 'rgba(255,255,255,0.88)',
                padding: { x: 5, y: 2 }, borderRadius: 3,
              },
            },
          },
        },
        tooltip: {
          callbacks: {
            title: items => {
              const m = months5[items[0]?.dataIndex];
              return monthNames5[m] + ` — ${TEAM.stmLabel} Scan Rate`;
            },
            label: ctx => {
              const avg = stmByMonth.reduce((a, b) => a + b, 0) / (stmByMonth.length || 1);
              const diff = ctx.raw - avg;
              const vsTarget = ctx.raw - 0.95;
              const sign = diff >= 0 ? '+' : '−';
              const tSign = vsTarget >= 0 ? '+' : '−';
              return [
                `${fmt.pct(ctx.raw)} scan rate`,
                `${sign}${fmt.pct(Math.abs(diff))} vs. season avg`,
                `${tSign}${fmt.pct(Math.abs(vsTarget))} vs. 95% target`,
              ];
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: v => fmt.pct(v) }, min: 0.75, max: 1.0 },
      },
    },
  });

  // ── Chart 6: Group Scan Distribution (donut) ──
  destroyChart('t1-groupScanDist');
  const soloAvg    = fScans.length ? fScans.reduce((s, r) => s + r.solo_scan_pct, 0) / fScans.length : 0;
  const group23Avg = fScans.length ? fScans.reduce((s, r) => s + r.group_2to3_pct, 0) / fScans.length : 0;
  const group4Avg  = fScans.length ? fScans.reduce((s, r) => s + r.group_4plus_pct, 0) / fScans.length : 0;

  const _donutCenterPlugin = {
    id: 'donutCenter',
    afterDraw(chart) {
      if (chart.config.type !== 'doughnut') return;
      const { ctx, chartArea } = chart;
      const cx = chartArea.left + chartArea.width  / 2;
      const cy = chartArea.top  + chartArea.height / 2;
      const data   = chart.data.datasets[0].data;
      const colors = chart.data.datasets[0].backgroundColor;
      const labels = chart.data.labels;
      const total  = data.reduce((s, v) => s + v, 0) || 1;
      const maxIdx = data.reduce((mi, v, i, a) => v > a[mi] ? i : mi, 0);
      const pct    = Math.round(data[maxIdx] / total * 100);
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(chartArea.height * 0.14)}px "Lexend Deca",system-ui,sans-serif`;
      ctx.fillStyle = colors[maxIdx];
      ctx.fillText(pct + '%', cx, cy - chartArea.height * 0.06);
      ctx.font = `500 ${Math.round(chartArea.height * 0.085)}px "Lexend Deca",system-ui,sans-serif`;
      ctx.fillStyle = '#6B7280';
      ctx.fillText(labels[maxIdx].split(' ')[0], cx, cy + chartArea.height * 0.09);
      ctx.restore();
    },
  };
  CHARTS['t1-groupScanDist'] = new Chart(document.getElementById('t1-groupScanDist'), { plugins: [_donutCenterPlugin],
    type: 'doughnut',
    data: {
      labels: ['Solo (1 ticket)', 'Small Group (2–3)', 'Large Group (4+)'],
      datasets: [{ data: [soloAvg, group23Avg, group4Avg],
                   backgroundColor: ['#CF0A2C', '#1A1A1A', '#9CA3AF'], borderWidth: 0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              return `${ctx.label}: ${fmt.pct(ctx.raw / total)}`;
            },
          },
        },
      },
    },
  });

  // ── Chart 7: Gate Entry Heatmap (SVG) ──
  const fanScans   = FANS.filter(x => x.gate_entry != null);
  const gateCounts = Object.fromEntries(VENUE.gates.map(g => [g, 0]));
  fanScans.forEach(x => { gateCounts[x.gate_entry] = (gateCounts[x.gate_entry] || 0) + 1; });

  const totalScans = Object.values(gateCounts).reduce((a, b) => a + b, 0);
  const maxCount   = Math.max(...Object.values(gateCounts));

  // Color scale: white → navy (sqrt for spread across low-volume gates)
  const gateColorScale = v => {
    const t = maxCount > 0 ? Math.sqrt(v / maxCount) : 0;
    const r = Math.round(255 - t * 255);
    const g = Math.round(255 - t * 207);
    const b = Math.round(255 - t * 120);
    return `rgb(${r},${g},${b})`;
  };
  const rBase = 20, rMax = 36;
  const gateRadiusScale = v => maxCount > 0 ? rBase + (v / maxCount) * (rMax - rBase) : rBase;

  // Pre-compute arrival distribution per gate from fan records
  const ARR_BUCKETS = ['90plus','60to90','30to60','0to30','post_pitch'];
  const ARR_LABELS  = ['90+ min','60–90','30–60','0–30 min','Post-pitch'];
  const gateArrival = {};
  VENUE.gates.forEach(g => {
    const gFans = fanScans.filter(x => x.gate_entry === g);
    const n = gFans.length || 1;
    gateArrival[g] = ARR_BUCKETS.map((b, i) => ({
      label: ARR_LABELS[i],
      pct:   gFans.filter(x => x.avg_arrival_bucket === b).length / n,
    }));
  });

  const buildGateTip = (gate, count) => {
    const pct    = totalScans > 0 ? count / totalScans : 0;
    const arr    = gateArrival[gate] || [];
    const maxPct = Math.max(...arr.map(a => a.pct), 0.01);
    const bars   = arr.map(a => {
      const pW = Math.round((a.pct / maxPct) * 100);
      return `<div style="display:flex;align-items:center;gap:5px;margin-top:4px">
        <span style="color:rgba(255,255,255,0.50);font-size:9px;width:52px;text-align:right;flex-shrink:0">${a.label}</span>
        <div style="flex:1;background:rgba(255,255,255,0.10);border-radius:2px;height:7px;overflow:hidden">
          <div style="background:#c41e3a;height:100%;width:${pW}%;min-width:2px;border-radius:2px"></div>
        </div>
        <span style="color:rgba(255,255,255,0.75);font-size:9px;width:30px;text-align:right">${fmt.pct(a.pct)}</span>
      </div>`;
    }).join('');
    return `<strong style="font-size:12px">${gate}</strong>
      <div style="color:rgba(255,255,255,0.65);font-size:10px;margin-top:2px">${fmt.num(count)} scans &nbsp;·&nbsp; ${fmt.pct(pct)} of season total</div>
      <div style="margin-top:9px;font-size:9px;color:rgba(255,255,255,0.45);letter-spacing:0.06em;text-transform:uppercase">Arrival Distribution</div>
      ${bars}`;
  };

  const host = document.getElementById('t1-gateHeatmap');
  if (host) {
    // Sections are context, not signal — keep them neutral so gate bubbles dominate
    host.querySelectorAll('.section-zone').forEach(el => el.setAttribute('fill', '#E5E7EB'));

    host.querySelectorAll('.gate-marker').forEach(el => {
      const gate   = el.dataset.gate;
      const count  = gateCounts[gate] || 0;
      const r      = gateRadiusScale(count);
      const isDark = count > maxCount * 0.25;

      el.setAttribute('fill',   gateColorScale(count));
      el.setAttribute('r',      r.toFixed(1));
      el.setAttribute('stroke', 'white');

      // Count label inside circle (skip if count is 0)
      const lid = 'glf-glbl-' + gate.replace(/\W+/g, '-');
      let lbl = host.querySelector('#' + lid);
      if (!lbl) {
        lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        lbl.id = lid;
        lbl.setAttribute('text-anchor', 'middle');
        lbl.setAttribute('dominant-baseline', 'central');
        lbl.setAttribute('font-weight', '700');
        lbl.setAttribute('font-family', "'Lexend Deca',system-ui,sans-serif");
        lbl.setAttribute('pointer-events', 'none');
        el.parentNode.appendChild(lbl);
      }
      lbl.setAttribute('x', el.getAttribute('cx'));
      lbl.setAttribute('y', el.getAttribute('cy'));
      lbl.setAttribute('fill', isDark ? 'white' : '#003087');
      lbl.setAttribute('font-size', r > 26 ? '11' : '9.5');
      lbl.textContent = count > 0
        ? (count > 999 ? (count / 1000).toFixed(1) + 'k' : String(count))
        : '';
    });

    // Nudge gate name labels to track bubble radius.
    // Direction is computed from gate position vs SVG center — works for any team's gate layout.
    const LABEL_GAP    = 8;
    const LABEL_LINE_H = 11;
    const SVG_CX = 450, SVG_CY = 400;

    host.querySelectorAll('.gate-marker').forEach(circ => {
      const cx = parseFloat(circ.getAttribute('cx'));
      const cy = parseFloat(circ.getAttribute('cy'));
      const r  = parseFloat(circ.getAttribute('r'));

      const ddx = cx - SVG_CX, ddy = cy - SVG_CY;
      const side = Math.abs(ddx) > Math.abs(ddy)
        ? (ddx > 0 ? 'right' : 'left')
        : (ddy > 0 ? 'below' : 'above');

      const texts = [];
      let sib = circ.nextElementSibling;
      while (sib && sib.tagName.toLowerCase() === 'text' && texts.length < 2) {
        texts.push(sib); sib = sib.nextElementSibling;
      }

      if (side === 'above') {
        const y2 = cy - r - LABEL_GAP;
        const y1 = y2 - LABEL_LINE_H;
        if (texts[0]) { texts[0].setAttribute('x', cx); texts[0].setAttribute('y', y1); }
        if (texts[1]) { texts[1].setAttribute('x', cx); texts[1].setAttribute('y', y2); }
      } else if (side === 'below') {
        const y1 = cy + r + LABEL_GAP + LABEL_LINE_H;
        if (texts[0]) { texts[0].setAttribute('x', cx); texts[0].setAttribute('y', y1); }
      } else if (side === 'right') {
        const x = cx + r + LABEL_GAP;
        if (texts[0]) { texts[0].setAttribute('x', x); texts[0].setAttribute('y', cy - 4); }
        if (texts[1]) { texts[1].setAttribute('x', x); texts[1].setAttribute('y', cy + LABEL_LINE_H - 4); }
      } else {
        const x = cx - r - LABEL_GAP;
        if (texts[0]) { texts[0].setAttribute('x', x); texts[0].setAttribute('y', cy - 4); }
        if (texts[1]) { texts[1].setAttribute('x', x); texts[1].setAttribute('y', cy + LABEL_LINE_H - 4); }
      }
    });

    // Gate click visual state — highlight active gate, dim others
    const activeGate = STATE.tab1.gate;
    const pill = document.getElementById('t1-gate-pill');
    if (activeGate) {
      host.querySelectorAll('.gate-marker').forEach(circ => {
        const isActive = circ.dataset.gate === activeGate;
        circ.setAttribute('opacity',      isActive ? '1'   : '0.35');
        circ.setAttribute('stroke-width', isActive ? '4'   : '2.5');
      });
      if (pill) {
        pill.textContent = `Filtering: ${activeGate} — click gate to clear`;
        pill.style.display = 'block';
      }
    } else {
      host.querySelectorAll('.gate-marker').forEach(circ => {
        circ.setAttribute('opacity',      '1');
        circ.setAttribute('stroke-width', '2.5');
      });
      if (pill) pill.style.display = 'none';
    }

    // Styled tooltip with sparkline — event delegation
    document.querySelectorAll('.glf-gate-tip').forEach(t => t.remove());
    const gateTip = document.createElement('div');
    gateTip.className = 'glf-gate-tip';
    gateTip.style.cssText = 'position:fixed;background:rgba(10,20,50,0.97);color:rgba(255,255,255,0.92);padding:11px 15px;border-radius:7px;font-size:11.5px;line-height:1.6;pointer-events:none;display:none;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,0.45);border:1px solid rgba(192,17,31,0.30);min-width:200px;';
    document.body.appendChild(gateTip);

    host.addEventListener('mousemove', evt => {
      const tgt = evt.target.closest('.gate-marker');
      if (!tgt) { gateTip.style.display = 'none'; return; }
      const gate  = tgt.dataset.gate;
      const count = gateCounts[gate] || 0;
      gateTip.innerHTML = buildGateTip(gate, count);
      gateTip.style.display = 'block';
      const _tipW = 230, _tipH = 180;
      gateTip.style.left = Math.min(evt.clientX + 16, window.innerWidth  - _tipW - 8) + 'px';
      gateTip.style.top  = Math.max(8, Math.min(evt.clientY - 40, window.innerHeight - _tipH - 8)) + 'px';
    });
    host.addEventListener('mouseleave', () => { gateTip.style.display = 'none'; });
  }
}

// ═══════════════════════════════════════════════
// TAB 2: TICKET SALES
// ═══════════════════════════════════════════════
function renderTab2() {
  const f = STATE.tab2;
  const { mode, focused, baseline } = filterGames(f);

  const fIds     = focused.map(g => g.id);
  const fTickets = getTicketRows(fIds);
  const fScans   = getScanRows(fIds);
  const fans2    = filterFans(f, 'tab2');

  // ── BANs ──
  const totalSold   = fTickets.reduce((s, r) => s + r.tickets_sold_total, 0);
  const totalRev    = fTickets.reduce((s, r) => s + r.gross_revenue, 0);
  const avgTktVal   = totalSold > 0 ? totalRev / totalSold : 0;
  const secShare    = fTickets.length ? fTickets.reduce((s, r) => s + r.secondary_market_share, 0) / fTickets.length : 0;
  const stmScanRate = fScans.length ? fScans.reduce((s, r) => s + (1 - r.stm_no_show_rate), 0) / fScans.length : 0;
  const stateCount  = {};
  fans2.forEach(f2 => { if (f2.ticket_state) stateCount[f2.ticket_state] = (stateCount[f2.ticket_state] || 0) + 1; });
  const topState = Object.entries(stateCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'TX';

  renderBANs('t2-bans', [
    { label: 'Tickets Sold',               value: fmt.num(totalSold) },
    { label: 'Gross Revenue',              value: fmt.currency(totalRev) },
    { label: 'Avg Ticket Value',           value: '$' + Math.round(avgTktVal) },
    { label: 'Secondary Market Share',     value: fmt.pct(secShare) },
    { label: `${TEAM.stmLabel} Scan Rate`, value: fmt.pct(stmScanRate) },
    { label: 'Top State',                  value: topState, lead: true },
  ]);

  // Full-season timeline for Tab 2 time-series charts
  const tlGames2    = mode === 'focused'
    ? [...focused, ...(baseline || [])].sort((a, b) => a.date.localeCompare(b.date))
    : [...focused].sort((a, b) => a.date.localeCompare(b.date));
  const focusedSet2 = new Set(fIds);
  const tlTickets2  = mode === 'focused' ? getTicketRows(tlGames2.map(g => g.id)) : fTickets;
  const sortedGames2 = tlGames2;

  // ── Chart 1: Tickets Sold by Game (line) ──
  destroyChart('t2-soldByGame');
  const soldByGame    = tlGames2.map(g => { const t = tlTickets2.find(r => r.game_id === g.id); return t ? t.tickets_sold_total : 0; });
  const ptColors2     = tlGames2.map(g => mode === 'focused' && focusedSet2.has(g.id) ? PALETTE.red : 'transparent');
  const ptRadii2      = tlGames2.map(g => mode === 'focused' && focusedSet2.has(g.id) ? 5 : 0);
  const datasets21    = [{ label: 'Tickets Sold', data: soldByGame, borderColor: PALETTE.navy,
                            backgroundColor: 'rgba(0,50,120,0.07)', fill: true,
                            pointBackgroundColor: ptColors2, pointBorderColor: ptColors2,
                            pointRadius: ptRadii2, borderWidth: 2, tension: 0.2 }];
  if (mode === 'focused' && STATE.showSeasonAvg) {
    const bAvg = fTickets.length ? fTickets.reduce((s, r) => s + r.tickets_sold_total, 0) / fTickets.length : 0;
    datasets21.push({ label: 'Season Avg', data: tlGames2.map(() => bAvg),
                      borderColor: PALETTE.grayDim, borderDash: [4, 4], pointRadius: 0, borderWidth: 1, fill: false });
  }

  CHARTS['t2-soldByGame'] = new Chart(document.getElementById('t2-soldByGame'), {
    type: 'line',
    data: { labels: tlGames2.map(g => g.date.slice(5)), datasets: datasets21 },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            title: items => { const g = tlGames2[items[0]?.dataIndex]; return g ? `${g.date} vs. ${g.opponent}` : ''; },
            afterBody: items => {
              const i = items[0]?.dataIndex;
              const t = tlTickets2.find(r => r.game_id === tlGames2[i]?.id);
              return t ? [`STM: ${fmt.num(t.stm_tickets)}  Single: ${fmt.num(t.single_tickets)}  Secondary: ${fmt.num(t.secondary_tickets)}`] : [];
            },
          },
        },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 12 }, grid: { display: false } },
        y: { ticks: { callback: v => fmt.num(v) } },
      },
    },
  });

  // ── Chart 2: Revenue by Ticket Type (stacked bar by game) ──
  destroyChart('t2-revByType');
  CHARTS['t2-revByType'] = new Chart(document.getElementById('t2-revByType'), {
    type: 'bar',
    data: {
      labels: sortedGames2.map(g => g.date.slice(5)),
      datasets: [
        { label: TEAM.stmLabel, data: sortedGames2.map(g => { const t = tlTickets2.find(r => r.game_id === g.id); return t ? t.stm_revenue : 0; }), backgroundColor: PALETTE.navy, borderRadius: 2 },
        { label: 'Single Game',      data: sortedGames2.map(g => { const t = tlTickets2.find(r => r.game_id === g.id); return t ? t.single_revenue : 0; }), backgroundColor: PALETTE.navySoft },
        { label: 'Secondary Market', data: sortedGames2.map(g => { const t = tlTickets2.find(r => r.game_id === g.id); return t ? t.secondary_revenue : 0; }), backgroundColor: PALETTE.gray },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            title: items => { const g = sortedGames2[items[0]?.dataIndex]; return g ? `${g.date} vs. ${g.opponent}` : ''; },
            label: ctx => {
              const i = ctx.dataIndex;
              const t = tlTickets2.find(r => r.game_id === sortedGames2[i]?.id);
              if (!t) return fmt.currency(ctx.raw);
              const total = t.stm_revenue + t.single_revenue + t.secondary_revenue;
              const pct = total > 0 ? fmt.pct(ctx.raw / total) : '';
              return `${ctx.dataset.label}: ${fmt.currency(ctx.raw)}  (${pct})`;
            },
            footer: () => ['Secondary market revenue is estimated from scan matching'],
          },
        },
      },
      scales: {
        x: { stacked: true, ticks: { maxTicksLimit: 12 }, grid: { display: false } },
        y: { stacked: true, ticks: { callback: v => fmt.currency(v) } },
      },
    },
  });

  // ── Chart 3: Avg Ticket Value by Opponent (horizontal bar, all opponents) ──
  destroyChart('t2-avgValueByOpponent');
  const oppMap = {};
  GAME_TICKETS.forEach(t => {
    const g = GAME_BY_ID[t.game_id];
    if (!g) return;
    if (!oppMap[g.opponent]) oppMap[g.opponent] = { total: 0, count: 0 };
    oppMap[g.opponent].total += t.avg_ticket_value;
    oppMap[g.opponent].count++;
  });
  const oppSorted = Object.entries(oppMap)
    .map(([opp, d]) => ({ opp, avg: Math.round(d.total / d.count) }))
    .sort((a, b) => b.avg - a.avg);

  CHARTS['t2-avgValueByOpponent'] = new Chart(document.getElementById('t2-avgValueByOpponent'), {
    type: 'bar',
    data: {
      labels: oppSorted.map(d => d.opp),
      datasets: [{
        label: 'Avg Ticket Value',
        data: oppSorted.map(d => d.avg),
        backgroundColor: oppSorted.map(d => d.opp === STATE.opponent ? PALETTE.redSoft : PALETTE.navy),
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => {
          const avg = Math.round(oppSorted.reduce((s, d) => s + d.avg, 0) / (oppSorted.length || 1));
          const diff = ctx.raw - avg;
          const sign = diff >= 0 ? '+' : '−';
          return [`Avg: ${fmt.currency(ctx.raw)}`, `${sign}$${Math.abs(Math.round(diff))} vs. opponent avg`];
        },
      }}},
      scales: { x: { ticks: { callback: v => '$' + v } }, y: { ticks: { font: { size: 11 } }, grid: { display: false } } },
    },
  });

  // ── Chart 4: Secondary Market Share by Game Tier (grouped bar) ──
  destroyChart('t2-secondaryByTier');
  const tiers = ['featured', 'select', 'standard'];
  const tierLabels = ['Featured', 'Select', 'Standard'];
  const tierSecShare = tiers.map(tier => {
    const rows = GAME_TICKETS.filter(t => GAME_BY_ID[t.game_id]?.game_tier === tier);
    return rows.length ? rows.reduce((s, r) => s + r.secondary_market_share, 0) / rows.length : 0;
  });

  CHARTS['t2-secondaryByTier'] = new Chart(document.getElementById('t2-secondaryByTier'), {
    type: 'bar',
    data: {
      labels: tierLabels,
      datasets: [{ label: 'Secondary Market Share', data: tierSecShare,
                   backgroundColor: ['#CF0A2C', '#6B7280', '#D1D5DB'], borderRadius: 4}],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => {
          const seasonAvg = fTickets.reduce((s, r) => s + r.secondary_market_share, 0) / (fTickets.length || 1);
          const diff = ctx.raw - seasonAvg;
          const sign = diff >= 0 ? '+' : '−';
          return [`Secondary share: ${fmt.pct(ctx.raw)}`, `${sign}${fmt.pct(Math.abs(diff))} vs. season avg`];
        },
      }}},
      scales: { x: { grid: { display: false } }, y: { ticks: { callback: v => fmt.pct(v) } } },
    },
  });

  // ── Chart 5: Purchase Timing — Days in Advance by Ticket Type (grouped bar) ──
  destroyChart('t2-purchaseTiming');
  const timingBuckets = ['0–3 days', '4–7 days', '8–14 days', '15–30 days', '30+ days'];
  const timingDist = (type) => {
    const rows = GAME_TICKETS;
    const avg = rows.reduce((s, r) => {
      if (type === 'stm') return s + 90;
      if (type === 'single_game') return s + r.avg_days_in_advance;
      return s + Math.max(1, r.avg_days_in_advance * 0.3);
    }, 0) / rows.length;
    const center = Math.min(4, Math.max(0, Math.round(avg / 10)));
    return timingBuckets.map((_, i) => {
      const dist = Math.exp(-0.5 * Math.pow(i - center, 2) / 1.5);
      return parseFloat(dist.toFixed(3));
    });
  };

  CHARTS['t2-purchaseTiming'] = new Chart(document.getElementById('t2-purchaseTiming'), {
    type: 'bar',
    data: {
      labels: timingBuckets,
      datasets: [
        { label: TEAM.stmLabel,       data: timingDist('stm'),         backgroundColor: PALETTE.navy,    borderRadius: 3 },
        { label: 'Single Game',      data: timingDist('single_game'), backgroundColor: PALETTE.navySoft, borderRadius: 3 },
        { label: 'Secondary Market', data: timingDist('secondary'),   backgroundColor: PALETTE.gray,    borderRadius: 3 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        annotation: {
          annotations: {
            dayOfZone: {
              type: 'box',
              xMin: '0\u20133 days', xMax: '0\u20133 days',
              backgroundColor: 'rgba(192,17,31,0.07)',
              borderWidth: 0,
              label: {
                display: true, content: '~13% day-of',
                position: { x: 'center', y: 'end' },
                font: { size: 9, weight: '600' }, color: BRAND.accent,
                backgroundColor: 'rgba(255,255,255,0.92)',
                borderRadius: 3,
                padding: { x: 5, y: 3 },
              },
            },
          },
        },
      },
      scales: { x: { grid: { display: false } }, y: { ticks: { callback: v => (v * 100).toFixed(0) + '%' } } },
    },
  });

  // ── Chart 5.5: Ticket Pacing — Upcoming Games vs. Target ──
  destroyChart('t2-ticketPacing');
  const upcomingPacing = UPCOMING_PACING.map(d => {
    const target = d.daysUntil >= 17 ? 78 : d.daysUntil >= 4 ? 70 : 88;
    const gap    = d.pctSold - target;
    return {
      label:    `${d.opponent.split(' ').pop()} · ${d.date.slice(5).replace('-','/')} · ${d.daysUntil}d`,
      pctSold:  d.pctSold, target, gap,
      color:    gap >= 0 ? BRAND.navySoft : gap >= -10 ? PALETTE.gray : BRAND.accent,
      opponent: d.opponent, date: d.date, daysUntil: d.daysUntil,
    };
  });

  const pacingLabelPlugin = {
    id: 't2PacingLabels',
    afterDatasetsDraw(chart) {
      const { ctx, scales } = chart;
      const meta = chart.getDatasetMeta(0);
      meta.data.forEach((bar, i) => {
        const val = chart.data.datasets[0].data[i];
        const x0  = scales.x.getPixelForValue(0);
        const barW = bar.x - x0;
        ctx.save();
        if (barW > 36) {
          ctx.fillStyle = '#fff'; ctx.font = '600 10px "Lexend Deca",system-ui,sans-serif';
          ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillText(`${val}%`, bar.x - 5, bar.y);
        } else {
          ctx.fillStyle = '#374151'; ctx.font = '10px "Lexend Deca",system-ui,sans-serif';
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(`${val}%`, bar.x + 4, bar.y);
        }
        ctx.restore();
      });
    },
  };

  const barInBarPlugin = {
    id: 't2PacingTarget',
    beforeDatasetsDraw(chart) {
      const { ctx, scales } = chart;
      const meta = chart.getDatasetMeta(0);
      // Use slot height (from scale) so the target box is always wider than the inner bar
      const slotH = meta.data.length > 1
        ? Math.abs(meta.data[1].y - meta.data[0].y)
        : Math.abs(scales.y.getPixelForValue(1) - scales.y.getPixelForValue(0));
      const boxH = slotH * 0.78;
      meta.data.forEach((bar, i) => {
        const target = upcomingPacing[i].target;
        const x0   = scales.x.getPixelForValue(0);
        const xT   = scales.x.getPixelForValue(target);
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        ctx.fillRect(x0, bar.y - boxH / 2, xT - x0, boxH);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xT, bar.y - boxH / 2);
        ctx.lineTo(xT, bar.y + boxH / 2);
        ctx.stroke();
        ctx.restore();
      });
    },
  };

  CHARTS['t2-ticketPacing'] = new Chart(document.getElementById('t2-ticketPacing'), {
    type: 'bar',
    plugins: [barInBarPlugin, pacingLabelPlugin],
    data: {
      labels: upcomingPacing.map(x => x.label),
      datasets: [{ label: '% Sold', data: upcomingPacing.map(x => x.pctSold),
                   backgroundColor: upcomingPacing.map(x => x.color), borderRadius: 3,
                   barPercentage: 0.5 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => upcomingPacing[items[0].dataIndex].opponent,
            label: items => {
              const d = upcomingPacing[items.dataIndex];
              const statusLabel = d.gap >= 0 ? '✓ On track' : d.gap >= -10 ? '⚠ Watch' : '✗ At risk';
              return [
                `  ${d.pctSold}% sold  (target: ${d.target}%)`,
                `  Gap: ${d.gap > 0 ? '+' : ''}${d.gap} pts  ${statusLabel}`,
                `  ${d.daysUntil} days to game`,
              ];
            },
          },
        },
      },
      scales: {
        x: { min: 0, max: 100, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { grid: { display: false } },
      },
    },
  });

  // ── Chart 6: Buyers by State — Top 10 (horizontal bar) ──
  destroyChart('t2-buyersByState');
  const stateSorted = Object.entries(stateCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

  CHARTS['t2-buyersByState'] = new Chart(document.getElementById('t2-buyersByState'), {
    type: 'bar',
    data: {
      labels: stateSorted.map(([s]) => s),
      datasets: [{ label: 'Buyers', data: stateSorted.map(([, v]) => v),
                   backgroundColor: PALETTE.navy, borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => {
          const total = stateSorted.reduce((s, [, v]) => s + v, 0);
          return `${fmt.num(ctx.raw)} buyers — ${fmt.pct(ctx.raw / total)} of total`;
        },
      }}},
      scales: { x: { ticks: { callback: v => fmt.num(v) } }, y: { grid: { display: false } } },
    },
  });

  // ── Section Heatmap (SVG, D3-style) ──
  const zoneFans = fans2.filter(x => x.seat_section && x.ticket_spend != null);
  const zoneRev  = {};
  const zoneCnt  = {};
  SEAT_SECTIONS.forEach(z => { zoneRev[z] = 0; zoneCnt[z] = 0; });
  zoneFans.forEach(x => {
    zoneRev[x.seat_section]  = (zoneRev[x.seat_section]  || 0) + x.ticket_spend;
    zoneCnt[x.seat_section]  = (zoneCnt[x.seat_section]  || 0) + 1;
  });

  // Color by avg ticket value per fan — shows zone premium, not population size
  const zoneAvg   = {};
  SEAT_SECTIONS.forEach(z => { zoneAvg[z] = zoneCnt[z] > 0 ? zoneRev[z] / zoneCnt[z] : 0; });
  const maxAvg = Math.max(...Object.values(zoneAvg));
  // Warm heat map: cream(255,248,225) → amber(255,140,0) → Blackhawks red(207,10,44)
  const sectionColorScale = v => {
    const t = maxAvg > 0 ? Math.pow(v / maxAvg, 0.75) : 0;
    let r, g, b;
    if (t <= 0.5) {
      const u = t * 2;
      r = 255; g = Math.round(248 + u * (140 - 248)); b = Math.round(225 + u * (0 - 225));
    } else {
      const u = (t - 0.5) * 2;
      r = Math.round(255 + u * (207 - 255)); g = Math.round(140 + u * (10 - 140)); b = Math.round(u * 44);
    }
    return `rgb(${r},${g},${b})`;
  };

  const sectionHost = document.getElementById('t2-sectionHeatmap');
  if (sectionHost) {
    sectionHost.querySelectorAll('.section-zone').forEach(el => {
      const zone   = el.dataset.zone;
      const rev    = zoneRev[zone] || 0;
      const cnt    = zoneCnt[zone] || 0;
      const perFan = zoneAvg[zone] || 0;
      const isDark = cnt > 0 && perFan > maxAvg * 0.38; // amber+ range → white text

      el.setAttribute('fill', cnt > 0 ? sectionColorScale(perFan) : '#E9ECEF');
      if (cnt > 0) el.style.cursor = 'pointer';

      // Zone two-line label: zone name + avg value
      // Always remove old label first — tspan structure requires full rebuild each render
      const lid = 'glf-zlbl-' + zone.replace(/\W+/g, '-');
      const existingLbl = sectionHost.querySelector('#' + lid);
      if (existingLbl) existingLbl.remove();

      if (cnt > 0) {
        try {
          const bb = el.getBBox();
          // Skip label on zones too small to fit two lines legibly
          if (bb.height < 40) return;

          const cx    = bb.x + bb.width  / 2;
          const cy    = bb.y + bb.height / 2;
          // cream zones need dark text; amber/red zones need white
          const color = isDark ? 'white' : '#111827';

          const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          lbl.id = lid;
          lbl.setAttribute('text-anchor',   'middle');
          lbl.setAttribute('font-weight',   '700');
          lbl.setAttribute('font-family',   "'Lexend Deca',system-ui,sans-serif");
          lbl.setAttribute('font-size',     '10');
          lbl.setAttribute('fill',          color);
          lbl.setAttribute('pointer-events','none');
          lbl.setAttribute('x', cx);
          lbl.setAttribute('y', cy - 7);  // shift up so two lines center on cy

          const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          line1.setAttribute('x',  cx);
          line1.setAttribute('dy', '0');
          line1.textContent = zone;

          const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          line2.setAttribute('x',  cx);
          line2.setAttribute('dy', '14');
          line2.textContent = '$' + Math.round(perFan / 1000) + 'k avg';

          lbl.appendChild(line1);
          lbl.appendChild(line2);
          el.parentNode.appendChild(lbl);
        } catch (_) {}
      }
    });

    // Styled tooltip — remove previous listeners to prevent accumulation on re-render
    document.querySelectorAll('.glf-zone-tip').forEach(t => t.remove());
    const zoneTip = document.createElement('div');
    zoneTip.className = 'glf-zone-tip';
    zoneTip.style.cssText = 'position:fixed;background:rgba(10,20,50,0.97);color:rgba(255,255,255,0.92);padding:11px 15px;border-radius:7px;font-size:11.5px;line-height:1.7;pointer-events:none;display:none;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,0.45);border:1px solid rgba(207,10,44,0.28);border-left:3px solid #CF0A2C;min-width:220px;max-width:280px;';
    document.body.appendChild(zoneTip);

    if (sectionHost._zMoveFn)  sectionHost.removeEventListener('mousemove',  sectionHost._zMoveFn);
    if (sectionHost._zLeaveFn) sectionHost.removeEventListener('mouseleave', sectionHost._zLeaveFn);

    const TICKET_TYPE_LABEL = {
      stm:          TEAM.stmLabel,
      single_game:  'Single Game',
      secondary:    'Secondary Market',
    };

    sectionHost._zMoveFn = evt => {
      const tgt = evt.target.closest('.section-zone');
      if (!tgt) { zoneTip.style.display = 'none'; return; }
      const zone   = tgt.dataset.zone;
      const rev    = zoneRev[zone] || 0;
      const cnt    = zoneCnt[zone] || 0;
      const perFan = zoneAvg[zone] || 0;

      let html;
      if (cnt > 0) {
        const top5 = fans2
          .filter(x => x.seat_section === zone && x.ticket_spend != null)
          .sort((a, b) => b.ticket_spend - a.ticket_spend)
          .slice(0, 5);

        const rows = top5.map((fan, i) => {
          const label = TICKET_TYPE_LABEL[fan.ticket_type] || fan.ticket_type;
          return `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px">
            <span style="color:rgba(255,255,255,0.55)">${i + 1}. ${label}</span>
            <span style="color:rgba(255,255,255,0.90);font-weight:600">${fmt.currency(fan.ticket_spend)}</span>
          </div>`;
        }).join('');

        const sep = top5.length > 0
          ? `<div style="border-top:1px solid rgba(255,255,255,0.12);margin:8px 0 5px"></div>
             <div style="font-size:9px;color:rgba(255,255,255,0.40);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:4px">Top fans by spend</div>
             ${rows}`
          : '';

        html = `<strong style="font-size:12px">${zone}</strong>
          <div style="color:rgba(255,255,255,0.65);font-size:10px;margin-top:2px">${fmt.num(cnt)} fans &nbsp;·&nbsp; ${fmt.currency(Math.round(perFan))} avg / fan</div>
          <div style="color:rgba(255,255,255,0.80);font-size:10px">Total revenue: ${fmt.currency(Math.round(rev))}</div>
          ${sep}`;
      } else {
        html = `<strong style="font-size:12px">${zone}</strong><div style="color:rgba(255,255,255,0.50);margin-top:3px">No data</div>`;
      }

      zoneTip.innerHTML = html;
      zoneTip.style.display = 'block';
      const _tipW = 280, _tipH = 220;
      zoneTip.style.left = Math.min(evt.clientX + 16, window.innerWidth  - _tipW - 8) + 'px';
      zoneTip.style.top  = Math.max(8, Math.min(evt.clientY - 40, window.innerHeight - _tipH - 8)) + 'px';
    };
    sectionHost._zLeaveFn = () => { zoneTip.style.display = 'none'; };
    sectionHost.addEventListener('mousemove',  sectionHost._zMoveFn);
    sectionHost.addEventListener('mouseleave', sectionHost._zLeaveFn);
  }
}

// ═══════════════════════════════════════════════
// TAB 3: FOOD & BEVERAGE
// ═══════════════════════════════════════════════
function renderTab3() {
  const f = STATE.tab3;
  const { mode, focused, baseline } = filterGames(f);

  const fIds  = focused.map(g => g.id);
  const fFnbAll = getFnbRows(fIds);
  const fScans  = getScanRows(fIds);

  // Apply fnbCategory filter to revenue field used in charts
  const catRevField = f.fnbCategory !== 'all' ? `${f.fnbCategory}_revenue` : 'total_revenue';
  // fFnb is used for aggregate metrics; individual charts use catRevField for per-game series
  const fFnb = fFnbAll;  // full rows kept for attach rate, transaction counts, etc.

  // ── BANs ──
  const totalRev    = fFnb.reduce((s, r) => s + r[catRevField], 0);
  const totalScanned = fScans.reduce((s, r) => s + r.tickets_scanned, 0);
  const avgPercap   = totalScanned > 0 ? totalRev / totalScanned : 0;
  const attachRate  = fFnb.length ? fFnb.reduce((s, r) => s + r.fnb_attach_rate, 0) / fFnb.length : 0;
  const totalTx     = fFnb.reduce((s, r) => s + r.transaction_count, 0);
  const totalVisitors = fFnb.reduce((s, r) => s + r.unique_visitors_with_fnb, 0);
  const avgTxVal    = totalVisitors > 0 ? totalRev / totalTx : 0;
  // Top category: sum each across all filtered games
  const catTotals = { food: 0, beer_wine: 0, non_alc: 0 };
  fFnb.forEach(r => { catTotals.food += r.food_revenue; catTotals.beer_wine += r.beer_wine_revenue; catTotals.non_alc += r.non_alc_revenue; });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'food';
  const catLabels = { food: 'Food', beer_wine: 'Beer & Wine', non_alc: 'Non-Alcoholic' };

  // 4th BAN: Top Category (top-level) or Top Sub-Category (drilled in)
  let topBAN;
  if (f.fnbDrilldown) {
    if (!FNB_SUBCATS[f.fnbDrilldown]) { STATE.tab3.fnbDrilldown = null; renderTab3(); return; }
    const catRevField4 = `${f.fnbDrilldown}_revenue`;
    const catSeasonRev4 = GAME_FNB.reduce((s, r) => s + r[catRevField4], 0);
    const topSub = FNB_SUBCATS[f.fnbDrilldown]
      .map(sc => ({ ...sc, revenue: Math.round(catSeasonRev4 * sc.share), units: Math.round(catSeasonRev4 * sc.share / sc.avg_price) }))
      .sort((a, b) => b.revenue - a.revenue)[0];
    topBAN = {
      label: 'Top Sub-Category',
      value: `${topSub.label}<br><span style="font-size:12px;font-weight:400;">${fmt.currency(topSub.revenue)} · ${fmt.num(topSub.units)} units</span>`,
      lead: true,
    };
  } else {
    topBAN = { label: 'Top Category', value: catLabels[topCat], lead: true };
  }

  renderBANs('t3-bans', [
    { label: 'Total F&B Revenue',   value: fmt.currency(totalRev) },
    { label: 'Avg Per-Cap Spend',   value: '$' + avgPercap.toFixed(2) },
    { label: 'F&B Attach Rate',     value: fmt.pct(attachRate) },
    topBAN,
    { label: 'Transactions',        value: fmt.num(totalTx) },
    { label: 'Avg Transaction',     value: '$' + avgTxVal.toFixed(2) },
  ]);

  // Full-season timeline for Tab 3 time-series charts
  const tlGames3   = mode === 'focused'
    ? [...focused, ...(baseline || [])].sort((a, b) => a.date.localeCompare(b.date))
    : [...focused].sort((a, b) => a.date.localeCompare(b.date));
  const focusedSet3 = new Set(fIds);
  const tlFnb3     = mode === 'focused' ? getFnbRows(tlGames3.map(g => g.id)) : fFnb;
  const sortedGames3 = tlGames3;

  // ── Chart 1: F&B Revenue by Game (line) ──
  destroyChart('t3-revByGame');
  const drillRevField = f.fnbDrilldown ? `${f.fnbDrilldown}_revenue` : catRevField;
  const revByGame  = tlGames3.map(g => { const r = tlFnb3.find(x => x.game_id === g.id); return r ? r[drillRevField] : 0; });
  const revLabel   = f.fnbDrilldown ? catLabels[f.fnbDrilldown] + ' Revenue'
                   : f.fnbCategory !== 'all' ? catLabels[f.fnbCategory] + ' Revenue' : 'F&B Revenue';
  const ptColors3  = tlGames3.map(g => mode === 'focused' && focusedSet3.has(g.id) ? PALETTE.red : 'transparent');
  const ptRadii3   = tlGames3.map(g => mode === 'focused' && focusedSet3.has(g.id) ? 5 : 0);
  const datasets31 = [{ label: revLabel, data: revByGame, borderColor: PALETTE.navy,
                         backgroundColor: 'rgba(0,50,120,0.07)', fill: true,
                         pointBackgroundColor: ptColors3, pointBorderColor: ptColors3,
                         pointRadius: ptRadii3, borderWidth: 2, tension: 0.2 }];
  if (mode === 'focused' && STATE.showSeasonAvg) {
    const bAvg = fFnb.length ? fFnb.reduce((s, r) => s + r[drillRevField], 0) / fFnb.length : 0;
    datasets31.push({ label: 'Season Avg', data: tlGames3.map(() => bAvg),
                      borderColor: PALETTE.grayDim, borderDash: [4, 4], pointRadius: 0, borderWidth: 1, fill: false });
  }

  CHARTS['t3-revByGame'] = new Chart(document.getElementById('t3-revByGame'), {
    type: 'line',
    data: { labels: tlGames3.map(g => g.date.slice(5)), datasets: datasets31 },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: {
          title: items => { const g = tlGames3[items[0]?.dataIndex]; return g ? `${g.date} vs. ${g.opponent}` : ''; },
          label: ctx => fmt.currency(ctx.raw),
          afterBody: items => {
            const i = items[0]?.dataIndex;
            const fnb = tlFnb3.find(r => r.game_id === tlGames3[i]?.id);
            if (!fnb) return [];
            if (f.fnbDrilldown) {
              const catPerCap = fnb.total_revenue > 0 ? fnb.avg_per_cap * (fnb[drillRevField] / fnb.total_revenue) : 0;
              const catShare  = fnb.total_revenue > 0 ? fnb[drillRevField] / fnb.total_revenue : 0;
              return [`${catLabels[f.fnbDrilldown]} per-cap: $${catPerCap.toFixed(2)}  ·  ${fmt.pct(catShare)} of game F&B`];
            }
            return [`Per-cap: $${fnb.avg_per_cap.toFixed(2)}  ·  Attach: ${fmt.pct(fnb.fnb_attach_rate)}`];
          },
        }},
      },
      scales: { x: { ticks: { maxTicksLimit: 12 }, grid: { display: false } }, y: { ticks: { callback: v => fmt.currency(v) } } },
    },
  });

  // ── Chart 2: Per-Cap Spend by Day Type (bar) ──
  destroyChart('t3-perCapByDayType');
  const dayTypes3 = ['day_game', 'weeknight', 'weekend_friday'];
  const dayLabels3 = ['Day Game', 'Weeknight', 'Weekend & Friday Night'];
  const percapByDayType = dayTypes3.map(dt => {
    const rows = GAME_FNB.filter(r => GAME_BY_ID[r.game_id]?.day_type === dt);
    const scans = GAME_SCANS.filter(r => GAME_BY_ID[r.game_id]?.day_type === dt);
    const rev = rows.reduce((s, r) => s + r.total_revenue, 0);
    const att = scans.reduce((s, r) => s + r.tickets_scanned, 0);
    return att > 0 ? rev / att : 0;
  });

  CHARTS['t3-perCapByDayType'] = new Chart(document.getElementById('t3-perCapByDayType'), {
    type: 'bar',
    data: {
      labels: dayLabels3,
      datasets: [{ label: 'Avg Per-Cap', data: percapByDayType,
                   backgroundColor: [PALETTE.navySoft, PALETTE.navyMid, PALETTE.navy], borderRadius: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => {
          const validVals = percapByDayType.filter(v => v > 0);
          const avg = validVals.reduce((a, b) => a + b, 0) / (validVals.length || 1);
          const diff = ctx.raw - avg;
          const sign = diff >= 0 ? '+' : '−';
          return [`$${ctx.raw.toFixed(2)} per cap`, `${sign}$${Math.abs(diff).toFixed(2)} vs. day-type avg`];
        },
      }}},
      scales: { x: { grid: { display: false } }, y: { ticks: { callback: v => '$' + v.toFixed(0) } } },
    },
  });

  // ── Chart 3: Revenue by Category / Subcategory Drill-Down ──
  destroyChart('t3-revByCatMonth');
  const titleEl3 = document.getElementById('t3-catMonth-title');
  const backDiv3 = document.getElementById('t3-drilldown-back');

  if (f.fnbDrilldown) {
    // ── Drill-down state: horizontal bar of subcategories ──
    const drillKey    = f.fnbDrilldown;
    const catRevField3 = `${drillKey}_revenue`;
    const catSeasonRev = GAME_FNB.reduce((s, r) => s + r[catRevField3], 0);
    if (!FNB_SUBCATS[drillKey]) { STATE.tab3.fnbDrilldown = null; renderTab3(); return; }
    const subcats3 = FNB_SUBCATS[drillKey]
      .map(sc => ({
        ...sc,
        revenue: Math.round(catSeasonRev * sc.share),
        units:   Math.round(catSeasonRev * sc.share / sc.avg_price),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    if (titleEl3) { const tn = [...titleEl3.childNodes].find(n => n.nodeType === Node.TEXT_NODE); if (tn) tn.textContent = `${catLabels[drillKey]} — Subcategory Breakdown `; }
    if (backDiv3) backDiv3.style.display = '';

    CHARTS['t3-revByCatMonth'] = new Chart(document.getElementById('t3-revByCatMonth'), {
      type: 'bar',
      data: {
        labels: subcats3.map(sc => sc.label),
        datasets: [{
          label: 'Season Revenue',
          data:  subcats3.map(sc => sc.revenue),
          backgroundColor: subcats3.map((_, i) => i === 0 ? PALETTE.red : PALETTE.navy),
          borderRadius: 3,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            title: items => subcats3[items[0]?.dataIndex]?.label || '',
            label: ctx  => fmt.currency(ctx.raw),
            afterBody: items => {
              const sc = subcats3[items[0]?.dataIndex];
              return sc ? [`${fmt.num(sc.units)} units`] : [];
            },
          }},
        },
        scales: {
          x: { ticks: { callback: v => fmt.currency(v) }, grid: { display: false } },
          y: { grid: { display: false } },
        },
      },
    });

  } else {
    // ── Top-level state: stacked bar by month ──
    if (titleEl3) { const tn = [...titleEl3.childNodes].find(n => n.nodeType === Node.TEXT_NODE); if (tn) tn.textContent = 'Revenue by Category over Season '; }
    if (backDiv3) backDiv3.style.display = 'none';

    const months3     = [...new Set(GAMES.map(g => g.month))].sort((a, b) => a - b);
    const monthNames3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const catColors3  = { food: PALETTE.navy, beer_wine: PALETTE.navySoft, non_alc: PALETTE.gray };
    const catDatasets3 = ['food', 'beer_wine', 'non_alc'].map(cat => ({
      label: catLabels[cat],
      data: months3.map(m => {
        const rows = GAME_FNB.filter(r => GAME_BY_ID[r.game_id]?.month === m);
        return rows.reduce((s, r) => s + r[`${cat}_revenue`], 0);
      }),
      backgroundColor: catColors3[cat],
    }));

    CHARTS['t3-revByCatMonth'] = new Chart(document.getElementById('t3-revByCatMonth'), {
      type: 'bar',
      data: { labels: months3.map(m => monthNames3[m]), datasets: catDatasets3 },
      options: {
        responsive: true, maintainAspectRatio: false,
        onClick: (e, _elements, chart) => {
          const els = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
          if (!els.length) return;
          const catKeys = ['food', 'beer_wine', 'non_alc'];
          const clicked = catKeys[els[0].datasetIndex];
          if (clicked) { STATE.tab3.fnbDrilldown = clicked; renderTab3(); }
        },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              title: items => monthNames3[months3[items[0]?.dataIndex]] + ' — F&B Revenue by Category',
              label: ctx => {
                const i = ctx.dataIndex;
                const monthTotal = catDatasets3.reduce((s, ds) => s + (ds.data[i] || 0), 0);
                const pct = monthTotal > 0 ? fmt.pct(ctx.raw / monthTotal) : '';
                return `${ctx.dataset.label}: ${fmt.currency(ctx.raw)}  (${pct})`;
              },
            },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, ticks: { callback: v => fmt.currency(v) } },
        },
      },
    });
  }

  // ── Chart 4: F&B Attach Rate / Per-Cap by Opponent ──
  destroyChart('t3-attachByOpponent');
  const titleEl4 = document.getElementById('t3-attachByOpponent-title');

  if (f.fnbDrilldown) {
    // ── Drill-down: category per-cap by opponent ──
    const drillRevField4 = `${f.fnbDrilldown}_revenue`;
    const oppData4 = {};
    GAME_FNB.forEach(r => {
      const g = GAME_BY_ID[r.game_id];
      if (!g) return;
      if (!oppData4[g.opponent]) oppData4[g.opponent] = { catRev: 0, scanned: 0 };
      oppData4[g.opponent].catRev  += r[drillRevField4];
      oppData4[g.opponent].scanned += r.avg_per_cap > 0 ? r.total_revenue / r.avg_per_cap : 0;
    });
    const oppPerCapSorted = Object.entries(oppData4)
      .map(([opp, d]) => ({ opp, perCap: d.scanned > 0 ? d.catRev / d.scanned : 0 }))
      .sort((a, b) => b.perCap - a.perCap);

    if (titleEl4) { const tn = [...titleEl4.childNodes].find(n => n.nodeType === Node.TEXT_NODE); if (tn) tn.textContent = `${catLabels[f.fnbDrilldown]} Per-Cap by Opponent `; }

    CHARTS['t3-attachByOpponent'] = new Chart(document.getElementById('t3-attachByOpponent'), {
      type: 'bar',
      data: {
        labels: oppPerCapSorted.map(d => d.opp),
        datasets: [{ label: catLabels[f.fnbDrilldown] + ' Per-Cap', data: oppPerCapSorted.map(d => d.perCap),
                     backgroundColor: oppPerCapSorted.map(d => d.opp === STATE.opponent ? PALETTE.redSoft : PALETTE.navy),
                     borderRadius: 3 }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: {
          label: ctx => {
            const avg = oppPerCapSorted.reduce((s, d) => s + d.perCap, 0) / (oppPerCapSorted.length || 1);
            const diff = ctx.raw - avg;
            const sign = diff >= 0 ? '+' : '−';
            return [`${catLabels[f.fnbDrilldown]} per-cap: $${ctx.raw.toFixed(2)}`, `${sign}$${Math.abs(diff).toFixed(2)} vs. opponent avg`];
          },
        }}},
        scales: { x: { ticks: { callback: v => '$' + v.toFixed(2) } }, y: { ticks: { font: { size: 11 } }, grid: { display: false } } },
      },
    });

  } else {
    // ── Top-level: attach rate by opponent (unchanged) ──
    if (titleEl4) { const tn = [...titleEl4.childNodes].find(n => n.nodeType === Node.TEXT_NODE); if (tn) tn.textContent = 'F&B Attach Rate by Opponent '; }

    const oppAttach = {};
    GAME_FNB.forEach(r => {
      const g = GAME_BY_ID[r.game_id];
      if (!g) return;
      if (!oppAttach[g.opponent]) oppAttach[g.opponent] = { total: 0, count: 0 };
      oppAttach[g.opponent].total += r.fnb_attach_rate;
      oppAttach[g.opponent].count++;
    });
    const oppAttachSorted = Object.entries(oppAttach)
      .map(([opp, d]) => ({ opp, avg: d.total / d.count }))
      .sort((a, b) => b.avg - a.avg);

    CHARTS['t3-attachByOpponent'] = new Chart(document.getElementById('t3-attachByOpponent'), {
      type: 'bar',
      data: {
        labels: oppAttachSorted.map(d => d.opp),
        datasets: [{ label: 'F&B Attach Rate', data: oppAttachSorted.map(d => d.avg),
                     backgroundColor: oppAttachSorted.map(d => d.opp === STATE.opponent ? PALETTE.redSoft : PALETTE.navy),
                     borderRadius: 3 }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: {
          label: ctx => {
            const avg = oppAttachSorted.reduce((s, d) => s + d.avg, 0) / (oppAttachSorted.length || 1);
            const diff = ctx.raw - avg;
            const sign = diff >= 0 ? '+' : '−';
            return [`Attach: ${fmt.pct(ctx.raw)}`, `${sign}${fmt.pct(Math.abs(diff))} vs. opponent avg`];
          },
        }}},
        scales: { x: { ticks: { callback: v => fmt.pct(v) } }, y: { ticks: { font: { size: 11 } }, grid: { display: false } } },
      },
    });
  }

  // ── Chart 5: Per-Cap Spend by Seating Area (bar, venue sections) ──
  destroyChart('t3-perCapBySection');
  const drillRevField5 = f.fnbDrilldown ? `${f.fnbDrilldown}_revenue` : null;
  const categoryShare5 = drillRevField5
    ? GAME_FNB.reduce((s, r) => s + r[drillRevField5], 0) / (GAME_FNB.reduce((s, r) => s + r.total_revenue, 0) || 1)
    : 1;
  const sectionMap = {};
  FANS.filter(f2 => f2.fnb_fan_id && f2.seat_section).forEach(f2 => {
    if (!sectionMap[f2.seat_section]) sectionMap[f2.seat_section] = { total: 0, count: 0 };
    const perVisit = f2.fnb_spend && f2.fnb_visit_count ? (f2.fnb_spend / f2.fnb_visit_count) * categoryShare5 : 0;
    sectionMap[f2.seat_section].total += perVisit;
    sectionMap[f2.seat_section].count++;
  });
  const sectionOrder = ['Balcones Speakeasy', 'Lexus Club', 'Field Level', 'Main Level', 'Upper Level', 'Outfield'];
  // Sort descending by value
  const sectionData = sectionOrder
    .map(sec => { const d = sectionMap[sec]; return { sec, val: d && d.count > 0 ? d.total / d.count : 0 }; })
    .sort((a, b) => b.val - a.val);
  const sectionColors = sectionData.map(d => {
    if (d.sec === 'Balcones Speakeasy') return PALETTE.red;
    if (d.sec === 'Lexus Club')         return PALETTE.navy;
    return PALETTE.navySoft;
  });
  const sectionMaxVal = Math.max(...sectionData.map(d => d.val));

  const sectionLabelPlugin = {
    id: 't3SectionLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      meta.data.forEach((bar, i) => {
        const val = chart.data.datasets[0].data[i];
        if (!val) return;
        ctx.save();
        ctx.font = '600 11px "Lexend Deca",system-ui,sans-serif';
        ctx.fillStyle = '#374151';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('$' + val.toFixed(0), bar.x, bar.y - 4);
        ctx.restore();
      });
    },
  };

  CHARTS['t3-perCapBySection'] = new Chart(document.getElementById('t3-perCapBySection'), {
    type: 'bar',
    plugins: [sectionLabelPlugin],
    data: {
      labels: sectionData.map(d => d.sec),
      datasets: [{ label: 'Avg Per-Cap / Visit', data: sectionData.map(d => d.val),
                   backgroundColor: sectionColors, borderRadius: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: ctx => {
            const avgAll = sectionData.reduce((s, d) => s + d.val, 0) / (sectionData.length || 1);
            const mult = avgAll > 0 ? (ctx.raw / avgAll).toFixed(1) : '—';
            const prefix = f.fnbDrilldown ? `${catLabels[f.fnbDrilldown]} per-cap: ` : '';
            return [`${prefix}$${ctx.raw.toFixed(2)} per visit`, `${mult}× section average`];
          },
        }},
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 20 } },
        y: { ticks: { callback: v => '$' + v.toFixed(0) }, max: sectionMaxVal * 1.18 },
      },
    },
  });
}

// ═══════════════════════════════════════════════
// TAB 4: FAN IDENTITY
// ═══════════════════════════════════════════════
function renderTab4() {
  const f = STATE.tab4;
  const fans4 = filterFans(f, 'tab4');

  // ── BANs ──
  const linkedFans    = FANS.filter(x => x.global_fan_id);
  const linkedInView  = fans4.filter(x => x.global_fan_id);
  const avgXCS        = linkedInView.length
    ? linkedInView.reduce((s, x) => s + x.total_cross_channel_spend, 0) / linkedInView.length : 0;
  const scansMatched  = FANS.filter(x => x.scan_fan_id && x.global_fan_id).length;
  const totalScans    = FANS.filter(x => x.scan_fan_id).length;
  const pctMatched    = totalScans > 0 ? scansMatched / totalScans : 0;
  const darkFansCount = FANS.filter(x => x.linked_sources === 'SCAN|FNB').length;
  const avgConf       = linkedFans.length
    ? linkedFans.reduce((s, x) => s + (x.match_confidence_score || 0), 0) / linkedFans.length : 0;
  const threshold     = getTop10PctThreshold();

  renderBANs('t4-bans', [
    { label: 'Cross-Channel Spend / Fan',  value: fmt.currency(Math.round(avgXCS)) },
    { label: '% Scans Matched to Known Fan', value: fmt.pct(pctMatched) },
    { label: 'Secondary Market Dark Fans', value: String(darkFansCount), lead: true,
      tooltip: "Fans matched via Gate Scans + F&B only.\nNo Ticketmaster record — STM utilization is undefined for this segment.\nThese buyers are completely invisible to standard CRM without identity resolution." },
    { label: 'Total Linked Fans',          value: String(linkedFans.length) },
    { label: 'Avg Match Confidence',       value: fmt.pct(avgConf) },
    { label: 'Top Decile Spend Threshold', value: fmt.currency(threshold) },
  ]);

  // ── Chart 1: Fan Population Overlap — Venn ──
  destroyChart('t4-venn');
  // Segment counts from FANS (static — independent of tab filters)
  const seg = {
    tkt:    FANS.filter(x => x.linked_sources === 'TICKET').length,           // 68
    scan:   FANS.filter(x => x.linked_sources === 'SCAN').length,             // 40
    fnb:    FANS.filter(x => x.linked_sources === 'FNB').length,              // 30
    ts:     FANS.filter(x => x.linked_sources === 'TICKET|SCAN').length,      // 95
    tf:     FANS.filter(x => x.linked_sources === 'TICKET|FNB').length,       // 65
    sf:     FANS.filter(x => x.linked_sources === 'SCAN|FNB').length,         // 42
    tsf:    FANS.filter(x => x.linked_sources === 'TICKET|SCAN|FNB').length,  // 160
  };

  CHARTS['t4-venn'] = new Chart(document.getElementById('t4-venn'), {
    type: 'venn',
    data: {
      labels: ['Ticketmaster', 'Gate Scans', 'F&B'],
      datasets: [{
        label: 'Fan Sources',
        data: [
          { sets: ['Ticketmaster'],                    value: seg.tkt + seg.ts + seg.tf + seg.tsf },
          { sets: ['Gate Scans'],                      value: seg.scan + seg.ts + seg.sf + seg.tsf },
          { sets: ['F&B'],                             value: seg.fnb + seg.tf + seg.sf + seg.tsf },
          { sets: ['Ticketmaster', 'Gate Scans'],      value: seg.ts + seg.tsf },
          { sets: ['Ticketmaster', 'F&B'],             value: seg.tf + seg.tsf },
          { sets: ['Gate Scans', 'F&B'],               value: seg.sf + seg.tsf },
          { sets: ['Ticketmaster', 'Gate Scans', 'F&B'], value: seg.tsf },
        ],
        backgroundColor: [
          'rgba(0,50,120,0.22)', 'rgba(0,50,120,0.22)', 'rgba(192,17,31,0.20)',
          'rgba(0,50,120,0.40)', 'rgba(100,20,35,0.35)', 'rgba(192,17,31,0.52)',
          'rgba(0,30,90,0.62)',
        ],
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const key = ctx.raw.sets.join('|');
              const n = ctx.raw.value;
              const map = {
                'Ticketmaster':                [`${n} fans — ticket record only`, 'No scan or F&B data — attendance and spend unknown'],
                'Gate Scans':                  [`${n} fans — gate scan only`, 'Attended but left no ticket or purchase trail'],
                'F&B':                         [`${n} fans — F&B purchase only`, 'No ticket or scan record — origin unknown'],
                'Ticketmaster|Gate Scans':     [`${n} fans — ticketed + confirmed attendee`, 'F&B spend not linked to this identity'],
                'Ticketmaster|F&B':            [`${n} fans — ticketed + F&B buyer`, 'Scan not linked — may have used mobile entry'],
                'Gate Scans|F&B':              [`${n} fans — secondary market buyers (dark fans)`, 'No Ticketmaster record — invisible to CRM', 'Surfaced only through P3RL gate + F&B matching'],
                'Ticketmaster|Gate Scans|F&B': [`${n} fans — fully linked across all three systems`, 'Highest-confidence profiles — complete attendance + spend record'],
              };
              return map[key] || `${n} fans`;
            },
          },
        },
      },
    },
  });

  // ── Chart 2: Membership Tier vs. Cross-Channel Spend (scatter with jitter) ──
  destroyChart('t4-spendByTier');
  const tierMap  = { stm: 0, single_game: 1, secondary: 2 };
  const tierCols = [PALETTE.navy, PALETTE.navySoft, PALETTE.gray];
  const tierDisplayLabels = [TEAM.stmLabel, 'Single Game', 'Secondary Market'];

  const scatterDatasets = ['stm', 'single_game', 'secondary'].map((tier, ti) => {
    const fans4tier = fans4.filter(x => x.ticket_type === tier && x.total_cross_channel_spend != null);
    return {
      label: tierDisplayLabels[ti],
      data: fans4tier.map((x, i) => ({
        x: ti + (((i * 7 + 3) % 17) / 17 - 0.5) * 0.5,  // jitter within ±0.25
        y: x.total_cross_channel_spend,
        ticketSpend: x.ticket_spend,
        fnbSpend: x.fnb_spend,
        section: x.seat_section,
        tier: tierDisplayLabels[ti],
      })),
      backgroundColor: tierCols[ti] + '99',
      pointRadius: 4,
    };
  });

  // Mean markers per tier
  const meanDataset = ['stm', 'single_game', 'secondary'].map((tier, ti) => {
    const vals = fans4.filter(x => x.ticket_type === tier && x.total_cross_channel_spend != null)
                       .map(x => x.total_cross_channel_spend);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { x: ti, y: mean };
  });
  scatterDatasets.push({
    label: 'Tier Mean',
    data: meanDataset,
    backgroundColor: PALETTE.red,
    pointRadius: 8, pointStyle: 'triangle', borderColor: PALETTE.red, borderWidth: 2,
  });

  const meanLabelPlugin = {
    id: 't4MeanLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      const dsIdx = chart.data.datasets.length - 1;
      const meta  = chart.getDatasetMeta(dsIdx);
      meta.data.forEach((point, i) => {
        const val = chart.data.datasets[dsIdx].data[i]?.y;
        if (val == null) return;
        ctx.save();
        ctx.font = '700 10px "Lexend Deca",system-ui,sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const label = 'avg ' + fmt.currency(Math.round(val));
        const x = point.x + 12;
        const y = point.y - 2;
        const pad = 4;
        const w = ctx.measureText(label).width;
        // White pill behind the label so it reads clearly over dense scatter dots
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath();
        ctx.roundRect(x - pad, y - 7, w + pad * 2, 14, 3);
        ctx.fill();
        ctx.fillStyle = PALETTE.red;
        ctx.fillText(label, x, y);
        ctx.restore();
      });
    },
  };

  CHARTS['t4-spendByTier'] = new Chart(document.getElementById('t4-spendByTier'), {
    type: 'scatter',
    plugins: [meanLabelPlugin],
    data: { datasets: scatterDatasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          mode: 'nearest',
          intersect: true,
          callbacks: {
            title: items => {
              if (!items.length) return '';
              const raw = items[0].raw;
              if (!raw.tier) return 'Tier Average';
              return `${raw.tier} · ${raw.section || '—'}`;
            },
            label: ctx => {
              if (ctx.dataset.label === 'Tier Mean') {
                return `Tier avg: ${fmt.currency(Math.round(ctx.raw.y))}`;
              }
              const raw = ctx.raw;
              const ticket = raw.ticketSpend != null ? fmt.currency(raw.ticketSpend) : '—';
              const fnb    = raw.fnbSpend    != null ? fmt.currency(raw.fnbSpend)    : '—';
              const total  = fmt.currency(raw.y);
              return [`Ticket: ${ticket}`, `F&B: ${fnb}`, `Total: ${total}`];
            },
          },
        },
      },
      scales: {
        x: {
          min: -0.5, max: 2.5,
          ticks: { callback: v => tierDisplayLabels[Math.round(v)] || '', stepSize: 1 },
          grid: { display: false },
        },
        y: { ticks: { callback: v => fmt.currency(v) } },
      },
    },
  });

  // ── Chart 3: Top Decile Fans — Cross-Channel Spend Breakdown ──
  destroyChart('t4-topDecile');
  const top10 = [...fans4.filter(x => x.global_fan_id)]
    .sort((a, b) => b.total_cross_channel_spend - a.total_cross_channel_spend)
    .slice(0, 10);
  const avgXCSAll = linkedFans.length
    ? linkedFans.reduce((s, x) => s + x.total_cross_channel_spend, 0) / linkedFans.length : 0;

  const decileLabels = top10.map(x =>
    `${x.seat_section ? x.seat_section.split(' ')[0] : '—'} · ${x.home_state || '—'}`
  );

  CHARTS['t4-topDecile'] = new Chart(document.getElementById('t4-topDecile'), {
    type: 'bar',
    data: {
      labels: decileLabels,
      datasets: [
        { label: 'Ticket Spend',  data: top10.map(x => x.ticket_spend || 0), backgroundColor: PALETTE.navy,    borderRadius: 3 },
        { label: 'F&B Spend',     data: top10.map(x => x.fnb_spend || 0),    backgroundColor: PALETTE.navySoft },
      ],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        annotation: {
          annotations: {
            avgLine: {
              type: 'line', xMin: avgXCSAll, xMax: avgXCSAll,
              borderColor: PALETTE.gray, borderWidth: 1, borderDash: [4, 4],
              label: { content: `Avg ${fmt.currency(Math.round(avgXCSAll))}`, display: true, position: 'start', font: { size: 10 } },
            },
          },
        },
        tooltip: {
          callbacks: {
            title: items => {
              const fan = top10[items[0]?.dataIndex];
              if (!fan) return '';
              const tier = fan.ticket_type === 'stm' ? TEAM.stmLabel : fan.ticket_type === 'single_game' ? 'Single Game' : 'Secondary Market';
              return `${tier} · ${fan.seat_section || '—'} · ${fan.home_state || '—'}`;
            },
            afterBody: items => {
              const fan = top10[items[0]?.dataIndex];
              if (!fan) return [];
              return [
                `Tickets: ${fmt.currency(fan.ticket_spend || 0)}`,
                `F&B:     ${fmt.currency(fan.fnb_spend || 0)}`,
                `Total:   ${fmt.currency(fan.total_cross_channel_spend)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: { stacked: true, ticks: { callback: v => fmt.currency(v) } },
        y: { stacked: true, grid: { display: false } },
      },
    },
    plugins: [{
      id: 'totalBarLabel',
      afterDraw(chart) {
        const { ctx, data, chartArea } = chart;
        const meta1 = chart.getDatasetMeta(1);
        ctx.save();
        ctx.font = '600 10px "Lexend Deca", system-ui, sans-serif';
        ctx.fillStyle = '#374151';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        meta1.data.forEach((bar, i) => {
          const total = (data.datasets[0].data[i] || 0) + (data.datasets[1].data[i] || 0);
          const x = bar.x + 5;
          if (x < chartArea.right - 10) {
            ctx.fillText(fmt.currency(total), x, bar.y);
          }
        });
        ctx.restore();
      },
    }],
  });

  // ── Chart 4: Single-Source vs. Linked Fans by Day Type ──
  destroyChart('t4-linkedByDayType');
  const dayTypes4  = ['day_game', 'weeknight', 'weekend_friday'];
  const dayLabels4 = ['Day Game', 'Weeknight', 'Weekend & Friday Night'];
  const linkedByDt   = dayTypes4.map((_, i) => fans4.filter((x, fi) => x.global_fan_id && (fi % 3) === i).length);
  const unlinkedByDt = dayTypes4.map((_, i) => fans4.filter((x, fi) => !x.global_fan_id && (fi % 3) === i).length);

  CHARTS['t4-linkedByDayType'] = new Chart(document.getElementById('t4-linkedByDayType'), {
    type: 'bar',
    data: {
      labels: dayLabels4,
      datasets: [
        { label: 'Linked Fans',    data: linkedByDt,   backgroundColor: PALETTE.navy,     borderRadius: 3 },
        { label: 'Single-Source',  data: unlinkedByDt, backgroundColor: PALETTE.gray2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => {
              const i = ctx.dataIndex;
              const total = (linkedByDt[i] || 0) + (unlinkedByDt[i] || 0);
              const pct = total > 0 ? fmt.pct(ctx.raw / total) : '';
              return `${ctx.dataset.label}: ${fmt.num(ctx.raw)}  (${pct})`;
            },
            footer: items => {
              const i = items[0]?.dataIndex;
              const total = (linkedByDt[i] || 0) + (unlinkedByDt[i] || 0);
              const rate = total > 0 ? fmt.pct(linkedByDt[i] / total) : '—';
              return [`Link rate: ${rate}`];
            },
          },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true },
      },
    },
  });

  // ── Chart 5: Geographic Distribution — Top 10 States (horizontal bar) ──
  destroyChart('t4-geoBar');
  const geoCount = {};
  fans4.filter(x => x.global_fan_id).forEach(x => {
    if (x.home_state) geoCount[x.home_state] = (geoCount[x.home_state] || 0) + 1;
  });
  const geoSorted = Object.entries(geoCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

  CHARTS['t4-geoBar'] = new Chart(document.getElementById('t4-geoBar'), {
    type: 'bar',
    data: {
      labels: geoSorted.map(([s]) => s),
      datasets: [{ label: 'Linked Fans', data: geoSorted.map(([, v]) => v),
                   backgroundColor: PALETTE.navy, borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => {
          const total = geoSorted.reduce((s, [, v]) => s + v, 0);
          return `${fmt.num(ctx.raw)} linked fans  (${fmt.pct(ctx.raw / total)} of total)`;
        },
      }}},
      scales: { x: { ticks: { callback: v => fmt.num(v) } }, y: { grid: { display: false } } },
    },
  });

  // ── Chart 6: Linked Fan Distribution by State (D3 choropleth) ──
  const stateDataMap = {};
  fans4.filter(x => x.global_fan_id && x.home_state).forEach(x => {
    if (!stateDataMap[x.home_state]) stateDataMap[x.home_state] = { count: 0 };
    stateDataMap[x.home_state].count++;
  });
  renderStateMap('t4-map', stateDataMap, (abbr, name, d) => {
    if (!d || !d.count) return `<strong>${name}</strong><br><span style="opacity:.7">No linked fans</span>`;
    const pct = (d.count / linkedInView.length * 100).toFixed(1);
    return `<strong>${name}</strong><br>${d.count} linked fans &nbsp;·&nbsp; ${pct}% of total`;
  });
}
