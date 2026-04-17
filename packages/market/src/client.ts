import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { ContractRouterClient } from '@orpc/contract'
import type { AppContract } from './contract.js'
import type { InternalContract } from './internal-contract.js'

export type MarketClient = ContractRouterClient<AppContract>
export type InternalClient = ContractRouterClient<InternalContract>

const DEFAULT_BASE_URL = 'https://api.market.drawcall.ai'

export interface MarketClientOptions {
  baseUrl?: string
  fetch?: typeof globalThis.fetch
}

export function createMarketClient(opts: MarketClientOptions = {}): MarketClient {
  const baseUrl = opts.baseUrl || DEFAULT_BASE_URL
  const link = new RPCLink({
    url: new URL('/api/rpc', baseUrl).href,
    fetch: opts.fetch,
  })
  return createORPCClient<MarketClient>(link)
}

export function createInternalClient(opts: MarketClientOptions = {}): InternalClient {
  const baseUrl = opts.baseUrl || DEFAULT_BASE_URL
  const link = new RPCLink({
    url: new URL('/api/internal-rpc', baseUrl).href,
    fetch: opts.fetch,
  })
  return createORPCClient<InternalClient>(link)
}
