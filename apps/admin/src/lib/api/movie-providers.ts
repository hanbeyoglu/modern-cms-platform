import { request } from './client';
import type { CmsMovie } from './movies';

export type TmdbProviderSettings = {
  readAccessToken: string;
  language: string;
  region: string;
  posterSize: string;
  syncEnabled: boolean;
  cronTime: string;
  readAccessTokenSource?: 'tenant' | 'env' | 'none';
  readAccessTokenConfigured?: boolean;
  lastSync?: {
    status?: string;
    newMovies?: number;
    updatedMovies?: number;
    errors?: number;
    finishedAt?: string;
  };
};

export type MovieProvidersSettingsResponse = {
  tenantId: string;
  movieProviders: { tmdb: TmdbProviderSettings };
};

export type TmdbListItem = {
  tmdbId: number;
  title: string;
  originalTitle?: string;
  releaseDate?: string;
  genres: string[];
  tmdbVoteAverage?: number;
  posterUrl: string | null;
  importStatus: 'import' | 'update';
};

export type TmdbListResponse = {
  page: number;
  totalPages: number;
  totalResults: number;
  results: TmdbListItem[];
};

export type MovieSyncLog = {
  id: string;
  tenantId: string;
  provider: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  newMovies: number;
  updatedMovies: number;
  failedMovies: number;
  message: string | null;
};

export function apiMovieProvidersSettingsGet(
  token: string,
  tenantId: string,
): Promise<MovieProvidersSettingsResponse> {
  return request('/movie-providers/settings', { token, tenantId });
}

export function apiMovieProvidersSettingsUpdateTmdb(
  token: string,
  tenantId: string,
  data: Partial<TmdbProviderSettings>,
): Promise<MovieProvidersSettingsResponse> {
  return request('/movie-providers/settings/tmdb', {
    method: 'PATCH',
    token,
    tenantId,
    body: JSON.stringify(data),
  });
}

export function apiTmdbNowPlaying(
  token: string,
  tenantId: string,
  page = 1,
): Promise<TmdbListResponse> {
  return request(`/movie-providers/tmdb/now-playing?page=${page}`, { token, tenantId });
}

export function apiTmdbUpcoming(
  token: string,
  tenantId: string,
  page = 1,
): Promise<TmdbListResponse> {
  return request(`/movie-providers/tmdb/upcoming?page=${page}`, { token, tenantId });
}

export function apiTmdbPopular(
  token: string,
  tenantId: string,
  page = 1,
): Promise<TmdbListResponse> {
  return request(`/movie-providers/tmdb/popular?page=${page}`, { token, tenantId });
}

export function apiTmdbSearch(
  token: string,
  tenantId: string,
  q: string,
  page = 1,
): Promise<TmdbListResponse> {
  const params = new URLSearchParams({ q, page: String(page) });
  return request(`/movie-providers/tmdb/search?${params}`, { token, tenantId });
}

export function apiTmdbImport(
  token: string,
  tenantId: string,
  tmdbId: number,
): Promise<{ movieId: string; created: boolean; tmdbId: number }> {
  return request('/movie-providers/tmdb/import', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify({ tmdbId }),
  });
}

export function apiMovieSyncTrigger(
  token: string,
  tenantId: string,
): Promise<{ accepted: boolean; jobId: string }> {
  return request('/movie-providers/sync', { method: 'POST', token, tenantId });
}

export function apiMovieSyncLogs(
  token: string,
  tenantId: string,
): Promise<{ logs: MovieSyncLog[] }> {
  return request('/movie-providers/sync/logs', { token, tenantId });
}

export function apiMovieResyncFromProvider(
  token: string,
  tenantId: string,
  movieId: string,
): Promise<CmsMovie> {
  return request(`/movies/${movieId}/sync-from-provider`, { method: 'POST', token, tenantId });
}

export type MovieImportBatchProgress = {
  batchId: string;
  tenantId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  total: number;
  processed: number;
  newMovies: number;
  updatedMovies: number;
  failedMovies: number;
  percent: number;
  startedAt?: string;
  finishedAt?: string;
};

export type BulkImportPreview = {
  total: number;
  newMovies: number;
  updatedMovies: number;
};

export function apiTmdbBulkImport(
  token: string,
  tenantId: string,
  tmdbIds: number[],
): Promise<{ accepted: boolean; batchId: string; jobId: string; preview: BulkImportPreview }> {
  return request('/movie-providers/tmdb/import/bulk', {
    method: 'POST',
    token,
    tenantId,
    body: JSON.stringify({ tmdbIds }),
  });
}

export function apiMovieImportBatchProgress(
  token: string,
  tenantId: string,
  batchId: string,
): Promise<{ found: boolean; progress?: MovieImportBatchProgress }> {
  return request(`/movie-providers/import/batches/${batchId}`, { token, tenantId });
}
