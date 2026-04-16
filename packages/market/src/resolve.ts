/**
 * Dependency resolver for market assets.
 *
 * 1. Collects the target assets and all transitive asset dependencies.
 * 2. For each asset, finds a version that satisfies ALL constraints from
 *    every dependent.
 * 3. Merges npm dependency ranges across all resolved assets and checks
 *    that they are compatible.
 */

import * as semver from 'semver'
import type { MarketClient } from './client.js'
import type { AssetWithVersionsAndTags } from './contract.js'

export interface ResolvedAsset {
  name: string
  version: string
  npmDependencies: Record<string, string>
  assetDependencies: Record<string, string>
}

export interface ResolveResult {
  assets: ResolvedAsset[]
  npmDependencies: Record<string, string>
}

interface AssetRequest {
  name: string
  range: string // semver range, e.g. "^1.0.0" or "*"
}

export class ResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResolutionError'
  }
}

export async function resolve(
  client: MarketClient['asset'],
  requests: AssetRequest[],
  opts: { includeUnapproved?: boolean } = {},
): Promise<ResolveResult> {
  // constraints[assetName] = list of { range, from } constraints
  const constraints: Map<string, { range: string; from: string }[]> = new Map()
  // resolved[assetName] = ResolvedAsset
  const resolved: Map<string, ResolvedAsset> = new Map()
  // cache of fetched metadata
  const metaCache: Map<string, AssetWithVersionsAndTags> = new Map()

  // Seed constraints from the requested assets
  for (const req of requests) {
    addConstraint(constraints, req.name, req.range, '<root>')
  }

  // Iteratively resolve until stable
  let unresolved = getUnresolved(constraints, resolved)
  while (unresolved.length > 0) {
    for (const assetName of unresolved) {
      const meta = await fetchMeta(client, metaCache, assetName)
      if (!meta) {
        throw new ResolutionError(`Asset "${assetName}" not found.`)
      }

      // Filter to approved versions (unless --unapproved)
      const candidates = meta.versions.filter((v) => opts.includeUnapproved || v.approved)

      if (candidates.length === 0) {
        throw new ResolutionError(
          `Asset "${assetName}" has no ${opts.includeUnapproved ? '' : 'approved '}versions.`,
        )
      }

      // Collect all constraints for this asset
      const assetConstraints = constraints.get(assetName) ?? []

      // Find the best (highest) version that satisfies ALL constraints
      const candidateVersions = candidates.map((c) => c.version)
      const satisfying = candidateVersions.filter((v) =>
        assetConstraints.every((c) => semver.satisfies(v, c.range)),
      )

      if (satisfying.length === 0) {
        const constraintDesc = assetConstraints
          .map((c) => `  ${c.range} (from ${c.from})`)
          .join('\n')
        throw new ResolutionError(
          `No version of "${assetName}" satisfies all constraints:\n${constraintDesc}\n` +
            `Available${opts.includeUnapproved ? '' : ' approved'}: ${candidateVersions.join(', ')}`,
        )
      }

      const best = semver.maxSatisfying(satisfying, '*')!
      const versionMeta = candidates.find((c) => c.version === best)!

      const npmDeps: Record<string, string> = JSON.parse(versionMeta.npmDependencies)
      const assetDeps: Record<string, string> = JSON.parse(versionMeta.assetDependencies)

      resolved.set(assetName, {
        name: assetName,
        version: best,
        npmDependencies: npmDeps,
        assetDependencies: assetDeps,
      })

      // Add transitive asset dependency constraints
      for (const [depName, depRange] of Object.entries(assetDeps)) {
        addConstraint(constraints, depName, depRange, `${assetName}@${best}`)
      }
    }

    unresolved = getUnresolved(constraints, resolved)
  }

  // Verify all resolved versions still satisfy constraints (transitive deps
  // may have added new constraints after we resolved a version)
  for (const [assetName, asset] of resolved) {
    const assetConstraints = constraints.get(assetName) ?? []
    for (const c of assetConstraints) {
      if (!semver.satisfies(asset.version, c.range)) {
        throw new ResolutionError(
          `Conflict: "${assetName}@${asset.version}" does not satisfy ` +
            `${c.range} (required by ${c.from}).`,
        )
      }
    }
  }

  // Merge npm dependencies across all resolved assets
  const mergedNpm = mergeNpmDependencies(Array.from(resolved.values()))

  return {
    assets: Array.from(resolved.values()),
    npmDependencies: mergedNpm,
  }
}

function addConstraint(
  constraints: Map<string, { range: string; from: string }[]>,
  name: string,
  range: string,
  from: string,
) {
  const existing = constraints.get(name) ?? []
  existing.push({ range, from })
  constraints.set(name, existing)
}

function getUnresolved(
  constraints: Map<string, { range: string; from: string }[]>,
  resolved: Map<string, ResolvedAsset>,
): string[] {
  return Array.from(constraints.keys()).filter((name) => !resolved.has(name))
}

async function fetchMeta(
  client: MarketClient['asset'],
  cache: Map<string, AssetWithVersionsAndTags>,
  name: string,
): Promise<AssetWithVersionsAndTags | null> {
  if (cache.has(name)) return cache.get(name)!
  const meta = await client.getByName({ name })
  if (meta) cache.set(name, meta)
  return meta
}

/**
 * Merge npm dependency ranges from all resolved assets.
 * For each package, check that all declared ranges are compatible
 * (using semver.intersects). Return the narrowest range.
 */
function mergeNpmDependencies(assets: ResolvedAsset[]): Record<string, string> {
  // Collect all ranges per package
  const rangesPerPkg: Map<string, { range: string; from: string }[]> = new Map()

  for (const asset of assets) {
    for (const [pkg, range] of Object.entries(asset.npmDependencies)) {
      const existing = rangesPerPkg.get(pkg) ?? []
      existing.push({ range, from: `${asset.name}@${asset.version}` })
      rangesPerPkg.set(pkg, existing)
    }
  }

  const merged: Record<string, string> = {}

  for (const [pkg, ranges] of rangesPerPkg) {
    // Check pairwise compatibility
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        if (!semver.intersects(ranges[i].range, ranges[j].range)) {
          throw new ResolutionError(
            `npm dependency conflict for "${pkg}":\n` +
              `  ${ranges[i].range} (from ${ranges[i].from})\n` +
              `  ${ranges[j].range} (from ${ranges[j].from})`,
          )
        }
      }
    }

    // Use the narrowest (most constrained) range.
    // Simple heuristic: pick the range with the highest minimum version.
    let narrowest = ranges[0].range
    for (const r of ranges.slice(1)) {
      const minCurrent = semver.minVersion(narrowest)
      const minNew = semver.minVersion(r.range)
      if (minCurrent && minNew && semver.gt(minNew, minCurrent)) {
        narrowest = r.range
      }
    }

    merged[pkg] = narrowest
  }

  return merged
}
