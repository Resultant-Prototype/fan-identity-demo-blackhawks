#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'index.html');

// ── Load config (Node require — browser uses concatenated version) ──
const { TEAM, BRAND } = require('./src/client-config');

// ── Read source files ──────────────────────────
const shell = fs.readFileSync(path.join(SRC, 'shell.html'), 'utf8');

// CSS with brand token injection
let style = fs.readFileSync(path.join(SRC, 'style.css'), 'utf8');
style = style
  .replace(/\{\{BRAND_NAVY\}\}/g,         BRAND.navy)
  .replace(/\{\{BRAND_ACCENT\}\}/g,       BRAND.accent)
  .replace(/\{\{BRAND_ACCENT_LIGHT\}\}/g, BRAND.accentLight)
  .replace(/\{\{BRAND_ACCENT_RED\}\}/g,   BRAND.accentRed);

// ── JS bundle: client-config → preset → data → filters → charts → export → main ──
const presetFile = path.join(SRC, 'presets', `${TEAM.sport}.js`);
if (!fs.existsSync(presetFile)) {
  console.error(`Error: no preset found for sport "${TEAM.sport}" at ${presetFile}`);
  process.exit(1);
}

const configJs = fs.readFileSync(path.join(SRC, 'client-config.js'), 'utf8');
const presetJs = fs.readFileSync(presetFile, 'utf8');
const restFiles = ['data.js', 'filters.js', 'charts.js', 'export.js', 'main.js'];
const restJs    = restFiles
  .map(f => `// ── ${f} ──\n` + fs.readFileSync(path.join(SRC, f), 'utf8'))
  .join('\n\n');

const script = [
  `// ── client-config.js ──\n${configJs}`,
  `// ── presets/${TEAM.sport}.js ──\n${presetJs}`,
  restJs,
].join('\n\n');

// ── Stadium SVG detection ──────────────────────
// Looks for [team-short-name-kebab]-stadium.svg in repo root.
// E.g. "Indy Rezzers" → indy-rezzers-stadium.svg
const svgSlug   = TEAM.shortName.toLowerCase().replace(/\s+/g, '-');
const svgPath   = path.join(__dirname, `${svgSlug}-stadium.svg`);
const stadiumContent = fs.existsSync(svgPath)
  ? fs.readFileSync(svgPath, 'utf8')
  : `<div class="venue-placeholder"><p>Venue diagram</p><p class="venue-placeholder-sub">Add <code>${svgSlug}-stadium.svg</code> to the repo root and run <code>node build.js</code> to enable this chart.</p></div>`;

// ── Assemble output ────────────────────────────
const output = shell
  .replace('{{STYLE}}',                      () => style)
  .replace('{{SCRIPT}}',                     () => script)
  .replace(/\{\{STADIUM_SVG\}\}/g,           () => stadiumContent)
  .replace(/\{\{PAGE_TITLE\}\}/g,            `Fan Identity Resolution Demo — ${TEAM.orgName}`)
  .replace(/\{\{TEAM_LOGO_FILE\}\}/g,        TEAM.logoFile)
  .replace(/\{\{TEAM_SHORT_NAME\}\}/g,       TEAM.shortName)
  .replace(/\{\{TEAM_ORG_NAME\}\}/g,         TEAM.orgName)
  .replace(/\{\{TEAM_STM_LABEL\}\}/g,        TEAM.stmLabel)
  .replace(/\{\{TEAM_TICKETING_VENDOR\}\}/g, TEAM.ticketingVendor)
  .replace(/\{\{TEAM_SCAN_VENDOR\}\}/g,      TEAM.scanVendor)
  .replace(/\{\{TEAM_FNB_VENDOR\}\}/g,       TEAM.fnbVendor);

fs.writeFileSync(OUT, output, 'utf8');
console.log(`Built ${OUT} (${(output.length / 1024).toFixed(1)} KB) — ${TEAM.orgName}`);
