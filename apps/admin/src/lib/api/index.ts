export { request, onUnauthorized } from './client';
export type { RequestOptions } from './client';

export {
  apiLogin,
  apiMe,
  apiTenants,
  apiMalls,
} from './auth';
export type {
  LoginResponse,
  MeMembership,
  MeResponse,
  Tenant,
  TenantsResponse,
  Mall,
  MallsResponse,
} from './auth';

export {
  apiMediaUpload,
  apiMediaList,
  apiMediaDelete,
  apiFoldersList,
  apiFolderCreate,
} from './media';
export type { MediaAsset, MediaFolder, MediaListResponse, FolderListResponse } from './media';

export {
  apiSlidersList,
  apiSliderGet,
  apiSliderCreate,
  apiSliderUpdate,
  apiSliderDelete,
  apiSliderPublish,
  apiSliderArchive,
  apiSliderReorder,
} from './sliders';
export type {
  SliderStatus,
  SliderTargetDevice,
  SliderLinkType,
  SliderMediaPreview,
  Slider,
  SliderListResponse,
  CreateSliderPayload,
  ReorderItem,
} from './sliders';

export {
  apiEventsList,
  apiEventGet,
  apiEventCreate,
  apiEventUpdate,
  apiEventDelete,
  apiEventPublish,
  apiEventArchive,
} from './events';
export type {
  ContentStatus,
  EventMediaPreview,
  CmsEvent,
  EventListResponse,
  CreateEventPayload,
} from './events';

export {
  apiCampaignsList,
  apiCampaignGet,
  apiCampaignCreate,
  apiCampaignUpdate,
  apiCampaignDelete,
  apiCampaignPublish,
  apiCampaignArchive,
} from './campaigns';
export type {
  MallStoreSummary,
  CmsCampaign,
  CampaignListResponse,
  CreateCampaignPayload,
} from './campaigns';

export {
  apiStoreCategoriesList,
  apiStoreCategoryCreate,
  apiStoreCategoryUpdate,
  apiStoreCategoryDelete,
  apiGlobalStoresList,
  apiGlobalStoreGet,
  apiGlobalStoreCreate,
  apiGlobalStoreUpdate,
  apiGlobalStoreDelete,
  apiMallStoresList,
  apiMallStoreGet,
  apiMallStoreAssign,
  apiMallStoreUpdate,
  apiMallStoreDelete,
  apiMallStoreFeature,
  apiMallStoreUnfeature,
} from './stores';
export type {
  StoreCategoryStatus,
  StoreCategory,
  StoreCategoryListResponse,
  GlobalStoreCategoryPreview,
  GlobalStoreMediaPreview,
  GlobalStore,
  GlobalStoreListResponse,
  StoreStatus,
  MallStore,
  MallStoreListResponse,
} from './stores';

export {
  apiCinemasList,
  apiCinemaGet,
  apiCinemaCreate,
  apiCinemaUpdate,
  apiCinemaDelete,
} from './cinemas';
export type {
  CinemaStatus,
  CinemaProviderType,
  CmsCinema,
  CinemaListResponse,
  CreateCinemaPayload,
} from './cinemas';

export { apiMoviesList, apiMovieGet, apiMovieCreate, apiMovieUpdate, apiMovieDelete } from './movies';
export type { MovieStatus, CmsMovie, MovieListResponse, CreateMoviePayload } from './movies';

export {
  apiMovieSessionsList,
  apiMovieSessionGet,
  apiMovieSessionCreate,
  apiMovieSessionUpdate,
  apiMovieSessionDelete,
  apiMovieSessionCancel,
} from './movie-sessions';
export type {
  MovieSessionStatus,
  MovieSessionRow,
  MovieSessionListResponse,
  CreateMovieSessionPayload,
} from './movie-sessions';

export {
  apiPagesList,
  apiPageGet,
  apiPageCreate,
  apiPageUpdate,
  apiPageDelete,
  apiPagePublish,
  apiPageArchive,
  apiPageBlocksList,
  apiPageBlockCreate,
  apiPageBlockUpdate,
  apiPageBlockDelete,
  apiPageBlocksReorder,
} from './pages';
export type {
  PageStatus,
  PageType,
  PageBlockStatus,
  CmsPage,
  CmsPageBlock,
  PageListResponse,
  CreatePagePayload,
  CreatePageBlockPayload,
  ReorderBlocksPayload,
} from './pages';

export {
  apiAnalyticsSummary,
  apiAnalyticsTopContent,
  apiAnalyticsTimeseries,
} from './analytics';
export type {
  AnalyticsSummary,
  AnalyticsTopRow,
  AnalyticsTimeseriesRow,
  AnalyticsQueryParams,
} from './analytics';
