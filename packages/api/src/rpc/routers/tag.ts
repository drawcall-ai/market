import { sql, eq } from 'drizzle-orm'
import { tags, assetTags } from '@market/db/schema'
import { impl } from '../procedures.js'

export const tagRouter = {
  list: impl.tag.list.handler(async ({ context }) => {
    const result = await context.db
      .select({
        id: tags.id,
        name: tags.name,
        count: sql<number>`count(${assetTags.assetId})`.as('count'),
      })
      .from(tags)
      .leftJoin(assetTags, eq(tags.id, assetTags.tagId))
      .groupBy(tags.id)
      .orderBy(tags.name)

    return result
  }),
}
