import { eq } from 'drizzle-orm'
import { assets, assetVersions, tags, assetTags } from '@market/db/schema'
import type { Database } from '@market/db/client'
import { uploadToR2, sourceKey } from '../lib/storage.js'
import { indexAsset } from './embedding.js'
import type { Env } from '../env.js'

const V43_DEPENDENCIES: Record<string, string> = {
  '@v43/core': '^0.1.10',
  '@v43/plugin': '^0.1.10',
  three: '^0.183.0',
  elics: '^3.0.0',
}

interface UploadGenericInput {
  name: string
  version: string
  description?: string
  npmDependencies: Record<string, string>
  assetDependencies: Record<string, string>
  tags: string[]
  file: File
}

interface UploadTypedInput {
  name: string
  version: string
  description?: string
  tags: string[]
  file: File
}

interface UploadMaterialInput {
  name: string
  version: string
  description?: string
  tags: string[]
  properties: Record<string, unknown>
}

interface UploadContext {
  userRole: string
}

async function getOrCreateAsset(
  db: Database,
  name: string,
  type: string,
  ownerId: string,
  description?: string,
): Promise<number> {
  const existing = await db.query.assets.findFirst({
    where: eq(assets.name, name),
  })

  if (existing) {
    return existing.id
  }

  const result = await db
    .insert(assets)
    .values({ name, type, ownerId, description: description ?? null })
    .returning({ id: assets.id })

  return result[0].id
}

async function createExampleAsset(
  db: Database,
  r2: R2Bucket,
  env: Env,
  parentName: string,
  parentType: string,
  version: string,
  ownerId: string,
  npmDependencies: string,
) {
  const exampleName = `${parentName}-example`
  const exampleAssetId = await getOrCreateAsset(db, exampleName, 'generic', ownerId)

  const { applyTemplate } = await import('../templates/index.js')
  const _templateFiles = await applyTemplate(
    parentType as any,
    parentName,
    {
      version,
      sourceKey: `assets/${parentName}/${version}/source/`,
      npmDependencies,
      assetDependencies: '{}',
      readme: null,
    },
    r2,
  )

  const exampleTemplateFiles = await applyTemplate(
    'generic' as any,
    exampleName,
    {
      version,
      sourceKey: `assets/${exampleName}/${version}/source/`,
      npmDependencies,
      assetDependencies: '{}',
      readme: null,
    },
    r2,
    parentType,
  )

  // Write example template files to R2
  for (const file of exampleTemplateFiles) {
    if (file.content) {
      const key = `assets/${exampleName}/${version}/source/${file.path}`
      await uploadToR2(r2, key, file.content, 'text/plain')
    }
  }

  const exampleSourceKey = `assets/${exampleName}/${version}/source/`
  await db
    .insert(assetVersions)
    .values({
      assetId: exampleAssetId,
      version,
      npmDependencies,
      assetDependencies: '{}',
      sourceKey: exampleSourceKey,
      approved: true,
    })
    .onConflictDoNothing()
}

function embedAssetInBackground(
  env: Env,
  asset: { id: number; name: string; type: string; description: string | null },
  tagNames: string[],
) {
  indexAsset(env.OPENROUTER_API_KEY, env.VECTORIZE, asset, tagNames).catch((e) =>
    console.error('Failed to index asset embedding:', e),
  )
}

async function attachTags(db: Database, assetId: number, tagNames: string[]) {
  for (const tagName of tagNames) {
    let tag = await db.query.tags.findFirst({
      where: eq(tags.name, tagName),
    })

    if (!tag) {
      const result = await db.insert(tags).values({ name: tagName }).returning()
      tag = result[0]
    }

    await db.insert(assetTags).values({ assetId, tagId: tag.id }).onConflictDoNothing()
  }
}

export async function uploadGenericAsset(
  db: Database,
  r2: R2Bucket,
  env: Env,
  userId: string,
  input: UploadGenericInput,
  ctx: UploadContext = { userRole: 'user' },
) {
  const assetId = await getOrCreateAsset(db, input.name, 'generic', userId, input.description)
  const approved = ctx.userRole === 'admin'

  const key = sourceKey(input.name, input.version, input.file.name)
  await uploadToR2(r2, key, await input.file.arrayBuffer(), input.file.type)

  const versionRecord = await db
    .insert(assetVersions)
    .values({
      assetId,
      version: input.version,
      npmDependencies: JSON.stringify(input.npmDependencies),
      assetDependencies: JSON.stringify(input.assetDependencies),
      sourceKey: key,
      approved,
    })
    .returning()

  if (input.tags.length > 0) {
    await attachTags(db, assetId, input.tags)
  }

  embedAssetInBackground(
    env,
    { id: assetId, name: input.name, type: 'generic', description: input.description ?? null },
    input.tags,
  )

  return versionRecord[0]
}

export async function uploadModelAsset(
  db: Database,
  r2: R2Bucket,
  env: Env,
  userId: string,
  input: UploadTypedInput,
  ctx: UploadContext = { userRole: 'user' },
) {
  const ext = input.file.name.endsWith('.gltf') ? 'gltf' : 'glb'
  const key = sourceKey(input.name, input.version, `model.${ext}`)
  const approved = ctx.userRole === 'admin'
  const npmDeps = JSON.stringify(V43_DEPENDENCIES)

  const assetId = await getOrCreateAsset(db, input.name, 'model', userId, input.description)
  await uploadToR2(r2, key, await input.file.arrayBuffer(), input.file.type)

  const versionRecord = await db
    .insert(assetVersions)
    .values({
      assetId,
      version: input.version,
      npmDependencies: npmDeps,
      assetDependencies: '{}',
      sourceKey: key,
      approved,
    })
    .returning()

  if (input.tags.length > 0) {
    await attachTags(db, assetId, input.tags)
  }

  embedAssetInBackground(
    env,
    { id: assetId, name: input.name, type: 'model', description: input.description ?? null },
    input.tags,
  )

  // Auto-create example asset
  createExampleAsset(db, r2, env, input.name, 'model', input.version, userId, npmDeps).catch((e) =>
    console.error('Failed to create example asset:', e),
  )

  return versionRecord[0]
}

export async function uploadHdriAsset(
  db: Database,
  r2: R2Bucket,
  env: Env,
  userId: string,
  input: UploadTypedInput,
  ctx: UploadContext = { userRole: 'user' },
) {
  const ext = input.file.name.endsWith('.exr') ? 'exr' : 'hdr'
  const key = sourceKey(input.name, input.version, `environment.${ext}`)
  const approved = ctx.userRole === 'admin'
  const npmDeps = JSON.stringify(V43_DEPENDENCIES)

  const assetId = await getOrCreateAsset(db, input.name, 'hdri', userId, input.description)
  await uploadToR2(r2, key, await input.file.arrayBuffer(), input.file.type)

  const versionRecord = await db
    .insert(assetVersions)
    .values({
      assetId,
      version: input.version,
      npmDependencies: npmDeps,
      assetDependencies: '{}',
      sourceKey: key,
      approved,
    })
    .returning()

  if (input.tags.length > 0) {
    await attachTags(db, assetId, input.tags)
  }

  embedAssetInBackground(
    env,
    { id: assetId, name: input.name, type: 'hdri', description: input.description ?? null },
    input.tags,
  )

  // Auto-create example asset
  createExampleAsset(db, r2, env, input.name, 'hdri', input.version, userId, npmDeps).catch((e) =>
    console.error('Failed to create example asset:', e),
  )

  return versionRecord[0]
}

export async function uploadMusicAsset(
  db: Database,
  r2: R2Bucket,
  env: Env,
  userId: string,
  input: UploadTypedInput,
  ctx: UploadContext = { userRole: 'user' },
) {
  const ext = input.file.name.split('.').pop()?.toLowerCase() ?? 'mp3'
  const key = sourceKey(input.name, input.version, `audio.${ext}`)
  const approved = ctx.userRole === 'admin'

  const assetId = await getOrCreateAsset(db, input.name, 'music', userId, input.description)
  await uploadToR2(r2, key, await input.file.arrayBuffer(), input.file.type)

  const versionRecord = await db
    .insert(assetVersions)
    .values({
      assetId,
      version: input.version,
      npmDependencies: '{}',
      assetDependencies: '{}',
      sourceKey: key,
      approved,
    })
    .returning()

  if (input.tags.length > 0) {
    await attachTags(db, assetId, input.tags)
  }

  embedAssetInBackground(
    env,
    { id: assetId, name: input.name, type: 'music', description: input.description ?? null },
    input.tags,
  )

  return versionRecord[0]
}

export async function uploadMaterialAsset(
  db: Database,
  r2: R2Bucket,
  env: Env,
  userId: string,
  input: UploadMaterialInput,
  ctx: UploadContext = { userRole: 'user' },
) {
  const key = sourceKey(input.name, input.version, 'properties.json')
  const approved = ctx.userRole === 'admin'
  const npmDeps = JSON.stringify(V43_DEPENDENCIES)

  const assetId = await getOrCreateAsset(db, input.name, 'material', userId, input.description)
  await uploadToR2(r2, key, JSON.stringify(input.properties), 'application/json')

  const versionRecord = await db
    .insert(assetVersions)
    .values({
      assetId,
      version: input.version,
      npmDependencies: npmDeps,
      assetDependencies: '{}',
      sourceKey: key,
      approved,
    })
    .returning()

  if (input.tags.length > 0) {
    await attachTags(db, assetId, input.tags)
  }

  embedAssetInBackground(
    env,
    { id: assetId, name: input.name, type: 'material', description: input.description ?? null },
    input.tags,
  )

  // Auto-create example asset
  createExampleAsset(db, r2, env, input.name, 'material', input.version, userId, npmDeps).catch(
    (e) => console.error('Failed to create example asset:', e),
  )

  return versionRecord[0]
}
