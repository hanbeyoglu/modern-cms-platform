import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { PermissionGate } from './PermissionGate';
import { LoginPage } from '../pages/LoginPage';
import { SelectTenantPage } from '../pages/SelectTenantPage';
import { SelectLocationPage } from '../pages/SelectLocationPage';
import { DashboardPage } from '../pages/DashboardPage';
import { MediaPage } from '../pages/MediaPage';
import { MediaGuidelinesPage } from '../pages/MediaGuidelinesPage';
import { SlidersPage } from '../pages/SlidersPage';
import { SliderDetailPage } from '../pages/SliderDetailPage';
import { EventsPage } from '../pages/EventsPage';
import { CampaignsPage } from '../pages/CampaignsPage';
import { GlobalStoresPage } from '../pages/GlobalStoresPage';
import { MallStoresPage } from '../pages/MallStoresPage';
import { CinemasPage } from '../pages/CinemasPage';
import { MoviesPage } from '../pages/MoviesPage';
import { MovieCategoriesPage } from '../pages/MovieCategoriesPage';
import { TmdbHubPage } from '../pages/TmdbHubPage';
import { MovieSessionsPage } from '../pages/MovieSessionsPage';
import { PagesPage } from '../pages/PagesPage';
import { PageDetailPage } from '../pages/PageDetailPage';
import { LanguagesPage } from '../pages/LanguagesPage';
import { SystemLanguagesPage } from '../pages/SystemLanguagesPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { SearchPage } from '../pages/SearchPage';
import { CapabilitiesPage } from '../pages/CapabilitiesPage';
import { UsersPage } from '../pages/UsersPage';
import { UserDetailPage } from '../pages/UserDetailPage';
import { RolesPage } from '../pages/RolesPage';
import { RoleDetailPage } from '../pages/RoleDetailPage';
import { AccountPage } from '../pages/AccountPage';
import { SettingsGeneralPage } from '../pages/SettingsGeneralPage';
import { SettingsSecurityPage } from '../pages/SettingsSecurityPage';
import { SettingsMovieProvidersPage } from '../pages/SettingsMovieProvidersPage';
import { SettingsDeveloperApiPage } from '../pages/SettingsDeveloperApiPage';
import { TenantsPage } from '../pages/TenantsPage';
import { TenantDetailPage } from '../pages/TenantDetailPage';
import { LocationsPage } from '../pages/LocationsPage';
import { LocationDetailPage } from '../pages/LocationDetailPage';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import { AuditLogDetailPage } from '../pages/AuditLogDetailPage';
import { AuditFeatureGate } from './AuditFeatureGate';
import { PopupsPage } from '../pages/PopupsPage';
import { ServicesPage } from '../pages/ServicesPage';
import { StoreCategoriesPage } from '../pages/StoreCategoriesPage';
import { FloorsPage } from '../pages/FloorsPage';
import { RestaurantsPage } from '../pages/RestaurantsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <AuthLayout>
        <LoginPage />
      </AuthLayout>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/select-tenant', element: <SelectTenantPage /> },
      { path: '/select-location', element: <SelectLocationPage /> },
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },

          // Always accessible to any authenticated user
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/account', element: <AccountPage /> },

          // Analytic
          { path: '/analytics', element: <PermissionGate permission="analytics:view" capability="analytics"><AnalyticsPage /></PermissionGate> },

          // Notifications
          { path: '/notifications', element: <PermissionGate permission="notification:read" capability="notifications"><NotificationsPage /></PermissionGate> },

          // Search
          { path: '/search', element: <PermissionGate permission="search:global" capability="search"><SearchPage /></PermissionGate> },

          // Media
          { path: '/media', element: <PermissionGate permission="media:read" capability="media"><MediaPage /></PermissionGate> },
          { path: '/media/guidelines', element: <PermissionGate permission="media:read" capability="media"><MediaGuidelinesPage /></PermissionGate> },

          // Sliders
          { path: '/sliders', element: <PermissionGate permission="slider:read" capability="sliders"><SlidersPage /></PermissionGate> },
          { path: '/sliders/:id', element: <PermissionGate permission="slider:read" capability="sliders"><SliderDetailPage /></PermissionGate> },

          // Content
          { path: '/events', element: <PermissionGate permission="event:read" capability="events"><EventsPage /></PermissionGate> },
          { path: '/campaigns', element: <PermissionGate permission="campaign:read" capability="campaigns"><CampaignsPage /></PermissionGate> },
          { path: '/popups', element: <PermissionGate permission="popup:read" capability="popups"><PopupsPage /></PermissionGate> },
          { path: '/services', element: <PermissionGate permission="service:read" capability="location_services"><ServicesPage /></PermissionGate> },
          { path: '/pages', element: <PermissionGate permission="page:read" capability="pages"><PagesPage /></PermissionGate> },
          { path: '/pages/:id', element: <PermissionGate permission="page:read" capability="pages"><PageDetailPage /></PermissionGate> },

          // Languages — location activation (tenant)
          { path: '/locales', element: <Navigate to="/settings/languages" replace /> },
          { path: '/settings/localization', element: <Navigate to="/settings/languages" replace /> },
          { path: '/settings/languages', element: <PermissionGate permission="location:read" capability="localization"><LanguagesPage /></PermissionGate> },

          // System languages — super admin only
          { path: '/system/languages', element: <Navigate to="/system/localization/languages" replace /> },
          { path: '/system/localization/languages', element: <PermissionGate permission="system-language:read" superAdminOnly capability="localization"><SystemLanguagesPage /></PermissionGate> },

          // Cinema
          { path: '/cinemas', element: <PermissionGate permission="cinema:read" capability="cinema"><CinemasPage /></PermissionGate> },
          { path: '/movies', element: <PermissionGate permission="movie:read" capability="cinema"><MoviesPage /></PermissionGate> },
          { path: '/movies/:movieId/sessions', element: <PermissionGate permission="movie:read" capability="cinema"><MovieSessionsPage /></PermissionGate> },
          { path: '/movie-categories', element: <PermissionGate permission="movie:read" capability="cinema"><MovieCategoriesPage /></PermissionGate> },
          { path: '/tmdb-hub', element: <PermissionGate permission="movie:read" capability="cinema"><TmdbHubPage /></PermissionGate> },
          { path: '/movie-sessions', element: <Navigate to="/movies" replace /> },

          // Stores
          { path: '/store-categories', element: <PermissionGate permission="store-category:read" capability="stores"><StoreCategoriesPage /></PermissionGate> },
          { path: '/floors', element: <PermissionGate anyPermission={['location:read', 'mall-store:read']} capability="stores"><FloorsPage /></PermissionGate> },
          { path: '/restaurants', element: <PermissionGate permission="location:read" capability="stores"><RestaurantsPage /></PermissionGate> },
          { path: '/global-stores', element: <PermissionGate permission="global-store:read" capability="stores"><GlobalStoresPage /></PermissionGate> },
          { path: '/mall-stores', element: <PermissionGate permission="mall-store:read" capability="stores"><MallStoresPage /></PermissionGate> },

          // Platform — Super Admin only
          { path: '/capabilities', element: <PermissionGate permission="capability:read" superAdminOnly><CapabilitiesPage /></PermissionGate> },

          // Platform — Audit logs (requires AUDIT_ENABLED / VITE_AUDIT_ENABLED)
          { path: '/audit-logs', element: <AuditFeatureGate><PermissionGate permission="audit:read"><AuditLogsPage /></PermissionGate></AuditFeatureGate> },
          { path: '/audit-logs/:id', element: <AuditFeatureGate><PermissionGate permission="audit:read"><AuditLogDetailPage /></PermissionGate></AuditFeatureGate> },

          // Management — Tenants (Super Admin only)
          { path: '/tenants', element: <PermissionGate permission="tenant:read" superAdminOnly><TenantsPage /></PermissionGate> },
          { path: '/tenants/:id', element: <PermissionGate permission="tenant:read" superAdminOnly><TenantDetailPage /></PermissionGate> },

          // Management
          { path: '/locations', element: <PermissionGate permission="location:read"><LocationsPage /></PermissionGate> },
          { path: '/locations/:id', element: <PermissionGate permission="location:read"><LocationDetailPage /></PermissionGate> },
          { path: '/users', element: <PermissionGate permission="user:read"><UsersPage /></PermissionGate> },
          { path: '/users/:id', element: <PermissionGate permission="user:read"><UserDetailPage /></PermissionGate> },
          { path: '/roles', element: <PermissionGate permission="role:read"><RolesPage /></PermissionGate> },
          { path: '/roles/:id', element: <PermissionGate permission="role:read"><RoleDetailPage /></PermissionGate> },

          // Settings
          { path: '/settings/general', element: <PermissionGate permission="settings:read"><SettingsGeneralPage /></PermissionGate> },
          { path: '/settings/security', element: <PermissionGate permission="settings:read"><SettingsSecurityPage /></PermissionGate> },
          { path: '/settings/movie-providers', element: <PermissionGate permission="settings:read" capability="cinema"><SettingsMovieProvidersPage /></PermissionGate> },
          { path: '/settings/developer-api', element: <PermissionGate permission="settings:read"><SettingsDeveloperApiPage /></PermissionGate> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
