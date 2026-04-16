import type { TemplateFile, VersionRecord } from './index.js'

export async function genericTemplate(
  assetName: string,
  version: VersionRecord,
  r2: R2Bucket,
): Promise<TemplateFile[]> {
  // For generic assets, the source is a zip that was unpacked and stored in R2
  // List all files under the asset's source prefix
  const prefix = `assets/${assetName}/${version.version}/source/`
  const listed = await r2.list({ prefix })

  const files: TemplateFile[] = []
  for (const obj of listed.objects) {
    const relativePath = obj.key.slice(prefix.length)
    if (relativePath) {
      files.push({
        path: relativePath,
        r2Key: obj.key,
      })
    }
  }

  return files
}
