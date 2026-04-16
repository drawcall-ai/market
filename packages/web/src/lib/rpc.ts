import { createMarketClient } from '@drawcall/market'
import { createORPCReactQueryUtils } from '@orpc/react-query'
import { API_BASE } from './api'

export const client = createMarketClient({
  baseUrl: API_BASE,
  fetch: (input, init) => globalThis.fetch(input, { ...init, credentials: 'include' }),
})
export const orpc = createORPCReactQueryUtils(client)
