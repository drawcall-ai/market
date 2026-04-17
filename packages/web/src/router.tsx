import { createBrowserRouter } from 'react-router'
import { Layout } from '@/components/layout/Layout'
import { ProtectedRoute, AdminRoute } from '@/components/layout/ProtectedRoute'
import { HomePage } from '@/pages/HomePage'
import { SignInPage } from '@/pages/SignInPage'
import { AssetDetailPage } from '@/pages/AssetDetailPage'
import { UploadPage } from '@/pages/UploadPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { AdminPage } from '@/pages/AdminPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { CliAuthPage } from '@/pages/CliAuthPage'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/auth/signin', element: <SignInPage /> },
      { path: '/asset/:name/:version?', element: <AssetDetailPage /> },
      { path: '/cli-auth', element: <CliAuthPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/upload', element: <UploadPage /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
      {
        element: <AdminRoute />,
        children: [{ path: '/admin', element: <AdminPage /> }],
      },
    ],
  },
])
