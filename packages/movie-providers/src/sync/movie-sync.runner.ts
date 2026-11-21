import type { PrismaClient } from '@prisma/client';
import type { MovieProvider } from '../movie-provider.interface';
import type { MovieProviderListItem } from '../types';
import { importMovieFromProvider } from '../import/movie-import.runner';

export type RunMovieSyncDeps = {
  prisma: PrismaClient;
  provider: MovieProvider;
  tenantId: string;
  systemUserId: string;
};

export type MovieSyncRunResult = {
  logId: string;
  newMovies: number;
  updatedMovies: number;
  failedMovies: number;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  message?: string;
};

async function fetchAllPages(
  fetchPage: (page: number) => Promise<{ page: number; totalPages: number; results: MovieProviderListItem[] }>,
): Promise<MovieProviderListItem[]> {
  const first = await fetchPage(1);
  const all = [...first.results];
  for (let p = 2; p <= first.totalPages; p++) {
    const next = await fetchPage(p);
    all.push(...next.results);
  }
  return all;
}

export async function runMovieSync(deps: RunMovieSyncDeps): Promise<MovieSyncRunResult> {
  const { prisma, provider, tenantId, systemUserId } = deps;

  const log = await prisma.movieSyncLog.create({
    data: {
      tenantId,
      provider: 'TMDB',
      status: 'RUNNING',
    },
  });

  let newMovies = 0;
  let updatedMovies = 0;
  let failedMovies = 0;
  const errors: string[] = [];

  try {
    const [nowPlaying, upcoming] = await Promise.all([
      fetchAllPages((page) => provider.getNowPlaying(page)),
      fetchAllPages((page) => provider.getUpcoming(page)),
    ]);

    // NOW_PLAYING wins if a regional TMDB feed includes the same film in both lists.
    const nowPlayingIds = new Set(nowPlaying.map((movie) => movie.id));
    const availableIds = new Set([...nowPlaying, ...upcoming].map((movie) => movie.id));
    const deleted = await prisma.movie.findMany({
      where: { tenantId, provider: 'TMDB', deletedAt: { not: null }, tmdbId: { in: [...availableIds] } },
      select: { tmdbId: true },
    });
    const deletedIds = new Set(deleted.map((movie) => movie.tmdbId));

    for (const tmdbId of availableIds) {
      if (deletedIds.has(tmdbId)) continue;
      try {
        const result = await importMovieFromProvider(
          { prisma, provider, tenantId, userId: systemUserId, skipDeleted: true, listingStatus: nowPlayingIds.has(tmdbId) ? 'NOW_PLAYING' : 'UPCOMING' },
          tmdbId,
        );
        if (result.skipped) continue;
        if (result.created) newMovies += 1;
        else updatedMovies += 1;
      } catch (err) {
        failedMovies += 1;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`tmdb:${tmdbId} ${msg}`);
      }
    }

    const staleMovies = await prisma.movie.findMany({
      where: {
        tenantId,
        provider: 'TMDB',
        tmdbId: { not: null },
        deletedAt: null,
      },
      select: { id: true, tmdbId: true, manualStatusOverride: true, status: true },
    });

    const toMarkUnavailable = staleMovies.filter(
      (m) => m.tmdbId != null && !availableIds.has(m.tmdbId) && !m.manualStatusOverride && m.status !== 'ARCHIVED',
    );

    if (toMarkUnavailable.length > 0) {
      await prisma.movie.updateMany({
        where: { tenantId, provider: 'TMDB', deletedAt: null, manualStatusOverride: false, id: { in: toMarkUnavailable.map((m) => m.id) } },
        data: { status: 'ARCHIVED', notCurrentlyAvailable: true, listingStatus: 'OTHER', updatedBy: systemUserId },
      });
      updatedMovies += toMarkUnavailable.length;
    }

    const status =
      failedMovies > 0 && newMovies + updatedMovies === 0
        ? 'FAILED'
        : failedMovies > 0
          ? 'PARTIAL'
          : 'SUCCESS';

    const message = errors.length > 0 ? errors.slice(0, 10).join('; ') : null;

    await prisma.movieSyncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        status,
        newMovies,
        updatedMovies,
        failedMovies,
        message,
      },
    });

    return { logId: log.id, newMovies, updatedMovies, failedMovies, status, message: message ?? undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.movieSyncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        status: 'FAILED',
        newMovies,
        updatedMovies,
        failedMovies,
        message,
      },
    });
    return { logId: log.id, newMovies, updatedMovies, failedMovies, status: 'FAILED', message };
  }
}
