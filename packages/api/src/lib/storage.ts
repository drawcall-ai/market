export async function uploadToR2(
  r2: R2Bucket,
  key: string,
  data: ArrayBuffer | ReadableStream | string,
  contentType?: string,
): Promise<void> {
  await r2.put(key, data, {
    httpMetadata: contentType ? { contentType } : undefined,
  })
}

export async function getFromR2(r2: R2Bucket, key: string): Promise<R2ObjectBody | null> {
  return r2.get(key)
}

export async function deleteFromR2(r2: R2Bucket, key: string): Promise<void> {
  await r2.delete(key)
}

export function sourceKey(assetName: string, version: string, filename: string): string {
  return `assets/${assetName}/${version}/source/${filename}`
}

export function buildKey(assetName: string, version: string, path: string): string {
  return `assets/${assetName}/${version}/build/${path}`
}

export function thumbnailKey(assetName: string, version: string): string {
  return `assets/${assetName}/${version}/thumbnail.png`
}
