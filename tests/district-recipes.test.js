'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { runRecipe, CHECK_NAMES, manifestHash } = require('../app/district/recipes');

const HTML = '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><form><input data-testid="task-input"><button data-testid="add-task">Add</button></form><ul data-testid="task-list"></ul><script src="script.js"></script></body></html>';
const RALLY_HTML = '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body data-neon-rally-app><script src="script.js"></script></body></html>';
function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bus-recipe-'));
  const root = path.join(temp, 'project'), artifactRoot = path.join(root, '.agent-bus', 'artifacts', 'run-1');
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, 'index.html'), HTML);
  fs.writeFileSync(path.join(root, 'styles.css'), 'body { color: teal; }');
  fs.writeFileSync(path.join(root, 'script.js'), 'document.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); });');
  t.after(() => {
    const resolved = path.resolve(temp), allowed = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(resolved.startsWith(allowed) && path.basename(resolved).startsWith('agent-bus-recipe-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return { root, artifactRoot, runId: 'run-1' };
}
function named(result, name) { return result.checks.find((check) => check.name === name); }

test('recipe checks actual source and publishes an exact candidate-bound artifact', async (t) => {
  const options = fixture(t), events = [];
  fs.mkdirSync(path.join(options.root, '.agent-bus'));
  fs.writeFileSync(path.join(options.root, '.agent-bus', 'private.txt'), 'not public');
  const result = await runRecipe({ ...options, onEvent: (event) => events.push(event) });
  assert.equal(result.state, 'passed', result.output);
  assert.equal(result.contractId, 'checklist');
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.checks.map((check) => check.name), CHECK_NAMES);
  assert.ok(result.checks.every((check) => check.state === 'passed'));
  assert.equal(result.source.hash, manifestHash(result.source.files));
  assert.equal(result.artifact.candidateHash, result.source.hash);
  assert.deepEqual(result.artifact.manifest, result.source.files);
  for (const [name, digest] of Object.entries(result.source.files)) {
    const bytes = fs.readFileSync(path.join(result.artifact.root, name));
    assert.deepEqual(bytes, fs.readFileSync(path.join(options.root, name)));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), digest);
  }
  assert.ok(!fs.existsSync(path.join(result.artifact.root, '.agent-bus')));
  assert.ok(events.some((event) => event.type === 'phase' && event.phase === 'build'));
  assert.match(result.output, /Browser interaction remains unverified/);
});

test('planted missing-entry break fails its named check, then restored source passes', async (t) => {
  const options = fixture(t), script = path.join(options.root, 'script.js'), before = fs.readFileSync(script);
  fs.unlinkSync(script);
  const broken = await runRecipe(options);
  assert.equal(broken.state, 'failed'); assert.equal(named(broken, 'Required entry files').state, 'failed'); assert.equal(broken.artifact, null);
  fs.writeFileSync(script, before);
  assert.equal((await runRecipe(options)).state, 'passed');
});

test('planted HTML contract break is named and cannot be hidden in a comment', async (t) => {
  const options = fixture(t);
  fs.writeFileSync(path.join(options.root, 'index.html'), HTML.replace('data-testid="task-list"', 'data-other="task-list"') + '<!-- <ul data-testid="task-list"></ul> -->');
  const broken = await runRecipe(options);
  assert.equal(broken.state, 'failed'); assert.equal(named(broken, 'HTML contract').state, 'failed'); assert.match(broken.output, /task-list/);
  assert.ok(!fs.existsSync(options.artifactRoot));
  fs.writeFileSync(path.join(options.root, 'index.html'), HTML);
  assert.equal((await runRecipe(options)).state, 'passed');
});

test('a selector mentioned inside script text cannot satisfy the HTML markup contract', async (t) => {
  const options = fixture(t);
  fs.writeFileSync(path.join(options.root, 'index.html'), HTML.replace('data-testid="task-list"', 'data-other="task-list"').replace('</body>', '<script>const example = \'<ul data-testid="task-list"></ul>\';</script></body>'));
  const result = await runRecipe(options);
  assert.equal(result.state, 'failed'); assert.equal(named(result, 'HTML contract').state, 'failed');
});

test('actual Node syntax subprocess catches a planted error and does not execute source', async (t) => {
  const options = fixture(t), script = path.join(options.root, 'script.js'), marker = path.join(options.root, 'executed.txt');
  fs.writeFileSync(script, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'should not run');\nconst broken = ;`);
  const broken = await runRecipe(options);
  assert.equal(broken.state, 'failed'); assert.equal(named(broken, 'JavaScript syntax').state, 'failed'); assert.equal(broken.artifact, null);
  assert.ok(!fs.existsSync(marker));
  fs.writeFileSync(script, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'still should not run');`);
  assert.equal((await runRecipe(options)).state, 'passed'); assert.ok(!fs.existsSync(marker));
});

test('local asset break is detected and exact restored source passes', async (t) => {
  const options = fixture(t), style = path.join(options.root, 'styles.css');
  fs.writeFileSync(style, 'body { background: url("missing.svg"); }');
  const broken = await runRecipe(options);
  assert.equal(broken.state, 'failed'); assert.equal(named(broken, 'Local asset references').state, 'failed'); assert.match(broken.output, /missing.svg/);
  fs.writeFileSync(path.join(options.root, 'missing.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.equal((await runRecipe(options)).state, 'passed');
});

test('root-relative assets are rejected because token-scoped preview requires relative URLs', async (t) => {
  const options = fixture(t);
  fs.writeFileSync(path.join(options.root, 'styles.css'), 'body { background: url(/icon.svg); }');
  fs.writeFileSync(path.join(options.root, 'icon.svg'), '<svg></svg>');
  const result = await runRecipe(options);
  assert.equal(named(result, 'Local asset references').state, 'failed'); assert.match(result.output, /relative local asset/);
});

test('source mutation during build cannot publish an old passing artifact', async (t) => {
  const options = fixture(t);
  const result = await runRecipe({ ...options, onEvent: (event) => { if (event.type === 'phase' && event.phase === 'build') fs.appendFileSync(path.join(options.root, 'styles.css'), '\nbody { color: red; }'); } });
  assert.equal(result.state, 'failed'); assert.equal(named(result, 'Snapshot integrity').state, 'failed'); assert.equal(result.artifact, null);
  assert.ok(!fs.existsSync(options.artifactRoot));
  assert.equal((await runRecipe(options)).state, 'passed');
});

test('mutation from the final check observer is rechecked before success', async (t) => {
  const options = fixture(t);
  const result = await runRecipe({ ...options, onEvent: (event) => { if (event.name === 'Snapshot integrity' && event.state === 'passed') fs.appendFileSync(path.join(options.root, 'script.js'), '\n// changed after check event'); } });
  assert.equal(result.state, 'failed'); assert.equal(result.artifact, null); assert.ok(!fs.existsSync(options.artifactRoot));
});

test('artifact destinations are single-use and cannot overwrite a prior candidate', async (t) => {
  const options = fixture(t), first = await runRecipe(options);
  assert.equal(first.state, 'passed');
  fs.appendFileSync(path.join(options.root, 'styles.css'), '\nbody { color: violet; }');
  const second = await runRecipe(options);
  assert.equal(second.state, 'failed'); assert.equal(second.artifact, null);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(first.artifact.root, 'styles.css'))).digest('hex'), first.artifact.manifest['styles.css']);
});

test('pre-cancelled and in-progress cancelled recipes never publish artifacts', async (t) => {
  const options = fixture(t), before = new AbortController(); before.abort();
  assert.equal((await runRecipe({ ...options, signal: before.signal })).state, 'cancelled');
  const active = new AbortController();
  const result = await runRecipe({ ...options, signal: active.signal, onEvent: (event) => { if (event.name === 'JavaScript syntax' && event.state === 'running') setImmediate(() => active.abort()); } });
  assert.equal(result.state, 'cancelled'); assert.equal(result.exitCode, null); assert.equal(result.artifact, null); assert.ok(!fs.existsSync(options.artifactRoot));
});

test('unsupported, oversized and linked public files fail without creating a candidate', async (t) => {
  const options = fixture(t), bad = path.join(options.root, 'unsafe.exe'); fs.writeFileSync(bad, 'not executable');
  assert.equal((await runRecipe(options)).state, 'failed'); fs.unlinkSync(bad);
  const large = path.join(options.root, 'large.txt'); fs.writeFileSync(large, Buffer.alloc(1024 * 1024 + 1));
  assert.equal((await runRecipe(options)).state, 'failed'); fs.unlinkSync(large);
  const linked = path.join(options.root, 'linked.js'); fs.linkSync(path.join(options.root, 'script.js'), linked);
  const result = await runRecipe(options); assert.equal(result.state, 'failed'); assert.match(result.output, /unlinked file/); assert.equal(result.artifact, null);
});

test('source files cannot be used as artifact output and no cwd fallback exists', async (t) => {
  const options = fixture(t);
  assert.equal((await runRecipe({ ...options, artifactRoot: path.join(options.root, 'public-output') })).state, 'failed');
  assert.equal((await runRecipe({ artifactRoot: options.artifactRoot, runId: 'missing-root' })).state, 'failed');
  assert.ok(!fs.existsSync(options.artifactRoot));
});

test('inline and module script syntax is checked without claiming browser behavior', async (t) => {
  const options = fixture(t);
  fs.writeFileSync(path.join(options.root, 'index.html'), HTML.replace('<script src="script.js"></script>', '<script type="module" src="script.js"></script><script>const broken = ;</script>'));
  fs.writeFileSync(path.join(options.root, 'script.js'), 'export const value = 1;');
  const broken = await runRecipe(options);
  assert.equal(named(broken, 'JavaScript syntax').state, 'failed'); assert.match(broken.output, /inline script/);
  fs.writeFileSync(path.join(options.root, 'index.html'), HTML.replace('<script src="script.js"></script>', '<script type="module" src="script.js"></script>'));
  assert.equal((await runRecipe(options)).state, 'passed');
});

test('trusted dynamic Rally mount contract passes without fake controls and preserves five checks', async (t) => {
  const options = fixture(t);
  fs.writeFileSync(path.join(options.root, 'index.html'), RALLY_HTML);
  fs.writeFileSync(path.join(options.root, 'script.js'), 'document.querySelector("[data-neon-rally-app]");');
  const result = await runRecipe({ ...options, contractId: 'neon-rally' });
  assert.equal(result.state, 'passed', result.output);
  assert.equal(result.contractId, 'neon-rally');
  assert.deepEqual(result.checks.map((check) => check.name), CHECK_NAMES);
  assert.ok(result.checks.every((check) => check.state === 'passed'));
  assert.equal(result.artifact.candidateHash, result.source.hash);
  assert.ok(!/task-input|add-task|task-list/.test(fs.readFileSync(path.join(result.artifact.root, 'index.html'), 'utf8')));
  assert.ok(!/data-testid=/.test(fs.readFileSync(path.join(result.artifact.root, 'index.html'), 'utf8')));
  assert.match(named(result, 'HTML contract').detail, /Rally mount/);
  assert.match(named(result, 'HTML contract').detail, /live controls require separate browser verification/);
});

test('planted Rally mount selector break fails by name and actual restored source passes', async (t) => {
  const options = fixture(t), entry = path.join(options.root, 'index.html');
  fs.writeFileSync(entry, RALLY_HTML.replace('data-neon-rally-app', 'data-other-app'));
  const missing = await runRecipe({ ...options, contractId: 'neon-rally' });
  assert.equal(missing.state, 'failed'); assert.equal(named(missing, 'HTML contract').state, 'failed');
  assert.equal(missing.contractId, 'neon-rally'); assert.match(missing.output, /data-neon-rally-app/); assert.equal(missing.artifact, null);
  assert.ok(!fs.existsSync(options.artifactRoot));
  fs.writeFileSync(entry, RALLY_HTML);
  const restored = await runRecipe({ ...options, contractId: 'neon-rally' });
  assert.equal(restored.state, 'passed', restored.output);
  assert.deepEqual(fs.readFileSync(path.join(restored.artifact.root, 'index.html')), Buffer.from(RALLY_HTML));
});

test('Rally mount root is required exactly once and cannot be supplied by script text', async (t) => {
  const options = fixture(t), entry = path.join(options.root, 'index.html');
  for (const html of [
    RALLY_HTML.replace('data-neon-rally-app', 'data-other-app'),
    RALLY_HTML.replace('</body>', '<div data-neon-rally-app></div></body>'),
    RALLY_HTML.replace('data-neon-rally-app', 'data-other-app').replace('</body>', '<script>const sample = "<div data-neon-rally-app></div>";</script></body>'),
  ]) {
    fs.writeFileSync(entry, html);
    const result = await runRecipe({ ...options, contractId: 'neon-rally' });
    assert.equal(result.state, 'failed'); assert.equal(named(result, 'HTML contract').state, 'failed');
    assert.equal(result.contractId, 'neon-rally');
    assert.match(result.output, /data-neon-rally-app mount root/); assert.equal(result.artifact, null);
  }
});

test('unknown contract IDs fail before syntax execution or artifact publication', async (t) => {
  const options = fixture(t), events = [];
  for (const contractId of ['unknown', 'Neon-Rally', '', null, {}, '__proto__']) {
    const result = await runRecipe({ ...options, contractId, onEvent: (event) => events.push(event) });
    assert.equal(result.state, 'failed'); assert.equal(named(result, 'HTML contract').state, 'failed');
    assert.equal(result.contractId, null);
    assert.match(result.output, /Unknown recipe contract/); assert.equal(result.artifact, null);
  }
  assert.ok(!events.some((event) => event.name === 'JavaScript syntax' && event.state === 'running'));
  assert.ok(!fs.existsSync(options.artifactRoot));
  assert.equal((await runRecipe(options)).state, 'passed', 'default checklist contract remains valid');
});

test('contract choice comes from the trusted argument, never an app-authored marker', async (t) => {
  const options = fixture(t), entry = path.join(options.root, 'index.html');
  fs.writeFileSync(entry, RALLY_HTML);
  const defaultResult = await runRecipe(options);
  assert.equal(defaultResult.state, 'failed'); assert.match(defaultResult.output, /task-input/);
  fs.writeFileSync(entry, HTML.replace('<body>', '<body data-recipe-contract="neon-rally">'));
  const rallyResult = await runRecipe({ ...options, contractId: 'neon-rally' });
  assert.equal(rallyResult.state, 'failed'); assert.match(rallyResult.output, /data-neon-rally-app/);
});

test('cancelled and failed results retain only a validated canonical contract ID', async (t) => {
  const options = fixture(t), controller = new AbortController(); controller.abort();
  for (const contractId of ['checklist', 'neon-rally']) {
    const result = await runRecipe({ ...options, contractId, signal: controller.signal });
    assert.equal(result.state, 'cancelled'); assert.equal(result.contractId, contractId);
  }
  const failed = await runRecipe({ ...options, contractId: 'neon-rally' });
  assert.equal(failed.state, 'failed'); assert.equal(failed.contractId, 'neon-rally');
});
