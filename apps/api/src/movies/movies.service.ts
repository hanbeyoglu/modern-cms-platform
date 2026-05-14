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

const POSTER_SELECT = { id: true, publicUrl: true, originalName: true, mimeType: true } as const;

const MOVIE_INCLUDE = {
  posterMedia: { select: POSTER_SELECT },
} satisfies Prisma.MovieInclude;

export type MovieResponse = Prisma.MovieGetPayload<{ include: typeof MOVIE_INCLUDE }>;

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
  ): Promise<{ movies: MovieResponse[]; total: number; page: number; limit: number }> {
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
      sortBy === 'createdAt' ? { createdAt: dir } : sortBy === 'releaseDate' ? { releaseDate: dir } : { title: dir };

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
    return { movies, total, page, limit };
  }

  async findOne(id: string, tenantId: string): Promise<MovieResponse> {
    const row = await this.prisma.movie.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: MOVIE_INCLUDE,
    });
    if (!row) throw new NotFoundException('Film bulunamadı');
    return row;
  }

  async create(dto: CreateMovieDto, user: User, tenantId: string): Promise<MovieResponse> {
    assertOptionalHttpUrl(dto.trailerUrl);
    if (dto.posterMediaId) {
      await this.assertPosterMedia(tenantId, dto.posterMediaId);
    }

    const baseSlug = dto.slug?.trim() ? slugify(dto.slug) : slugify(dto.title);
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
        releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : null,
        status: dto.status ?? 'ACTIVE',
        createdBy: user.id,
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

  async update(id: string, dto: UpdateMovieDto, user: User, tenantId: string): Promise<MovieResponse> {
    const existing = await this.assertExists(id, tenantId);

    const nextTrailer = dto.trailerUrl !== undefined ? dto.trailerUrl : existing.trailerUrl;
    assertOptionalHttpUrl(nextTrailer ?? undefined);

    if (dto.posterMediaId) {
      await this.assertPosterMedia(tenantId, dto.posterMediaId);
    }

    let slug = existing.slug;
    if (dto.slug !== undefined && dto.slug.trim().length > 0) {
      const candidate = slugify(dto.slug);
      slug =
        candidate === existing.slug
          ? existing.slug
          : await uniqueMovieSlug(this.prisma, tenantId, candidate, id);
    } else if (dto.title !== undefined && dto.title !== existing.title && dto.slug === undefined) {
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
        ...(dto.releaseDate !== undefined && {
          releaseDate: dto.releaseDate === null ? null : dto.releaseDate ? new Date(dto.releaseDate) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
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
  async getPublicMovies(opts: { tenantId: string; mallId: string; date?: string }): Promise<MovieResponse[]> {
    const dayStart = opts.date ? new Date(opts.date) : undefined;
    let dayEnd: Date | undefined;
    if (dayStart) {
      dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    }

    const where: Prisma.MovieWhereInput = {
      tenantId: opts.tenantId,
      deletedAt: null,
      status: 'ACTIVE',
      movieSessions: {
        some: {
          mallId: opts.mallId,
          deletedAt: null,
          status: 'SCHEDULED',
          ...(dayStart && dayEnd
            ? { startsAt: { gte: dayStart, lt: dayEnd } }
            : {}),
        },
      },
    };

    return this.prisma.movie.findMany({
      where,
      include: MOVIE_INCLUDE,
      orderBy: { title: 'asc' },
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
}
