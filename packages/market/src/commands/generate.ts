import chalk from 'chalk'
import ora from 'ora'
import { getCliClient } from '../cli-client.js'
import { generateAndWait } from '../generate.js'
import { resolve } from '../resolve.js'
import { install as runInstall } from '../install.js'
import type { AssetType } from '../schemas.js'

export interface GenerateCommandOptions {
  type?: AssetType
  cwd?: string
  baseUrl?: string
  unapproved?: boolean
}

export async function generateCommand(
  description: string,
  opts: GenerateCommandOptions,
): Promise<void> {
  const { client } = await getCliClient({ baseUrl: opts.baseUrl, requireAuth: true })

  const spinner = ora(`Generating "${description}"`).start()
  try {
    const generated = await generateAndWait(
      client,
      { description, type: opts.type },
      {
        onProgress: (msg) => {
          spinner.text = msg
        },
      },
    )

    spinner.text = `Resolving ${generated.assetName}@${generated.version}`
    const resolution = await resolve(
      client.asset,
      [{ name: generated.assetName, range: generated.version }],
      { includeUnapproved: opts.unapproved ?? false },
    )

    await runInstall(client, resolution, {
      cwd: opts.cwd,
      onProgress: (msg) => {
        spinner.text = msg
      },
    })

    spinner.succeed(
      `Installed ${chalk.cyan(generated.assetName)}${chalk.dim('@' + generated.version)}`,
    )
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : String(err))
    throw err
  }
}
