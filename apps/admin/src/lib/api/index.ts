export { request, onUnauthorized } from './client';
export type { RequestOptions } from './client';

export { apiDashboardSummary } from './dashboard';
export type {
  DashboardSummary,
  DashboardTimelineItem,
  DashboardTimelineType,
  UpcomingContentItem,
} from './dashboard';

export { API_MAX_PAGE_SIZE, clampApiLimit, appendLimitParam } from './constants';

export {
  apiLogin,
  apiMe,
  apiTenants,
  apiMalls,
} from './auth';
export type {
  LoginResponse,
  MeMallSummary,
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
  apiMediaGet,
  apiMediaUpdate,
  apiMediaMove,
  apiMediaDelete,
  apiMediaUsages,
  apiFoldersList,
  apiFolderCreate,
  apiFolderUpdate,
  apiFolderDelete,
} from './media';
export {
  apiMediaGuidelinesList,
  apiMediaGuidelineUpdate,
} from './media-guidelines';
export type { MediaGuideline, UpdateMediaGuidelinePayload } from './media-guidelines';
export type {
  MediaAsset,
  MediaAssetStatus,
  MediaFolder,
  MediaUsage,
  MediaListResponse,
  FolderListResponse,
  UpdateMediaPayload,
} from './media';

export {
  apiSlidersList,
  apiSliderGet,
  apiSliderCreate,
  apiSliderUpdate,
  apiSliderDelete,
  apiSliderPublish,
  apiSliderArchive,
  apiSliderReorder,
  apiSliderItemsList,
  apiSliderItemCreate,
  apiSliderItemUpdate,
  apiSliderItemDelete,
  apiSliderItemsReorder,
} from './sliders';
export type {
  SliderStatus,
  SliderPlacementType,
  SliderLinkedEntityType,
  SliderChannel,
  SliderMediaPreview,
  Slider,
  SliderItem,
  SliderItemTranslation,
  SliderItemTranslationPayload,
  SliderListResponse,
  CreateSliderPayload,
  UpdateSliderPayload,
  CreateSliderItemPayload,
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
export type { ContentChannel } from '../content-channels';
export {
  CONTENT_CHANNELS,
  CONTENT_CHANNEL_LABELS,
  DEFAULT_CONTENT_CHANNELS,
  formatChannels,
} from '../content-channels';

export type {
  ContentStatus,
  EventMediaPreview,
  CmsEvent,
  EventListResponse,
  CreateEventPayload,
  EventPublishResponse,
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
  apiStoreCategoryGet,
  apiStoreCategoryCreate,
  apiStoreCategoryUpdate,
  apiStoreCategoriesReorder,
  apiStoreCategoryDelete,
  buildStoreCategoryTreeOptions,
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
  apiMallFloorsList,
  apiMallFloorCreate,
  apiMallFloorUpdate,
  apiMallFloorsReorder,
  apiMallFloorDelete,
} from './stores';
export type {
  StoreCategory,
  StoreCategoryMediaPreview,
  GlobalStoreMediaPreview,
  GlobalStore,
  GlobalStoreListResponse,
  StoreStatus,
  MallFloor,
  MallStore,
  MallStoreListResponse,
  StoreSocialLink,
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

export { apiMoviesList, apiMovieGet, apiMovieCreate, apiMovieUpdate, apiMovieDelete, apiMovieCategoriesList, tmdbPosterUrl } from './movies';
export type { MovieStatus, CmsMovie, MovieCategory, MovieListResponse, CreateMoviePayload } from './movies';

export {
  apiMovieSessionsList,
  apiMovieSessionGet,
  apiMovieSessionCreate,
  apiMovieSessionUpdate,
  apiMovieSessionDelete,
  apiMovieSessionCancel,
  apiMovieSessionsForMovieList,
  apiMovieSessionForMovieCreate,
  apiMovieSessionForMovieUpdate,
  apiMovieSessionForMovieDelete,
} from './movie-sessions';
export type {
  MovieSessionStatus,
  MovieSessionRow,
  MovieSessionListResponse,
  CreateMovieSessionPayload,
  CreateMovieSessionForMoviePayload,
} from './movie-sessions';

export {
  apiScreeningHallsList,
  apiScreeningHallCreate,
  apiScreeningHallDelete,
} from './screening-halls';
export type { ScreeningHall, ScreeningHallListResponse } from './screening-halls';

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
  apiSystemLocalesList,
  apiSystemLocaleCreate,
  apiSystemLocaleUpdate,
  apiSystemLocaleDeactivate,
  apiSystemLocaleSetDefault,
  apiSystemLocalesReorder,
} from './system-locales';
export type { CmsLocale, CreateLocalePayload, UpdateLocalePayload } from './system-locales';

/** @deprecated Use system-locales API — kept for backward compatibility */
export {
  apiLocalesList,
  apiLocaleCreate,
  apiLocaleUpdate,
  apiLocaleDeactivate,
  apiLocaleSetDefault,
  apiLocalesReorder,
} from './locales';

export {
  apiTranslationsList,
  apiTranslationUpsert,
  apiTranslationDelete,
} from './translations';
export type {
  LocalizedEntityType,
  LocalizedContentRow,
  ListTranslationsParams,
  UpsertTranslationPayload,
} from './translations';

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

export {
  apiNotificationsList,
  apiNotificationsUnreadCount,
  apiNotificationMarkRead,
  apiNotificationsMarkAllRead,
  apiNotificationDelete,
  notificationEntityHref,
} from './notifications';
export type {
  CmsNotification,
  NotificationListResponse,
  ListNotificationsParams,
  NotificationSeverity,
  NotificationType,
} from './notifications';

export { apiGlobalSearch } from './search';
export type {
  GlobalSearchHit,
  GlobalSearchParams,
  GlobalSearchResponse,
  SearchIndexEntityType,
} from './search';

export {
  apiCapabilitiesList,
  apiTenantCapabilitiesList,
  apiTenantCapabilitiesUpdate,
} from './capabilities';
export type {
  CapabilityCategory,
  Capability,
  TenantCapabilityRow,
  CapabilityListResponse,
  TenantCapabilityListResponse,
} from './capabilities';

export {
  apiUsersList,
  apiUserGet,
  apiUserCreate,
  apiUserUpdate,
  apiUserUpdateStatus,
  apiUserAddMembership,
  apiUserUpdateMembership,
  apiUserRemoveMembership,
  apiUserResetPassword,
} from './users';
export type {
  UserStatus,
  UserMembership,
  CmsUser,
  UserListResponse,
  CreateUserPayload,
  CreateMembershipPayload,
  UpdateMembershipPayload,
} from './users';

export {
  apiRolesList,
  apiRoleGet,
  apiRoleCreate,
  apiRoleUpdate,
  apiRoleUpdatePermissions,
  apiRoleClone,
  apiRoleDelete,
  apiPermissionsList,
} from './roles';
export type {
  RolePermission,
  CmsRole,
  RoleListResponse,
  PermissionGroup,
  PermissionsResponse,
} from './roles';

export {
  apiSettingsGet,
  apiSettingsUpdateGeneral,
  apiSettingsUpdateSecurity,
} from './settings';
export type {
  GeneralSettings,
  SecuritySettings,
  TenantSettings,
} from './settings';

export { apiUpdateProfile, apiChangePassword } from './account';

export {
  apiTenantsList,
  apiTenantGet,
  apiTenantCreate,
  apiTenantUpdate,
  apiTenantUpdateStatus,
  apiTenantDeletePreview,
  apiTenantDelete,
} from './tenants';
export type {
  TenantStatus,
  TenantDeleteMode,
  TenantDeletePreview,
  TenantDeletePreviewCounts,
  TenantDeleteResult,
  CmsTenant,
  TenantListResponse,
  CreateTenantPayload,
  UpdateTenantPayload,
} from './tenants';

export {
  apiLocationsList,
  apiLocationGet,
  apiLocationCreate,
  apiLocationUpdate,
  apiLocationUpdateStatus,
  apiLocationDelete,
  LOCATION_TYPE_LABELS,
} from './locations';
export type {
  LocationType,
  LocationStatus,
  CmsLocation,
  LocationListResponse,
  CreateLocationPayload,
  UpdateLocationPayload,
} from './locations';

export {
  apiLocationLocalesList,
  apiLocationActiveLocales,
  apiLocationLocalesUpdate,
  apiContentLocales,
} from './location-locales';
export type { LocationLocaleRow } from './location-locales';

export {
  apiAuditLogsList,
  apiAuditLogGet,
  apiAuditLogsTimeline,
  apiAuditLogsRecentActivity,
  apiAuditLogsSecurityEvents,
  apiAuditLogsExportUrl,
} from './audit-logs';
export type {
  AuditSeverity,
  AuditActor,
  AuditTenant,
  AuditMall,
  AuditLog,
  AuditLogListResponse,
  AuditLogFilters,
} from './audit-logs';

export {
  apiPopupsList,
  apiPopupGet,
  apiPopupCreate,
  apiPopupUpdate,
  apiPopupDelete,
  apiPopupPublish,
  apiPopupArchive,
} from './popups';
export type {
  PopupStatus,
  CmsPopup,
  PopupListResponse,
  CreatePopupPayload,
} from './popups';

export {
  apiServicesList,
  apiServiceGet,
  apiServiceCreate,
  apiServiceUpdate,
  apiServiceDelete,
} from './services';
export type {
  ServiceStatus,
  CmsService,
  ServiceListResponse,
  CreateServicePayload,
} from './services';
