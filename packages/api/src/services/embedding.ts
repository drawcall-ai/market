const EMBEDDING_MODEL = 'openai/text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 768

export function buildAssetText(
  asset: { name: string; type: string; description: string | null },
  tags: string[],
): string {
  const parts = [`${asset.type}: ${asset.name}`]
  if (asset.description) {
    parts.push(asset.description)
  }
  if (tags.length > 0) {
    parts.push(`Tags: ${tags.join(', ')}`)
  }
  return parts.join('. ')
}

export async function embed(apiKey: string, text: string): Promise<number[]> {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenRouter embedding failed (${response.status}): ${body}`)
  }

  const result = (await response.json()) as {
    data: Array<{ embedding: number[] }>
  }
  return result.data[0].embedding
}

export async function indexAsset(
  apiKey: string,
  vectorize: VectorizeIndex,
  asset: { id: number; name: string; type: string; description: string | null },
  tags: string[],
): Promise<void> {
  const text = buildAssetText(asset, tags)
  const values = await embed(apiKey, text)
  await vectorize.upsert([
    {
      id: String(asset.id),
      values: new Float32Array(values),
      metadata: { name: asset.name, type: asset.type },
    },
  ])
}

export async function embedQuery(apiKey: string, query: string): Promise<number[]> {
  return embed(apiKey, query)
}
