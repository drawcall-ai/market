// MOCK — replace with real generator later.
//
// Jobs live in an in-memory Map keyed by a crypto.randomUUID() jobId.
// State is derived from elapsed time since `start`:
//   < 2s   → queued
//   < 4s   → running
//   ≥ 4s   → done (returns an arbitrary approved asset so install completes)
//
// On Cloudflare Workers the Map is per-isolate, so a job kicked off in one
// isolate may not be visible to a later request. That's fine for a mock.

import { and, eq, desc } from 'drizzle-orm'
import { ORPCError } from '@orpc/server'
import { assets, assetVersions } from '@market/db/schema'
import type { GenerateJobStatus, AssetType } from '@drawcall/market'
import { impl } from '../procedures.js'

interface MockJob {
  createdAt: number
  description: string
  type?: AssetType
}

const jobs = new Map<string, MockJob>()

const QUEUED_MS = 2_000
const RUNNING_MS = 4_000

export const generateRouter = {
  start: impl.generate.start.handler(async ({ input }) => {
    const jobId = crypto.randomUUID()
    jobs.set(jobId, {
      createdAt: Date.now(),
      description: input.description,
      type: input.type,
    })
    return { jobId }
  }),

  status: impl.generate.status.handler(async ({ context, input }): Promise<GenerateJobStatus> => {
    const job = jobs.get(input.jobId)
    if (!job) {
      throw new ORPCError('NOT_FOUND', { message: `Unknown jobId: ${input.jobId}` })
    }

    const elapsed = Date.now() - job.createdAt

    if (elapsed < QUEUED_MS) {
      return {
        jobId: input.jobId,
        state: 'queued',
        message: 'Queued',
        assetName: null,
        version: null,
        error: null,
      }
    }

    if (elapsed < RUNNING_MS) {
      return {
        jobId: input.jobId,
        state: 'running',
        message: `Generating "${truncate(job.description, 40)}"`,
        assetName: null,
        version: null,
        error: null,
      }
    }

    // Done: return any existing approved asset (optionally filtered by type)
    // so the CLI can complete the install path end-to-end.
    const typeFilter = job.type ? eq(assets.type, job.type) : undefined
    const approvedFilter = eq(assetVersions.approved, true)

    const row = await context.db
      .select({
        name: assets.name,
        version: assetVersions.version,
      })
      .from(assetVersions)
      .innerJoin(assets, eq(assetVersions.assetId, assets.id))
      .where(typeFilter ? and(approvedFilter, typeFilter) : approvedFilter)
      .orderBy(desc(assetVersions.createdAt))
      .limit(1)
      .get()

    if (!row) {
      return {
        jobId: input.jobId,
        state: 'failed',
        message: null,
        assetName: null,
        version: null,
        error: 'Mock generator has no approved assets to return.',
      }
    }

    return {
      jobId: input.jobId,
      state: 'done',
      message: 'Done',
      assetName: row.name,
      version: row.version,
      error: null,
    }
  }),
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
