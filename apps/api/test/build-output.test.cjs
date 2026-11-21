const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Nest emits main.js on repeated builds even when deleteOutDir removes previous output', { timeout: 60000 }, () => {
  const apiRoot = path.resolve(__dirname, '..');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-build-output-'));
  try {
    const sourceRoot = path.join(root, 'src');
    const outDir = path.join(root, 'dist');
    fs.mkdirSync(sourceRoot);
    fs.writeFileSync(path.join(sourceRoot, 'main.ts'), 'export const ready = true;\n');
    const configPath = path.join(root, 'tsconfig.json');
    fs.writeFileSync(configPath, JSON.stringify({
      extends: path.join(apiRoot, 'tsconfig.build.json'),
      compilerOptions: { rootDir: sourceRoot, outDir },
      include: [path.join(sourceRoot, '**/*.ts')], exclude: [],
    }));
    const cli = require.resolve('@nestjs/cli/bin/nest.js');
    for (let run = 1; run <= 2; run++) {
      const result = spawnSync(process.execPath, [cli, 'build', '--path', path.relative(apiRoot, configPath)], {
        cwd: apiRoot, encoding: 'utf8', timeout: 25000,
      });
      assert.equal(result.status, 0, `build ${run}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
      assert.ok(fs.existsSync(path.join(outDir, 'main.js')), `build ${run} must emit the API entry point`);
      assert.equal(require(path.join(outDir, 'main.js')).ready, true);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
