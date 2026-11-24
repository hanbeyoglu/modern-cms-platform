export type ImportMode = 'dry-run' | 'apply';

export type RowResultStatus = 'created' | 'updated' | 'skipped' | 'error' | 'would-create' | 'would-update';

export type SourceStore = {
  id: string;
  slug: string;
  name: string;
  cover_image?: string;
  images?: string[];
  category?: string;
  floor?: string;
  description?: string;
  working_hours?: string;
  phone?: string;
  website?: string;
  social_links?: Record<string, string>;
  is_featured?: boolean;
  is_active?: boolean;
  meta?: { title?: string; description?: string };
};

export type SourceCampaign = {
  id: string;
  slug: string;
  title: string;
  image?: string;
  hero_image?: string;
  short_description?: string;
  description?: string;
  terms?: string;
  discount_label?: string;
  store?: { id?: string; slug?: string; name?: string; category?: string };
  category?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  is_active?: boolean;
  is_featured?: boolean;
  meta?: { title?: string; description?: string };
};

export type SourceEvent = {
  id: string;
  slug: string;
  title: string;
  image?: string;
  hero_image?: string;
  gallery?: string[];
  short_description?: string;
  description?: string;
  date?: string;
  time?: string;
  end_date?: string;
  end_time?: string;
  location?: string;
  organizer?: string;
  is_free?: boolean;
  ticket_price?: string;
  category?: string;
  is_featured?: boolean;
  tags?: string[];
};

export type SourceMovie = {
  id: string;
  slug: string;
  title: string;
  poster?: string;
  cover_image?: string;
  gallery?: string[];
  synopsis?: string;
  genre?: string[];
  director?: string;
  cast?: string[];
  language?: string;
  subtitle?: string;
  rating?: string;
  duration?: number;
  release_date?: string;
  status?: string;
  is_current?: boolean;
  is_featured?: boolean;
  daily_times?: string[];
  ticket_url?: string;
};

export type SourceSlider = {
  id: string;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  image?: string;
  cta_label?: string;
  cta_url?: string;
  order?: number;
  is_active?: boolean;
};

export type MetrogardenExport = {
  sourceSystem: string;
  exportedAt: string;
  webRoot?: string;
  stores: SourceStore[];
  campaigns: SourceCampaign[];
  events: SourceEvent[];
  movies: SourceMovie[];
  sliders: SourceSlider[];
  mediaIndex?: Array<{ url: string; urlHash: string }>;
  counts?: Record<string, number>;
};

export type CliOptions = {
  input: string;
  tenantId: string;
  mallId: string;
  mode: ImportMode;
  actorUserId?: string;
  siteBaseUrl: string;
  reportPath?: string;
  batchId?: string;
  /** Display name of the target mall — used to replace Metrogarden branding. */
  targetMallName?: string;
  /** When true, shift campaign/event/movie dates relative to import day. */
  shiftDates?: boolean;
};

export type RowResult = {
  entityType: string;
  sourceKey: string;
  status: RowResultStatus;
  entityId?: string;
  message?: string;
  unsupportedFields?: string[];
};

export type ImportReport = {
  mode: ImportMode;
  tenantId: string;
  mallId: string;
  targetMallName: string;
  shiftDates: boolean;
  dateShiftDays: number;
  startedAt: string;
  finishedAt?: string;
  counts: {
    stores: number;
    campaigns: number;
    events: number;
    movies: number;
    sliders: number;
    uniqueMediaUrls: number;
  };
  media: {
    uniqueUrls: number;
    wouldUpload: number;
    reused: number;
    uploaded: number;
    failed: number;
  };
  expiredAsDraft: Array<{ entityType: string; sourceKey: string; endDate: string }>;
  unmatchedStoreRefs: Array<{ entityType: string; sourceKey: string; storeRef: string }>;
  unsupportedFields: Array<{ entityType: string; sourceKey: string; fields: string[] }>;
  textReplacements: Array<{
    entityType: string;
    sourceKey: string;
    field: string;
    before: string;
    after: string;
  }>;
  publicVisibility: {
    campaigns: number;
    events: number;
    movies: number;
    sliders: number;
  };
  rows: RowResult[];
  errors: string[];
};
