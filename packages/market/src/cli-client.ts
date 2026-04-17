import { createMarketClient, type MarketClient } from './client.js'
import { loadConfig } from './config.js'

const DEFAULT_BASE_URL = 'https://api.market.drawcall.ai'

export class NotLoggedInError extends Error {
  constructor() {
    super('Not logged in. Run `market login` first.')
    this.name = 'NotLoggedInError'
  }
}

export interface CliClientOptions {
  /** Override the API base URL. Takes precedence over config and defaults. */
  baseUrl?: string
  /** Require authentication. When true, throws NotLoggedInError if no key is available. */
  requireAuth?: boolean
}

export interface CliClient {
  client: MarketClient
  baseUrl: string
  apiKey: string | undefined
}

export async function getCliClient(opts: CliClientOptions = {}): Promise<CliClient> {
  const config = await loadConfig()
  const apiKey = process.env.MARKET_API_KEY ?? config?.apiKey
  const baseUrl = opts.baseUrl ?? process.env.MARKET_API_URL ?? config?.baseUrl ?? DEFAULT_BASE_URL

  if (opts.requireAuth && !apiKey) {
    throw new NotLoggedInError()
  }

  return {
    client: createMarketClient({ baseUrl, apiKey }),
    baseUrl,
    apiKey,
  }
}
