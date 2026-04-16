import { sqliteTable, text, integer, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { users } from './auth.js'

export const assets = sqliteTable('assets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  type: text('type').notNull(), // generic | model | hdri | material
  description: text('description'),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const assetVersions = sqliteTable(
  'asset_versions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    assetId: integer('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    version: text('version').notNull(),
    approved: integer('approved', { mode: 'boolean' }).notNull().default(false),
    npmDependencies: text('npm_dependencies').notNull().default('{}'), // JSON string
    assetDependencies: text('asset_dependencies').notNull().default('{}'), // JSON string
    sourceKey: text('source_key').notNull(), // R2 object key
    buildOutputKey: text('build_output_key'),
    thumbnailKey: text('thumbnail_key'),
    buildError: text('build_error'),
    readme: text('readme'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex('asset_version_unique').on(table.assetId, table.version)],
)

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
})

export const assetTags = sqliteTable(
  'asset_tags',
  {
    assetId: integer('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.assetId, table.tagId] })],
)

// Relations

export const assetsRelations = relations(assets, ({ one, many }) => ({
  owner: one(users, { fields: [assets.ownerId], references: [users.id] }),
  versions: many(assetVersions),
  assetTags: many(assetTags),
}))

export const assetVersionsRelations = relations(assetVersions, ({ one }) => ({
  asset: one(assets, { fields: [assetVersions.assetId], references: [assets.id] }),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  assetTags: many(assetTags),
}))

export const assetTagsRelations = relations(assetTags, ({ one }) => ({
  asset: one(assets, { fields: [assetTags.assetId], references: [assets.id] }),
  tag: one(tags, { fields: [assetTags.tagId], references: [tags.id] }),
}))
