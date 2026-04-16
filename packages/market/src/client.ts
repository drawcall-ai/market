import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { ContractRouterClient } from '@orpc/contract'
import type { AppContract } from './contract.js'
import type { InternalContract } from './internal-contract.js'

export type MarketClient = ContractRouterClient<AppContract>
export type InternalClient = ContractRouterClient<InternalContract>

export interface MarketClientOptions {
  baseUrl: string
  fetch?: typeof globalThis.fetch
}

function resolveUrl(baseUrl: string, path: string): string {
  if (baseUrl) return `${baseUrl}${path}`
  // In browser environments, use the current origin for relative URLs
  if (typeof globalThis !== 'undefined' && 'location' in globalThis) {
    return `${(globalThis as unknown as { location: { origin: string } }).location.origin}${path}`
  }
  throw new Error('baseUrl is required in non-browser environments')
}

export function createMarketClient(opts: MarketClientOptions): MarketClient {
  const link = new RPCLink({
    url: resolveUrl(opts.baseUrl, '/api/rpc'),
    fetch: opts.fetch,
  })
  return createORPCClient<MarketClient>(link)
}

export function createInternalClient(opts: MarketClientOptions): InternalClient {
  const link = new RPCLink({
    url: resolveUrl(opts.baseUrl, '/api/internal-rpc'),
    fetch: opts.fetch,
  })
  return createORPCClient<InternalClient>(link)
}
