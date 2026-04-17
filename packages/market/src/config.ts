import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { z } from 'zod'

const configSchema = z.object({
  apiKey: z.string().startsWith('mk_'),
  baseUrl: z.string().url().optional(),
})

export type Config = z.infer<typeof configSchema>

function configDir(): string {
  if (process.platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'drawcall-market')
  }
  const base = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config')
  return path.join(base, 'drawcall-market')
}

function configPath(): string {
  return path.join(configDir(), 'config.json')
}

export async function loadConfig(): Promise<Config | null> {
  try {
    const raw = await fs.readFile(configPath(), 'utf-8')
    const parsed = configSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function saveConfig(config: Config): Promise<void> {
  const dir = configDir()
  await fs.mkdir(dir, { recursive: true })
  const file = configPath()
  await fs.writeFile(file, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 })
}

export async function clearConfig(): Promise<boolean> {
  try {
    await fs.unlink(configPath())
    return true
  } catch {
    return false
  }
}

export function getConfigPath(): string {
  return configPath()
}
