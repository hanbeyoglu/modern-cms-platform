/** Maps OpenAPI path (+ method) to developer guide dictionary keys. */
export const ENDPOINT_GUIDE_KEY_BY_ROUTE: Record<string, string> = {
  'GET /public/site-config': 'devGuide.public.siteConfig',
  'GET /public/media-guidelines': 'devGuide.public.mediaGuidelines',
  'GET /public/home': 'devGuide.public.home',
  'GET /public/sliders': 'devGuide.public.sliders',
  'GET /public/events': 'devGuide.public.events.list',
  'GET /public/events/{slug}': 'devGuide.public.events.detail',
  'GET /public/campaigns': 'devGuide.public.campaigns.list',
  'GET /public/campaigns/{slug}': 'devGuide.public.campaigns.detail',
  'GET /public/stores': 'devGuide.public.stores.list',
  'GET /public/stores/{slug}': 'devGuide.public.stores.detail',
  'GET /public/pages/{slug}': 'devGuide.public.pages.detail',
  'GET /public/cinema': 'devGuide.public.cinema',
  'GET /public/movie-sessions': 'devGuide.public.movieSessions',
  'GET /public/popups': 'devGuide.public.popups',
  'GET /public/services': 'devGuide.public.services.list',
  'GET /public/services/{id}': 'devGuide.public.services.detail',
  'GET /public/search': 'devGuide.public.search',
};

export function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}
