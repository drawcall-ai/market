import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  assetNameSchema,
  assetTypeSchema,
  semverSchema,
  listAssetsSchema,
  updateProfileSchema,
  uploadGenericSchema,
  uploadTypedSchema,
  uploadMaterialSchema,
} from './schemas.js'

// ─── Output types ─────────────────────────────────────────────────────────────
// These mirror what the server handlers return (Drizzle query results).
// We use z.custom<T>() so the contract carries full types for the client
// without duplicating every DB column as a Zod field.

export interface AssetVersion {
  id: number
  assetId: number
  version: string
  approved: boolean
  npmDependencies: string
  assetDependencies: string
  sourceKey: string
  buildOutputKey: string | null
  thumbnailKey: string | null
  buildError: string | null
  readme: string | null
  createdAt: Date
}

export interface Asset {
  id: number
  name: string
  type: string
  description: string | null
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

export interface AssetWithVersionsAndTags extends Asset {
  versions: AssetVersion[]
  tags: string[]
}

export interface AssetListItem {
  id: number
  name: string
  type: string
  description: string | null
  ownerId: string
  createdAt: Date
  updatedAt: Date
  latestVersion: string
  thumbnailKey: string | null
  approved: boolean
}

export interface PaginatedList<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: string
  createdAt: Date
  updatedAt: Date
}

export interface AssetWithVersions extends Asset {
  versions: AssetVersion[]
}

export interface UnapprovedItem {
  versionId: number
  assetId: number
  assetName: string
  assetType: string
  version: string
  buildError: string | null
  buildOutputKey: string | null
  thumbnailKey: string | null
  createdAt: Date
  ownerName: string
  ownerEmail: string
}

export interface TagWithCount {
  id: number
  name: string
  count: number
}

export interface FileTreeEntry {
  path: string
  size: number
}

export interface GenerateJobStatus {
  jobId: string
  state: 'queued' | 'running' | 'done' | 'failed'
  message: string | null
  assetName: string | null
  version: string | null
  error: string | null
}

// ─── Contract ─────────────────────────────────────────────────────────────────

export const contract = {
  asset: {
    getByName: oc
      .input(z.object({ name: assetNameSchema }))
      .output(z.custom<AssetWithVersionsAndTags | null>()),

    list: oc.input(listAssetsSchema).output(z.custom<PaginatedList<AssetListItem>>()),

    getVersionTree: oc
      .input(z.object({ name: z.string(), version: semverSchema }))
      .output(z.custom<FileTreeEntry[]>()),

    getRawFile: oc
      .input(z.object({ name: z.string(), version: semverSchema, path: z.string() }))
      .output(z.instanceof(Blob)),
  },

  upload: {
    generic: oc
      .input(uploadGenericSchema.extend({ file: z.instanceof(File) }))
      .output(z.custom<AssetVersion>()),

    model: oc
      .input(uploadTypedSchema.extend({ file: z.instanceof(File) }))
      .output(z.custom<AssetVersion>()),

    hdri: oc
      .input(uploadTypedSchema.extend({ file: z.instanceof(File) }))
      .output(z.custom<AssetVersion>()),

    music: oc
      .input(uploadTypedSchema.extend({ file: z.instanceof(File) }))
      .output(z.custom<AssetVersion>()),

    material: oc.input(uploadMaterialSchema).output(z.custom<AssetVersion>()),
  },

  admin: {
    listUnapproved: oc.output(z.custom<UnapprovedItem[]>()),

    approve: oc
      .input(z.object({ assetName: z.string(), version: z.string() }))
      .output(z.object({ success: z.boolean() })),

    backfillEmbeddings: oc.output(z.object({ indexed: z.number() })),
  },

  user: {
    getProfile: oc.output(z.custom<User | null>()),

    updateProfile: oc.input(updateProfileSchema).output(z.custom<User>()),

    getApiKey: oc.output(z.custom<{ prefix: string; createdAt: Date } | null>()),

    regenerateApiKey: oc.output(z.object({ key: z.string(), prefix: z.string() })),

    myAssets: oc.output(z.custom<AssetWithVersions[]>()),
  },

  tag: {
    list: oc.output(z.custom<TagWithCount[]>()),
  },

  generate: {
    start: oc
      .input(
        z.object({
          description: z.string().min(3).max(1000),
          type: assetTypeSchema.optional(),
        }),
      )
      .output(z.object({ jobId: z.string() })),

    status: oc.input(z.object({ jobId: z.string() })).output(z.custom<GenerateJobStatus>()),
  },
}

export type AppContract = typeof contract
