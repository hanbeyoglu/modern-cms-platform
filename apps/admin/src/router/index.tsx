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
          { path: '/locales', element: <LocalesPage /> },
          { path: '/cinemas', element: <CinemasPage /> },
          { path: '/movies', element: <MoviesPage /> },
          { path: '/movie-sessions', element: <MovieSessionsPage /> },
          { path: '/store-categories', element: <StoreCategoriesPage /> },
          { path: '/global-stores', element: <GlobalStoresPage /> },
          { path: '/mall-stores', element: <MallStoresPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
