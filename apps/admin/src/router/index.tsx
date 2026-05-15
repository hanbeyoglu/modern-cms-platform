import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { MediaPage } from '../pages/MediaPage';
import { SlidersPage } from '../pages/SlidersPage';
import { EventsPage } from '../pages/EventsPage';
import { CampaignsPage } from '../pages/CampaignsPage';
import { StoreCategoriesPage } from '../pages/StoreCategoriesPage';
import { GlobalStoresPage } from '../pages/GlobalStoresPage';
import { MallStoresPage } from '../pages/MallStoresPage';
import { CinemasPage } from '../pages/CinemasPage';
import { MoviesPage } from '../pages/MoviesPage';
import { MovieSessionsPage } from '../pages/MovieSessionsPage';
import { PagesPage } from '../pages/PagesPage';
import { PageDetailPage } from '../pages/PageDetailPage';
import { LocalesPage } from '../pages/LocalesPage';
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
import { TenantsPage } from '../pages/TenantsPage';
import { TenantDetailPage } from '../pages/TenantDetailPage';
import { LocationsPage } from '../pages/LocationsPage';
import { LocationDetailPage } from '../pages/LocationDetailPage';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import { AuditLogDetailPage } from '../pages/AuditLogDetailPage';

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
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/analytics', element: <AnalyticsPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/media', element: <MediaPage /> },
          { path: '/sliders', element: <SlidersPage /> },
          { path: '/events', element: <EventsPage /> },
          { path: '/campaigns', element: <CampaignsPage /> },
          { path: '/pages', element: <PagesPage /> },
          { path: '/pages/:id', element: <PageDetailPage /> },
          { path: '/locales', element: <Navigate to="/settings/localization" replace /> },
          { path: '/settings/localization', element: <LocalesPage /> },
          { path: '/cinemas', element: <CinemasPage /> },
          { path: '/movies', element: <MoviesPage /> },
          { path: '/movie-sessions', element: <MovieSessionsPage /> },
          { path: '/store-categories', element: <StoreCategoriesPage /> },
          { path: '/global-stores', element: <GlobalStoresPage /> },
          { path: '/mall-stores', element: <MallStoresPage /> },
          { path: '/capabilities', element: <CapabilitiesPage /> },
          { path: '/users', element: <UsersPage /> },
          { path: '/users/:id', element: <UserDetailPage /> },
          { path: '/roles', element: <RolesPage /> },
          { path: '/roles/:id', element: <RoleDetailPage /> },
          { path: '/settings/general', element: <SettingsGeneralPage /> },
          { path: '/settings/security', element: <SettingsSecurityPage /> },
          { path: '/account', element: <AccountPage /> },
          { path: '/tenants', element: <TenantsPage /> },
          { path: '/tenants/:id', element: <TenantDetailPage /> },
          { path: '/locations', element: <LocationsPage /> },
          { path: '/locations/:id', element: <LocationDetailPage /> },
          { path: '/audit-logs', element: <AuditLogsPage /> },
          { path: '/audit-logs/:id', element: <AuditLogDetailPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
