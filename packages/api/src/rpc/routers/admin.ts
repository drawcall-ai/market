import { eq, and } from 'drizzle-orm'
import { assetVersions, assets, users } from '@market/db/schema'
import { ORPCError } from '@orpc/server'
import { impl } from '../procedures.js'
import { indexAsset } from '../../services/embedding.js'

const admin = impl.admin
  .use(({ context, next }) => {
    if (!context.user) {
      throw new ORPCError('UNAUTHORIZED')
    }
    return next({ context: { user: context.user } })
  })
  .use(({ context, next }) => {
    if (context.user.role !== 'admin') {
      throw new ORPCError('FORBIDDEN')
    }
    return next({ context })
  })

export const adminRouter = {
  listUnapproved: admin.listUnapproved.handler(async ({ context }) => {
    const result = await context.db
      .select({
        versionId: assetVersions.id,
        assetId: assets.id,
        assetName: assets.name,
        assetType: assets.type,
        version: assetVersions.version,
        buildError: assetVersions.buildError,
        buildOutputKey: assetVersions.buildOutputKey,
        thumbnailKey: assetVersions.thumbnailKey,
        createdAt: assetVersions.createdAt,
        ownerName: users.name,
        ownerEmail: users.email,
      })
      .from(assetVersions)
      .innerJoin(assets, eq(assetVersions.assetId, assets.id))
      .innerJoin(users, eq(assets.ownerId, users.id))
      .where(eq(assetVersions.approved, false))
      .orderBy(assetVersions.createdAt)

    return result
  }),

  approve: admin.approve.handler(async ({ context, input }) => {
    const asset = await context.db.query.assets.findFirst({
      where: eq(assets.name, input.assetName),
    })

    if (!asset) {
      throw new Error('Asset not found')
    }

    const updated = await context.db
      .update(assetVersions)
      .set({ approved: true })
      .where(and(eq(assetVersions.assetId, asset.id), eq(assetVersions.version, input.version)))
      .returning()

    if (updated.length === 0) {
      throw new Error('Version not found')
    }

    return { success: true }
  }),

  backfillEmbeddings: admin.backfillEmbeddings.handler(async ({ context }) => {
    const allAssets = await context.db.query.assets.findMany({
      with: {
        versions: true,
        assetTags: { with: { tag: true } },
      },
    })

    let indexed = 0
    for (const asset of allAssets) {
      try {
        const tagNames = asset.assetTags.map((at) => at.tag.name)
        await indexAsset(context.env.OPENROUTER_API_KEY, context.vectorize, asset, tagNames)
        indexed++
      } catch (e) {
        console.error(`Failed to index asset ${asset.name}:`, e)
      }
    }

    return { indexed }
  }),
}
