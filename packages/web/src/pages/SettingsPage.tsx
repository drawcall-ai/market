import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orpc } from '@/lib/rpc'
import { useSession } from '@/lib/auth-client'

export function SettingsPage() {
  const { data: session } = useSession()
  const [name, setName] = useState(session?.user?.name ?? '')
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const apiKeyOptions = orpc.user.getApiKey.queryOptions({ input: undefined })
  const { data: apiKeyData } = useQuery(apiKeyOptions)

  const updateProfile = useMutation(orpc.user.updateProfile.mutationOptions())

  const regenerateKey = useMutation(
    orpc.user.regenerateApiKey.mutationOptions({
      onSuccess: (data: any) => {
        setRevealedKey(data.key)
        queryClient.invalidateQueries({ queryKey: apiKeyOptions.queryKey })
      },
    }),
  )

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-medium">Profile</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            updateProfile.mutate({ name })
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={session?.user?.email ?? ''}
              disabled
              className="mt-1 w-full rounded-md border bg-gray-50 px-3 py-2 text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 focus:border-black focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* API Key */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-medium">API Key</h2>
        <p className="mb-4 text-sm text-gray-600">
          Use your API key to upload assets programmatically via the API.
        </p>

        {apiKeyData ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <code className="rounded-md bg-gray-100 px-3 py-2 text-sm">
                {revealedKey ?? `${apiKeyData.prefix}${'*'.repeat(24)}`}
              </code>
              {revealedKey && (
                <span className="text-xs text-yellow-600">
                  Copy this now — it won't be shown again
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setRevealedKey(null)
                regenerateKey.mutate(undefined)
              }}
              disabled={regenerateKey.isPending}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {regenerateKey.isPending ? 'Regenerating...' : 'Regenerate Key'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => regenerateKey.mutate(undefined)}
            disabled={regenerateKey.isPending}
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {regenerateKey.isPending ? 'Generating...' : 'Generate API Key'}
          </button>
        )}
      </div>
    </div>
  )
}
