import type { Database } from '@market/db/client'
import type { Env } from '../env.js'

export interface Context {
  db: Database
  r2: R2Bucket
  vectorize: VectorizeIndex
  env: Env
  user: {
    id: string
    name: string
    email: string
    role: string
  } | null
}
