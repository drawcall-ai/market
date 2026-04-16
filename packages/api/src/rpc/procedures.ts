import { implement } from '@orpc/server'
import { contract, internalContract } from '@drawcall/market'
import type { Context } from './context.js'

export const impl = implement(contract).$context<Context>()
export const internalImpl = implement(internalContract).$context<Context>()
