import { z } from 'zod'

export const ASSET_TYPES = ['generic', 'model', 'hdri', 'material', 'music'] as const
export type AssetType = (typeof ASSET_TYPES)[number]

export const assetTypeSchema = z.enum(ASSET_TYPES)

export const semverSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/,
    'Must be a valid semver version (e.g. 1.0.0)',
  )

export const assetNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Must be lowercase alphanumeric with hyphens, no leading/trailing hyphens',
  )
  .refine((name) => !name.endsWith('-example'), {
    message: "Asset names cannot end with '-example' (reserved for generated examples)",
  })

export const npmDependenciesSchema = z.record(z.string(), z.string()).default({})

export const assetDependenciesSchema = z.record(z.string(), z.string()).default({})

export const uploadGenericSchema = z.object({
  name: assetNameSchema,
  version: semverSchema,
  description: z.string().max(1000).optional(),
  npmDependencies: npmDependenciesSchema,
  assetDependencies: assetDependenciesSchema,
  tags: z.array(z.string()).default([]),
})

export const uploadTypedSchema = z.object({
  name: assetNameSchema,
  version: semverSchema,
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).default([]),
})

export const uploadMaterialSchema = uploadTypedSchema.extend({
  properties: z.object({
    color: z.string().default('#ffffff'),
    roughness: z.number().min(0).max(1).default(0.5),
    metalness: z.number().min(0).max(1).default(0),
    normalScale: z.number().min(0).max(2).default(1),
    emissive: z.string().default('#000000'),
    emissiveIntensity: z.number().min(0).max(10).default(0),
  }),
})

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
})

export const listAssetsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  type: assetTypeSchema.optional(),
  tag: z.string().optional(),
  search: z.string().max(200).optional(),
  sort: z.enum(['newest', 'alphabetical', 'relevance']).default('newest'),
})
