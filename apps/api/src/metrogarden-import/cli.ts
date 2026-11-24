/**
 * Metrogarden sample content → CMS import CLI.
 *
 * Default mode is dry-run (no writes).
 *
 * Export JSON first:
 *   pnpm exec tsx integrations/metrogarden-import/export-source.ts \
 *     --web-root ../metrogarden-mall-react \
 *     --out tmp/metrogarden-content.json
 *
 * Dry-run (builds API first — Nest DI requires compiled metadata):
 *   pnpm --filter @modern-cms/api metrogarden:import -- \
 *     --input ../../tmp/metrogarden-content.json \
 *     --tenant-id <TENANT_ID> \
 *     --mall-id <MALL_ID>
 *
 * Apply:
 *   pnpm --filter @modern-cms/api metrogarden:import -- \
 *     --input ../../tmp/metrogarden-content.json \
 *     --tenant-id <TENANT_ID> \
 *     --mall-id <MALL_ID> \
 *     --apply \
 *     --actor-user-id <USER_ID>
 *
 * Note: Do not run this entry with tsx; emitDecoratorMetadata is required.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { User } from '@prisma/client';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { GlobalStoresService } from '../global-stores/global-stores.service';
import { MallStoresService } from '../mall-stores/mall-stores.service';
import { StoreCategoriesService } from '../store-categories/store-categories.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { EventsService } from '../events/events.service';
import { MoviesService } from '../movies/movies.service';
import { MovieSessionsService } from '../movie-sessions/movie-sessions.service';
import { SlidersService } from '../sliders/sliders.service';
import { MetrogardenImporter } from './importer';
import type { CliOptions, MetrogardenExport } from './types';

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

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

function requireArg(flag: string): string {
  const value = argValue(flag)?.trim();
  if (!value) {
    throw new Error(`Zorunlu argüman eksik: ${flag}`);
  }
  return value;
}

function parseOptions(): CliOptions {
  const apply = hasFlag('--apply');
  const dryRun = hasFlag('--dry-run') || !apply;
  if (apply && hasFlag('--dry-run')) {
    throw new Error('--apply ve --dry-run birlikte kullanılamaz');
  }

  return {
    input: resolve(requireArg('--input')),
    tenantId: requireArg('--tenant-id'),
    mallId: requireArg('--mall-id'),
    mode: dryRun ? 'dry-run' : 'apply',
    actorUserId: argValue('--actor-user-id')?.trim(),
    siteBaseUrl: (argValue('--site-base-url') ?? 'https://metrogarden.hanbeyoglu.com').replace(/\/$/, ''),
    reportPath: argValue('--report') ? resolve(argValue('--report')!) : undefined,
    targetMallName: argValue('--target-mall-name')?.trim(),
    shiftDates: hasFlag('--shift-dates'),
  };
}

function printSummary(report: Awaited<ReturnType<MetrogardenImporter['run']>>): void {
  const byStatus = report.rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log('\n=== Metrogarden import raporu ===');
  console.log(`mode: ${report.mode}`);
  console.log(`tenantId: ${report.tenantId}`);
  console.log(`mallId: ${report.mallId}`);
  console.log(`targetMallName: ${report.targetMallName}`);
  console.log(`shiftDates: ${report.shiftDates} (days=${report.dateShiftDays})`);
  console.log('kaynak sayıları:', report.counts);
  console.log('public görünürlük tahmini:', report.publicVisibility);
  console.log(`metin değişimi örneği: ${report.textReplacements.length}`);
  console.log('satır sonuçları:', byStatus);
  console.log('medya:', report.media);
  console.log(`süresi dolmuş → DRAFT: ${report.expiredAsDraft.length}`);
  console.log(`eşleşmeyen mağaza ref: ${report.unmatchedStoreRefs.length}`);
  console.log(`desteklenmeyen alan bildirimi: ${report.unsupportedFields.length}`);
  console.log(`hata: ${report.errors.length}`);

  if (report.textReplacements.length) {
    console.log('\n— Metin değişimleri (örnek) —');
    for (const row of report.textReplacements.slice(0, 12)) {
      console.log(`  ${row.entityType}.${row.field}: "${row.before}" → "${row.after}"`);
    }
    if (report.textReplacements.length > 12) {
      console.log(`  … +${report.textReplacements.length - 12} daha`);
    }
  }

  if (report.expiredAsDraft.length) {
    console.log('\n— Süresi dolmuş (DRAFT/pasif) —');
    for (const row of report.expiredAsDraft.slice(0, 20)) {
      console.log(`  ${row.entityType} ${row.sourceKey} end=${row.endDate}`);
    }
    if (report.expiredAsDraft.length > 20) {
      console.log(`  … +${report.expiredAsDraft.length - 20} daha`);
    }
  }

  if (report.unmatchedStoreRefs.length) {
    console.log('\n— Eşleşmeyen mağaza referansları —');
    for (const row of report.unmatchedStoreRefs) {
      console.log(`  ${row.entityType} ${row.sourceKey} → ${row.storeRef}`);
    }
  }

  if (report.errors.length) {
    console.log('\n— Hatalar —');
    for (const err of report.errors.slice(0, 30)) {
      console.log(`  ${err}`);
    }
  }
}

async function resolveActor(prisma: PrismaService, options: CliOptions): Promise<User> {
  if (options.actorUserId) {
    const user = await prisma.user.findFirst({
      where: { id: options.actorUserId, deletedAt: null, status: 'ACTIVE' },
    });
    if (!user) throw new Error(`Actor user bulunamadı: ${options.actorUserId}`);
    return user;
  }

  if (options.mode === 'apply') {
    throw new Error('Apply için --actor-user-id zorunludur (admin kullanıcı; loglara yazılmaz).');
  }

  const fallback = await prisma.user.findFirst({
    where: { deletedAt: null, status: 'ACTIVE', isSuperAdmin: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!fallback) {
    throw new Error('Dry-run için aktif super admin kullanıcı bulunamadı (scope doğrulaması).');
  }
  return fallback;
}

async function main(): Promise<void> {
  loadEnvFile(resolve(process.cwd(), '.env'));
  loadEnvFile(resolve(process.cwd(), '../../.env'));
  loadEnvFile(resolve(process.cwd(), '../../.env.local'));

  const options = parseOptions();
  if (!existsSync(options.input)) {
    throw new Error(`Input JSON bulunamadı: ${options.input}`);
  }

  const data = JSON.parse(readFileSync(options.input, 'utf8')) as MetrogardenExport;
  if (!Array.isArray(data.stores) || !Array.isArray(data.campaigns)) {
    throw new Error('Geçersiz export JSON: stores/campaigns bekleniyor');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const actor = await resolveActor(prisma, options);

    const importer = new MetrogardenImporter(
      {
        prisma,
        media: app.get(MediaService),
        globalStores: app.get(GlobalStoresService),
        mallStores: app.get(MallStoresService),
        storeCategories: app.get(StoreCategoriesService),
        campaigns: app.get(CampaignsService),
        events: app.get(EventsService),
        movies: app.get(MoviesService),
        movieSessions: app.get(MovieSessionsService),
        sliders: app.get(SlidersService),
      },
      actor,
      options,
      data,
    );

    const report = await importer.run();
    printSummary(report);

    const reportPath =
      options.reportPath ??
      resolve(process.cwd(), '../../tmp', `metrogarden-import-report-${options.mode}.json`);
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\nRapor yazıldı: ${reportPath}`);

    if (report.errors.length && options.mode === 'apply') {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
