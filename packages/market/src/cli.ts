#!/usr/bin/env node

import { Command, Option } from 'commander'
import chalk from 'chalk'
import { ASSET_TYPES, type AssetType } from './schemas.js'
import { installCommand } from './commands/install.js'
import { searchCommand } from './commands/search.js'
import { generateCommand } from './commands/generate.js'
import { login } from './commands/login.js'
import { logout } from './commands/logout.js'
import { NotLoggedInError } from './cli-client.js'

const program = new Command()

const DEFAULT_BASE_URL = 'https://api.market.drawcall.ai'

const typeOption = new Option('--type <type>', 'Filter by asset type').choices([...ASSET_TYPES])

const apiOption = new Option('--api <url>', 'API base URL').default(
  process.env.MARKET_API_URL,
  'from MARKET_API_URL / config / default',
)

program.name('market').description('Install assets from the drawcall.ai market').version('0.1.0')

program
  .command('login')
  .description('Authenticate with the market via your browser')
  .addOption(apiOption)
  .action(async (opts: { api?: string }) => {
    await login({ baseUrl: opts.api ?? DEFAULT_BASE_URL })
  })

program
  .command('logout')
  .description('Remove the local API key')
  .action(async () => {
    await logout()
  })

program
  .command('install')
  .description(
    'Install assets. Each arg is tried as an exact name, then a semantic search, then auto-generated.',
  )
  .argument('<assets...>', 'Asset names or natural-language descriptions')
  .addOption(typeOption)
  .addOption(apiOption)
  .option('--unapproved', 'Include unapproved versions', false)
  .option('--cwd <dir>', 'Project directory', process.cwd())
  .action(
    async (
      args: string[],
      opts: { type?: AssetType; api?: string; unapproved: boolean; cwd: string },
    ) => {
      await installCommand(args, {
        type: opts.type,
        baseUrl: opts.api,
        unapproved: opts.unapproved,
        cwd: opts.cwd,
      })
    },
  )

program
  .command('search')
  .description('Search the market. Prints up to 10 ranked results.')
  .argument('<query>', 'Natural-language query')
  .addOption(typeOption)
  .addOption(apiOption)
  .action(async (query: string, opts: { type?: AssetType; api?: string }) => {
    await searchCommand(query, { type: opts.type, baseUrl: opts.api })
  })

program
  .command('generate')
  .description('Generate a new asset from a description and install it.')
  .argument('<description>', 'Description of the asset to generate')
  .addOption(typeOption)
  .addOption(apiOption)
  .option('--cwd <dir>', 'Project directory', process.cwd())
  .action(async (description: string, opts: { type?: AssetType; api?: string; cwd: string }) => {
    await generateCommand(description, {
      type: opts.type,
      baseUrl: opts.api,
      cwd: opts.cwd,
    })
  })

program.parseAsync().catch((err) => {
  // Commands that own a spinner print the error via spinner.fail() and rethrow,
  // so we only print here when nothing else did.
  if (err instanceof NotLoggedInError) {
    console.error(chalk.red(err.message))
  }
  process.exit(1)
})
