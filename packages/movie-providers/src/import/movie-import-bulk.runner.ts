import type { PrismaClient } from '@prisma/client';
import {
  buildImportProgress,
  type MovieImportBatchProgress,
  type MovieImportBulkJobData,
} from './import-progress';
import { createTmdbProvider } from '../tmdb/tmdb.provider';
import { resolveTmdbAccessToken } from '../tmdb/resolve-tmdb-token';
import { DEFAULT_MOVIE_PROVIDERS_SETTINGS } from '../types';
import { importMovieFromProvider } from './movie-import.runner';

export async function runMovieImportBulkJob(
  prisma: PrismaClient,
  data: MovieImportBulkJobData,
  reportProgress: (progress: MovieImportBatchProgress) => Promise<void>,
): Promise<void> {
  const startedAt = new Date().toISOString();
  let processed = 0;
  let newMovies = 0;
  let updatedMovies = 0;
  let failedMovies = 0;

  const push = async (status: MovieImportBatchProgress['status'], finishedAt?: string) => {
    const progress = buildImportProgress(data, {
      status,
      processed,
      newMovies,
      updatedMovies,
      failedMovies,
      startedAt,
      finishedAt,
    });
    await reportProgress(progress);
    return progress;
  };

  await push('running');

  const settingsRow = await prisma.tenantSetting.findUnique({
    where: { tenantId_key: { tenantId: data.tenantId, key: 'movieProviders' } },
  });
  const stored = (settingsRow?.value ?? {}) as { tmdb?: typeof DEFAULT_MOVIE_PROVIDERS_SETTINGS.tmdb };
  const tmdbSettings = { ...DEFAULT_MOVIE_PROVIDERS_SETTINGS.tmdb, ...(stored.tmdb ?? {}) };
  const accessToken = resolveTmdbAccessToken(tmdbSettings.readAccessToken);
  if (!accessToken) {
    await push('failed', new Date().toISOString());
    throw new Error('TMDB token yapılandırılmamış');
  }

  const provider = createTmdbProvider({
    accessToken,
    language: tmdbSettings.language,
    region: tmdbSettings.region,
    posterSize: tmdbSettings.posterSize,
  });

  for (const tmdbId of data.tmdbIds) {
    console.log(`[MovieImport] Processing movie tmdbId=${tmdbId} batchId=${data.batchId}`);
    try {
      const result = await importMovieFromProvider(
        { prisma, provider, tenantId: data.tenantId, userId: data.userId },
        tmdbId,
      );
      processed += 1;
      if (result.created) newMovies += 1;
      else updatedMovies += 1;
    } catch (err) {
      processed += 1;
      failedMovies += 1;
      console.error(`[MovieImport] Failed tmdbId=${tmdbId}`, err);
    }
    const progress = await push('running');
    console.log(`[MovieImport] ${progress.processed} / ${progress.total} (${progress.percent}%)`);
  }

  const finalStatus = failedMovies === data.tmdbIds.length ? 'failed' : 'completed';
  await push(finalStatus, new Date().toISOString());
  console.log(
    `[MovieImport] Finished batchId=${data.batchId} new=${newMovies} updated=${updatedMovies} failed=${failedMovies}`,
  );
}
