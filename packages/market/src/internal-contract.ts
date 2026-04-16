import { oc } from '@orpc/contract'
import { z } from 'zod'

export const internalContract = {
  buildUpload: oc
    .input(
      z.object({
        key: z.string(),
        content: z.string(), // base64-encoded
        contentType: z.string(),
      }),
    )
    .output(z.object({ ok: z.boolean() })),

  buildComplete: oc
    .input(
      z.object({
        assetName: z.string(),
        version: z.string(),
        buildOutputKey: z.string(),
      }),
    )
    .output(z.object({ ok: z.boolean() })),
}

export type InternalContract = typeof internalContract
