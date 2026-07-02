import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Movie, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { SearchIndexerService } from '../search/search-indexer.service';
import { slugify } from '../common/utils/slugify';
import { assertOptionalHttpUrl } from '../common/utils/content-validation';
import { uniqueMovieSlug } from '../common/utils/unique-content-slug';
import type { CreateMovieDto } from './dto/create-movie.dto';
import type { UpdateMovieDto } from './dto/update-movie.dto';
import type { ListMoviesDto } from './dto/list-movies.dto';
import { DEFAULT_MOVIE_CATEGORIES } from './movie-categories.constants';

const POSTER_SELECT = { id: true, publicUrl: true, originalName: true, mimeType: true } as const;

const MOVIE_INCLUDE = {
  posterMedia: { select: POSTER_SELECT },
  categories: {
    include: { category: true },
    orderBy: { category: { sortOrder: 'asc' } },
  },
} satisfies Prisma.MovieInclude;

export type MovieResponse = Prisma.MovieGetPayload<{ include: typeof MOVIE_INCLUDE }>;
export type MovieCategoryResponse = Prisma.MovieCategoryGetPayload<Record<string, never>>;
export type MovieSessionSummary = {
  sessionCount: number;
  todaySessionStartAt: string | null;
  nextSessionStartAt: string | null;
};
export type MovieListItemResponse = MovieResponse & { sessionSummary?: MovieSessionSummary };

@Injectable()
export class MoviesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly searchIndexer: SearchIndexerService,
  ) {}

  private scheduleMovieIndex(id: string): void {
    void this.searchIndexer.syncMovie(id).catch(() => undefined);
  }

  async list(
    tenantId: string,
    query: ListMoviesDto,
  ): Promise<{ movies: MovieListItemResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.MovieWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { originalTitle: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const dir = query.sortDir === 'desc' ? 'desc' : 'asc';
    const sortBy = query.sortBy ?? 'title';
    const orderBy: Prisma.MovieOrderByWithRelationInput =
      sortBy === 'createdAt'
        ? { createdAt: dir }
        : sortBy === 'releaseDate'
          ? { releaseDate: dir }
          : sortBy === 'title'
            ? { title: dir }
            : { sortOrder: dir };

    const [movies, total] = await Promise.all([
      this.prisma.movie.findMany({
        where,
        include: MOVIE_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.movie.count({ where }),
    ]);
    if (!query.mallId || movies.length === 0) {
      return { movies, total, page, limit };
    }

    const summaryByMovieId = await this.getSessionSummaries(
      tenantId,
      query.mallId,
      movies.map((movie) => movie.id),
    );

    return {
      movies: movies.map((movie) => ({
        ...movie,
        sessionSummary: summaryByMovieId.get(movie.id) ?? {
          sessionCount: 0,
          todaySessionStartAt: null,
          nextSessionStartAt: null,
        },
      })),
      total,
      page,
      limit,
    };
  }

  async listCategories(tenantId: string): Promise<MovieCategoryResponse[]> {
    await this.ensureDefaultCategories(tenantId);
    return this.prisma.movieCategory.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, tenantId: string): Promise<MovieResponse> {
    const row = await this.prisma.movie.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: MOVIE_INCLUDE,
    });
    if (!row) throw new NotFoundException('Film bulunamadı');
    return row;
  }

  private async getSessionSummaries(
    tenantId: string,
    mallId: string,
    movieIds: string[],
  ): Promise<Map<string, MovieSessionSummary>> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const now = new Date();

    const [counts, todaySessions, nextSessions] = await Promise.all([
      this.prisma.movieSession.groupBy({
        by: ['movieId'],
        where: { tenantId, mallId, movieId: { in: movieIds }, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.movieSession.findMany({
        where: {
          tenantId,
          mallId,
          movieId: { in: movieIds },
          deletedAt: null,
          status: 'SCHEDULED',
          startsAt: { gte: startOfToday, lt: startOfTomorrow },
        },
        orderBy: { startsAt: 'asc' },
        select: { movieId: true, startsAt: true },
      }),
      this.prisma.movieSession.findMany({
        where: {
          tenantId,
          mallId,
          movieId: { in: movieIds },
          deletedAt: null,
          status: 'SCHEDULED',
          startsAt: { gte: now },
        },
        orderBy: { startsAt: 'asc' },
        select: { movieId: true, startsAt: true },
      }),
    ]);

    const summaries = new Map<string, MovieSessionSummary>();
    for (const movieId of movieIds) {
      summaries.set(movieId, {
        sessionCount: 0,
        todaySessionStartAt: null,
        nextSessionStartAt: null,
      });
    }
    for (const count of counts) {
      const current = summaries.get(count.movieId);
      if (current) current.sessionCount = count._count._all;
    }
    for (const session of todaySessions) {
      const current = summaries.get(session.movieId);
      if (current && !current.todaySessionStartAt && session.startsAt) {
        current.todaySessionStartAt = session.startsAt.toISOString();
      }
    }
    for (const session of nextSessions) {
      const current = summaries.get(session.movieId);
      if (current && !current.nextSessionStartAt && session.startsAt) {
        current.nextSessionStartAt = session.startsAt.toISOString();
      }
    }
    return summaries;
  }

  async create(dto: CreateMovieDto, user: User, tenantId: string): Promise<MovieResponse> {
    assertOptionalHttpUrl(dto.trailerUrl);
    assertOptionalHttpUrl(dto.ticketUrl);
    if (dto.posterMediaId) {
      await this.assertPosterMedia(tenantId, dto.posterMediaId);
    }
    await this.assertPublishWindow(dto.publishStartAt, dto.publishEndAt);
    const categoryIds = await this.assertMovieCategories(tenantId, dto.categoryIds ?? []);

    const baseSlug = slugify(dto.title);
    const slug = await uniqueMovieSlug(this.prisma, tenantId, baseSlug);

    const movie = await this.prisma.movie.create({
      data: {
        tenantId,
        title: dto.title,
        slug,
        originalTitle: dto.originalTitle ?? null,
        posterMediaId: dto.posterMediaId ?? null,
        description: dto.description ?? null,
        durationMinutes: dto.durationMinutes ?? null,
        genre: dto.genre ?? null,
        rating: dto.rating ?? null,
        trailerUrl: dto.trailerUrl ?? null,
        ticketUrl: dto.ticketUrl ?? null,
        releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : null,
        publishStartAt: dto.publishStartAt ? new Date(dto.publishStartAt) : null,
        publishEndAt: dto.publishEndAt ? new Date(dto.publishEndAt) : null,
        sortOrder: dto.sortOrder ?? 0,
        status: dto.status ?? 'ACTIVE',
        createdBy: user.id,
        categories: {
          create: categoryIds.map((categoryId) => ({ categoryId })),
        },
      },
      include: MOVIE_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'movie:create',
      entityType: 'movie',
      entityId: movie.id,
      after: { title: movie.title, slug: movie.slug, status: movie.status },
    });

    this.scheduleMovieIndex(movie.id);
    return movie;
  }

  async update(
    id: string,
    dto: UpdateMovieDto,
    user: User,
    tenantId: string,
  ): Promise<MovieResponse> {
    const existing = await this.assertExists(id, tenantId);

    const nextTrailer = dto.trailerUrl !== undefined ? dto.trailerUrl : existing.trailerUrl;
    assertOptionalHttpUrl(nextTrailer ?? undefined);
    const nextTicket = dto.ticketUrl !== undefined ? dto.ticketUrl : existing.ticketUrl;
    assertOptionalHttpUrl(nextTicket ?? undefined);

    if (dto.posterMediaId) {
      await this.assertPosterMedia(tenantId, dto.posterMediaId);
    }
    const publishStartAt =
      dto.publishStartAt !== undefined
        ? dto.publishStartAt === null
          ? null
          : new Date(dto.publishStartAt)
        : existing.publishStartAt;
    const publishEndAt =
      dto.publishEndAt !== undefined
        ? dto.publishEndAt === null
          ? null
          : new Date(dto.publishEndAt)
        : existing.publishEndAt;
    await this.assertPublishWindow(publishStartAt, publishEndAt);
    const categoryIds =
      dto.categoryIds !== undefined
        ? await this.assertMovieCategories(tenantId, dto.categoryIds)
        : undefined;

    let slug = existing.slug;
    if (dto.title !== undefined && dto.title !== existing.title) {
      const candidate = slugify(dto.title);
      slug =
        candidate === existing.slug
          ? existing.slug
          : await uniqueMovieSlug(this.prisma, tenantId, candidate, id);
    }

    const movie = await this.prisma.movie.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        slug,
        ...(dto.originalTitle !== undefined && { originalTitle: dto.originalTitle || null }),
        ...(dto.posterMediaId !== undefined && { posterMediaId: dto.posterMediaId || null }),
        ...(dto.description !== undefined && { description: dto.description || null }),
        ...(dto.durationMinutes !== undefined && {
          durationMinutes: dto.durationMinutes === null ? null : dto.durationMinutes,
        }),
        ...(dto.genre !== undefined && { genre: dto.genre || null }),
        ...(dto.rating !== undefined && { rating: dto.rating || null }),
        ...(dto.trailerUrl !== undefined && { trailerUrl: dto.trailerUrl || null }),
        ...(dto.ticketUrl !== undefined && { ticketUrl: dto.ticketUrl || null }),
        ...(dto.releaseDate !== undefined && {
          releaseDate:
            dto.releaseDate === null ? null : dto.releaseDate ? new Date(dto.releaseDate) : null,
        }),
        ...(dto.publishStartAt !== undefined && { publishStartAt }),
        ...(dto.publishEndAt !== undefined && { publishEndAt }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder ?? 0 }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(categoryIds !== undefined && {
          categories: {
            deleteMany: {},
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
        }),
        updatedBy: user.id,
      },
      include: MOVIE_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'movie:update',
      entityType: 'movie',
      entityId: id,
      before: { title: existing.title, status: existing.status },
      after: { title: movie.title, status: movie.status },
    });

    this.scheduleMovieIndex(id);
    return movie;
  }

  async remove(id: string, user: User, tenantId: string): Promise<void> {
    const existing = await this.assertExists(id, tenantId);
    await this.prisma.movie.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: user.id },
    });
    await this.audit.logAction({
      userId: user.id,
      tenantId,
      action: 'movie:delete',
      entityType: 'movie',
      entityId: id,
      before: { title: existing.title, status: existing.status },
    });

    this.scheduleMovieIndex(id);
  }

  /** Filmler tenant genelinde; mallId ile o AVM'de seansı olan aktif filmler filtrelenir. */
  async getPublicMovies(opts: {
    tenantId: string;
    mallId: string;
    date?: string;
  }): Promise<MovieResponse[]> {
    const dayStart = opts.date ? new Date(opts.date) : undefined;
    let dayEnd: Date | undefined;
    if (dayStart) {
      dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    }

    const now = new Date();
    const where: Prisma.MovieWhereInput = {
      tenantId: opts.tenantId,
      deletedAt: null,
      status: 'ACTIVE',
      AND: [
        { OR: [{ publishStartAt: null }, { publishStartAt: { lte: now } }] },
        { OR: [{ publishEndAt: null }, { publishEndAt: { gte: now } }] },
      ],
      movieSessions: {
        some: {
          mallId: opts.mallId,
          deletedAt: null,
          status: 'SCHEDULED',
          ...(dayStart && dayEnd ? { startsAt: { gte: dayStart, lt: dayEnd } } : {}),
        },
      },
    };

    return this.prisma.movie.findMany({
      where,
      include: MOVIE_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
  }

  private async assertExists(id: string, tenantId: string): Promise<Movie> {
    const row = await this.prisma.movie.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!row) throw new NotFoundException('Film bulunamadı');
    return row;
  }

  private async assertPosterMedia(tenantId: string, mediaId: string): Promise<void> {
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, tenantId, deletedAt: null },
    });
    if (!media) {
      throw new UnprocessableEntityException('Afiş medyası bulunamadı');
    }
  }

  private async assertMovieCategories(tenantId: string, categoryIds: string[]): Promise<string[]> {
    const uniqueIds = [...new Set(categoryIds.filter(Boolean))];
    if (uniqueIds.length === 0) return [];
    const rows = await this.prisma.movieCategory.findMany({
      where: { tenantId, id: { in: uniqueIds } },
      select: { id: true },
    });
    if (rows.length !== uniqueIds.length) {
      throw new UnprocessableEntityException('Film kategorisi bulunamadı');
    }
    return uniqueIds;
  }

  private async assertPublishWindow(
    start: string | Date | null | undefined,
    end: string | Date | null | undefined,
  ): Promise<void> {
    if (!start || !end) return;
    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);
    if (endDate < startDate) {
      throw new UnprocessableEntityException('Yayın bitişi yayın başlangıcından küçük olamaz');
    }
  }

  private async ensureDefaultCategories(tenantId: string): Promise<void> {
    const rows = await this.prisma.movieCategory.findMany({
      where: { tenantId },
      select: { slug: true },
    });
    const existing = new Set(rows.map((row) => row.slug));
    const missing = DEFAULT_MOVIE_CATEGORIES.map((name, index) => ({
      name,
      slug: slugify(name),
      sortOrder: (index + 1) * 10,
    })).filter((category) => !existing.has(category.slug));
    if (missing.length === 0) return;
    await this.prisma.movieCategory.createMany({
      data: missing.map((category) => ({ ...category, tenantId })),
      skipDuplicates: true,
    });
  }
}
