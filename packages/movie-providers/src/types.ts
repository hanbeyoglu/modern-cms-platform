export type MovieProviderType = 'TMDB';

export type MovieProviderListItem = {
  id: number;
  title: string;
  originalTitle?: string;
  overview?: string;
  releaseDate?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  genreIds?: number[];
  genreNames?: string[];
  adult?: boolean;
  originalLanguage?: string;
};

export type MovieProviderCredits = {
  cast: Array<{ id: number; name: string; character?: string; order?: number; profilePath?: string | null }>;
  crew: Array<{ id: number; name: string; job?: string; department?: string; profilePath?: string | null }>;
};

export type MovieProviderImages = {
  posters: Array<{ filePath: string; width?: number; height?: number }>;
  backdrops: Array<{ filePath: string; width?: number; height?: number }>;
};

export type MovieProviderVideos = {
  results: Array<{ key: string; site: string; type: string; name?: string; official?: boolean }>;
};

export type MovieProviderDetail = MovieProviderListItem & {
  runtime?: number;
  status?: string;
  homepage?: string;
  imdbId?: string;
  productionCompanies?: Array<{ id: number; name: string; logoPath?: string | null }>;
  productionCountries?: Array<{ iso31661: string; name: string }>;
  keywords?: string[];
  credits?: MovieProviderCredits;
  images?: MovieProviderImages;
  videos?: MovieProviderVideos;
  releaseDates?: Array<{ iso31661: string; releaseDate?: string; certification?: string }>;
};

export type MovieProviderSearchResult = {
  page: number;
  totalPages: number;
  totalResults: number;
  results: MovieProviderListItem[];
};

export type MovieProviderListResult = {
  page: number;
  totalPages: number;
  totalResults: number;
  results: MovieProviderListItem[];
};

export type MovieProviderConfig = {
  accessToken: string;
  language: string;
  region: string;
  posterSize: string;
};

export type TmdbProviderSettings = {
  readAccessToken: string;
  language: string;
  region: string;
  posterSize: string;
  syncEnabled: boolean;
  cronTime: string;
  lastSync?: {
    status?: string;
    newMovies?: number;
    updatedMovies?: number;
    errors?: number;
    finishedAt?: string;
  };
};

export type MovieProvidersSettings = {
  tmdb: TmdbProviderSettings;
};

export const DEFAULT_TMDB_SETTINGS: TmdbProviderSettings = {
  readAccessToken: '',
  language: 'tr-TR',
  region: 'TR',
  posterSize: 'w500',
  syncEnabled: true,
  cronTime: '03:00',
};

export const DEFAULT_MOVIE_PROVIDERS_SETTINGS: MovieProvidersSettings = {
  tmdb: DEFAULT_TMDB_SETTINGS,
};

export const MOVIE_SYNC_QUEUE_NAME = 'movie-sync';

export type MovieSyncJobData = {
  tenantId: string;
  provider: MovieProviderType;
  triggeredBy: 'cron' | 'manual';
  userId?: string;
};

export type MovieImportJobData = {
  tenantId: string;
  provider: MovieProviderType;
  externalId: number;
  userId: string;
};
