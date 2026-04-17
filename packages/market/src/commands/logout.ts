import chalk from 'chalk'
import { clearConfig, getConfigPath } from '../config.js'

export async function logout(): Promise<void> {
  const existed = await clearConfig()
  if (existed) {
    console.log(chalk.green('Logged out.') + chalk.dim(` (${getConfigPath()} removed)`))
  } else {
    console.log(chalk.dim('Already logged out.'))
  }
}
