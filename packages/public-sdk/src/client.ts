import type {
  CmsCampaign,
  CmsCinema,
  CmsEnvelope,
  CmsEvent,
  CmsHomeResponse,
  CmsMediaGuideline,
  CmsMovieSession,
  CmsPage,
  CmsPaginatedEnvelope,
  CmsPopup,
  CmsSearchPaginatedEnvelope,
  CmsService,
  CmsSiteConfig,
  CmsSlider,
  CmsStore,
} from './types';

export interface CmsClientConfig {
  /** Base URL of the CMS API (e.g. 'https://api.example.com') */
  baseUrl: string;
  /** Tenant identifier — sent as x-tenant-id header on every request */
  tenantId: string;
  /** Mall/location identifier — sent as x-mall-id header when provided */
  mallId?: string;
  /** Default locale code (e.g. 'tr', 'en') */
  defaultLocale?: string;
  /** Optional fetch implementation for SSR environments */
  fetchImpl?: typeof fetch;
}

export interface PaginatedListOpts {
  locale?: string;
  page?: number;
  limit?: number;
}

export interface GetEventsOpts extends PaginatedListOpts {
  category?: string;
  search?: string;
}

export interface GetCampaignsOpts extends PaginatedListOpts {
  storeId?: string;
  search?: string;
}

export interface GetStoresOpts extends PaginatedListOpts {
  categoryId?: string;
  search?: string;
  featuredOnly?: boolean;
}

export interface GetSlidersOpts {
  locale?: string;
  targetDevice?: string;
  placement?: string;
  entityId?: string;
  channel?: string;
}

export interface GetPopupsOpts extends PaginatedListOpts {
  channel?: string;
}

export interface GetServicesOpts extends PaginatedListOpts {
  search?: string;
}

export interface GetMovieSessionsOpts {
  locale?: string;
  date?: string;
  cinemaId?: string;
  movieId?: string;
  limit?: number;
}

export interface SearchOpts extends PaginatedListOpts {
  q: string;
  type?: string;
}

/**
 * Framework-agnostic client for the Modern CMS public API.
 *
 * @example
 * const cms = new CmsPublicClient({
 *   baseUrl: 'https://api.example.com',
 *   tenantId: 'ten_abc123',
 *   mallId: 'mal_xyz456',
 *   defaultLocale: 'tr',
 * });
 *
 * const home = await cms.getHomePage();
 * const events = await cms.getEvents({ locale: 'en', limit: 10 });
 */
export class CmsPublicClient {
  private readonly config: Required<Pick<CmsClientConfig, 'baseUrl' | 'tenantId'>> &
    Pick<CmsClientConfig, 'mallId' | 'defaultLocale' | 'fetchImpl'>;

  constructor(config: CmsClientConfig) {
    this.config = config;
  }

  // ── Site Config ───────────────────────────────────────────────────────────

  getSiteConfig(locale?: string): Promise<CmsEnvelope<CmsSiteConfig>> {
    return this.get('/public/site-config', { locale });
  }

  getMediaGuidelines(locale?: string): Promise<CmsEnvelope<CmsMediaGuideline[]>> {
    return this.get('/public/media-guidelines', { locale });
  }

  // ── Home ──────────────────────────────────────────────────────────────────

  getHomePage(locale?: string): Promise<CmsEnvelope<CmsHomeResponse>> {
    return this.get('/public/home', { locale });
  }

  // ── Sliders ───────────────────────────────────────────────────────────────

  getSliders(opts: GetSlidersOpts = {}): Promise<CmsEnvelope<CmsSlider[]>> {
    return this.get('/public/sliders', {
      locale: opts.locale,
      targetDevice: opts.targetDevice,
      placement: opts.placement,
      entityId: opts.entityId,
      channel: opts.channel,
    });
  }

  // ── Events ────────────────────────────────────────────────────────────────

  getEvents(opts: GetEventsOpts = {}): Promise<CmsPaginatedEnvelope<CmsEvent>> {
    return this.get('/public/events', {
      locale: opts.locale,
      category: opts.category,
      search: opts.search,
      page: opts.page,
      limit: opts.limit,
    });
  }

  getEvent(slug: string, locale?: string): Promise<CmsEnvelope<CmsEvent>> {
    return this.get(`/public/events/${encodeURIComponent(slug)}`, { locale });
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  getCampaigns(opts: GetCampaignsOpts = {}): Promise<CmsPaginatedEnvelope<CmsCampaign>> {
    return this.get('/public/campaigns', {
      locale: opts.locale,
      storeId: opts.storeId,
      search: opts.search,
      page: opts.page,
      limit: opts.limit,
    });
  }

  getCampaign(slug: string, locale?: string): Promise<CmsEnvelope<CmsCampaign>> {
    return this.get(`/public/campaigns/${encodeURIComponent(slug)}`, { locale });
  }

  // ── Stores ────────────────────────────────────────────────────────────────

  getStores(opts: GetStoresOpts = {}): Promise<CmsPaginatedEnvelope<CmsStore>> {
    return this.get('/public/stores', {
      locale: opts.locale,
      categoryId: opts.categoryId,
      search: opts.search,
      featuredOnly: opts.featuredOnly,
      page: opts.page,
      limit: opts.limit,
    });
  }

  getStore(slug: string, locale?: string): Promise<CmsEnvelope<CmsStore>> {
    return this.get(`/public/stores/${encodeURIComponent(slug)}`, { locale });
  }

  // ── Pages ─────────────────────────────────────────────────────────────────

  getPage(slug: string, locale?: string): Promise<CmsEnvelope<CmsPage>> {
    return this.get(`/public/pages/${encodeURIComponent(slug)}`, { locale });
  }

  // ── Popups ────────────────────────────────────────────────────────────────

  getPopups(opts: GetPopupsOpts = {}): Promise<CmsPaginatedEnvelope<CmsPopup>> {
    return this.get('/public/popups', {
      locale: opts.locale,
      channel: opts.channel,
      page: opts.page,
      limit: opts.limit,
    });
  }

  // ── Location Services ─────────────────────────────────────────────────────

  getServices(opts: GetServicesOpts = {}): Promise<CmsPaginatedEnvelope<CmsService>> {
    return this.get('/public/services', {
      locale: opts.locale,
      search: opts.search,
      page: opts.page,
      limit: opts.limit,
    });
  }

  getService(id: string, locale?: string): Promise<CmsEnvelope<CmsService>> {
    return this.get(`/public/services/${encodeURIComponent(id)}`, { locale });
  }

  // ── Cinema ────────────────────────────────────────────────────────────────

  getCinemas(locale?: string): Promise<CmsEnvelope<CmsCinema[]>> {
    return this.get('/public/cinema', { locale });
  }

  // ── Movie Sessions ────────────────────────────────────────────────────────

  getMovieSessions(opts: GetMovieSessionsOpts = {}): Promise<CmsEnvelope<CmsMovieSession[]>> {
    return this.get('/public/movie-sessions', {
      locale: opts.locale,
      date: opts.date,
      cinemaId: opts.cinemaId,
      movieId: opts.movieId,
      limit: opts.limit,
    });
  }

  // ── Search ────────────────────────────────────────────────────────────────

  search(opts: SearchOpts): Promise<CmsSearchPaginatedEnvelope> {
    return this.get('/public/search', {
      q: opts.q,
      locale: opts.locale,
      type: opts.type,
      page: opts.page,
      limit: opts.limit,
    });
  }

  // ── Internal fetch ────────────────────────────────────────────────────────

  private async get<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined | null> = {},
  ): Promise<T> {
    const fetchFn = this.config.fetchImpl ?? globalThis.fetch;
    if (!fetchFn) {
      throw new Error(
        'No fetch implementation available. Pass fetchImpl in CmsClientConfig for Node.js < 18.',
      );
    }

    const url = new URL(path, this.config.baseUrl);
    const locale = params.locale ?? this.config.defaultLocale;
    if (locale) url.searchParams.set('locale', String(locale));

    for (const [key, value] of Object.entries(params)) {
      if (key !== 'locale' && value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      'x-tenant-id': this.config.tenantId,
      Accept: 'application/json',
    };
    if (this.config.mallId) {
      headers['x-mall-id'] = this.config.mallId;
    }

    const response = await fetchFn(url.toString(), { headers });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = null;
      }
      const envelope = errorBody as { success: false; error: { code: string; message: string } } | null;
      const code = envelope?.error?.code ?? 'HTTP_ERROR';
      const message = envelope?.error?.message ?? `HTTP ${response.status}`;
      throw new CmsApiError(code, message, response.status);
    }

    return response.json() as Promise<T>;
  }
}

export class CmsApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'CmsApiError';
  }
}
