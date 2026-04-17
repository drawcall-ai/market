import chalk from 'chalk'
import ora, { type Ora } from 'ora'
import { resolve } from '../resolve.js'
import { install as runInstall } from '../install.js'
import { generateAndWait } from '../generate.js'
import { assetNameSchema, type AssetType } from '../schemas.js'
import { getCliClient } from '../cli-client.js'
import type { MarketClient } from '../client.js'

export interface InstallCommandOptions {
  type?: AssetType
  unapproved?: boolean
  cwd?: string
  baseUrl?: string
}

interface AssetRequest {
  name: string
  range: string
}

export async function installCommand(args: string[], opts: InstallCommandOptions): Promise<void> {
  const { client } = await getCliClient({ baseUrl: opts.baseUrl, requireAuth: true })

  const spinner = ora().start()
  try {
    const requests: AssetRequest[] = []
    for (const arg of args) {
      spinner.text = `Resolving "${truncate(arg, 40)}"`
      requests.push(await resolveArg(client, arg, opts.type, spinner))
    }

    spinner.text = 'Resolving dependency tree'
    const resolution = await resolve(client.asset, requests, {
      includeUnapproved: opts.unapproved ?? false,
    })

    await runInstall(client, resolution, {
      cwd: opts.cwd,
      onProgress: (msg) => {
        spinner.text = msg
      },
    })

    spinner.succeed(
      `Installed ${resolution.assets.length} asset(s): ` +
        resolution.assets.map((a) => chalk.cyan(a.name) + chalk.dim('@' + a.version)).join(', '),
    )
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : String(err))
    throw err
  }
}

/**
 * Fallthrough: exact-name → top-1 search hit → auto-generate.
 */
async function resolveArg(
  client: MarketClient,
  arg: string,
  type: AssetType | undefined,
  spinner: Ora,
): Promise<AssetRequest> {
  // 1. Try parsing as asset-name[@range] and looking up exact
  const parsed = parseNameAndRange(arg)
  if (parsed) {
    const existing = await client.asset.getByName({ name: parsed.name })
    if (existing) return parsed
  }

  // 2. Semantic search — top-1
  spinner.text = `Searching "${truncate(arg, 40)}"`
  const results = await client.asset.list({
    search: arg,
    type,
    limit: 1,
    page: 1,
    sort: 'relevance',
  })
  if (results.items.length > 0) {
    const hit = results.items[0]
    spinner.info(`Matched "${chalk.cyan(hit.name)}" ${chalk.dim(`(${hit.type})`)} for "${arg}"`)
    spinner.start()
    return { name: hit.name, range: '*' }
  }

  // 3. Auto-generate
  spinner.text = `No matches — generating "${truncate(arg, 40)}"`
  const generated = await generateAndWait(
    client,
    { description: arg, type },
    {
      onProgress: (msg) => {
        spinner.text = msg
      },
    },
  )
  spinner.info(
    `Generated ${chalk.cyan(generated.assetName)}${chalk.dim('@' + generated.version)} for "${arg}"`,
  )
  spinner.start()
  return { name: generated.assetName, range: generated.version }
}

/**
 * Returns { name, range } if the arg parses as `<asset-name>[@<range>]`.
 * Returns null if the name portion fails the asset-name schema (e.g. has spaces).
 */
function parseNameAndRange(arg: string): AssetRequest | null {
  const atIdx = arg.indexOf('@')
  const name = atIdx >= 0 ? arg.slice(0, atIdx) : arg
  const range = atIdx >= 0 ? arg.slice(atIdx + 1) : '*'
  return assetNameSchema.safeParse(name).success ? { name, range } : null
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
