import type { MarketClient } from './client.js'
import type { AssetType } from './schemas.js'

export class GenerateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GenerateError'
  }
}

export interface GenerateInput {
  description: string
  type?: AssetType
}

export interface GenerateResult {
  assetName: string
  version: string
}

export interface GenerateOptions {
  onProgress?: (message: string) => void
  pollIntervalMs?: number
  timeoutMs?: number
}

export async function generateAndWait(
  client: MarketClient,
  input: GenerateInput,
  opts: GenerateOptions = {},
): Promise<GenerateResult> {
  const pollIntervalMs = opts.pollIntervalMs ?? 1500
  const timeoutMs = opts.timeoutMs ?? 60_000
  const report = opts.onProgress ?? (() => {})

  const { jobId } = await client.generate.start(input)

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const status = await client.generate.status({ jobId })
    if (status.message) report(status.message)

    if (status.state === 'done') {
      if (!status.assetName || !status.version) {
        throw new GenerateError('Generation completed without an asset name.')
      }
      return { assetName: status.assetName, version: status.version }
    }

    if (status.state === 'failed') {
      throw new GenerateError(status.error ?? 'Generation failed.')
    }

    await sleep(pollIntervalMs)
  }

  throw new GenerateError(`Generation timed out after ${timeoutMs}ms.`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
