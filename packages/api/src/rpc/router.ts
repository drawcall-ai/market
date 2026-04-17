import { assetRouter } from './routers/asset.js'
import { adminRouter } from './routers/admin.js'
import { userRouter } from './routers/user.js'
import { tagRouter } from './routers/tag.js'
import { uploadRouter } from './routers/upload.js'
import { generateRouter } from './routers/generate.js'
import { internalRouter } from './routers/internal.js'

export const router = {
  asset: assetRouter,
  admin: adminRouter,
  user: userRouter,
  tag: tagRouter,
  upload: uploadRouter,
  generate: generateRouter,
}

export { internalRouter }
