import { eq } from 'drizzle-orm'
import { users, apiKeys, assets } from '@market/db/schema'
import { ORPCError } from '@orpc/server'
import { nanoid } from 'nanoid'
import { impl } from '../procedures.js'

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

const authed = impl.user.use(({ context, next }) => {
  if (!context.user) {
    throw new ORPCError('UNAUTHORIZED')
  }
  return next({ context: { user: context.user } })
})

export const userRouter = {
  getProfile: authed.getProfile.handler(async ({ context }) => {
    const user = await context.db.query.users.findFirst({
      where: eq(users.id, context.user.id),
    })
    return user ?? null
  }),

  updateProfile: authed.updateProfile.handler(async ({ context, input }) => {
    const updated = await context.db
      .update(users)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.image !== undefined && { image: input.image }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, context.user.id))
      .returning()

    return updated[0]
  }),

  getApiKey: authed.getApiKey.handler(async ({ context }) => {
    const key = await context.db.query.apiKeys.findFirst({
      where: eq(apiKeys.userId, context.user.id),
    })
    return key ? { prefix: key.prefix, createdAt: key.createdAt } : null
  }),

  regenerateApiKey: authed.regenerateApiKey.handler(async ({ context }) => {
    const rawKey = `mk_${nanoid(32)}`
    const hashed = await hashKey(rawKey)
    const prefix = rawKey.slice(0, 11) // "mk_" + first 8 chars

    // Delete existing key
    await context.db.delete(apiKeys).where(eq(apiKeys.userId, context.user.id))

    // Create new key
    await context.db.insert(apiKeys).values({
      id: nanoid(),
      userId: context.user.id,
      key: hashed,
      prefix,
    })

    // Return the full key once — it won't be retrievable again
    return { key: rawKey, prefix }
  }),

  myAssets: authed.myAssets.handler(async ({ context }) => {
    const result = await context.db.query.assets.findMany({
      where: eq(assets.ownerId, context.user.id),
      with: {
        versions: true,
      },
      orderBy: (assets, { desc }) => [desc(assets.createdAt)],
    })

    return result
  }),
}
