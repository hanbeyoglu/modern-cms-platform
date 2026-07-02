import type {
  MovieProviderConfig,
  MovieProviderCredits,
  MovieProviderDetail,
  MovieProviderImages,
  MovieProviderListResult,
  MovieProviderSearchResult,
  MovieProviderVideos,
} from './types';

/**
 * Abstract movie metadata provider.
 * TMDB is the first implementation; IMDb, OMDb, custom chains can follow.
 */
export abstract class MovieProvider {
  abstract readonly type: string;

  abstract searchMovies(query: string, page?: number): Promise<MovieProviderSearchResult>;
  abstract getMovie(id: number): Promise<MovieProviderDetail>;
  abstract getNowPlaying(page?: number): Promise<MovieProviderListResult>;
  abstract getUpcoming(page?: number): Promise<MovieProviderListResult>;
  abstract getPopular(page?: number): Promise<MovieProviderListResult>;
  abstract getCredits(id: number): Promise<MovieProviderCredits>;
  abstract getImages(id: number): Promise<MovieProviderImages>;
  abstract getVideos(id: number): Promise<MovieProviderVideos>;
}

export type MovieProviderFactory = (config: MovieProviderConfig) => MovieProvider;
