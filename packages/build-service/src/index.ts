import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { createMarketClient, createInternalClient } from '@drawcall/market'

const API_URL = process.env.API_URL ?? 'https://api.market.drawcall.ai'

const client = createMarketClient({ baseUrl: API_URL })
const internalClient = createInternalClient({ baseUrl: API_URL })

interface BuildRequest {
  assetName: string // e.g. "test-example"
  version: string // e.g. "1.0.0"
  parentName: string // e.g. "test"
}

async function buildExample(req: BuildRequest) {
  const { assetName, version, parentName } = req
  console.log(`Building ${assetName}@${version}...`)

  // Create temp directory
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'market-build-'))
  console.log(`  Work dir: ${tmpDir}`)

  try {
    // 1. Fetch example asset file tree
    const exampleTree = await client.asset.getVersionTree({ name: assetName, version })
    console.log(`  Example files: ${exampleTree.map((f) => f.path).join(', ')}`)

    // 2. Fetch parent asset file tree
    const parentTree = await client.asset.getVersionTree({ name: parentName, version })
    console.log(`  Parent files: ${parentTree.map((f) => f.path).join(', ')}`)

    // 3. Write example files to tmpDir
    for (const file of exampleTree) {
      const filePath = path.join(tmpDir, file.path)
      await fs.mkdir(path.dirname(filePath), { recursive: true })

      const blob = await client.asset.getRawFile({ name: assetName, version, path: file.path })

      if (
        file.path.endsWith('.glb') ||
        file.path.endsWith('.gltf') ||
        file.path.endsWith('.hdr') ||
        file.path.endsWith('.exr')
      ) {
        const buf = Buffer.from(await blob.arrayBuffer())
        await fs.writeFile(filePath, buf)
      } else {
        const content = await blob.text()
        await fs.writeFile(filePath, content)
      }
    }

    // 4. Write parent asset files into src/{parentName}/
    const parentDir = path.join(tmpDir, 'src', parentName)
    await fs.mkdir(parentDir, { recursive: true })
    for (const file of parentTree) {
      const filePath = path.join(parentDir, file.path)
      await fs.mkdir(path.dirname(filePath), { recursive: true })

      const blob = await client.asset.getRawFile({ name: parentName, version, path: file.path })

      if (
        file.path.endsWith('.glb') ||
        file.path.endsWith('.gltf') ||
        file.path.endsWith('.hdr') ||
        file.path.endsWith('.exr')
      ) {
        const buf = Buffer.from(await blob.arrayBuffer())
        await fs.writeFile(filePath, buf)
      } else {
        const content = await blob.text()
        await fs.writeFile(filePath, content)
      }
    }

    // 5. Install dependencies from the template's package.json
    console.log('  Installing dependencies...')
    const { execSync } = await import('child_process')
    execSync('npm install --legacy-peer-deps', { cwd: tmpDir, stdio: 'pipe' })

    // 6. Build with Vite + V43
    execSync('npm install --save-dev vite @v43/plugin --legacy-peer-deps', {
      cwd: tmpDir,
      stdio: 'pipe',
    })

    console.log('  Building with Vite...')
    const outDir = path.join(tmpDir, 'dist')
    execSync('npx vite build', { cwd: tmpDir, stdio: 'pipe' })

    // 7. Upload build output files via internal oRPC client
    const distFiles = await collectFiles(outDir)
    console.log(`  Build output: ${distFiles.length} files`)

    for (const file of distFiles) {
      const relativePath = path.relative(outDir, file)
      const r2Key = `assets/${parentName}/${version}/build/${relativePath}`
      const content = await fs.readFile(file)
      const ext = path.extname(file).slice(1)
      const contentType = getContentType(ext)

      console.log(`  Uploading ${r2Key} (${contentType})`)

      await internalClient.buildUpload({
        key: r2Key,
        content: content.toString('base64'),
        contentType,
      })
    }

    // 8. Update the PARENT asset's version record with buildOutputKey
    const buildOutputKey = `assets/${parentName}/${version}/build/`
    await internalClient.buildComplete({
      assetName: parentName,
      version,
      buildOutputKey,
    })

    console.log(`  Build complete for ${assetName}@${version}`)
  } finally {
    // Clean up
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
}

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

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

// Run build from CLI args
const [assetName, version] = process.argv.slice(2)
if (!assetName || !version) {
  console.error('Usage: tsx src/index.ts <example-asset-name> <version>')
  console.error('Example: tsx src/index.ts test-example 1.0.0')
  process.exit(1)
}

const parentName = assetName.replace(/-example$/, '')
if (parentName === assetName) {
  console.error('Asset name must end with -example')
  process.exit(1)
}

buildExample({ assetName, version, parentName }).catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})
