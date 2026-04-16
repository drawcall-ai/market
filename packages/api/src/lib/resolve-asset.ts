import { eq, and } from 'drizzle-orm'
import { assets, assetVersions } from '@market/db/schema'
import type { Database } from '@market/db/client'

/**
 * Resolve an asset by name. If the name ends with `-example`, resolve
 * the parent asset instead and return metadata indicating this is a virtual example.
 */
export async function resolveAsset(db: Database, name: string, version: string) {
  const isExample = name.endsWith('-example')
  const realName = isExample ? name.replace(/-example$/, '') : name

  const asset = await db.query.assets.findFirst({
    where: eq(assets.name, realName),
  })
  if (!asset) return null

  const ver = await db.query.assetVersions.findFirst({
    where: and(eq(assetVersions.assetId, asset.id), eq(assetVersions.version, version)),
  })
  if (!ver) return null

  return { asset, ver, isExample }
}
