const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const prefix = 'ghcr.io/hanbeyoglu/modern-cms-platform';
function run(services, fail = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-images-'));
  const log = path.join(dir, 'log');
  const manifest = path.join(dir, 'release.json');
  fs.writeFileSync(manifest, JSON.stringify({ sha, services, images: Object.fromEntries(['api','worker','admin','migrate'].map(s => [s, `${prefix}/${s}:${sha}`])) }));
  fs.writeFileSync(path.join(dir, 'docker'), '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$TEST_LOG"\n[[ -z "$TEST_FAIL" || "$*" != *"$TEST_FAIL"* ]]\n', { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'flock'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  const result = spawnSync('bash', [path.join(root, 'infra/scripts/deploy-images.sh'), manifest], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}`, TEST_LOG: log, TEST_FAIL: fail, CMS_RELEASE_DIR: path.join(dir, 'state') } });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [];
  const recorded = fs.existsSync(path.join(dir, 'state/current.json'));
  fs.rmSync(dir, { recursive: true, force: true });
  return { ...result, calls, recorded };
}
test('registry deployment pulls, migrates and waits for health without building', () => {
  const result = run(['api','worker']);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.calls.some(s => s.includes('pull api worker')));
  assert.ok(result.calls.some(s => s.includes('pull migrate')));
  assert.ok(result.calls.some(s => s.includes('run --rm --no-deps migrate')));
  assert.ok(result.calls.some(s => s.includes('--wait-timeout 180 api worker')));
  assert.ok(!result.calls.some(s => /(?:^| )build(?: |$)/.test(s)));
  assert.equal(result.recorded, true);
});
test('admin-only deployment does not touch migrations or database services', () => {
  const result = run(['admin']);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.calls.some(s => /migrate|postgres|redis/.test(s)));
});
test('migration or health failure never records a successful release', () => {
  for (const failure of ['run --rm', '--wait-timeout']) {
    const result = run(['api'], failure);
    assert.notEqual(result.status, 0);
    assert.equal(result.recorded, false);
    if (failure === 'run --rm') assert.ok(!result.calls.some(s => s.includes('up -d --no-deps')));
  }
});
test('documentation-only release does not change application containers', () => {
  const result = run([]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.calls.some(s => /pull|\bup\b/.test(s)));
  assert.equal(result.recorded, true);
});

test('migration flags in both scripts are accepted by the Compose CLI parser', (t) => {
  // Parse real script flags without accessing a daemon or production resources.
  for (const script of ['deploy-images.sh', 'deploy-prod.sh']) {
    const source = fs.readFileSync(path.join(root, 'infra/scripts', script), 'utf8');
    const match = source.match(/--profile tools run (.+) migrate/);
    assert.ok(match, script);
    const flags = match[1].trim().split(/\s+/);
    const result = spawnSync('docker', ['compose', 'run', ...flags, '--help'], { encoding: 'utf8' });
    if (result.error?.code === 'ENOENT') { t.skip('Docker CLI is unavailable'); return; }
    assert.equal(result.status, 0, result.stderr);
  }
});
