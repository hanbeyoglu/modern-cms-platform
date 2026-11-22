/**
 * Detect and migrate MediaAsset rows that still point at local disk / localhost URLs
 * into configured Cloudflare R2 (S3-compatible) object storage.
 *
 * Usage:
 *   pnpm --filter @modern-cms/api media:migrate-to-r2 -- --dry-run
 *   pnpm --filter @modern-cms/api media:migrate-to-r2
 *   pnpm --filter @modern-cms/api media:migrate-to-r2 -- --delete-local
 *
 * Safety:
 * - Never deletes DB rows
 * - Local files are kept unless --delete-local is passed AFTER a successful R2 upload + DB update
 * - Demo/placeholder URLs (placehold.co) are reported but skipped
 */
import { existsSync, readFileSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// Prefer apps/api/.env then monorepo root .env / .env.production
loadEnvFile(resolve(process.cwd(), '.env'));
loadEnvFile(resolve(process.cwd(), '../../.env'));
loadEnvFile(resolve(process.cwd(), '../../.env.production'));

const prisma = new PrismaClient();

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function isLocalLikeUrl(url: string): boolean {
  const raw = url.trim();
  if (raw.startsWith('file:')) return true;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
      return true;
    }
    return parsed.pathname.includes('/uploads/');
  } catch {
    return raw.includes('/uploads/') || raw.startsWith('/');
  }
}

function isPlaceholder(url: string, source: string | null): boolean {
  if (source === 'demo-seed') return true;
  return url.includes('placehold.co') || url.includes('via.placeholder.com');
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2).filter((a) => a !== '--'));
  const dryRun = args.has('--dry-run');
  const deleteLocal = args.has('--delete-local');

  const accountId = env('R2_ACCOUNT_ID');
  const bucket = env('R2_BUCKET_NAME');
  const accessKey = env('R2_ACCESS_KEY_ID');
  const secretKey = env('R2_SECRET_ACCESS_KEY');
  const publicBase = env('R2_PUBLIC_URL')?.replace(/\/$/, '');
  const storageRoot = env('STORAGE_ROOT') ?? join(process.cwd(), 'storage');

  const r2Ready = Boolean(accountId && bucket && accessKey && secretKey && publicBase);
  if (!dryRun && !r2Ready) {
    throw new Error(
      'R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL are required to apply migration',
    );
  }

  const assets = await prisma.mediaAsset.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      tenantId: true,
      storageKey: true,
      publicUrl: true,
      mimeType: true,
      source: true,
      originalName: true,
      size: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const candidates = assets.filter((a) => isLocalLikeUrl(a.publicUrl));
  const placeholders = candidates.filter((a) => isPlaceholder(a.publicUrl, a.source));
  const migratable = candidates.filter((a) => !isPlaceholder(a.publicUrl, a.source));

  console.log(`Media assets total: ${assets.length}`);
  console.log(`Local-like publicUrl: ${candidates.length}`);
  console.log(`  placeholders/demo (skip): ${placeholders.length}`);
  console.log(`  migratable: ${migratable.length}`);
  console.log(`STORAGE_ROOT: ${storageRoot}`);
  console.log(`R2_PUBLIC_URL: ${publicBase ?? '(not set — target URL unknown until R2_PUBLIC_URL is configured)'}`);
  console.log(dryRun ? 'Mode: DRY-RUN (no writes)' : 'Mode: APPLY');

  for (const row of migratable) {
    const localPath = join(storageRoot, row.storageKey);
    const targetUrl = publicBase
      ? `${publicBase}/${row.storageKey.replace(/^\/+/, '')}`
      : `(R2_PUBLIC_URL)/${row.storageKey}`;
    const exists = existsSync(localPath);
    console.log(
      `- id=${row.id} key=${row.storageKey} localFile=${exists ? 'yes' : 'MISSING'} current=${row.publicUrl} → ${targetUrl}`,
    );
  }

  if (dryRun) {
    console.log('\nDry-run complete. Re-run without --dry-run to upload and update publicUrl.');
    return;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey!, secretAccessKey: secretKey! },
  });

  let ok = 0;
  let failed = 0;
  for (const row of migratable) {
    const localPath = join(storageRoot, row.storageKey);
    const targetUrl = `${publicBase!}/${row.storageKey.replace(/^\/+/, '')}`;
    if (!existsSync(localPath)) {
      console.error(`SKIP missing file id=${row.id} path=${localPath}`);
      failed += 1;
      continue;
    }
    try {
      const body = await readFile(localPath);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket!,
          Key: row.storageKey,
          Body: body,
          ContentType: row.mimeType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      await prisma.mediaAsset.update({
        where: { id: row.id },
        data: { publicUrl: targetUrl },
      });
      if (deleteLocal) {
        await unlink(localPath);
      }
      ok += 1;
      console.log(`OK id=${row.id}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL id=${row.id}: ${(err as Error).message}`);
    }
  }

  console.log(`\nDone. migrated=${ok} failed=${failed} placeholdersSkipped=${placeholders.length}`);
  if (!deleteLocal) {
    console.log('Local files were kept. Pass --delete-local to remove after successful upload.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
