import { createMiddleware } from 'hono/factory'
import { eq } from 'drizzle-orm'
import { createDb } from '@market/db/client'
import { apiKeys, users } from '@market/db/schema'
import type { Env } from '../env.js'

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const apiKeyMiddleware = createMiddleware<{
  Bindings: Env
  Variables: {
    user: { id: string; name: string; email: string; role: string } | null
    session: { id: string; token: string } | null
  }
}>(async (c, next) => {
  // Skip if already authenticated via session
  if (c.get('user')) {
    return next()
  }

  const apiKey = c.req.header('x-api-key')
  if (!apiKey) {
    return next()
  }

  const hashed = await hashKey(apiKey)
  const db = createDb(c.env.DB)

  const result = await db
    .select({
      userId: apiKeys.userId,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(eq(apiKeys.key, hashed))
    .get()

  if (result) {
    c.set('user', {
      id: result.userId,
      name: result.name,
      email: result.email,
      role: result.role,
    })
  }

  await next()
})
