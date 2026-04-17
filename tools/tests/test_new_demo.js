'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

// slugify is internal to new-demo.js — inline a copy for testing
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

test('slugify: multi-word team name', () => {
  assert.equal(slugify('New York Yankees'), 'new-york-yankees');
});

test('slugify: already lowercase single word', () => {
  assert.equal(slugify('chiefs'), 'chiefs');
});

test('slugify: special characters stripped', () => {
  assert.equal(slugify('FC Dallas (MLS)'), 'fc-dallas-mls');
});

test('slugify: leading/trailing hyphens removed', () => {
  assert.equal(slugify('  Team Name  '), 'team-name');
});

// ── preflight ────────────────────────────────────────────────
const { checkEnv, checkBinary, checkDirAbsent } = require('../lib/preflight');
const os   = require('os');
const path = require('path');

test('checkEnv: returns null when key is set', () => {
  const orig = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  assert.equal(checkEnv(), null);
  if (orig === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = orig;
});

test('checkEnv: returns error message when key is missing', () => {
  const orig = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const result = checkEnv();
  assert.ok(result.includes('ANTHROPIC_API_KEY'));
  if (orig !== undefined) process.env.ANTHROPIC_API_KEY = orig;
});

test('checkBinary: returns null for git (must be installed)', () => {
  assert.equal(checkBinary('git'), null);
});

test('checkBinary: returns error for nonexistent binary', () => {
  const result = checkBinary('__nonexistent_binary_xyz__');
  assert.ok(result !== null);
  assert.ok(result.includes('not found'));
});

test('checkDirAbsent: returns null when dir does not exist', () => {
  assert.equal(checkDirAbsent('/tmp/__no_such_dir_xyz_12345__'), null);
});

test('checkDirAbsent: returns error when dir exists', () => {
  const result = checkDirAbsent(os.tmpdir());
  assert.ok(result !== null);
  assert.ok(result.includes('already exists'));
});

// ── synth: parseResponse ─────────────────────────────────────
const { parseResponse, validate, patchClientConfig, SPORT_HOME_GAMES } = require('../lib/synth');

test('parseResponse: plain JSON object', () => {
  const obj = { UPCOMING_PACING: [], SERIES_SCHEDULE: [], HOME_STATES: [], STATE_WEIGHTS: [] };
  assert.deepEqual(parseResponse(JSON.stringify(obj)), obj);
});

test('parseResponse: strips ```json fence', () => {
  const obj = { SERIES_SCHEDULE: [1, 2, 3] };
  const fenced = '```json\n' + JSON.stringify(obj) + '\n```';
  assert.deepEqual(parseResponse(fenced), obj);
});

test('parseResponse: throws SyntaxError on truly invalid JSON', () => {
  assert.throws(() => parseResponse('not json at all ###'), SyntaxError);
});

// ── synth: validate ──────────────────────────────────────────

function makeValidData(sport = 'mlb') {
  const homeGames = SPORT_HOME_GAMES[sport];
  return {
    UPCOMING_PACING: Array.from({ length: 10 }, (_, i) => ({
      opponent: 'Test Opponent', date: '2026-05-01', daysUntil: i + 1, pctSold: 70
    })),
    SERIES_SCHEDULE: [{
      start: '2026-04-01', opp: 'Test Opponent', lg: 'AL', rival: false,
      n: homeGames, tier: 'standard', promo: null, promoLabel: null
    }],
    HOME_STATES:   ['NY','NJ','CT','PA','MA','FL','CA','TX','OH','IL'],
    STATE_WEIGHTS: [200, 80, 40, 30, 25, 20, 15, 10,  8,   5],
  };
}

test('validate: passes valid MLB data (81 games)', () => {
  assert.equal(validate(makeValidData('mlb'), 'mlb').length, 0);
});

test('validate: passes valid NFL data (9 games)', () => {
  assert.equal(validate(makeValidData('nfl'), 'nfl').length, 0);
});

test('validate: fails when game count is wrong', () => {
  const data = makeValidData('mlb');
  data.SERIES_SCHEDULE[0].n = 79;
  const errors = validate(data, 'mlb');
  assert.ok(errors.some(e => e.includes('Expected 81 games, got 79')));
});

test('validate: fails on invalid date format', () => {
  const data = makeValidData('mlb');
  data.SERIES_SCHEDULE[0].start = 'April 1, 2026';
  const errors = validate(data, 'mlb');
  assert.ok(errors.some(e => e.toLowerCase().includes('invalid date')));
});

test('validate: fails on invalid tier value', () => {
  const data = makeValidData('mlb');
  data.SERIES_SCHEDULE[0].tier = 'premium';
  const errors = validate(data, 'mlb');
  assert.ok(errors.some(e => e.includes('invalid tier')));
});

test('validate: fails when UPCOMING_PACING has fewer than 5 entries', () => {
  const data = makeValidData('mlb');
  data.UPCOMING_PACING = data.UPCOMING_PACING.slice(0, 4);
  const errors = validate(data, 'mlb');
  assert.ok(errors.some(e => e.includes('at least 5')));
});

test('validate: fails when daysUntil is 0', () => {
  const data = makeValidData('mlb');
  data.UPCOMING_PACING[0].daysUntil = 0;
  const errors = validate(data, 'mlb');
  assert.ok(errors.some(e => e.includes('daysUntil')));
});

test('validate: fails when HOME_STATES has wrong length', () => {
  const data = makeValidData('mlb');
  data.HOME_STATES = ['NY', 'NJ'];
  const errors = validate(data, 'mlb');
  assert.ok(errors.some(e => e.includes('HOME_STATES')));
});

test('validate: fails when STATE_WEIGHTS has wrong length', () => {
  const data = makeValidData('mlb');
  data.STATE_WEIGHTS = [100];
  const errors = validate(data, 'mlb');
  assert.ok(errors.some(e => e.includes('STATE_WEIGHTS')));
});

test('validate: returns multiple errors independently', () => {
  const data = makeValidData('mlb');
  data.SERIES_SCHEDULE[0].n = 79;
  data.UPCOMING_PACING[0].daysUntil = 0;
  const errors = validate(data, 'mlb');
  assert.ok(errors.length >= 2);
});

// ── synth: generateSynthData — venue validation ───────────────
const { generateSynthData } = require('../lib/synth');

test('generateSynthData: throws on unknown sport', async () => {
  const badVenue = { sport: 'cricket', team: { name: 'Test', slug: 'test' } };
  await assert.rejects(
    () => generateSynthData(badVenue, '/tmp/fake.js', '/tmp', true),
    /Invalid sport/
  );
});

test('generateSynthData: throws when team.name is missing', async () => {
  const badVenue = { sport: 'mlb', team: { slug: 'test' } };
  await assert.rejects(
    () => generateSynthData(badVenue, '/tmp/fake.js', '/tmp', true),
    /team\.name/
  );
});

// ── synth: patchClientConfig ─────────────────────────────────
const tmpOs   = require('os');
const tmpFs   = require('fs');
const tmpPath = require('path');

test('patchClientConfig: replaces all four stub fields', () => {
  const dir = tmpFs.mkdtempSync(tmpPath.join(tmpOs.tmpdir(), 'synth-test-'));
  const configPath = tmpPath.join(dir, 'client-config.js');

  tmpFs.writeFileSync(configPath, [
    'const UPCOMING_PACING = [];',
    'const SERIES_SCHEDULE = [];',
    "const HOME_STATES = ['STUB_STATE'];",
    'const STATE_WEIGHTS = [100];',
  ].join('\n'));

  const data = makeValidData('mlb');
  patchClientConfig(configPath, data);

  const result = tmpFs.readFileSync(configPath, 'utf8');
  assert.ok(!result.includes('STUB_STATE'),          'HOME_STATES stub not replaced');
  assert.ok(!result.includes('STATE_WEIGHTS = [100]'), 'STATE_WEIGHTS stub not replaced');
  assert.ok(result.includes('"NY"'),                 'HOME_STATES value not written');
  assert.ok(result.includes('Test Opponent'),        'SERIES_SCHEDULE not written');
  assert.ok(result.includes('daysUntil'),            'UPCOMING_PACING not written');

  tmpFs.rmSync(dir, { recursive: true });
});

test('patchClientConfig: does not modify other config fields', () => {
  const dir = tmpFs.mkdtempSync(tmpPath.join(tmpOs.tmpdir(), 'synth-test2-'));
  const configPath = tmpPath.join(dir, 'client-config.js');

  tmpFs.writeFileSync(configPath, [
    "const TEAM = { sport: 'mlb', orgName: 'Test Org' };",
    'const UPCOMING_PACING = [];',
    'const SERIES_SCHEDULE = [];',
    "const HOME_STATES = ['STUB_STATE'];",
    'const STATE_WEIGHTS = [100];',
  ].join('\n'));

  patchClientConfig(configPath, makeValidData('mlb'));

  const result = tmpFs.readFileSync(configPath, 'utf8');
  assert.ok(result.includes("orgName: 'Test Org'"), 'TEAM field was modified');

  tmpFs.rmSync(dir, { recursive: true });
});
