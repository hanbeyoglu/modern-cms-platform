import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { MovieSession, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit.service';
import { assertOptionalHttpUrl, validateStartBeforeEnd } from '../common/utils/content-validation';
import type { CreateMovieSessionDto } from './dto/create-movie-session.dto';
import type { UpdateMovieSessionDto } from './dto/update-movie-session.dto';
import type { ListMovieSessionsDto } from './dto/list-movie-sessions.dto';

const SESSION_INCLUDE = {
  cinema: { select: { id: true, name: true, slug: true } },
  movie: { select: { id: true, title: true, slug: true, durationMinutes: true } },
} satisfies Prisma.MovieSessionInclude;

export type MovieSessionResponse = Prisma.MovieSessionGetPayload<{ include: typeof SESSION_INCLUDE }>;

@Injectable()
export class MovieSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

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
      ...(query.search
        ? {
            OR: [
              { hallName: { contains: query.search, mode: 'insensitive' as const } },
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

    const dir = query.sortDir === 'desc' ? 'desc' : 'asc';
    const sortBy = query.sortBy ?? 'startsAt';
    const orderBy: Prisma.MovieSessionOrderByWithRelationInput =
      sortBy === 'createdAt' ? { createdAt: dir } : { startsAt: dir };

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

  async create(
    dto: CreateMovieSessionDto,
    user: User,
    tenantId: string,
    mallId: string,
  ): Promise<MovieSessionResponse> {
    validateStartBeforeEnd(dto.startsAt, dto.endsAt);
    assertOptionalHttpUrl(dto.ticketUrl);

    await this.assertCinemaInMall(dto.cinemaId, tenantId, mallId);
    await this.assertMovieInTenant(dto.movieId, tenantId);

    const session = await this.prisma.movieSession.create({
      data: {
        tenantId,
        mallId,
        cinemaId: dto.cinemaId,
        movieId: dto.movieId,
        hallName: dto.hallName ?? null,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
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
      userId: user.id,
      tenantId,
      mallId,
      action: 'movie-session:create',
      entityType: 'movie-session',
      entityId: session.id,
      after: { startsAt: session.startsAt.toISOString(), cinemaId: session.cinemaId, movieId: session.movieId },
    });

    return session;
  }

  async update(
    id: string,
    dto: UpdateMovieSessionDto,
    user: User,
    tenantId: string,
    mallId: string,
  ): Promise<MovieSessionResponse> {
    const existing = await this.assertExists(id, tenantId, mallId);

    const nextStarts = dto.startsAt !== undefined ? dto.startsAt : existing.startsAt.toISOString();
    const nextEnds = dto.endsAt !== undefined ? dto.endsAt : existing.endsAt?.toISOString();
    validateStartBeforeEnd(nextStarts, nextEnds ?? undefined);

    const nextTicket = dto.ticketUrl !== undefined ? dto.ticketUrl : existing.ticketUrl;
    assertOptionalHttpUrl(nextTicket ?? undefined);

    const cinemaId = dto.cinemaId ?? existing.cinemaId;
    const movieId = dto.movieId ?? existing.movieId;

    if (dto.cinemaId) {
      await this.assertCinemaInMall(cinemaId, tenantId, mallId);
    }
    if (dto.movieId) {
      await this.assertMovieInTenant(movieId, tenantId);
    }

    const session = await this.prisma.movieSession.update({
      where: { id },
      data: {
        ...(dto.cinemaId !== undefined && { cinemaId: dto.cinemaId }),
        ...(dto.movieId !== undefined && { movieId: dto.movieId }),
        ...(dto.hallName !== undefined && { hallName: dto.hallName || null }),
        ...(dto.startsAt !== undefined && { startsAt: new Date(dto.startsAt) }),
        ...(dto.endsAt !== undefined && {
          endsAt: dto.endsAt === null ? null : dto.endsAt ? new Date(dto.endsAt) : null,
        }),
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
      userId: user.id,
      tenantId,
      mallId,
      action: 'movie-session:update',
      entityType: 'movie-session',
      entityId: id,
      before: { startsAt: existing.startsAt.toISOString(), status: existing.status },
      after: { startsAt: session.startsAt.toISOString(), status: session.status },
    });

    return session;
  }

  async remove(id: string, user: User, tenantId: string, mallId: string): Promise<void> {
    const existing = await this.assertExists(id, tenantId, mallId);
    await this.prisma.movieSession.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: user.id },
    });
    await this.audit.logAction({
      userId: user.id,
      tenantId,
      mallId,
      action: 'movie-session:delete',
      entityType: 'movie-session',
      entityId: id,
      before: { startsAt: existing.startsAt.toISOString(), status: existing.status },
    });
  }

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
      userId: user.id,
      tenantId,
      mallId,
      action: 'movie-session:cancel',
      entityType: 'movie-session',
      entityId: id,
      before: { status: existing.status },
      after: { status: 'CANCELLED' },
    });

    return session;
  }

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
        cinema: { deletedAt: null, status: 'ACTIVE' },
        movie: { deletedAt: null, status: 'ACTIVE' },
        ...(opts.cinemaId ? { cinemaId: opts.cinemaId } : {}),
        ...(opts.movieId ? { movieId: opts.movieId } : {}),
        ...(dayStart && dayEnd ? { startsAt: { gte: dayStart, lt: dayEnd } } : {}),
      },
      include: SESSION_INCLUDE,
      orderBy: { startsAt: 'asc' },
    });
  }

  private async assertExists(id: string, tenantId: string, mallId: string): Promise<MovieSession> {
    const row = await this.prisma.movieSession.findFirst({
      where: { id, tenantId, mallId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Seans bulunamadı');
    return row;
  }

  private async assertCinemaInMall(cinemaId: string, tenantId: string, mallId: string): Promise<void> {
    const c = await this.prisma.cinema.findFirst({
      where: { id: cinemaId, tenantId, mallId, deletedAt: null },
    });
    if (!c) {
      throw new UnprocessableEntityException('Sinema bu AVM için geçerli değil');
    }
  }

  private async assertMovieInTenant(movieId: string, tenantId: string): Promise<void> {
    const m = await this.prisma.movie.findFirst({
      where: { id: movieId, tenantId, deletedAt: null },
    });
    if (!m) {
      throw new UnprocessableEntityException('Film bu tenant için geçerli değil');
    }
  }
}
