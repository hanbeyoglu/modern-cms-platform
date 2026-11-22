const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');

function deploy(args = [], failOn = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-deploy-'));
  const log = path.join(dir, 'calls');
  fs.writeFileSync(path.join(dir, 'docker'), '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$DEPLOY_TEST_LOG"\nif [[ -n "$DEPLOY_TEST_FAIL" && "$*" == *"$DEPLOY_TEST_FAIL"* ]]; then exit 17; fi\n', { mode: 0o755 });
  const result = spawnSync('bash', [path.join(root, 'infra/scripts/deploy-prod.sh'), ...args], {
    encoding: 'utf8', env: { ...process.env, PATH: dir + path.delimiter + process.env.PATH, DEPLOY_TEST_LOG: log, DEPLOY_TEST_FAIL: failOn },
  });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [];
  fs.rmSync(dir, { recursive: true, force: true });
  return { ...result, calls };
}
test('full deployment builds serially, migrates without rebuilding, then replaces services', () => {
  const result = deploy();
  assert.equal(result.status, 0, result.stderr);
  const actions = result.calls.map(s => s.replace(/^.*docker-compose.prod.yml /, ''));
  assert.deepEqual(actions, ['config --quiet', '--progress plain build api', '--progress plain build worker', '--progress plain build admin', 'up -d --wait postgres redis', '--profile tools build migrate', '--profile tools run --rm --no-deps migrate', 'up -d --no-deps --no-build --wait --wait-timeout 180 api worker admin', 'ps']);
});
test('admin-only deploy does not build backend images or migrate', () => {
  const result = deploy(['admin']);
  assert.equal(result.status, 0);
  assert.equal(result.calls.some(s => s.includes('build api') || s.includes('build worker') || s.includes('migrate')), false);
});
test('failed builds or migrations never replace application containers', () => {
  for (const fail of ['build worker', 'run --rm --no-deps migrate']) {
    const result = deploy([], fail);
    assert.equal(result.status, 17);
    assert.equal(result.calls.some(s => s.includes('up -d --no-deps')), false);
  }
});
test('unknown service is rejected before any Docker operation', () => {
  const result = deploy(['postgres']);
  assert.equal(result.status, 2);
  assert.equal(result.calls.length, 0);
});
test('all workspace manifests are copied before dependency install in each Dockerfile', () => {
  const manifests = ['apps', 'packages'].flatMap(base => fs.readdirSync(path.join(root, base)).filter(name => fs.existsSync(path.join(root, base, name, 'package.json'))).map(name => `${base}/${name}/package.json`));
  for (const service of ['api', 'admin', 'worker']) {
    const dockerfile = fs.readFileSync(path.join(root, `infra/docker/Dockerfile.${service}`), 'utf8');
    const dependencies = dockerfile.slice(0, dockerfile.indexOf('pnpm install --frozen-lockfile'));
    for (const manifest of manifests) assert.ok(dependencies.includes(`COPY ${manifest} `), `${service}: missing ${manifest}`);
    assert.ok(!dependencies.includes('COPY apps ./apps'));
    assert.ok(!dependencies.includes('COPY packages ./packages'));
  }
});
