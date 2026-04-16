import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { RPCHandler } from '@orpc/server/fetch'
import { createDb } from '@market/db/client'
import type { Env } from './env.js'
import { createAuth } from './auth.js'
import { authMiddleware } from './middleware/auth.js'
import { apiKeyMiddleware } from './middleware/api-key.js'
import { router, internalRouter } from './rpc/router.js'
import { build } from './routes/build.js'
import type { Context } from './rpc/context.js'

const app = new Hono<{ Bindings: Env }>()

// CORS
app.use(
  '*',
  cors({
    origin: (origin) => origin,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  }),
)

// Auth middleware (session + API key)
app.use('/api/*', authMiddleware)
app.use('/api/*', apiKeyMiddleware)

// Better Auth handler
app.on(['POST', 'GET'], '/api/auth/**', async (c) => {
  try {
    const auth = createAuth(c.env)
    return await auth.handler(c.req.raw)
  } catch (e) {
    console.error('Auth error:', e)
    return c.json({ error: 'Internal auth error' }, 500)
  }
})

// oRPC handler (public API)
app.all('/api/rpc/*', async (c) => {
  const db = createDb(c.env.DB)
  const user = c.get('user' as never) as Context['user']

  const context: Context = {
    db,
    r2: c.env.R2,
    vectorize: c.env.VECTORIZE,
    env: c.env,
    user,
  }

  const handler = new RPCHandler(router)
  const { matched, response } = await handler.handle(c.req.raw, {
    prefix: '/api/rpc',
    context,
  })

  if (matched) {
    return response
  }

  return c.json({ error: 'Not found' }, 404)
})

// oRPC handler (internal API for build-service)
app.all('/api/internal-rpc/*', async (c) => {
  const db = createDb(c.env.DB)

  const context: Context = {
    db,
    r2: c.env.R2,
    vectorize: c.env.VECTORIZE,
    env: c.env,
    user: null,
  }

  const handler = new RPCHandler(internalRouter)
  const { matched, response } = await handler.handle(c.req.raw, {
    prefix: '/api/internal-rpc',
    context,
  })

  if (matched) {
    return response
  }

  return c.json({ error: 'Not found' }, 404)
})

// Build output serving (stays as HTTP for iframe embedding)
app.route('/api', build)

export default app
