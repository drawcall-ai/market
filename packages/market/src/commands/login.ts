import * as http from 'http'
import type { AddressInfo } from 'net'
import chalk from 'chalk'
import open from 'open'
import ora from 'ora'
import { createMarketClient } from '../client.js'
import { saveConfig, getConfigPath } from '../config.js'

export interface LoginOptions {
  baseUrl: string
  timeoutMs?: number
}

/**
 * Spins up a localhost HTTP server, opens the browser to {baseUrl}/cli-auth,
 * waits for the web app to redirect back with the key, saves it to config.
 */
export async function login(opts: LoginOptions): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 120_000
  const state = crypto.randomUUID()

  const { port, waitForKey, close } = await startCallbackServer(state, timeoutMs)

  const authUrl = new URL('/cli-auth', opts.baseUrl)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('callback', `http://127.0.0.1:${port}/callback`)

  console.log(chalk.dim(`If your browser doesn't open, visit:\n  ${authUrl.toString()}`))
  await open(authUrl.toString()).catch(() => {})

  const spinner = ora('Waiting for browser approval…').start()
  try {
    const key = await waitForKey

    spinner.text = 'Verifying key…'
    const verifyClient = createMarketClient({ baseUrl: opts.baseUrl, apiKey: key })
    const profile = await verifyClient.user.getProfile()
    if (!profile) {
      throw new Error('Key was not accepted by the server.')
    }

    await saveConfig({ apiKey: key, baseUrl: opts.baseUrl })
    spinner.succeed(`Logged in as ${chalk.cyan(profile.email)}`)
    console.log(chalk.dim(`  Key saved to ${getConfigPath()}`))
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : String(err))
    throw err
  } finally {
    close()
  }
}

async function startCallbackServer(
  expectedState: string,
  timeoutMs: number,
): Promise<{ port: number; waitForKey: Promise<string>; close: () => void }> {
  let resolveKey!: (k: string) => void
  let rejectKey!: (e: Error) => void
  const waitForKey = new Promise<string>((resolve, reject) => {
    resolveKey = resolve
    rejectKey = reject
  })

  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(400).end()
      return
    }
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname !== '/callback') {
      res.writeHead(404).end()
      return
    }
    const receivedState = url.searchParams.get('state')
    const receivedKey = url.searchParams.get('key')

    if (receivedState !== expectedState) {
      res.writeHead(400, { 'Content-Type': 'text/html' })
      res.end('<h1>Invalid state</h1><p>You can close this window.</p>')
      rejectKey(new Error('Invalid state parameter from callback.'))
      return
    }
    if (!receivedKey) {
      res.writeHead(400, { 'Content-Type': 'text/html' })
      res.end('<h1>Missing key</h1><p>You can close this window.</p>')
      rejectKey(new Error('Callback did not include a key.'))
      return
    }

    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<h1>Logged in!</h1><p>You can close this window.</p>')
    resolveKey(receivedKey)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address() as AddressInfo | null
  if (!address) throw new Error('Failed to bind local callback server.')

  const timer = setTimeout(() => {
    rejectKey(new Error(`Timed out after ${timeoutMs / 1000}s waiting for browser approval.`))
  }, timeoutMs)

  const close = () => {
    clearTimeout(timer)
    server.close()
  }

  return { port: address.port, waitForKey, close }
}
