import type { PrismaClient } from '@prisma/client';
import type { MovieProvider } from '../movie-provider.interface';
import type { MovieProviderDetail } from '../types';
import {
  localeCodeToTmdbLanguage,
  pickDirectors,
  pickTopCast,
  pickTrailerUrl,
  TmdbProvider,
} from '../tmdb/tmdb.provider';

export type ImportMovieDeps = {
  prisma: PrismaClient;
  provider: MovieProvider;
  tenantId: string;
  userId: string;
  tmdbProvider?: TmdbProvider;
};

export type ImportMovieResult = {
  movieId: string;
  created: boolean;
  tmdbId: number;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

async function uniqueSlug(prisma: PrismaClient, tenantId: string, base: string, excludeId?: string): Promise<string> {
  let candidate = base || 'film';
  let n = 0;
  for (;;) {
    const existing = await prisma.movie.findFirst({
      where: {
        tenantId,
        slug: candidate,
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

async function getActiveTenantLocales(prisma: PrismaClient, tenantId: string) {
  return prisma.locale.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
  });
}

async function upsertGenreCategories(
  prisma: PrismaClient,
  tenantId: string,
  genreNames: string[] | undefined,
): Promise<string[]> {
  if (!genreNames?.length) return [];
  const ids: string[] = [];
  for (const name of genreNames) {
    const slug = slugify(name);
    const row = await prisma.movieCategory.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: {},
      create: { tenantId, name, slug, sortOrder: 0 },
    });
    ids.push(row.id);
  }
  return ids;
}

function buildMovieData(detail: MovieProviderDetail, userId: string) {
  const directors = pickDirectors(detail.credits);
  const cast = pickTopCast(detail.credits);
  const trailerUrl = pickTrailerUrl(detail.videos);
  const genreLabel = detail.genreNames?.join(', ') ?? undefined;

  return {
    title: detail.title,
    originalTitle: detail.originalTitle ?? null,
    description: detail.overview ?? null,
    posterPath: detail.posterPath ?? null,
    backdropPath: detail.backdropPath ?? null,
    durationMinutes: detail.runtime ?? null,
    genre: genreLabel ?? null,
    rating: detail.voteAverage != null ? String(detail.voteAverage) : null,
    trailerUrl,
    releaseDate: detail.releaseDate ? new Date(detail.releaseDate) : null,
    provider: 'TMDB' as const,
    tmdbId: detail.id,
    tmdbVoteAverage: detail.voteAverage ?? null,
    tmdbVoteCount: detail.voteCount ?? null,
    tmdbPopularity: detail.popularity ?? null,
    lastSyncedAt: new Date(),
    imdbId: detail.imdbId ?? null,
    homepage: detail.homepage ?? null,
    originalLanguage: detail.originalLanguage ?? null,
    adult: detail.adult ?? false,
    releaseStatus: detail.status ?? null,
    castJson: cast,
    directorsJson: directors,
    productionCompaniesJson: detail.productionCompanies ?? [],
    productionCountriesJson: detail.productionCountries ?? [],
    notCurrentlyAvailable: false,
    updatedBy: userId,
  };
}

export async function importMovieFromProvider(
  deps: ImportMovieDeps,
  externalId: number,
): Promise<ImportMovieResult> {
  const { prisma, provider, tenantId, userId, tmdbProvider } = deps;
  const detail = await provider.getMovie(externalId);

  const existing = await prisma.movie.findFirst({
    where: { tenantId, tmdbId: externalId, deletedAt: null },
  });

  const categoryIds = await upsertGenreCategories(prisma, tenantId, detail.genreNames);
  const movieData = buildMovieData(detail, userId);
  const baseSlug = slugify(detail.title);
  const slug = existing ? existing.slug : await uniqueSlug(prisma, tenantId, baseSlug);

  let movieId: string;
  let created: boolean;

  if (existing) {
    const updated = await prisma.movie.update({
      where: { id: existing.id },
      data: {
        ...movieData,
        slug,
        categories: {
          deleteMany: {},
          create: categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
    });
    movieId = updated.id;
    created = false;
  } else {
    const createdRow = await prisma.movie.create({
      data: {
        tenantId,
        slug,
        status: 'ACTIVE',
        createdBy: userId,
        ...movieData,
        categories: {
          create: categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
    });
    movieId = createdRow.id;
    created = true;
  }

  const locales = await getActiveTenantLocales(prisma, tenantId);
  const defaultLocale = locales.find((l) => l.isDefault) ?? locales[0];
  const tmdb = tmdbProvider ?? (provider instanceof TmdbProvider ? provider : null);

  if (tmdb && locales.length > 0) {
    let defaultTitle = detail.title;
    let defaultOverview = detail.overview ?? '';

    for (const locale of locales) {
      const tmdbLang = localeCodeToTmdbLanguage(locale.code);
      let title = defaultTitle;
      let overview = defaultOverview;

      if (!locale.isDefault) {
        try {
          const localized = await tmdb.getMovieLocalized(externalId, tmdbLang);
          if (localized.title?.trim()) title = localized.title;
          if (localized.overview?.trim()) overview = localized.overview;
          else if (defaultOverview) overview = defaultOverview;
        } catch {
          if (defaultOverview) overview = defaultOverview;
        }
      }

      if (locale.isDefault) {
        await prisma.movie.update({
          where: { id: movieId },
          data: { title, description: overview || null },
        });
      } else if (title || overview) {
        const upserts = [];
        if (title) {
          upserts.push(
            prisma.localizedContent.upsert({
              where: {
                tenantId_localeId_entityType_entityId_field: {
                  tenantId,
                  localeId: locale.id,
                  entityType: 'MOVIE',
                  entityId: movieId,
                  field: 'title',
                },
              },
              update: { value: title },
              create: {
                tenantId,
                localeId: locale.id,
                entityType: 'MOVIE',
                entityId: movieId,
                field: 'title',
                value: title,
              },
            }),
          );
        }
        if (overview) {
          upserts.push(
            prisma.localizedContent.upsert({
              where: {
                tenantId_localeId_entityType_entityId_field: {
                  tenantId,
                  localeId: locale.id,
                  entityType: 'MOVIE',
                  entityId: movieId,
                  field: 'description',
                },
              },
              update: { value: overview },
              create: {
                tenantId,
                localeId: locale.id,
                entityType: 'MOVIE',
                entityId: movieId,
                field: 'description',
                value: overview,
              },
            }),
          );
        }
        await Promise.all(upserts);
      }
    }

    if (defaultLocale && !defaultLocale.isDefault) {
      // already handled above
    }
  }

  return { movieId, created, tmdbId: externalId };
}
