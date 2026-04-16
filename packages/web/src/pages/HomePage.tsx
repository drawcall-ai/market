import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/rpc'
import { API_BASE } from '@/lib/api'
import { ASSET_TYPE_LABELS, type AssetType } from '@drawcall/market'

export function HomePage() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [type, setType] = useState<AssetType | undefined>()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery(
    orpc.asset.list.queryOptions({
      input: { page, limit: 20, search: search || undefined, type },
    }),
  )

  const { data: tagsData } = useQuery(orpc.tag.list.queryOptions({ input: undefined }))

  return (
    <div>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Asset Market</h1>
        <p className="text-gray-600">Browse and discover 3D assets, materials, HDRIs, and more.</p>
      </div>

      {/* Search and filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <input
          type="text"
          placeholder="Search assets... (press Enter)"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setSearch(searchInput)
              setPage(1)
            }
          }}
          className="flex-1 rounded-md border px-4 py-2 focus:border-black focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            onClick={() => {
              setType(undefined)
              setPage(1)
            }}
            className={`rounded-md px-3 py-2 text-sm ${
              !type ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setType(key)
                setPage(1)
              }}
              className={`rounded-md px-3 py-2 text-sm ${
                type === key ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      {tagsData && tagsData.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {tagsData.map((tag: any) => (
            <span key={tag.id} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
              {tag.name} ({tag.count})
            </span>
          ))}
        </div>
      )}

      {/* Asset grid */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-500">Loading assets...</div>
        </div>
      ) : data?.items.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-gray-500">No assets found</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.items.map((asset: any) => (
              <Link
                key={asset.id}
                to={`/asset/${asset.name}/${asset.latestVersion}`}
                className="group overflow-hidden rounded-lg border bg-white transition hover:shadow-md"
              >
                <div className="aspect-video bg-gray-100">
                  {asset.thumbnailKey ? (
                    <img
                      src={`${API_BASE}/api/asset/${asset.name}/${asset.latestVersion}/raw/thumbnail.png`}
                      alt={asset.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      No preview
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-medium group-hover:text-blue-600">{asset.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {ASSET_TYPE_LABELS[asset.type as AssetType] ?? asset.type}
                    </span>
                    <span className="text-xs text-gray-400">v{asset.latestVersion}</span>
                    {!asset.approved && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Pending approval
                      </span>
                    )}
                  </div>
                  {asset.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-500">{asset.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="flex items-center px-4 text-sm text-gray-600">
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
