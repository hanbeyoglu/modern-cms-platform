import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Movie, MovieSession, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { assertOptionalHttpUrl } from '../common/utils/content-validation';
import { slugify } from '../common/utils/slugify';
import { uniqueCinemaSlug, uniqueScreeningHallSlug } from '../common/utils/unique-content-slug';
import type { CreateMovieSessionDto } from './dto/create-movie-session.dto';
import type { UpdateMovieSessionDto } from './dto/update-movie-session.dto';
import type { ListMovieSessionsDto } from './dto/list-movie-sessions.dto';
import type { CreateMovieSessionForMovieDto } from './dto/create-movie-session-for-movie.dto';
import type { UpdateMovieSessionForMovieDto } from './dto/update-movie-session-for-movie.dto';

const SESSION_INCLUDE = {
  cinema: { select: { id: true, name: true, slug: true } },
  hall: { select: { id: true, name: true, slug: true } },
  movie: { select: { id: true, title: true, slug: true, durationMinutes: true } },
} satisfies Prisma.MovieSessionInclude;

export type MovieSessionResponse = Prisma.MovieSessionGetPayload<{ include: typeof SESSION_INCLUDE }>;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute startsAt from showDate + showTime.
 * Returns null when showDate is absent (time-only session).
 */
function computeStartsAt(showDate: string | undefined | null, showTime: string): Date | null {
  if (!showDate) return null;
  const iso = `${showDate}T${showTime}:00.000Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Derive showDate / showTime strings from a legacy startsAt Date.
 */
function deriveShowFields(startsAt: Date): { showDate: string; showTime: string } {
  const d = startsAt;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    showDate: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    showTime: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

@Injectable()
export class MovieSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async list(
    tenantId: string,
    mallId: string,
    query: ListMovieSessionsDto,
  ): Promise<{ sessions: MovieSessionResponse[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MovieSessionWhereInput = {
      tenantId,
      mallId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.cinemaId ? { cinemaId: query.cinemaId } : {}),
      ...(query.movieId ? { movieId: query.movieId } : {}),
      ...(query.showDate ? { showDate: query.showDate } : {}),
      ...(query.search
        ? {
            OR: [
              { hall: { name: { contains: query.search, mode: 'insensitive' as const } } },
              { movie: { title: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
      ...(query.startsFrom || query.startsTo
        ? {
            startsAt: {
              ...(query.startsFrom ? { gte: new Date(query.startsFrom) } : {}),
              ...(query.startsTo ? { lte: new Date(query.startsTo) } : {}),
            },
          }
        : {}),
    };

    const sortBy = query.sortBy ?? 'startsAt';
    const dir = query.sortDir === 'desc' ? ('desc' as const) : ('asc' as const);
    const nulls = 'last' as const;
    const orderBy: Prisma.MovieSessionOrderByWithRelationInput[] =
      sortBy === 'createdAt'
        ? [{ createdAt: dir }]
        : sortBy === 'showDate'
          ? [{ showDate: { sort: dir, nulls } }, { showTime: { sort: dir, nulls } }]
          : [
              { startsAt: { sort: dir, nulls } },
              { showDate: { sort: dir, nulls } },
              { showTime: { sort: dir, nulls } },
            ];

    const [sessions, total] = await Promise.all([
      this.prisma.movieSession.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.movieSession.count({ where }),
    ]);
    return { sessions, total, page, limit };
  }

  async findOne(id: string, tenantId: string, mallId: string): Promise<MovieSessionResponse> {
    const row = await this.prisma.movieSession.findFirst({
      where: { id, tenantId, mallId, deletedAt: null },
      include: SESSION_INCLUDE,
    });
    if (!row) throw new NotFoundException('Seans bulunamadı');
    return row;
  }

  async listForMovie(
    movieId: string,
    tenantId: string,
    mallId: string,
    query: ListMovieSessionsDto,
  ): Promise<{ sessions: MovieSessionResponse[]; total: number; page: number; limit: number }> {
    await this.assertMovieInTenant(movieId, tenantId);
    return this.list(tenantId, mallId, { ...query, movieId });
  }

  // ── Create (legacy /movie-sessions endpoint) ──────────────────────────────

  async create(
    dto: CreateMovieSessionDto,
    user: User,
    tenantId: string,
    mallId: string,
  ): Promise<MovieSessionResponse> {
    assertOptionalHttpUrl(dto.ticketUrl);

    if (dto.cinemaId) await this.assertCinemaInMall(dto.cinemaId, tenantId, mallId);
    const movie = await this.assertMovieInTenant(dto.movieId, tenantId);

    // Legacy: startsAt required in CreateMovieSessionDto
    const startsAt = new Date(dto.startsAt);
    const endsAt = this.computeEndsAt(startsAt, movie, dto.endsAt);
    const { showDate, showTime } = deriveShowFields(startsAt);

    if (dto.cinemaId) {
      await this.assertNoScheduleConflictLegacy({
        tenantId, mallId, cinemaId: dto.cinemaId, startsAt, endsAt,
        status: dto.status ?? 'SCHEDULED',
      });
    }

    const session = await this.prisma.movieSession.create({
      data: {
        tenantId, mallId,
        cinemaId: dto.cinemaId ?? null,
        movieId: dto.movieId,
        hallName: dto.hallName ?? null,
        showTime, showDate,
        startsAt, endsAt,
        language: dto.language ?? null,
        subtitle: dto.subtitle ?? null,
        format: dto.format ?? null,
        ticketUrl: dto.ticketUrl ?? null,
        status: dto.status ?? 'SCHEDULED',
        createdBy: user.id,
      },
      include: SESSION_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id, tenantId, mallId,
      action: 'movie-session:create', entityType: 'movie-session', entityId: session.id,
      after: { showTime, showDate, cinemaId: session.cinemaId, movieId: session.movieId },
    });

    return session;
  }

  // ── Create for Movie (/movies/:movieId/sessions) ──────────────────────────

  async createForMovie(
    movieId: string,
    dto: CreateMovieSessionForMovieDto,
    user: User,
    tenantId: string,
    mallId: string,
  ): Promise<MovieSessionResponse> {
    assertOptionalHttpUrl(dto.ticketUrl);

    const movie = await this.assertMovieInTenant(movieId, tenantId);

    // Resolve hall (new entity)
    const hallId = await this.resolveHallForSession(dto, user, tenantId, mallId);

    // Resolve legacy cinema (for backward compat)
    const cinemaId = await this.resolveCinemaForSession(
      { cinemaId: dto.cinemaId, cinemaName: dto.cinemaName },
      user, tenantId, mallId,
    );

    // Compute startsAt from showDate + showTime
    const startsAt = computeStartsAt(dto.showDate, dto.showTime);
    const endsAt = startsAt ? this.computeEndsAt(startsAt, movie, undefined) : null;

    // Conflict check (only when hall + date are known)
    if (hallId && dto.showDate) {
      await this.assertNoScheduleConflictHall({
        tenantId, mallId, hallId, showDate: dto.showDate, showTime: dto.showTime,
        startsAt, endsAt, status: dto.status ?? 'SCHEDULED',
      });
    }

    const session = await this.prisma.movieSession.create({
      data: {
        tenantId, mallId,
        cinemaId: cinemaId ?? null,
        hallId: hallId ?? null,
        movieId,
        showTime: dto.showTime,
        showDate: dto.showDate ?? null,
        startsAt, endsAt,
        language: dto.language ?? null,
        subtitle: dto.subtitle ?? null,
        format: dto.format ?? null,
        ticketUrl: dto.ticketUrl ?? null,
        status: dto.status ?? 'SCHEDULED',
        createdBy: user.id,
      },
      include: SESSION_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id, tenantId, mallId,
      action: 'movie-session:create', entityType: 'movie-session', entityId: session.id,
      after: { showTime: dto.showTime, showDate: dto.showDate, hallId, movieId },
    });

    return session;
  }

  // ── Update (legacy) ───────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateMovieSessionDto,
    user: User,
    tenantId: string,
    mallId: string,
  ): Promise<MovieSessionResponse> {
    const existing = await this.assertExists(id, tenantId, mallId);

    const nextTicket = dto.ticketUrl !== undefined ? dto.ticketUrl : existing.ticketUrl;
    assertOptionalHttpUrl(nextTicket ?? undefined);

    const cinemaId = dto.cinemaId ?? existing.cinemaId ?? undefined;
    const movieId = dto.movieId ?? existing.movieId;

    if (dto.cinemaId) await this.assertCinemaInMall(cinemaId!, tenantId, mallId);
    if (dto.movieId) await this.assertMovieInTenant(movieId, tenantId);

    const movie = await this.assertMovieInTenant(movieId, tenantId);

    // Resolve new startsAt (legacy field)
    let nextStarts = existing.startsAt;
    if (dto.startsAt !== undefined) {
      nextStarts = new Date(dto.startsAt);
    }
    const nextEnds = nextStarts
      ? dto.endsAt !== undefined
        ? dto.endsAt === null ? null : new Date(dto.endsAt)
        : this.computeEndsAt(nextStarts, movie, existing.endsAt?.toISOString())
      : null;

    // Derive showDate/showTime from new startsAt if changed
    const nextShowFields = nextStarts ? deriveShowFields(nextStarts) : null;

    const session = await this.prisma.movieSession.update({
      where: { id },
      data: {
        ...(dto.cinemaId !== undefined && { cinemaId: dto.cinemaId }),
        ...(dto.movieId !== undefined && { movieId: dto.movieId }),
        ...(dto.hallName !== undefined && { hallName: dto.hallName || null }),
        ...(nextStarts !== existing.startsAt && { startsAt: nextStarts }),
        ...(nextEnds !== undefined && { endsAt: nextEnds }),
        ...(nextShowFields && { showDate: nextShowFields.showDate, showTime: nextShowFields.showTime }),
        ...(dto.language !== undefined && { language: dto.language || null }),
        ...(dto.subtitle !== undefined && { subtitle: dto.subtitle || null }),
        ...(dto.format !== undefined && { format: dto.format || null }),
        ...(dto.ticketUrl !== undefined && { ticketUrl: dto.ticketUrl || null }),
        ...(dto.status !== undefined && { status: dto.status }),
        updatedBy: user.id,
      },
      include: SESSION_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id, tenantId, mallId,
      action: 'movie-session:update', entityType: 'movie-session', entityId: id,
      before: { startsAt: existing.startsAt?.toISOString(), status: existing.status },
      after: { startsAt: session.startsAt?.toISOString(), status: session.status },
    });

    return session;
  }

  // ── Update for Movie ──────────────────────────────────────────────────────

  async updateForMovie(
    movieId: string,
    id: string,
    dto: UpdateMovieSessionForMovieDto,
    user: User,
    tenantId: string,
    mallId: string,
  ): Promise<MovieSessionResponse> {
    const existing = await this.assertExistsForMovie(id, movieId, tenantId, mallId);
    assertOptionalHttpUrl(dto.ticketUrl);

    const movie = await this.assertMovieInTenant(movieId, tenantId);

    // Resolve hall
    const hallId = await this.resolveHallForSession(
      { hallId: dto.hallId, hallName: dto.hallName },
      user, tenantId, mallId,
    );

    // Resolve legacy cinema
    const cinemaId = await this.resolveCinemaForSession(
      { cinemaId: dto.cinemaId, cinemaName: dto.cinemaName },
      user, tenantId, mallId,
    );

    // Determine new showTime / showDate
    const nextShowTime = dto.showTime ?? existing.showTime ?? undefined;
    const nextShowDate =
      dto.showDate !== undefined
        ? (dto.showDate ?? null)
        : existing.showDate;

    // Recompute startsAt
    const nextStartsAt = nextShowTime
      ? computeStartsAt(nextShowDate ?? undefined, nextShowTime)
      : null;
    const nextEndsAt = nextStartsAt ? this.computeEndsAt(nextStartsAt, movie, undefined) : null;

    // Conflict check
    const resolvedHallId = hallId ?? existing.hallId ?? undefined;
    if (resolvedHallId && nextShowDate && nextShowTime) {
      await this.assertNoScheduleConflictHall({
        tenantId, mallId, hallId: resolvedHallId,
        showDate: nextShowDate, showTime: nextShowTime,
        startsAt: nextStartsAt, endsAt: nextEndsAt,
        status: dto.status ?? existing.status,
        ignoreId: id,
      });
    }

    const session = await this.prisma.movieSession.update({
      where: { id },
      data: {
        ...(hallId !== undefined && { hallId: hallId ?? null }),
        ...(cinemaId !== undefined && { cinemaId: cinemaId ?? null }),
        ...(dto.showTime !== undefined && { showTime: dto.showTime }),
        ...(dto.showDate !== undefined && { showDate: dto.showDate ?? null }),
        ...(nextStartsAt !== null && { startsAt: nextStartsAt }),
        ...(nextEndsAt !== null && { endsAt: nextEndsAt }),
        ...(dto.language !== undefined && { language: dto.language || null }),
        ...(dto.subtitle !== undefined && { subtitle: dto.subtitle || null }),
        ...(dto.format !== undefined && { format: dto.format || null }),
        ...(dto.ticketUrl !== undefined && { ticketUrl: dto.ticketUrl || null }),
        ...(dto.status !== undefined && { status: dto.status }),
        updatedBy: user.id,
      },
      include: SESSION_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id, tenantId, mallId,
      action: 'movie-session:update', entityType: 'movie-session', entityId: id,
      before: { showTime: existing.showTime, showDate: existing.showDate, status: existing.status },
      after: { showTime: session.showTime, showDate: session.showDate, status: session.status },
    });

    return session;
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async remove(id: string, user: User, tenantId: string, mallId: string): Promise<void> {
    const existing = await this.assertExists(id, tenantId, mallId);
    await this.prisma.movieSession.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: user.id },
    });
    await this.audit.logAction({
      userId: user.id, tenantId, mallId,
      action: 'movie-session:delete', entityType: 'movie-session', entityId: id,
      before: { showTime: existing.showTime, showDate: existing.showDate, status: existing.status },
    });
  }

  async removeForMovie(
    movieId: string,
    id: string,
    user: User,
    tenantId: string,
    mallId: string,
  ): Promise<void> {
    await this.assertExistsForMovie(id, movieId, tenantId, mallId);
    await this.remove(id, user, tenantId, mallId);
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  async cancel(id: string, user: User, tenantId: string, mallId: string): Promise<MovieSessionResponse> {
    const existing = await this.assertExists(id, tenantId, mallId);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Seans zaten iptal edilmiş');
    }

    const session = await this.prisma.movieSession.update({
      where: { id },
      data: { status: 'CANCELLED', updatedBy: user.id },
      include: SESSION_INCLUDE,
    });

    await this.audit.logAction({
      userId: user.id, tenantId, mallId,
      action: 'movie-session:cancel', entityType: 'movie-session', entityId: id,
      before: { status: existing.status },
      after: { status: 'CANCELLED' },
    });

    return session;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async getPublicMovieSessions(opts: {
    tenantId: string;
    mallId: string;
    cinemaId?: string;
    movieId?: string;
    date?: string;
  }): Promise<MovieSessionResponse[]> {
    const dayStart = opts.date ? new Date(opts.date) : undefined;
    let dayEnd: Date | undefined;
    if (dayStart) {
      dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    }

    return this.prisma.movieSession.findMany({
      where: {
        tenantId: opts.tenantId,
        mallId: opts.mallId,
        deletedAt: null,
        status: 'SCHEDULED',
        movie: { deletedAt: null, status: 'ACTIVE' },
        ...(opts.cinemaId ? { cinemaId: opts.cinemaId } : {}),
        ...(opts.movieId ? { movieId: opts.movieId } : {}),
        ...(opts.date ? { showDate: opts.date } : {}),
        ...(dayStart && dayEnd && !opts.date
          ? { startsAt: { gte: dayStart, lt: dayEnd } }
          : {}),
      },
      include: SESSION_INCLUDE,
      orderBy: [
        { startsAt: { sort: 'asc', nulls: 'last' } },
        { showDate: { sort: 'asc', nulls: 'last' } },
        { showTime: { sort: 'asc', nulls: 'last' } },
      ],
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async assertExists(id: string, tenantId: string, mallId: string): Promise<MovieSession> {
    const row = await this.prisma.movieSession.findFirst({
      where: { id, tenantId, mallId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Seans bulunamadı');
    return row;
  }

  private async assertExistsForMovie(
    id: string,
    movieId: string,
    tenantId: string,
    mallId: string,
  ): Promise<MovieSession> {
    const row = await this.prisma.movieSession.findFirst({
      where: { id, movieId, tenantId, mallId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Seans bulunamadı');
    return row;
  }

  private async assertCinemaInMall(cinemaId: string, tenantId: string, mallId: string): Promise<void> {
    const c = await this.prisma.cinema.findFirst({
      where: { id: cinemaId, tenantId, mallId, deletedAt: null },
    });
    if (!c) throw new UnprocessableEntityException('Sinema bu AVM için geçerli değil');
  }

  private async assertMovieInTenant(
    movieId: string,
    tenantId: string,
  ): Promise<Pick<Movie, 'id' | 'durationMinutes'>> {
    const m = await this.prisma.movie.findFirst({
      where: { id: movieId, tenantId, deletedAt: null },
      select: { id: true, durationMinutes: true },
    });
    if (!m) throw new UnprocessableEntityException('Film bu tenant için geçerli değil');
    return m;
  }

  /** Auto-compute endsAt from movie duration. */
  private computeEndsAt(
    startsAt: Date,
    movie: Pick<Movie, 'durationMinutes'>,
    explicitEndsAt?: string | null,
  ): Date | null {
    if (movie.durationMinutes && movie.durationMinutes > 0) {
      return new Date(startsAt.getTime() + movie.durationMinutes * 60_000);
    }
    return explicitEndsAt ? new Date(explicitEndsAt) : null;
  }

  /** Resolve or auto-create a ScreeningHall. */
  private async resolveHallForSession(
    dto: { hallId?: string; hallName?: string },
    user: User,
    tenantId: string,
    mallId: string,
  ): Promise<string | undefined> {
    if (dto.hallId) {
      const hall = await this.prisma.screeningHall.findFirst({
        where: { id: dto.hallId, tenantId, mallId, deletedAt: null },
        select: { id: true },
      });
      if (!hall) throw new UnprocessableEntityException('Salon bu AVM için geçerli değil');
      return hall.id;
    }

    const name = dto.hallName?.trim();
    if (!name) return undefined;

    const slug = slugify(name);
    const existing = await this.prisma.screeningHall.findFirst({
      where: { tenantId, mallId, slug, deletedAt: null },
      select: { id: true },
    });
    if (existing) return existing.id;

    const uniqueSlug = await uniqueScreeningHallSlug(this.prisma, mallId, slug);
    const hall = await this.prisma.screeningHall.create({
      data: { tenantId, mallId, name, slug: uniqueSlug, createdBy: user.id },
      select: { id: true, name: true, slug: true },
    });
    await this.audit.logAction({
      userId: user.id, tenantId, mallId,
      action: 'screening-hall:create-from-session', entityType: 'screening-hall', entityId: hall.id,
      after: { name: hall.name, slug: hall.slug },
    });
    return hall.id;
  }

  /** Legacy: resolve or auto-create a Cinema (cinema operator). */
  private async resolveCinemaForSession(
    dto: { cinemaId?: string; cinemaName?: string },
    user: User,
    tenantId: string,
    mallId: string,
  ): Promise<string | undefined> {
    if (dto.cinemaId) {
      await this.assertCinemaInMall(dto.cinemaId, tenantId, mallId);
      return dto.cinemaId;
    }
    const name = dto.cinemaName?.trim();
    if (!name) return undefined;

    const slug = slugify(name);
    const existing = await this.prisma.cinema.findFirst({
      where: { tenantId, mallId, slug, deletedAt: null },
      select: { id: true },
    });
    if (existing) return existing.id;

    const uniqueSlug = await uniqueCinemaSlug(this.prisma, mallId, slug);
    const cinema = await this.prisma.cinema.create({
      data: {
        tenantId, mallId, name, slug: uniqueSlug,
        providerType: 'MANUAL', status: 'ACTIVE', createdBy: user.id,
      },
      select: { id: true, name: true, slug: true, status: true },
    });
    await this.audit.logAction({
      userId: user.id, tenantId, mallId,
      action: 'cinema:create-from-movie-session', entityType: 'cinema', entityId: cinema.id,
      after: { name: cinema.name, slug: cinema.slug, status: cinema.status },
    });
    return cinema.id;
  }

  /** Conflict check using the new ScreeningHall entity. */
  private async assertNoScheduleConflictHall(opts: {
    tenantId: string;
    mallId: string;
    hallId: string;
    showDate: string;
    showTime: string;
    startsAt: Date | null;
    endsAt: Date | null;
    status: MovieSession['status'];
    ignoreId?: string;
  }): Promise<void> {
    if (opts.status !== 'SCHEDULED') return;

    const baseWhere: Prisma.MovieSessionWhereInput = {
      tenantId: opts.tenantId,
      mallId: opts.mallId,
      hallId: opts.hallId,
      deletedAt: null,
      status: 'SCHEDULED',
      ...(opts.ignoreId ? { id: { not: opts.ignoreId } } : {}),
    };

    if (opts.startsAt && opts.endsAt) {
      // Full time-range overlap check
      const conflict = await this.prisma.movieSession.findFirst({
        where: {
          ...baseWhere,
          OR: [
            { startsAt: { lt: opts.endsAt }, endsAt: { gt: opts.startsAt } },
            { startsAt: { gte: opts.startsAt, lt: opts.endsAt }, endsAt: null },
          ],
        },
        select: { id: true },
      });
      if (conflict) {
        throw new UnprocessableEntityException('Bu salonda aynı zaman aralığında planlı seans var');
      }
    } else {
      // Exact showDate + showTime match
      const conflict = await this.prisma.movieSession.findFirst({
        where: { ...baseWhere, showDate: opts.showDate, showTime: opts.showTime },
        select: { id: true },
      });
      if (conflict) {
        throw new UnprocessableEntityException('Bu salonda aynı tarih ve saatte planlı seans var');
      }
    }
  }

  /** Legacy conflict check using Cinema entity. */
  private async assertNoScheduleConflictLegacy(opts: {
    tenantId: string;
    mallId: string;
    cinemaId: string;
    startsAt: Date;
    endsAt: Date | null;
    status: MovieSession['status'];
    ignoreId?: string;
  }): Promise<void> {
    if (opts.status !== 'SCHEDULED') return;

    const overlapWhere: Prisma.MovieSessionWhereInput = opts.endsAt
      ? {
          OR: [
            { startsAt: { lt: opts.endsAt }, endsAt: { gt: opts.startsAt } },
            { startsAt: { gte: opts.startsAt, lt: opts.endsAt }, endsAt: null },
          ],
        }
      : { startsAt: opts.startsAt };

    const conflict = await this.prisma.movieSession.findFirst({
      where: {
        tenantId: opts.tenantId,
        mallId: opts.mallId,
        cinemaId: opts.cinemaId,
        deletedAt: null,
        status: 'SCHEDULED',
        ...(opts.ignoreId ? { id: { not: opts.ignoreId } } : {}),
        ...overlapWhere,
      },
      select: { id: true },
    });
    if (conflict) {
      throw new UnprocessableEntityException('Bu sinema salonunda aynı zaman aralığında planlı seans var');
    }
  }
}
