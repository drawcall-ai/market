import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { orpc } from '@/lib/rpc'
import { useSession } from '@/lib/auth-client'

type Status = 'idle' | 'approving' | 'delivering' | 'success' | 'error'

/**
 * Approve-CLI page. Reached via `market login` opening
 *   /cli-auth?state=<uuid>&callback=http://127.0.0.1:<port>/callback
 * On approve we mint a new API key and redirect the browser to the callback
 * URL, which is served by the CLI's ephemeral localhost HTTP server.
 */
export function CliAuthPage() {
  const [params] = useSearchParams()
  const { data: session, isPending } = useSession()

  const state = params.get('state')
  const callback = params.get('callback')

  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const regenerateKey = useMutation(orpc.user.regenerateApiKey.mutationOptions())

  if (isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Loading…</div>
      </div>
    )
  }

  if (!session?.user) {
    const redirect = `/cli-auth?${params.toString()}`
    return <Navigate to={`/auth/signin?redirect=${encodeURIComponent(redirect)}`} replace />
  }

  if (!state || !callback || !isSafeCallback(callback)) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="text-xl font-bold text-red-600">Invalid CLI auth request</h1>
        <p className="mt-2 text-sm text-gray-600">
          This link is missing or has an invalid callback URL.
        </p>
      </div>
    )
  }

  async function approve() {
    setStatus('approving')
    setErrorMessage(null)
    try {
      const { key } = await regenerateKey.mutateAsync(undefined)
      setStatus('delivering')

      const url = new URL(callback!)
      url.searchParams.set('state', state!)
      url.searchParams.set('key', key)
      // Navigate the window to the CLI's localhost callback. The CLI serves a
      // "Logged in!" page in response, so the user sees a success state.
      window.location.href = url.toString()
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-xl font-bold">Authorize the market CLI</h1>
        <p className="mt-2 text-sm text-gray-600">
          A local <code className="rounded bg-gray-100 px-1 text-xs">market</code> CLI is requesting
          access to your account as <span className="font-medium">{session.user.email}</span>.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Approving will generate a new API key and send it to your machine. Any existing API key
          will be replaced.
        </p>

        {status === 'error' && errorMessage && (
          <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
        )}

        <button
          onClick={approve}
          disabled={status === 'approving' || status === 'delivering' || status === 'success'}
          className="mt-6 w-full rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {status === 'idle' && 'Approve'}
          {status === 'approving' && 'Approving…'}
          {status === 'delivering' && 'Sending key to CLI…'}
          {status === 'success' && 'Done — return to your terminal'}
          {status === 'error' && 'Try again'}
        </button>
      </div>
    </div>
  )
}

/**
 * Only allow loopback callbacks on http (the CLI's ephemeral server), to
 * avoid arbitrary-URL redirect attacks that would leak the API key.
 */
function isSafeCallback(raw: string): boolean {
  try {
    const url = new URL(raw)
    const isLoopback =
      url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]'
    return url.protocol === 'http:' && isLoopback
  } catch {
    return false
  }
}
