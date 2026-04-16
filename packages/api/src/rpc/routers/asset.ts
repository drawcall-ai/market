import { eq, and, not, like, desc, asc, sql, inArray } from 'drizzle-orm'
import { assets, assetVersions } from '@market/db/schema'
import type { AssetType } from '@drawcall/market'
import { impl } from '../procedures.js'
import { resolveAsset } from '../../lib/resolve-asset.js'
import { applyTemplate } from '../../templates/index.js'
import { embedQuery } from '../../services/embedding.js'
import { getFromR2 } from '../../lib/storage.js'

export const assetRouter = {
  getByName: impl.asset.getByName.handler(async ({ context, input }) => {
    const asset = await context.db.query.assets.findFirst({
      where: eq(assets.name, input.name),
      with: {
        versions: true,
        assetTags: {
          with: { tag: true },
        },
      },
    })

    if (!asset) return null

    return {
      ...asset,
      tags: asset.assetTags.map((at) => at.tag.name),
    }
  }),

  list: impl.asset.list.handler(async ({ context, input }) => {
    const { page, limit, type, search, sort } = input
    const offset = (page - 1) * limit

    // Vector search path: when search is provided, use embeddings
    if (search) {
      const queryVector = await embedQuery(context.env.OPENROUTER_API_KEY, search)

      const vectorResults = await context.vectorize.query(queryVector, {
        topK: page * limit,
        filter: type ? { type } : undefined,
      })

      const matchedIds = vectorResults.matches
        .slice(offset, offset + limit)
        .map((m) => Number(m.id))

      if (matchedIds.length === 0) {
        return { items: [], total: 0, page, limit, totalPages: 0 }
      }

      const results = await context.db
        .select({
          id: assets.id,
          name: assets.name,
          type: assets.type,
          description: assets.description,
          ownerId: assets.ownerId,
          createdAt: assets.createdAt,
          updatedAt: assets.updatedAt,
          latestVersion: sql<string>`(
            SELECT ${assetVersions.version} FROM ${assetVersions}
            WHERE ${assetVersions.assetId} = ${assets.id}
            ORDER BY ${assetVersions.approved} DESC, ${assetVersions.createdAt} DESC
            LIMIT 1
          )`.as('latest_version'),
          thumbnailKey: sql<string | null>`(
            SELECT ${assetVersions.thumbnailKey} FROM ${assetVersions}
            WHERE ${assetVersions.assetId} = ${assets.id}
            ORDER BY ${assetVersions.approved} DESC, ${assetVersions.createdAt} DESC
            LIMIT 1
          )`.as('thumbnail_key'),
          approved: sql<boolean>`(
            EXISTS (
              SELECT 1 FROM ${assetVersions}
              WHERE ${assetVersions.assetId} = ${assets.id}
                AND ${assetVersions.approved} = 1
            )
          )`.as('approved'),
        })
        .from(assets)
        .where(and(inArray(assets.id, matchedIds), not(like(assets.name, '%-example'))))

      // Preserve Vectorize ranking order
      const resultMap = new Map(results.map((r) => [r.id, r]))
      const ordered = matchedIds.map((id) => resultMap.get(id)).filter((r): r is NonNullable<typeof r> => !!r)

      return {
        items: ordered,
        total: vectorResults.matches.length,
        page,
        limit,
        totalPages: Math.ceil(vectorResults.matches.length / limit),
      }
    }

    // Standard D1 query path: no search term
    const conditions = [not(like(assets.name, '%-example'))]

    if (type) {
      conditions.push(eq(assets.type, type))
    }

    const query = context.db
      .select({
        id: assets.id,
        name: assets.name,
        type: assets.type,
        description: assets.description,
        ownerId: assets.ownerId,
        createdAt: assets.createdAt,
        updatedAt: assets.updatedAt,
        latestVersion: sql<string>`(
          SELECT ${assetVersions.version} FROM ${assetVersions}
          WHERE ${assetVersions.assetId} = ${assets.id}
          ORDER BY ${assetVersions.approved} DESC, ${assetVersions.createdAt} DESC
          LIMIT 1
        )`.as('latest_version'),
        thumbnailKey: sql<string | null>`(
          SELECT ${assetVersions.thumbnailKey} FROM ${assetVersions}
          WHERE ${assetVersions.assetId} = ${assets.id}
          ORDER BY ${assetVersions.approved} DESC, ${assetVersions.createdAt} DESC
          LIMIT 1
        )`.as('thumbnail_key'),
        approved: sql<boolean>`(
          EXISTS (
            SELECT 1 FROM ${assetVersions}
            WHERE ${assetVersions.assetId} = ${assets.id}
              AND ${assetVersions.approved} = 1
          )
        )`.as('approved'),
      })
      .from(assets)
      .where(and(...conditions))
      .orderBy(sort === 'alphabetical' ? asc(assets.name) : desc(assets.createdAt))
      .limit(limit)
      .offset(offset)

    const results = await query

    const countResult = await context.db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(and(...conditions))

    const total = countResult[0]?.count ?? 0

    return {
      items: results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }),

  getVersionTree: impl.asset.getVersionTree.handler(async ({ context, input }) => {
    const resolved = await resolveAsset(context.db, input.name, input.version)
    if (!resolved) throw new Error('Asset not found')

    const { asset, ver, isExample } = resolved

    const tree = await applyTemplate(
      asset.type as AssetType,
      input.name,
      ver,
      context.r2,
      isExample ? asset.type : undefined,
    )

    return tree.map((entry) => ({
      path: entry.path,
      size: entry.content?.length ?? 0,
    }))
  }),

  getRawFile: impl.asset.getRawFile.handler(async ({ context, input }) => {
    const resolved = await resolveAsset(context.db, input.name, input.version)
    if (!resolved) throw new Error('Asset not found')

    const { asset, ver, isExample } = resolved

    const tree = await applyTemplate(
      asset.type as AssetType,
      input.name,
      ver,
      context.r2,
      isExample ? asset.type : undefined,
    )

    const entry = tree.find((e) => e.path === input.path)
    if (!entry) throw new Error('File not found')

    if (entry.content !== undefined) {
      return new Blob([entry.content])
    }

    if (entry.r2Key) {
      const obj = await getFromR2(context.r2, entry.r2Key)
      if (!obj) throw new Error('File not found in storage')
      const arrayBuffer = await obj.arrayBuffer()
      return new Blob([arrayBuffer])
    }

    throw new Error('File not found')
  }),
}
