import { Navigate, Outlet } from 'react-router'
import { useSession } from '@/lib/auth-client'

export function ProtectedRoute() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!session?.user) {
    return <Navigate to="/auth/signin" replace />
  }

  return <Outlet />
}

export function AdminRoute() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!session?.user || (session.user as any).role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
