# Stadium SVG Generator

Two-stage CLI tool that researches a venue via the Claude API and generates a stadium SVG diagram and `client-config.js` stub for the fan identity demo.

---

## Prerequisites

- **Node.js** 18+ (`node --version`)
- **Python** 3.8+ (`python3 --version`)
- **Anthropic API key** — required for Stage 1 only:
  ```bash
  export ANTHROPIC_API_KEY=sk-ant-...
  ```
- Install Node dependency (one time, from repo root):
  ```bash
  npm install
  ```
- No Python packages to install — all stdlib.

---

## Quickstart

```bash
# Stage 1: research venue (calls Claude API, writes venue JSON)
node tools/research.js "Texas Rangers" "Globe Life Field"
# → texas-rangers-venue.json

# REVIEW texas-rangers-venue.json — verify sponsor/gate names,
# fix any errors, then commit it before proceeding.

# Stage 2: generate SVG and config stub
python3 tools/generate.py texas-rangers-venue.json
python3 tools/scaffold_config.py texas-rangers-venue.json
# → texas-rangers-stadium.svg  (place in repo root)
# → texas-rangers-config-stub.js  (copy to src/client-config.js, fill stubs)

# Build the demo
node build.js
```

---

## Workflow Detail

### Stage 1 — research.js

Calls `claude-sonnet-4-6` with web search enabled. Extracts team identity, venue metadata, seating zone names, gate names, brand colors, and vendor names. Writes a `[slug]-venue.json` to the current directory.

**What to review before proceeding:**
- Gate names: sponsor naming rights change frequently. Verify against the team's current website or venue map.
- Vendor names: ticketing, scan, and F&B vendors may differ from Claude's training data.
- Zone names: confirm they match what the team uses publicly (e.g. "Club Level" vs "Loge Level").
- Anchor positions: open the JSON and sanity-check the `svg.anchors` coords are within the 900×800 viewbox and home plate is near the bottom (y ≈ 570–580 for baseball).

**Flags:**
- `--overwrite` — replace an existing venue JSON
- `--dry-run` — print the JSON Claude would write, without creating a file
- `--quiet` — suppress human-readable summary (machine output only)

### Stage 2a — generate.py

Reads the venue JSON, resolves zone paths to polygon coordinates, and writes `[slug]-stadium.svg` to the current directory. Also updates `tools/VENUES.md`.

**Flags:**
- `--dry-run` — validate JSON and print zone/gate counts without writing

### Stage 2b — scaffold_config.py

Reads the venue JSON and writes a `[slug]-config-stub.js`. Copy it to `src/client-config.js` and fill in all `STUB_` fields:
- `TEAM.logoFile` — filename of the team logo in the repo root
- `UPCOMING_PACING` — current season upcoming game data
- `SERIES_SCHEDULE` — full season schedule
- `HOME_STATES` / `STATE_WEIGHTS` — fan geography data

---

## Schema Field Reference

All fields in `[slug]-venue.json`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema_version` | string | yes | Always `"1.0"` |
| `sport` | string | yes | `"mlb"`, `"nfl"`, `"nba"`, or `"nhl"` |
| `team.name` | string | yes | Full official name, e.g. `"Kansas City Chiefs"` |
| `team.short_name` | string | yes | Short display label, e.g. `"Chiefs"` |
| `team.slug` | string | yes | Kebab-case, drives output filenames |
| `team.stm_label` | string | yes | Season ticket member program name |
| `identity.primary_hex` | string | yes | Primary brand color `#RRGGBB` |
| `identity.secondary_hex` | string | yes | Accent/secondary brand color `#RRGGBB` |
| `identity.ticketing_vendor` | string | yes | Primary ticketing platform |
| `identity.scan_vendor` | string | yes | Gate scan / entry technology vendor |
| `identity.fnb_vendor` | string | yes | Food & beverage concessionaire |
| `venue.name` | string | yes | Full official venue name including naming rights |
| `venue.capacity` | integer | yes | Seating capacity |
| `svg.viewbox` | string | yes | SVG viewBox, always `"0 0 900 800"` |
| `svg.sport_geometry` | string | yes | `"baseball"` or `"football"` |
| `svg.anchors` | object | yes | Named coordinate anchors (see below) |
| `svg.zones[]` | array | yes | Seating zones, painted back-to-front by `layer` |
| `svg.zones[].data_zone` | string | yes | Must match `VENUE.sections` in client-config.js |
| `svg.zones[].layer` | integer | yes | Paint order: 1=back, higher=front |
| `svg.zones[].fill` | string | yes | Zone fill color `#RRGGBB` |
| `svg.zones[].suite_level` | boolean | no | `true` if this is a suite/premium level |
| `svg.zones[].path` | array | yes | Anchor names or `{anchor, offset_pct}` objects |
| `svg.gates[]` | array | yes | Gate markers placed around the perimeter |
| `svg.gates[].data_gate` | string | yes | Must match `VENUE.gates` in client-config.js |
| `svg.gates[].cx`, `cy` | number | yes | Gate circle center coordinates |
| `svg.gates[].label_side` | string | yes | `"top"`, `"bottom"`, `"left"`, or `"right"` |
| `svg.gates[].fill` | string | yes | Gate circle color |
| `svg.gates[].is_premium` | boolean | no | `true` for VIP / suite gates |
| `svg.gate_by_zone_weights` | object | yes | Probability weights: which gate each zone uses |

### Zone path entries

- **String**: anchor name resolved to exact `[x, y]`
- **Object**: `{"anchor": "name", "offset_pct": 0.55}` — 55% of the way from `center` toward the named anchor. `0.0` = center, `1.0` = the anchor itself.

### Baseball anchors (required in `svg.anchors`)

`center`, `home_plate`, `cf_wall`, `lf_corner`, `rf_corner`, `left_foul_ext`, `right_foul_ext`

Derived (available in paths, computed automatically): `lf_wall`, `rf_wall`

### Football anchors (required in `svg.anchors`)

`center`, `north_endzone`, `south_endzone`, `west_sideline`, `east_sideline`

Derived: `north_outer`, `south_outer`, `nw_outer`, `ne_outer`, `sw_outer`, `se_outer`, `west_outer`, `east_outer`

---

## Editing the Venue JSON by Hand

**Adjust zone depth**: change `offset_pct` on path entries. Higher value = closer to the anchor (outer edge). Lower value = closer to center (inner ring). Typical range: 0.35–0.75.

**Add a gate**: append an entry to `svg.gates` with new `cx`/`cy` coordinates, then add a corresponding weight array entry to every zone in `gate_by_zone_weights`.

**Remove a gate**: delete its entry from `svg.gates`, then remove the matching weight value from every `gate_by_zone_weights` array (keep arrays aligned).

**Fix a sponsor name**: edit `svg.gates[N].name` and `svg.gates[N].data_gate` — both fields must match. If `VENUE.gates` in `client-config.js` has already been generated, update it there too.

**Rerun generation after edits**:
```bash
python3 tools/generate.py [slug]-venue.json
```

---

## Adding a New Sport

1. Copy `tools/lib/geometry_football.py` to `tools/lib/geometry_basketball.py`
2. Implement `build_anchor_table(base_anchors)` and `build_field_overlay(anchors)` for the new sport
3. Add the module to `GEOMETRY_MODULES` in `tools/generate.py`:
   ```python
   from lib import geometry_basketball
   GEOMETRY_MODULES = {
       'baseball':   geometry_baseball,
       'football':   geometry_football,
       'basketball': geometry_basketball,
   }
   ```
4. Add test coverage in `tools/tests/test_geometry_basketball.py`
5. Update this README's anchor vocabulary table

---

## Troubleshooting

**`ValueError: unknown anchor 'nw_outer'`**
The zone path references a derived anchor that doesn't exist for this sport. Check `svg.sport_geometry` — derived anchor names differ between baseball and football. See the anchor vocabulary tables above.

**`data_zone "Club Level" missing from VENUE.sections`**
The `data_zone` value in a zone doesn't match what `client-config.js` expects. Ensure `svg.zones[].data_zone` values exactly match the `VENUE.sections` array (case-sensitive). Both are derived from the venue JSON zones array — they should always match unless you edited one manually.

**`ERROR: ANTHROPIC_API_KEY environment variable is not set`**
Run: `export ANTHROPIC_API_KEY=sk-ant-...` (get your key from console.anthropic.com)

**`ERROR: [slug]-venue.json already exists`**
Use `--overwrite` to replace it: `node tools/research.js "Team" "Venue" --overwrite`

**`WARNING: gate_by_zone_weights['Zone'] has N values but there are M gates`**
The weight array length doesn't match the gate count. Edit the venue JSON to align them. This is non-fatal — generation continues — but the weights will be wrong in `client-config.js`.

**Generated SVG looks wrong / zones don't line up**
Adjust `offset_pct` values in `svg.zones[].path` entries. Open the SVG in a browser as you iterate. Run `python3 tools/generate.py [slug]-venue.json` after each change.
