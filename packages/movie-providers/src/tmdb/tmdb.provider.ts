import type {
  MovieProviderConfig,
  MovieProviderCredits,
  MovieProviderDetail,
  MovieProviderImages,
  MovieProviderListItem,
  MovieProviderListResult,
  MovieProviderSearchResult,
  MovieProviderVideos,
} from '../types';
import { MovieProvider } from '../movie-provider.interface';
import { TMDB_APPEND_TO_RESPONSE } from '../tmdb-image';

type TmdbGenre = { id: number; name: string };

type TmdbCastMember = {
  id: number;
  name: string;
  character?: string;
  order?: number;
  profile_path?: string | null;
};

type TmdbCrewMember = {
  id: number;
  name: string;
  job?: string;
  department?: string;
  profile_path?: string | null;
};

type TmdbMovieBase = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  genres?: TmdbGenre[];
  adult?: boolean;
  original_language?: string;
  runtime?: number;
  status?: string;
  homepage?: string;
  imdb_id?: string;
  production_companies?: Array<{ id: number; name: string; logo_path?: string | null }>;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  credits?: { cast?: TmdbCastMember[]; crew?: TmdbCrewMember[] };
  images?: {
    posters?: Array<{ file_path: string; width?: number; height?: number }>;
    backdrops?: Array<{ file_path: string; width?: number; height?: number }>;
  };
  videos?: { results?: Array<{ key: string; site: string; type: string; name?: string; official?: boolean }> };
  release_dates?: {
    results?: Array<{
      iso_3166_1: string;
      release_dates?: Array<{ release_date?: string; certification?: string }>;
    }>;
  };
  keywords?: { keywords?: Array<{ id: number; name: string }> };
};

type TmdbPaged<T> = {
  page: number;
  total_pages: number;
  total_results: number;
  results: T[];
};

export class TmdbProvider extends MovieProvider {
  readonly type = 'TMDB';

  constructor(private readonly config: MovieProviderConfig) {
    super();
  }

  private async fetchJson<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`TMDB ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
  }

  async searchMovies(query: string, page = 1): Promise<MovieProviderSearchResult> {
    const data = await this.fetchJson<TmdbPaged<TmdbMovieBase>>('/search/movie', {
      query,
      page: String(page),
      language: this.config.language,
      region: this.config.region,
      include_adult: 'false',
    });
    return this.mapPaged(data);
  }

  async getMovie(id: number): Promise<MovieProviderDetail> {
    const data = await this.fetchJson<TmdbMovieBase>(`/movie/${id}`, {
      language: this.config.language,
      append_to_response: TMDB_APPEND_TO_RESPONSE,
    });
    return this.mapDetail(data);
  }

  async getNowPlaying(page = 1): Promise<MovieProviderListResult> {
    const data = await this.fetchJson<TmdbPaged<TmdbMovieBase>>('/movie/now_playing', {
      page: String(page),
      language: this.config.language,
      region: this.config.region,
    });
    return this.mapPaged(data);
  }

  async getUpcoming(page = 1): Promise<MovieProviderListResult> {
    const data = await this.fetchJson<TmdbPaged<TmdbMovieBase>>('/movie/upcoming', {
      page: String(page),
      language: this.config.language,
      region: this.config.region,
    });
    return this.mapPaged(data);
  }

  async getPopular(page = 1): Promise<MovieProviderListResult> {
    const data = await this.fetchJson<TmdbPaged<TmdbMovieBase>>('/movie/popular', {
      page: String(page),
      language: this.config.language,
      region: this.config.region,
    });
    return this.mapPaged(data);
  }

  async getCredits(id: number): Promise<MovieProviderCredits> {
    const data = await this.fetchJson<{ cast?: TmdbCastMember[]; crew?: TmdbCrewMember[] }>(
      `/movie/${id}/credits`,
      { language: this.config.language },
    );
    return {
      cast: (data.cast ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        order: c.order,
        profilePath: c.profile_path ?? null,
      })),
      crew: (data.crew ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        job: c.job,
        department: c.department,
        profilePath: c.profile_path ?? null,
      })),
    };
  }

  async getImages(id: number): Promise<MovieProviderImages> {
    const data = await this.fetchJson<{
      posters?: Array<{ file_path: string; width?: number; height?: number }>;
      backdrops?: Array<{ file_path: string; width?: number; height?: number }>;
    }>(`/movie/${id}/images`);
    return {
      posters: (data.posters ?? []).map((p) => ({
        filePath: p.file_path,
        width: p.width,
        height: p.height,
      })),
      backdrops: (data.backdrops ?? []).map((b) => ({
        filePath: b.file_path,
        width: b.width,
        height: b.height,
      })),
    };
  }

  async getVideos(id: number): Promise<MovieProviderVideos> {
    const data = await this.fetchJson<{
      results?: Array<{ key: string; site: string; type: string; name?: string; official?: boolean }>;
    }>(`/movie/${id}/videos`, { language: this.config.language });
    return {
      results: (data.results ?? []).map((v) => ({
        key: v.key,
        site: v.site,
        type: v.type,
        name: v.name,
        official: v.official,
      })),
    };
  }

  async getMovieLocalized(id: number, language: string): Promise<{ title?: string; overview?: string }> {
    return this.fetchJson<{ title?: string; overview?: string }>(`/movie/${id}`, { language });
  }

  private mapPaged(data: TmdbPaged<TmdbMovieBase>): MovieProviderListResult {
    return {
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
      results: data.results.map((r) => this.mapListItem(r)),
    };
  }

  private mapListItem(row: TmdbMovieBase): MovieProviderListItem {
    return {
      id: row.id,
      title: row.title ?? row.name ?? '',
      originalTitle: row.original_title ?? row.original_name,
      overview: row.overview,
      releaseDate: row.release_date ?? row.first_air_date,
      posterPath: row.poster_path ?? null,
      backdropPath: row.backdrop_path ?? null,
      voteAverage: row.vote_average,
      voteCount: row.vote_count,
      popularity: row.popularity,
      genreIds: row.genre_ids,
      genreNames: row.genres?.map((g) => g.name),
      adult: row.adult,
      originalLanguage: row.original_language,
    };
  }

  private mapDetail(row: TmdbMovieBase): MovieProviderDetail {
    const base = this.mapListItem(row);
    return {
      ...base,
      runtime: row.runtime,
      status: row.status,
      homepage: row.homepage,
      imdbId: row.imdb_id,
      productionCompanies: (row.production_companies ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        logoPath: c.logo_path ?? null,
      })),
      productionCountries: (row.production_countries ?? []).map((c) => ({
        iso31661: c.iso_3166_1,
        name: c.name,
      })),
      keywords: row.keywords?.keywords?.map((k) => k.name) ?? [],
      credits: row.credits
        ? {
            cast: (row.credits.cast ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              character: c.character,
              order: c.order,
              profilePath: c.profile_path ?? null,
            })),
            crew: (row.credits.crew ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              job: c.job,
              department: c.department,
              profilePath: c.profile_path ?? null,
            })),
          }
        : undefined,
      images: row.images
        ? {
            posters: (row.images.posters ?? []).map((p) => ({
              filePath: p.file_path,
              width: p.width,
              height: p.height,
            })),
            backdrops: (row.images.backdrops ?? []).map((b) => ({
              filePath: b.file_path,
              width: b.width,
              height: b.height,
            })),
          }
        : undefined,
      videos: row.videos
        ? {
            results: (row.videos.results ?? []).map((v) => ({
              key: v.key,
              site: v.site,
              type: v.type,
              name: v.name,
              official: v.official,
            })),
          }
        : undefined,
      releaseDates: (row.release_dates?.results ?? []).flatMap((r) =>
        (r.release_dates ?? []).map((d) => ({
          iso31661: r.iso_3166_1,
          releaseDate: d.release_date,
          certification: d.certification,
        })),
      ),
    };
  }
}

export function createTmdbProvider(config: MovieProviderConfig): TmdbProvider {
  return new TmdbProvider(config);
}

export function localeCodeToTmdbLanguage(code: string): string {
  const map: Record<string, string> = {
    tr: 'tr-TR',
    en: 'en-US',
    ru: 'ru-RU',
    de: 'de-DE',
    fr: 'fr-FR',
    es: 'es-ES',
    ar: 'ar-SA',
  };
  const lower = code.toLowerCase().split('-')[0] ?? code;
  return map[lower] ?? `${lower}-${lower.toUpperCase()}`;
}

export function pickTrailerUrl(videos?: MovieProviderDetail['videos']): string | null {
  const youtubeVideos = (videos?.results ?? []).filter((v) => v.site === 'YouTube' && v.key?.trim());
  const trailer =
    youtubeVideos.find((v) => v.official === true && v.type === 'Trailer') ??
    youtubeVideos.find((v) => v.type === 'Trailer') ??
    youtubeVideos.find((v) => v.type === 'Teaser');
  return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}

export function pickDirectors(credits?: MovieProviderDetail['credits']): Array<{ id: number; name: string }> {
  return (credits?.crew ?? [])
    .filter((c) => c.job === 'Director')
    .map((c) => ({ id: c.id, name: c.name }));
}

export function pickTopCast(
  credits?: MovieProviderDetail['credits'],
  limit = 20,
): Array<{ id: number; name: string; character?: string }> {
  return (credits?.cast ?? [])
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, limit)
    .map((c) => ({ id: c.id, name: c.name, character: c.character }));
}
