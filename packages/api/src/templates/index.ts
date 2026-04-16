import type { AssetType } from '@drawcall/market'
import { modelTemplate } from './model.js'
import { hdriTemplate } from './hdri.js'
import { materialTemplate } from './material.js'
import { genericTemplate } from './generic.js'
import { musicTemplate } from './music.js'
import { modelExampleTemplate } from './model-example.js'
import { hdriExampleTemplate } from './hdri-example.js'
import { materialExampleTemplate } from './material-example.js'

export interface TemplateFile {
  path: string
  content?: string
  r2Key?: string // if content should be fetched from R2
}

export interface VersionRecord {
  version: string
  sourceKey: string
  npmDependencies: string
  assetDependencies: string
  readme: string | null
}

type TemplateFunction = (
  assetName: string,
  version: VersionRecord,
  r2: R2Bucket,
) => Promise<TemplateFile[]>

const templates: Record<AssetType, TemplateFunction> = {
  generic: genericTemplate,
  model: modelTemplate,
  hdri: hdriTemplate,
  material: materialTemplate,
  music: musicTemplate,
}

const exampleTemplates: Record<string, TemplateFunction> = {
  model: modelExampleTemplate,
  hdri: hdriExampleTemplate,
  material: materialExampleTemplate,
}

export async function applyTemplate(
  type: AssetType,
  assetName: string,
  version: VersionRecord,
  r2: R2Bucket,
  parentType?: string,
): Promise<TemplateFile[]> {
  // If this is an example asset for a typed parent, use the example template
  if (assetName.endsWith('-example') && parentType && exampleTemplates[parentType]) {
    return exampleTemplates[parentType](assetName, version, r2)
  }

  const templateFn = templates[type]
  return templateFn(assetName, version, r2)
}
