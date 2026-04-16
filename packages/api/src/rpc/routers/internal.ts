import { eq, and } from 'drizzle-orm'
import { assets, assetVersions } from '@market/db/schema'
import { internalImpl } from '../procedures.js'

export const internalRouter = {
  buildUpload: internalImpl.buildUpload.handler(async ({ context, input }) => {
    const data = Uint8Array.from(atob(input.content), (c) => c.charCodeAt(0))
    await context.r2.put(input.key, data, {
      httpMetadata: { contentType: input.contentType },
    })
    return { ok: true }
  }),

  buildComplete: internalImpl.buildComplete.handler(async ({ context, input }) => {
    const asset = await context.db.query.assets.findFirst({
      where: eq(assets.name, input.assetName),
    })
    if (!asset) throw new Error('Asset not found')

    await context.db
      .update(assetVersions)
      .set({ buildOutputKey: input.buildOutputKey })
      .where(and(eq(assetVersions.assetId, asset.id), eq(assetVersions.version, input.version)))

    return { ok: true }
  }),
}
