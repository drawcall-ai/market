import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/rpc'
import { ASSET_TYPE_LABELS, type AssetType } from '@drawcall/market'

export function DashboardPage() {
  const { data: assets, isLoading } = useQuery(orpc.user.myAssets.queryOptions({}))

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Assets</h1>
        <Link
          to="/upload"
          className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          Upload New
        </Link>
      </div>

      {!assets || assets.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-lg border bg-white">
          <p className="text-gray-500">You haven't uploaded any assets yet.</p>
          <Link
            to="/upload"
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            Upload Your First Asset
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Versions</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {assets.map((asset: any) => {
                const latestVersion = asset.versions[asset.versions.length - 1]
                const hasApproved = asset.versions.some((v: any) => v.approved)
                const hasPending = asset.versions.some((v: any) => !v.approved)
                const hasBuildError = asset.versions.some((v: any) => v.buildError)

                return (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/asset/${asset.name}/${latestVersion?.version ?? ''}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {asset.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {ASSET_TYPE_LABELS[asset.type as AssetType] ?? asset.type}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {asset.versions.length} version
                      {asset.versions.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {hasApproved && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            Approved
                          </span>
                        )}
                        {hasPending && (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                            Pending
                          </span>
                        )}
                        {hasBuildError && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                            Build Error
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
