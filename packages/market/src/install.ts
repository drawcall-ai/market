/**
 * Install resolved assets into a local project.
 *
 * 1. Downloads asset files into ./src/{assetName}/ via the oRPC client.
 * 2. Merges npm dependencies into package.json.
 * 3. Runs the package manager to install npm deps.
 *
 * NOTE: This module uses Node.js APIs (fs, path, nypm) and is only
 * used by the CLI binary — it is NOT exported from the package index.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { detectPackageManager, installDependencies } from 'nypm'
import type { MarketClient } from './client.js'
import type { ResolveResult } from './resolve.js'

export interface InstallOptions {
  /** Project root directory (default: cwd) */
  cwd?: string
  /** Log progress */
  onProgress?: (message: string) => void
}

export async function install(
  client: MarketClient,
  resolution: ResolveResult,
  opts: InstallOptions = {},
): Promise<void> {
  const cwd = opts.cwd ?? process.cwd()
  const log = opts.onProgress ?? (() => {})

  // Run asset file downloads and npm dep installation in parallel
  await Promise.all([
    downloadAssets(client, resolution, cwd, log),
    installNpmDeps(resolution, cwd, log),
  ])
}

async function downloadAssets(
  client: MarketClient,
  resolution: ResolveResult,
  cwd: string,
  log: (msg: string) => void,
): Promise<void> {
  for (const asset of resolution.assets) {
    const destDir = path.join(cwd, 'src', asset.name)
    await fs.mkdir(destDir, { recursive: true })

    log(`Downloading ${asset.name}@${asset.version}...`)

    const tree = await client.asset.getVersionTree({ name: asset.name, version: asset.version })

    for (const file of tree) {
      const filePath = path.join(destDir, file.path)
      await fs.mkdir(path.dirname(filePath), { recursive: true })

      const blob = await client.asset.getRawFile({
        name: asset.name,
        version: asset.version,
        path: file.path,
      })
      const content = Buffer.from(await blob.arrayBuffer())
      await fs.writeFile(filePath, content)
    }

    log(`  ${tree.length} files → src/${asset.name}/`)
  }
}

async function installNpmDeps(
  resolution: ResolveResult,
  cwd: string,
  log: (msg: string) => void,
): Promise<void> {
  const deps = resolution.npmDependencies
  if (Object.keys(deps).length === 0) return

  // Read existing package.json
  const pkgPath = path.join(cwd, 'package.json')
  let pkg: any
  try {
    pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'))
  } catch {
    pkg = { name: 'my-project', private: true, dependencies: {} }
  }

  // Merge dependencies
  pkg.dependencies = { ...pkg.dependencies, ...deps }
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

  log(`Installing npm dependencies: ${Object.keys(deps).join(', ')}`)

  // Detect package manager, fall back to npm
  const pm = await detectPackageManager(cwd).catch(() => null)
  const pmName = pm?.name ?? 'npm'

  log(`Using ${pmName}...`)
  await installDependencies({ cwd, packageManager: { name: pmName, command: pmName } })
  log('npm dependencies installed.')
}
