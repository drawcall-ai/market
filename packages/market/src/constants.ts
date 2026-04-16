import type { AssetType } from './schemas.js'

export const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export const ALLOWED_EXTENSIONS: Record<AssetType, string[]> = {
  generic: ['.zip'],
  model: ['.gltf', '.glb'],
  hdri: ['.hdr', '.exr'],
  material: [], // material is submitted as JSON, no file upload
  music: ['.mp3', '.wav', '.ogg', '.flac'],
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  generic: 'Generic',
  model: '3D Model',
  hdri: 'HDRI',
  material: 'Material',
  music: 'Audio',
}
