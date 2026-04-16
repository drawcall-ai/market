import { Hono } from 'hono'
import type { Env } from '../env.js'
import { getFromR2 } from '../lib/storage.js'

const build = new Hono<{ Bindings: Env }>()

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    html: 'text/html',
    js: 'text/javascript',
    css: 'text/css',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    svg: 'image/svg+xml',
    glb: 'model/gltf-binary',
    gltf: 'model/gltf+json',
  }
  return types[ext] ?? 'application/octet-stream'
}

// GET /api/asset/:name/:version/build/* — serve build output from R2
// This stays as a regular HTTP route because browsers need direct URLs for iframes.
build.get('/asset/:name/:version/build/*', async (c) => {
  const { name, version } = c.req.param()
  const buildPath = c.req.path.split('/build/')[1] || 'index.html'

  // Build output is always stored under the real parent name
  const realName = name.endsWith('-example') ? name.replace(/-example$/, '') : name

  const key = `assets/${realName}/${version}/build/${buildPath}`
  const obj = await getFromR2(c.env.R2, key)

  if (!obj) return c.json({ error: 'Build file not found' }, 404)

  const ext = buildPath.split('.').pop() ?? ''
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? getContentType(ext),
    },
  })
})

export { build }
