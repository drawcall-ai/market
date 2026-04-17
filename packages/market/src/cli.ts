#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { createMarketClient } from './client.js'
import { resolve, ResolutionError, type ResolveResult } from './resolve.js'
import { install } from './install.js'

const program = new Command()

program.name('market').description('Install assets from the drawcall.ai market').version('0.1.0')

program
  .command('install')
  .description('Install assets into your project')
  .argument('<assets...>', 'Assets to install (e.g. my-model, my-model@^2.0.0)')
  .option('--unapproved', 'Include unapproved versions', false)
  .option(
    '--api <url>',
    'API base URL',
    process.env.MARKET_API_URL ?? 'https://api.market.drawcall.ai',
  )
  .option('--cwd <dir>', 'Project directory', process.cwd())
  .action(async (assetArgs: string[], opts) => {
    const client = createMarketClient({ baseUrl: opts.api })

    // Parse asset[@range] arguments
    const requests = assetArgs.map((arg) => {
      const atIdx = arg.indexOf('@', 1)
      if (atIdx > 0) {
        return { name: arg.slice(0, atIdx), range: arg.slice(atIdx + 1) }
      }
      return { name: arg, range: '*' }
    })

    // Resolve
    console.log(chalk.bold('Resolving dependencies...\n'))

    let resolution: ResolveResult
    try {
      resolution = await resolve(client.asset, requests, {
        includeUnapproved: opts.unapproved,
      })
    } catch (err) {
      if (err instanceof ResolutionError) {
        console.error(chalk.red('Resolution failed:\n') + err.message)
        process.exit(1)
      }
      throw err
    }

    console.log(chalk.green(`  ${resolution.assets.length} asset(s) resolved:\n`))
    for (const asset of resolution.assets) {
      console.log(`    ${chalk.cyan(asset.name)}${chalk.dim('@' + asset.version)}`)
    }

    const npmCount = Object.keys(resolution.npmDependencies).length
    if (npmCount > 0) {
      console.log(chalk.green(`\n  ${npmCount} npm dependenc${npmCount === 1 ? 'y' : 'ies'}:\n`))
      for (const [pkg, range] of Object.entries(resolution.npmDependencies)) {
        console.log(`    ${pkg} ${chalk.dim(range)}`)
      }
    }

    // Install
    console.log(chalk.bold('\nInstalling...\n'))

    await install(client, resolution, {
      cwd: opts.cwd,
      onProgress: (msg) => console.log(chalk.dim(`  ${msg}`)),
    })

    console.log(chalk.bold.green('\nDone!'))
  })

program.parse()
