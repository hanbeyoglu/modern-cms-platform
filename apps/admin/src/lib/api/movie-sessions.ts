import { appendLimitParam } from './constants';
import { request } from './client';

export type MovieSessionStatus = 'SCHEDULED' | 'CANCELLED' | 'ARCHIVED';

export type MovieSessionRow = {
  id: string;
  tenantId: string;
  mallId: string;
  cinemaId: string | null;
  hallId: string | null;
  movieId: string;
  hallName: string | null;
  showTime: string | null;
  showDate: string | null;
  startsAt: string | null;
  endsAt: string | null;
  language: string | null;
  subtitle: string | null;
  format: string | null;
  ticketUrl: string | null;
  status: MovieSessionStatus;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  cinema: { id: string; name: string; slug: string } | null;
  hall: { id: string; name: string; slug: string } | null;
  movie: { id: string; title: string; slug: string; durationMinutes: number | null };
};

export type MovieSessionListResponse = {
  sessions: MovieSessionRow[];
  total: number;
  page: number;
  limit: number;
};

/** Payload for /movies/:id/sessions (showTime required, everything else optional). */
export type CreateMovieSessionForMoviePayload = {
  hallId?: string;
  hallName?: string;
  cinemaId?: string;
  cinemaName?: string;
  showTime: string;
  showDate?: string;
  language?: string;
  subtitle?: string;
  format?: string;
  ticketUrl?: string;
  status?: MovieSessionStatus;
};

/** Legacy payload for /movie-sessions (startsAt required). */
export type CreateMovieSessionPayload = {
  cinemaId?: string;
  movieId: string;
  hallName?: string;
  startsAt: string;
  endsAt?: string;
  language?: string;
  subtitle?: string;
  format?: string;
  ticketUrl?: string;
  status?: MovieSessionStatus;
};

// ─── /movie-sessions (legacy) ─────────────────────────────────────────────────

export async function apiMovieSessionsList(
  token: string,
  tenantId: string,
  mallId: string,
  opts?: {
    status?: MovieSessionStatus;
    search?: string;
    cinemaId?: string;
    movieId?: string;
    showDate?: string;
    startsFrom?: string;
    startsTo?: string;
    sortBy?: 'startsAt' | 'createdAt' | 'showDate';
    sortDir?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  },
): Promise<MovieSessionListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.cinemaId) params.set('cinemaId', opts.cinemaId);
  if (opts?.movieId) params.set('movieId', opts.movieId);
  if (opts?.showDate) params.set('showDate', opts.showDate);
  if (opts?.startsFrom) params.set('startsFrom', opts.startsFrom);
  if (opts?.startsTo) params.set('startsTo', opts.startsTo);
  if (opts?.sortBy) params.set('sortBy', opts.sortBy);
  if (opts?.sortDir) params.set('sortDir', opts.sortDir);
  if (opts?.page) params.set('page', String(opts.page));
  appendLimitParam(params, opts?.limit);
  const qs = params.toString();
  return request<MovieSessionListResponse>(`/movie-sessions${qs ? `?${qs}` : ''}`, {
    method: 'GET', token, tenantId, mallId,
  });
}

export async function apiMovieSessionGet(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
): Promise<MovieSessionRow> {
  return request<MovieSessionRow>(`/movie-sessions/${id}`, { method: 'GET', token, tenantId, mallId });
}

export async function apiMovieSessionCreate(
  token: string,
  tenantId: string,
  mallId: string,
  body: CreateMovieSessionPayload,
): Promise<MovieSessionRow> {
  return request<MovieSessionRow>('/movie-sessions', {
    method: 'POST', token, tenantId, mallId, body: JSON.stringify(body),
  });
}

export async function apiMovieSessionUpdate(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
  body: Partial<CreateMovieSessionPayload>,
): Promise<MovieSessionRow> {
  return request<MovieSessionRow>(`/movie-sessions/${id}`, {
    method: 'PATCH', token, tenantId, mallId, body: JSON.stringify(body),
  });
}

export async function apiMovieSessionDelete(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
): Promise<void> {
  return request<void>(`/movie-sessions/${id}`, { method: 'DELETE', token, tenantId, mallId });
}

export async function apiMovieSessionCancel(
  token: string,
  tenantId: string,
  mallId: string,
  id: string,
): Promise<MovieSessionRow> {
  return request<MovieSessionRow>(`/movie-sessions/${id}/cancel`, {
    method: 'POST', token, tenantId, mallId,
  });
}

// ─── /movies/:movieId/sessions ────────────────────────────────────────────────

export async function apiMovieSessionsForMovieList(
  token: string,
  tenantId: string,
  mallId: string,
  movieId: string,
  opts?: {
    status?: MovieSessionStatus;
    showDate?: string;
    sortBy?: 'startsAt' | 'createdAt' | 'showDate';
    sortDir?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  },
): Promise<MovieSessionListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.showDate) params.set('showDate', opts.showDate);
  if (opts?.sortBy) params.set('sortBy', opts.sortBy);
  if (opts?.sortDir) params.set('sortDir', opts.sortDir);
  if (opts?.page) params.set('page', String(opts.page));
  appendLimitParam(params, opts?.limit);
  const qs = params.toString();
  return request<MovieSessionListResponse>(`/movies/${movieId}/sessions${qs ? `?${qs}` : ''}`, {
    method: 'GET', token, tenantId, mallId,
  });
}

export async function apiMovieSessionForMovieCreate(
  token: string,
  tenantId: string,
  mallId: string,
  movieId: string,
  body: CreateMovieSessionForMoviePayload,
): Promise<MovieSessionRow> {
  return request<MovieSessionRow>(`/movies/${movieId}/sessions`, {
    method: 'POST', token, tenantId, mallId, body: JSON.stringify(body),
  });
}

export async function apiMovieSessionForMovieUpdate(
  token: string,
  tenantId: string,
  mallId: string,
  movieId: string,
  sessionId: string,
  body: Partial<CreateMovieSessionForMoviePayload>,
): Promise<MovieSessionRow> {
  return request<MovieSessionRow>(`/movies/${movieId}/sessions/${sessionId}`, {
    method: 'PATCH', token, tenantId, mallId, body: JSON.stringify(body),
  });
}

export async function apiMovieSessionForMovieDelete(
  token: string,
  tenantId: string,
  mallId: string,
  movieId: string,
  sessionId: string,
): Promise<void> {
  return request<void>(`/movies/${movieId}/sessions/${sessionId}`, {
    method: 'DELETE', token, tenantId, mallId,
  });
}
