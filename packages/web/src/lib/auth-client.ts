import { createAuthClient } from 'better-auth/react'
import { API_BASE } from './api'

export const { useSession, signIn, signUp, signOut } = createAuthClient({
  baseURL: API_BASE || window.location.origin,
  basePath: '/api/auth',
})
