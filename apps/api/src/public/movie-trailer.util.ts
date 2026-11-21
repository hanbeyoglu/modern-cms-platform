import type { PublicMovieTrailer } from './public-response.types';

/** Normalize supported YouTube links into a player URL; never embed arbitrary hosts. */
export function resolveMovieTrailer(rawUrl: string | null | undefined): PublicMovieTrailer | null {
  if (!rawUrl?.trim()) return null;
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let videoId: string | null = null;
  if (host === 'youtu.be' && parts.length === 1) {
    videoId = parts[0];
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v');
    else if (parts.length === 2 && ['embed', 'shorts', 'live'].includes(parts[0])) videoId = parts[1];
  } else if (['youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host) && parts.length === 2 && parts[0] === 'embed') {
    videoId = parts[1];
  }
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

  return {
    provider: 'YOUTUBE',
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`,
  };
}
