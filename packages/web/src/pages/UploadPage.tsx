import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import type { AssetType } from '@drawcall/market'
import { API_BASE } from '@/lib/api'

const ACCEPTED_EXTENSIONS = ['.gltf', '.glb', '.hdr', '.exr', '.mp3', '.wav', '.ogg', '.flac']

function detectAssetType(filename: string): AssetType | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.gltf') || lower.endsWith('.glb')) return 'model'
  if (lower.endsWith('.hdr') || lower.endsWith('.exr')) return 'hdri'
  if (
    lower.endsWith('.mp3') ||
    lower.endsWith('.wav') ||
    lower.endsWith('.ogg') ||
    lower.endsWith('.flac')
  )
    return 'music'
  return null
}

function filenameToName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const TYPE_LABELS: Record<string, string> = {
  model: '3D Model',
  hdri: 'HDR Environment',
  music: 'Audio',
}

export function UploadPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false)
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const handleFile = useCallback(
    (f: File) => {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase()
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setError('Unsupported file type. Please upload a glTF, HDR, or audio file.')
        return
      }
      setError('')
      setFile(f)
      if (!nameManuallyEdited) {
        setName(filenameToName(f.name))
      }
    },
    [nameManuallyEdited],
  )

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  function removeFile() {
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!file) {
        throw new Error('Please select a file')
      }

      const assetType = detectAssetType(file.name)
      if (!assetType) {
        throw new Error('Unsupported file type. Please upload a glTF, HDR, or audio file.')
      }

      const formData = new FormData()
      formData.append('name', name)
      formData.append('version', '1.0.0')
      formData.append('file', file)
      formData.append('description', description)

      const endpoint =
        assetType === 'model'
          ? `${API_BASE}/api/asset/model`
          : assetType === 'hdri'
            ? `${API_BASE}/api/asset/hdri`
            : `${API_BASE}/api/asset/music`

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data: { error?: string } = await res.json()
        throw new Error(data.error?.toString() ?? 'Upload failed')
      }

      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const detectedType = file ? detectAssetType(file.name) : null

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Upload Asset</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />

        {/* Drop zone */}
        {!file ? (
          <button
            type="button"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileRef.current?.click()}
            className={`w-full rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
              dragging
                ? 'border-black bg-gray-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <svg
              className="mx-auto h-10 w-10 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-gray-700">
              {dragging ? 'Drop file here' : 'Drag & drop a file here, or click to browse'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              glTF (.gltf, .glb), HDR (.hdr, .exr), Audio (.mp3, .wav, .ogg, .flac)
            </p>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-gray-50 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-xs font-medium text-gray-600 uppercase">
              {file.name.split('.').pop()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">
                {formatFileSize(file.size)}
                {detectedType && (
                  <span className="ml-2 inline-block rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                    {TYPE_LABELS[detectedType] ?? detectedType}
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={removeFile}
              className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setNameManuallyEdited(true)
            }}
            placeholder="my-asset"
            required
            pattern="^[a-z0-9][a-z0-9-]*[a-z0-9]$"
            className="mt-1 w-full rounded-md border px-3 py-2 focus:border-black focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">Lowercase alphanumeric with hyphens</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            required
            className="mt-1 w-full rounded-md border px-3 py-2 focus:border-black focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !file}
          className="w-full rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Uploading...' : 'Upload Asset'}
        </button>
      </form>
    </div>
  )
}
