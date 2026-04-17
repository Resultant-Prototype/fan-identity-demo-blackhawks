'use strict';
const path     = require('path');
const fs       = require('fs');
const { spawnSync } = require('child_process');
const readline = require('readline');

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function run(cmd, opts = {}) {
  const result = spawnSync('sh', ['-c', cmd], { stdio: 'inherit', ...opts });
  if (result.status !== 0) {
    console.error(`\nFailed: ${cmd}`);
    process.exit(2);
  }
}

function pause() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => { rl.close(); resolve(); });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const flags = { resume: null, dryRun: false, quiet: false, svg: null };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--resume')   { flags.resume = slugify(args[++i]); }
    else if (args[i] === '--svg') { flags.svg    = args[++i]; }
    else if (args[i] === '--dry-run') flags.dryRun = true;
    else if (args[i] === '--quiet')   flags.quiet  = true;
    else positional.push(args[i]);
  }

  const isResume = flags.resume !== null;
  const slug     = isResume ? flags.resume : (positional[0] ? slugify(positional[0]) : null);
  const teamName  = isResume ? null : positional[0];
  const venueName = isResume ? null : positional[1];

  if (!slug || (!isResume && (!teamName || !venueName))) {
    console.error('Usage: node tools/new-demo.js "Team Name" "Venue Name" [--svg <scraped.svg>] [--dry-run] [--quiet]');
    console.error('       node tools/new-demo.js --resume <slug>');
    process.exit(1);
  }

  const repoName = `fan-demo-${slug}`;
  const localDir = path.join(process.env.HOME, 'fan-demos', slug);
  const TEMPLATE = 'https://github.com/brianvinson-serve/fan-identity-demo-template.git';
  const SVGS_DIR = path.join(__dirname, '..', 'source-svgs');
  const { runPreflight } = require('./lib/preflight');

  // Auto-detect scraped SVG from source-svgs/ if --svg not provided
  if (!flags.svg && !isResume) {
    const slugLast = slug.split('-').pop();   // "kansas-city-chiefs" → "chiefs"
    outer: for (const sport of ['mlb', 'nfl', 'nba', 'nhl']) {
      for (const candidate of [slug, slugLast]) {
        const p = path.join(SVGS_DIR, sport, `${candidate}.svg`);
        if (fs.existsSync(p)) {
          flags.svg = p;
          if (!flags.quiet) console.log(`Auto-detected SVG: source-svgs/${sport}/${candidate}.svg`);
          break outer;
        }
      }
    }
    if (!flags.svg && !flags.quiet) console.log('No scraped SVG found — will use generate.py (approximate geometry).');
  }

  // Step 0: Preflight
  if (!flags.quiet) console.log('Running preflight checks...');
  await runPreflight({ repoName, localDir, dryRun: flags.dryRun, isResume });
  if (!flags.quiet) console.log('✓ Preflight passed\n');

  if (flags.dryRun) {
    const { buildSynthPrompt, SPORT_HOME_GAMES } = require('./lib/synth');
    console.log('DRY RUN — would create:');
    console.log(`  Local:  ${localDir}`);
    console.log(`  GitHub: github.com/brianvinson-serve/${repoName} (private)`);
    console.log(`  Slug:   ${slug}`);
    if (teamName) console.log(`  Team:   ${teamName} at ${venueName}`);
    if (flags.svg) console.log(`  SVG:    ${flags.svg} (scraped — exact geometry)`);
    else           console.log(`  SVG:    generate.py fallback (approximate geometry)`);
    console.log('\n── Synthetic data prompt (Step 8) would be sent to claude-sonnet-4-6:');
    // Build a representative prompt with placeholder venue for schema preview
    const placeholderVenue = {
      sport: 'mlb',
      team: { name: teamName || slug, slug },
    };
    console.log(buildSynthPrompt(placeholderVenue, new Date().toISOString().slice(0, 10)));
    process.exit(0);
  }

  if (!isResume) {
    // Step 2: Clone template
    if (!flags.quiet) console.log(`Cloning template → ${localDir}`);
    fs.mkdirSync(path.join(process.env.HOME, 'fan-demos'), { recursive: true });
    run(`git clone "${TEMPLATE}" "${localDir}"`);

    // Step 3: Create GitHub repo and point origin at it
    if (!flags.quiet) console.log(`Creating GitHub repo: brianvinson-serve/${repoName}`);
    run(`gh repo create brianvinson-serve/${repoName} --private`);
    run('git remote remove origin', { cwd: localDir });
    run(`git remote add origin https://github.com/brianvinson-serve/${repoName}.git`, { cwd: localDir });
    run('git push -u origin main', { cwd: localDir });

    // Step 4: npm install
    if (!flags.quiet) console.log('Installing npm dependencies...');
    run('npm install', { cwd: localDir });

    // Step 5: Research (with optional scraped SVG section mapping)
    if (!flags.quiet) console.log(`\nResearching "${teamName}" at "${venueName}"...`);
    const sectionsFlag = flags.svg ? ` --sections-from "${flags.svg}"` : '';
    run(`node tools/research.js "${teamName}" "${venueName}"${sectionsFlag}`, { cwd: localDir });

    // Review gate
    const venueJsonPath = path.join(localDir, `${slug}-venue.json`);
    console.log(`\n✓ Venue research complete → ${venueJsonPath}\n`);
    console.log('Things to verify against the team\'s current website:');
    console.log('  • Zone names match the actual seating map sections');
    if (flags.svg) {
      console.log('  • section_ids patterns cover all scraped sections (check the output above)');
    }
    console.log('  • Gate sponsor names are current (naming rights change)');
    console.log('  • primary_hex / secondary_hex match official brand colors');
    console.log('  • ticketing_vendor, scan_vendor, fnb_vendor are accurate');
    console.log('  • venue.capacity is correct for the current season');
    console.log('\nReference example (already in repo): tools/tests/fixtures/texas-rangers-venue.json\n');
    console.log('Press Enter to continue, or Ctrl+C to abort and edit the JSON.');
    console.log(`After editing, run: node tools/new-demo.js --resume ${slug}${flags.svg ? ` --svg "${flags.svg}"` : ''}\n`);
    await pause();
  }

  // Step 6: Generate SVG (exact geometry from scraped SVG, or approximate fallback)
  if (!flags.quiet) console.log('Generating stadium SVG...');
  const venueJsonPath = path.join(localDir, `${slug}-venue.json`);
  const venueData     = JSON.parse(fs.readFileSync(venueJsonPath, 'utf8'));
  const shortSlug     = venueData.team.short_name.toLowerCase().replace(/\s+/g, '-');
  const svgOutPath    = path.join(localDir, `${shortSlug}-stadium.svg`);

  if (flags.svg) {
    // Copy the scraped SVG into the repo so it's self-contained
    const scrapedCopy = path.join(localDir, `${slug}-scraped.svg`);
    fs.copyFileSync(flags.svg, scrapedCopy);
    // Convert scraped SVG → demo-ready SVG using venue config for zone mapping
    run(
      `python3 tools/from_seating_chart.py "${scrapedCopy}" "${shortSlug}" --config "${venueJsonPath}"`,
      { cwd: localDir }
    );
    // from_seating_chart.py writes ${shortSlug}-stadium.svg in cwd (localDir) — already correct path
  } else {
    // Fallback: approximate geometry from anchors in venue JSON
    run(`python3 tools/generate.py ${slug}-venue.json`, { cwd: localDir });
  }

  if (!fs.existsSync(svgOutPath)) {
    console.error(`✗ Expected SVG not found: ${svgOutPath}`);
    process.exit(2);
  }
  if (!flags.quiet) console.log(`✓ SVG ready: ${svgOutPath}`);

  // Step 7: scaffold_config.py → copy to src/client-config.js
  if (!flags.quiet) console.log('Scaffolding client config...');
  run(`python3 tools/scaffold_config.py ${slug}-venue.json`, { cwd: localDir });
  fs.copyFileSync(
    path.join(localDir, `${slug}-config-stub.js`),
    path.join(localDir, 'src', 'client-config.js')
  );
  if (!flags.quiet) console.log('✓ Config stub copied to src/client-config.js');
}

main().catch(err => { console.error(err.message); process.exit(2); });
