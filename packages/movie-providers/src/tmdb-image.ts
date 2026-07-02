const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

/**
 * Build a TMDB image URL from a path segment (e.g. /abc.jpg) and size (e.g. w500).
 * Poster/backdrop paths are stored in DB; full URLs are derived at runtime.
 */
export function tmdbImage(path: string | null | undefined, size = 'w500'): string | null {
  if (!path?.trim()) return null;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${TMDB_IMAGE_BASE}/${size}${normalized}`;
}

export const TMDB_APPEND_TO_RESPONSE =
  'credits,videos,images,external_ids,release_dates,keywords';
