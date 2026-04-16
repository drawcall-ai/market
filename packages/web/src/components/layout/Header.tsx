import { Link } from 'react-router'
import { useSession, signOut } from '@/lib/auth-client'

export function Header() {
  const { data: session } = useSession()

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-bold">
            drawcall.ai
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link to="/" className="text-sm text-gray-600 hover:text-gray-900">
              Browse
            </Link>
            {session?.user && (
              <>
                <Link to="/upload" className="text-sm text-gray-600 hover:text-gray-900">
                  Upload
                </Link>
                <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
              </>
            )}
            {session?.user && (session.user as any).role === 'admin' && (
              <Link to="/admin" className="text-sm text-gray-600 hover:text-gray-900">
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {session?.user ? (
            <div className="flex items-center gap-4">
              <Link to="/settings" className="text-sm text-gray-600 hover:text-gray-900">
                {session.user.name}
              </Link>
              <button
                onClick={() => signOut()}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              to="/auth/signin"
              className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
