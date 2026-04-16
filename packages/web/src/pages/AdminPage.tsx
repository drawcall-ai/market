import { Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orpc } from '@/lib/rpc'

export function AdminPage() {
  const queryClient = useQueryClient()
  const unapprovedOptions = orpc.admin.listUnapproved.queryOptions({ input: undefined })
  const { data: unapproved, isLoading } = useQuery(unapprovedOptions)

  const approve = useMutation(
    orpc.admin.approve.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: unapprovedOptions.queryKey })
      },
    }),
  )

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Admin — Approval Queue</h1>

      {!unapproved || unapproved.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border bg-white">
          <p className="text-gray-500">No pending approvals</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Asset</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Version</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Uploader</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Build</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {unapproved.map((item: any) => (
                <tr key={item.versionId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/asset/${item.assetName}/${item.version}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {item.assetName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm">{item.version}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.assetType}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.ownerName}</td>
                  <td className="px-4 py-3">
                    {item.buildError ? (
                      <span
                        className="cursor-help rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700"
                        title={item.buildError}
                      >
                        Failed
                      </span>
                    ) : item.buildOutputKey ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Built
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        approve.mutate({
                          assetName: item.assetName,
                          version: item.version,
                        })
                      }
                      disabled={approve.isPending}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
