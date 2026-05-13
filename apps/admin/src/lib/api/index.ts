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
