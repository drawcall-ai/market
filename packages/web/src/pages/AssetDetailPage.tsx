import { useState, useEffect } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import Markdown from 'react-markdown'
import { client, orpc } from '@/lib/rpc'
import { API_BASE } from '@/lib/api'
import { ASSET_TYPE_LABELS, type AssetType } from '@drawcall/market'

export function AssetDetailPage() {
  const { name, version } = useParams<{ name: string; version?: string }>()
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)

  const { data: asset, isLoading } = useQuery(
    orpc.asset.getByName.queryOptions({
      input: { name: name! },
      enabled: !!name,
    }),
  )

  const currentVersion =
    version ?? asset?.versions.find((v: any) => v.approved)?.version ?? asset?.versions[0]?.version

  const { data: tree } = useQuery(
    orpc.asset.getVersionTree.queryOptions({
      input: { name: name!, version: currentVersion! },
      enabled: !!name && !!currentVersion,
    }),
  )

  const currentVersionData = asset?.versions.find((v: any) => v.version === currentVersion)

  // Build output is stored on the asset's own version record
  const hasBuild = !!currentVersionData?.buildOutputKey
  const isApproved = !!currentVersionData?.approved

  // Fetch README content from the file tree
  const [readmeContent, setReadmeContent] = useState<string | null>(null)
  useEffect(() => {
    setReadmeContent(null)
    if (!name || !currentVersion || !tree) return
    const hasReadme = tree.some((e: any) => e.path === 'README.md')
    if (!hasReadme) return

    client.asset
      .getRawFile({ name, version: currentVersion, path: 'README.md' })
      .then((blob) => blob.text())
      .then(setReadmeContent)
      .catch(() => null)
  }, [name, currentVersion, tree])

  useEffect(() => {
    setFileContent(null)
    if (!selectedFile || !name || !currentVersion) return

    client.asset
      .getRawFile({ name, version: currentVersion, path: selectedFile })
      .then((blob) => blob.text())
      .then(setFileContent)
      .catch(() => setFileContent('Failed to load file'))
  }, [selectedFile, name, currentVersion])

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>
  }

  if (!asset) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">Asset not found</div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Example preview — only shown when a build exists AND version is approved */}
      {hasBuild && isApproved ? (
        <div className="overflow-hidden rounded-lg border bg-white">
          <iframe
            src={`${API_BASE}/api/asset/${name}-example/${currentVersion}/build/index.html`}
            className="h-[400px] w-full border-0"
            title={`${name} example preview`}
          />
        </div>
      ) : !isApproved ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-amber-300 bg-amber-50">
          <p className="text-sm text-amber-700">Example available after approval</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{asset.name}</h1>
            <div className="mt-2 flex items-center gap-3">
              <span className="rounded bg-gray-100 px-2 py-1 text-sm">
                {ASSET_TYPE_LABELS[asset.type as AssetType] ?? asset.type}
              </span>
              {currentVersion && <span className="text-sm text-gray-500">v{currentVersion}</span>}
              {!isApproved && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Pending approval
                </span>
              )}
              {asset.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
                >
                  {tag}
                </span>
              ))}
            </div>
            {asset.description && <p className="mt-3 text-gray-600">{asset.description}</p>}
          </div>

          {/* File browser */}
          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="border-b px-4 py-3">
              <h2 className="font-medium">Files</h2>
            </div>
            <div className="flex">
              {/* File tree */}
              <div className="w-64 border-r">
                {tree?.map((entry: any) => (
                  <button
                    key={entry.path}
                    onClick={() => setSelectedFile(entry.path)}
                    className={`block w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                      selectedFile === entry.path ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    {entry.path}
                  </button>
                ))}
              </div>

              {/* File content */}
              <div className="flex-1 p-4">
                {selectedFile ? (
                  <div>
                    <div className="mb-2 text-sm font-medium text-gray-500">{selectedFile}</div>
                    <pre className="overflow-x-auto rounded-md bg-gray-50 p-4 text-sm">
                      <code>{fileContent ?? 'Loading...'}</code>
                    </pre>
                  </div>
                ) : (
                  <div className="flex h-48 items-center justify-center text-gray-400">
                    Select a file to view its contents
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* README */}
          {readmeContent && (
            <div className="mt-6 overflow-hidden rounded-lg border bg-white p-6">
              <div className="prose prose-sm prose-gray max-w-none">
                <Markdown>{readmeContent}</Markdown>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Install */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-2 font-medium">Install</h3>
            <div className="rounded-md bg-gray-50 p-3">
              <code className="text-sm">npx @drawcall/market install {asset.name}</code>
            </div>
          </div>

          {/* Versions */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 font-medium">Versions</h3>
            <div className="space-y-2">
              {asset.versions.map((v: any) => (
                <div
                  key={v.id}
                  className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
                    v.version === currentVersion ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    v{v.version}
                    {!v.approved && (
                      <span
                        className="inline-block h-2 w-2 rounded-full bg-amber-400"
                        title="Pending approval"
                      />
                    )}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Dependencies */}
          {currentVersionData && (
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-3 font-medium">Dependencies</h3>
              {Object.keys(JSON.parse(currentVersionData.npmDependencies)).length > 0 ? (
                <div className="space-y-1">
                  {Object.entries(
                    JSON.parse(currentVersionData.npmDependencies) as Record<string, string>,
                  ).map(([pkg, ver]) => (
                    <div key={pkg} className="flex justify-between text-sm text-gray-600">
                      <span>{pkg}</span>
                      <span className="text-gray-400">{ver}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No dependencies</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
