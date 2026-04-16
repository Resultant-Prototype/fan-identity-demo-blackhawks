// tools/research.js
'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const fs   = require('fs');
const path = require('path');

// ── Schema validation ──────────────────────────────────────────

const REQUIRED_TOP    = ['schema_version','sport','team','identity','venue','svg'];
const REQUIRED_TEAM   = ['name','short_name','slug','stm_label'];
const REQUIRED_IDENT  = ['primary_hex','secondary_hex','ticketing_vendor','scan_vendor','fnb_vendor'];
const REQUIRED_VENUE  = ['name','capacity'];
const REQUIRED_SVG    = ['viewbox','sport_geometry','anchors','zones','gates','gate_by_zone_weights'];

function validateVenueJson(obj) {
  const errors = [];
  for (const k of REQUIRED_TOP)   if (!(k in obj))           errors.push(`missing top-level: ${k}`);
  if (obj.team)    for (const k of REQUIRED_TEAM)   if (!(k in obj.team))    errors.push(`team.${k} missing`);
  if (obj.identity) for (const k of REQUIRED_IDENT) if (!(k in obj.identity)) errors.push(`identity.${k} missing`);
  if (obj.venue)   for (const k of REQUIRED_VENUE)  if (!(k in obj.venue))   errors.push(`venue.${k} missing`);
  if (obj.svg)     for (const k of REQUIRED_SVG)    if (!(k in obj.svg))     errors.push(`svg.${k} missing`);
  if (obj.svg?.zones?.length === 0)  errors.push('svg.zones must not be empty');
  if (obj.svg?.gates?.length === 0)  errors.push('svg.gates must not be empty');
  return errors;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Research prompt ────────────────────────────────────────────

function buildPrompt(teamName, venueName) {
  return `You are a sports venue researcher. Output ONLY valid JSON with no prose, no markdown fences.

Research "${teamName}" playing at "${venueName}" and return a venue intelligence object matching this exact schema:

{
  "schema_version": "1.0",
  "sport": "mlb|nfl|nba|nhl",
  "team": {
    "name": "Full official team name",
    "short_name": "Short display name (e.g. 'Chiefs', not 'Kansas City Chiefs')",
    "slug": "kebab-case-team-slug",
    "stm_label": "Season ticket member program name (e.g. 'Rangers Nation Member')"
  },
  "identity": {
    "primary_hex":      "#RRGGBB primary brand color",
    "secondary_hex":    "#RRGGBB secondary/accent brand color",
    "ticketing_vendor": "Primary ticketing platform name",
    "scan_vendor":      "Gate scan / entry technology vendor",
    "fnb_vendor":       "Primary food & beverage concessionaire"
  },
  "venue": {
    "name":     "Full official venue name including any naming rights sponsor",
    "capacity": 00000
  },
  "svg": {
    "viewbox": "0 0 900 800",
    "sport_geometry": "baseball|football|basketball|hockey",
    "anchors": {
      "center": [cx, cy],
      /* baseball: also include home_plate, cf_wall, lf_corner, rf_corner, left_foul_ext, right_foul_ext */
      /* football: also include north_endzone, south_endzone, west_sideline, east_sideline */
      /* Position home plate / south endzone near bottom-center (y≈570-580), CF wall / north endzone near top (y≈60-100) */
      /* All coordinates within viewbox 0 0 900 800 */
    },
    "zones": [
      {
        "name": "Zone display name",
        "data_zone": "Zone display name",
        "layer": 1,
        "fill": "#RRGGBB",
        "suite_level": false,
        "path": ["anchor_name_or_offset_object"]
      }
    ],
    "gates": [
      {
        "name": "Official gate name including any sponsor prefix",
        "data_gate": "Official gate name including any sponsor prefix",
        "cx": 000, "cy": 000,
        "label_side": "top|bottom|left|right",
        "fill": "#RRGGBB",
        "is_premium": false
      }
    ],
    "gate_by_zone_weights": {
      "Zone Name": [weight_per_gate_in_order]
    }
  }
}

Guidelines:
- Use real current sponsor names for gates (e.g. "Toyota Southwest Entry", "TXU Energy North Entry")
- Layers: 1=outermost (Upper/Club/Terrace), higher numbers = closer to field
- Zones should cover: upper/nosebleed, club/mezzanine, field/lower, any notable premium/suite club
- Suite-level zones: set suite_level=true, is_premium=true on dedicated suite gates
- Gate positions: place circle centers just outside the stadium footprint, distributed around the perimeter
- gate_by_zone_weights: integer weights (not decimals); each array length must equal number of gates
- For baseball: north=outfield/CF direction, south=home plate direction
- For football: north/south = end zones (researcher's choice which end is "north")
- Output ONLY the JSON object. No explanation, no markdown.`;
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const flags = { overwrite: false, dryRun: false, quiet: false };
  const positional = [];

  for (const a of args) {
    if (a === '--overwrite') flags.overwrite = true;
    else if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--quiet') flags.quiet = true;
    else positional.push(a);
  }

  if (positional.length < 2) {
    console.error('Usage: node tools/research.js "Team Name" "Venue Name" [--overwrite] [--dry-run] [--quiet]');
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('Set it with: export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(2);
  }

  const [teamName, venueName] = positional;
  const slug = slugify(teamName);
  const outPath = path.join(process.cwd(), `${slug}-venue.json`);

  if (fs.existsSync(outPath) && !flags.overwrite && !flags.dryRun) {
    console.error(`ERROR: ${outPath} already exists. Use --overwrite to replace it.`);
    process.exit(1);
  }

  if (!flags.quiet) console.log(`Researching "${teamName}" at "${venueName}"...`);

  const client = new Anthropic({ apiKey });

  let venueObj;
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: buildPrompt(teamName, venueName) }],
    });

    // Extract text from response (tool use may precede final text)
    const textBlock = response.content.filter(b => b.type === 'text').pop();
    if (!textBlock) throw new Error('No text block in response');

    // Strip any accidental markdown fences
    const raw = textBlock.text.replace(/^```[a-z]*\n?/m, '').replace(/```$/m, '').trim();
    venueObj = JSON.parse(raw);
  } catch (err) {
    console.error(`ERROR calling Claude API: ${err.message}`);
    process.exit(2);
  }

  // Validate
  const errors = validateVenueJson(venueObj);
  if (errors.length > 0) {
    console.error('ERROR: Response failed schema validation:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  if (flags.dryRun) {
    console.log('DRY RUN — would write:');
    console.log(JSON.stringify(venueObj, null, 2));
    process.exit(0);
  }

  fs.writeFileSync(outPath, JSON.stringify(venueObj, null, 2) + '\n');

  if (!flags.quiet) {
    console.log(`✓ Written: ${outPath}`);
    console.log(`  Team:     ${venueObj.team.name} (${venueObj.sport.toUpperCase()})`);
    console.log(`  Venue:    ${venueObj.venue.name} (cap: ${venueObj.venue.capacity.toLocaleString()})`);
    console.log(`  Zones:    ${venueObj.svg.zones.map(z => z.name).join(', ')}`);
    console.log(`  Gates:    ${venueObj.svg.gates.map(g => g.name).join(', ')}`);
    console.log(`  Colors:   primary=${venueObj.identity.primary_hex}  secondary=${venueObj.identity.secondary_hex}`);
    console.log('');
    console.log('⚠  Verify sponsor/gate names against the team website before committing.');
  }

  console.log(JSON.stringify({ status: 'ok', slug, path: outPath }));
}

main().catch(err => { console.error(err); process.exit(2); });
