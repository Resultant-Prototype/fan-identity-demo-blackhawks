# Fan Identity Resolution Demo — Template

A zero-backend, single-file analytics demo for Resultant sports sales conversations.
Demonstrates the P3RL identity resolution story across Gate Access, Ticket Sales,
Food & Beverage, and Fan Identity.

Ships with **Indy Rezzers** (fictional MLB team, Resultant brand colors) as the
working placeholder. Open `index.html` immediately — no install required.

**Reference implementation:** `fan-identity-demo-rangers/` shows the full experience
including stadium SVG heatmaps.

---

## Adapting for a new client

1. Clone or copy this repo:
   ```bash
   cp -r fan-identity-demo-template fan-identity-demo-[client]
   cd fan-identity-demo-[client]
   git init && git add . && git commit -m "init: fork from template"
   ```

2. Open `src/client-config.js` — this is the only file you need to edit for a standard adaptation.

3. Set `TEAM.sport` to select the sport preset: `'mlb'` | `'nfl'` | `'nba'` | `'nhl'`

4. Fill in `TEAM`, `BRAND`, `VENUE`, `HOME_STATES`, `STATE_WEIGHTS`, and `SERIES_SCHEDULE`.
   See the sport preset file (`src/presets/[sport].js`) for the series entry shape.

5. Drop the team logo into the repo root. Update `TEAM.logoFile` to match.

6. Run `node build.js` and open `index.html`.

### Optional: stadium SVG heatmaps

The Gate Access (Tab 1) and Ticket Sales (Tab 2) stadium heatmap charts show a
placeholder card by default. To enable them:

1. Add a stadium SVG file named `[team-short-name-kebab]-stadium.svg` to the repo root.
   (e.g. `kansas-city-chiefs-stadium.svg`)
2. Populate `VENUE.gateBySectionWeights` in `client-config.js`.
3. Run `node build.js`.

See `BACKLOG.md` for the planned Stadium SVG Generator tool.

---

## Build system

```bash
node build.js
```

Reads `src/client-config.js`, selects the matching sport preset, injects brand tokens
into CSS, replaces HTML tokens, and writes `src/` → `index.html`.

**Never edit `index.html` directly.** It is fully generated.

JS load order: `client-config.js` → `presets/[sport].js` → `data.js` → `filters.js`
→ `charts.js` → `export.js` → `main.js`

---

## Sport presets

| Preset | Sport | Home games | Active months | Status |
|--------|-------|-----------|---------------|--------|
| `mlb.js` | MLB | 81 | Mar–Sep | Active |
| `nfl.js` | NFL | 8 + 2 preseason | Sep–Jan | Stub |
| `nba-nhl.js` | NBA / NHL | 41 | Oct–Apr | Stub |

---

## Source files

```
src/
  client-config.js   Team identity, brand, venue, schedule, geography
  presets/           Sport-specific season defaults
  data.js            Synthetic data generation (reads from config + preset)
  filters.js         STATE object + filterGames() helper
  charts.js          All Chart.js / D3 render functions
  export.js          CSV export + toast notifications
  main.js            Tab switching, filter wiring, match banner
  shell.html         HTML structure with {{TOKEN}} slots
  style.css          Styles with {{BRAND_*}} slots in :root
build.js             Assembles index.html from src/
```
