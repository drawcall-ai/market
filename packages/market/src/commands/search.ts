import chalk from 'chalk'
import ora from 'ora'
import { getCliClient } from '../cli-client.js'
import type { AssetType } from '../schemas.js'

const SEARCH_LIMIT = 10

export interface SearchCommandOptions {
  type?: AssetType
  baseUrl?: string
}

export async function searchCommand(query: string, opts: SearchCommandOptions): Promise<void> {
  const { client } = await getCliClient({ baseUrl: opts.baseUrl })

  const spinner = ora(`Searching "${query}"`).start()
  let results
  try {
    results = await client.asset.list({
      search: query,
      type: opts.type,
      limit: SEARCH_LIMIT,
      page: 1,
      sort: 'relevance',
    })
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : String(err))
    throw err
  }
  spinner.stop()

  if (results.items.length === 0) {
    console.log(chalk.dim('No matches.'))
    return
  }

  for (const item of results.items) {
    const desc = item.description ? chalk.dim(` — ${item.description}`) : ''
    console.log(`  ${chalk.cyan(item.name)} ${chalk.dim(`(${item.type})`)}${desc}`)
  }
}
