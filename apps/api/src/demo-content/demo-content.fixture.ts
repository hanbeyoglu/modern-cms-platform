import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MetrogardenExport } from '../metrogarden-import/types';

const CANDIDATE_PATHS = [
  join(__dirname, 'fixtures/metrogarden.json'),
  join(process.cwd(), 'dist/demo-content/fixtures/metrogarden.json'),
  join(process.cwd(), 'src/demo-content/fixtures/metrogarden.json'),
  join(process.cwd(), 'assets/demo-content/metrogarden.json'),
  join(process.cwd(), 'apps/api/assets/demo-content/metrogarden.json'),
];

export function loadMetrogardenDemoFixture(): MetrogardenExport {
  for (const path of CANDIDATE_PATHS) {
    if (!existsSync(path)) continue;
    return JSON.parse(readFileSync(path, 'utf8')) as MetrogardenExport;
  }
  throw new Error(
    'Demo içerik fixture bulunamadı (assets/demo-content/metrogarden.json). ' +
      'Önce integrations/metrogarden-import/export-source.ts ile JSON üretin.',
  );
}
