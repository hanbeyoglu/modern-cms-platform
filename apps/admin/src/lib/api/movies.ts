import { appendLimitParam } from './constants';
import { request } from './client';
import type { MediaAsset } from './media';

export type MovieStatus = 'ACTIVE' | 'PASSIVE' | 'ARCHIVED';

export type MovieMediaPreview = Pick<MediaAsset, 'id' | 'publicUrl' | 'originalName' | 'mimeType'>;

export type CmsMovie = {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  originalTitle: string | null;
  posterMediaId: string | null;
  description: string | null;
  durationMinutes: number | null;
  genre: string | null;
  rating: string | null;
  trailerUrl: string | null;
  releaseDate: string | null;
  status: MovieStatus;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  posterMedia: MovieMediaPreview | null;
};

export type MovieListResponse = { movies: CmsMovie[]; total: number; page: number; limit: number };

export type CreateMoviePayload = {
  title: string;
  slug?: string;
  originalTitle?: string;
  posterMediaId?: string;
  description?: string;
  durationMinutes?: number;
  genre?: string;
  rating?: string;
  trailerUrl?: string;
  releaseDate?: string;
  status?: MovieStatus;
};

export async function apiMoviesList(
  token: string,
  tenantId: string,
  opts?: {
    status?: MovieStatus;
    search?: string;
    sortBy?: 'title' | 'createdAt' | 'releaseDate';
    sortDir?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  },
): Promise<MovieListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.search) params.set('search', opts.search);
  if (opts?.sortBy) params.set('sortBy', opts.sortBy);
  if (opts?.sortDir) params.set('sortDir', opts.sortDir);
  if (opts?.page) params.set('page', String(opts.page));
  appendLimitParam(params, opts?.limit);
  const qs = params.toString();
  return request<MovieListResponse>(`/movies${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
    tenantId,
  });
}

export async function apiMovieGet(token: string, tenantId: string, id: string): Promise<CmsMovie> {
  return request<CmsMovie>(`/movies/${id}`, { method: 'GET', token, tenantId });
}

export async function apiMovieCreate(
  token: string,
  tenantId: string,
  body: CreateMoviePayload,
): Promise<CmsMovie> {
  return request<CmsMovie>('/movies', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify(body),
  });
}

export async function apiMovieUpdate(
  token: string,
  tenantId: string,
  id: string,
  body: Partial<CreateMoviePayload>,
): Promise<CmsMovie> {
  return request<CmsMovie>(`/movies/${id}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(body),
  });
}

export async function apiMovieDelete(token: string, tenantId: string, id: string): Promise<void> {
  return request<void>(`/movies/${id}`, { method: 'DELETE', token, tenantId });
}
