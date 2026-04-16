import type { TemplateFile, VersionRecord } from './index.js'

export async function musicTemplate(
  assetName: string,
  version: VersionRecord,
  _r2: R2Bucket,
): Promise<TemplateFile[]> {
  return [
    {
      path: version.sourceKey.split('/').pop() ?? 'audio.mp3',
      r2Key: version.sourceKey,
    },
  ]
}
