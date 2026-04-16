import { ORPCError } from '@orpc/server'
import { impl } from '../procedures.js'
import { createDb } from '@market/db/client'
import {
  uploadGenericAsset,
  uploadModelAsset,
  uploadHdriAsset,
  uploadMusicAsset,
  uploadMaterialAsset,
} from '../../services/upload.js'

const authed = impl.upload.use(({ context, next }) => {
  if (!context.user) {
    throw new ORPCError('UNAUTHORIZED')
  }
  return next({ context: { user: context.user } })
})

export const uploadRouter = {
  generic: authed.generic.handler(async ({ context, input }) => {
    return uploadGenericAsset(
      context.db,
      context.r2,
      context.env,
      context.user.id,
      input,
      { userRole: context.user.role },
    )
  }),

  model: authed.model.handler(async ({ context, input }) => {
    return uploadModelAsset(
      context.db,
      context.r2,
      context.env,
      context.user.id,
      input,
      { userRole: context.user.role },
    )
  }),

  hdri: authed.hdri.handler(async ({ context, input }) => {
    return uploadHdriAsset(
      context.db,
      context.r2,
      context.env,
      context.user.id,
      input,
      { userRole: context.user.role },
    )
  }),

  music: authed.music.handler(async ({ context, input }) => {
    return uploadMusicAsset(
      context.db,
      context.r2,
      context.env,
      context.user.id,
      input,
      { userRole: context.user.role },
    )
  }),

  material: authed.material.handler(async ({ context, input }) => {
    return uploadMaterialAsset(
      context.db,
      context.r2,
      context.env,
      context.user.id,
      input,
      { userRole: context.user.role },
    )
  }),
}
