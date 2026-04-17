// Client
export { createMarketClient, createInternalClient } from './client.js'
export type { MarketClient, InternalClient, MarketClientOptions } from './client.js'

// Contracts
export { contract } from './contract.js'
export type { AppContract } from './contract.js'
export { internalContract } from './internal-contract.js'
export type { InternalContract } from './internal-contract.js'

// Contract output types
export type {
  Asset,
  AssetVersion,
  AssetWithVersionsAndTags,
  AssetWithVersions,
  AssetListItem,
  PaginatedList,
  User,
  UnapprovedItem,
  TagWithCount,
  FileTreeEntry,
  GenerateJobStatus,
} from './contract.js'

// Resolve
export { resolve, ResolutionError } from './resolve.js'
export type { ResolvedAsset, ResolveResult } from './resolve.js'

// Generate
export { generateAndWait, GenerateError } from './generate.js'
export type { GenerateInput, GenerateResult, GenerateOptions } from './generate.js'

// Schemas
export {
  ASSET_TYPES,
  assetTypeSchema,
  semverSchema,
  assetNameSchema,
  npmDependenciesSchema,
  assetDependenciesSchema,
  uploadGenericSchema,
  uploadTypedSchema,
  uploadMaterialSchema,
  updateProfileSchema,
  listAssetsSchema,
} from './schemas.js'
export type { AssetType } from './schemas.js'

// Constants
export { MAX_FILE_SIZE, ALLOWED_EXTENSIONS, ASSET_TYPE_LABELS } from './constants.js'
