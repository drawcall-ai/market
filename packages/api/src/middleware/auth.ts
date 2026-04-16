import { createMiddleware } from 'hono/factory'
import { createAuth } from '../auth.js'
import type { Env } from '../env.js'

type AuthUser = {
  id: string
  name: string
  email: string
  role: string
}

type AuthVariables = {
  user: AuthUser | null
  session: { id: string; token: string } | null
}

export const authMiddleware = createMiddleware<{
  Bindings: Env
  Variables: AuthVariables
}>(async (c, next) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  c.set('user', (session?.user as AuthUser | null) ?? null)
  c.set('session', session?.session ?? null)
  await next()
})

export const requireAuth = createMiddleware<{
  Bindings: Env
  Variables: AuthVariables
}>(async (c, next) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

export const requireAdmin = createMiddleware<{
  Bindings: Env
  Variables: AuthVariables
}>(async (c, next) => {
  const user = c.get('user')
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})
