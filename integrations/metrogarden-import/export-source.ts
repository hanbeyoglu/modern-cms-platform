/**
 * Resolves Metrogarden sample TypeScript data modules (running IMG/HERO/POSTER helpers)
 * into a JSON payload for the CMS import CLI.
 *
 * Usage:
 *   pnpm exec tsx integrations/metrogarden-import/export-source.ts \
 *     --web-root ../metrogarden-mall-react \
 *     --out tmp/metrogarden-content.json
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type UnknownRecord = Record<string, unknown>;

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

const IMAGE_KEYS = new Set([
  'cover_image',
  'image',
  'hero_image',
  'poster',
  'images',
  'gallery',
]);

function collectImageUrls(value: unknown, into: Set<string>, keyHint?: string): void {
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    if (!keyHint || IMAGE_KEYS.has(keyHint) || /unsplash\.com|images\./i.test(value)) {
      if (IMAGE_KEYS.has(keyHint ?? '') || /unsplash\.com/i.test(value)) into.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageUrls(item, into, keyHint);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as UnknownRecord)) {
      collectImageUrls(nested, into, key);
    }
  }
}

async function loadModule<T>(webRoot: string, relativePath: string): Promise<T> {
  const absolute = resolve(webRoot, relativePath);
  return import(pathToFileURL(absolute).href) as Promise<T>;
}

async function main(): Promise<void> {
  const webRoot = resolve(argValue('--web-root') ?? '../metrogarden-mall-react');
  const outPath = resolve(argValue('--out') ?? 'tmp/metrogarden-content.json');

  const storesMod = await loadModule<{ allStores: UnknownRecord[] }>(webRoot, 'src/data/stores.ts');
  const campaignsMod = await loadModule<{ allCampaigns: UnknownRecord[] }>(
    webRoot,
    'src/data/campaigns.ts',
  );
  const eventsMod = await loadModule<{ allEvents: UnknownRecord[] }>(webRoot, 'src/data/events.ts');
  const moviesMod = await loadModule<{ allMovies: UnknownRecord[] }>(webRoot, 'src/data/movies.ts');
  const slidersMod = await loadModule<{ sliders: UnknownRecord[] }>(webRoot, 'src/data/sliders.ts');

  const payload = {
    sourceSystem: 'metrogarden',
    exportedAt: new Date().toISOString(),
    webRoot,
    stores: storesMod.allStores,
    campaigns: campaignsMod.allCampaigns,
    events: eventsMod.allEvents,
    movies: moviesMod.allMovies,
    sliders: slidersMod.sliders,
  };

  const urls = new Set<string>();
  collectImageUrls(payload, urls);
  const mediaIndex = [...urls].sort().map((url) => ({
    url,
    urlHash: createHash('sha256').update(url).digest('hex'),
  }));

  const envelope = {
    ...payload,
    mediaIndex,
    counts: {
      stores: payload.stores.length,
      campaigns: payload.campaigns.length,
      events: payload.events.length,
      movies: payload.movies.length,
      sliders: payload.sliders.length,
      uniqueMediaUrls: mediaIndex.length,
    },
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  console.log(
    JSON.stringify(
      {
        ok: true,
        outPath,
        counts: envelope.counts,
      },
      null,
      2,
    ),
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
