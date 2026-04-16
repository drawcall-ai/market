# Market

An asset marketplace. Users upload versioned assets — bundles of files with npm and asset dependencies — that are built into live examples and published after admin approval.

## Core Concepts

### Assets

An asset is the fundamental unit of content. It has:

- A unique **name**
- A **type** (generic, model, HDRI, material, etc.)
- **Semver versions** — each version contains:
  - **Source files** — the raw uploaded data (shape depends on asset type)
  - **npm dependencies** — packages from the npm registry
  - **Asset dependencies** — other assets in the market, declared as semver ranges (e.g. `^1.0.0`)

The type determines how the asset is uploaded and how its source is stored. On retrieval, every asset type is converted to the same unified shape: a file tree with a README.md, code files, and dependency declarations.

### Examples

Every asset has a corresponding **example** — a buildable project that demonstrates the asset. The example is itself an asset, named `{name}-example`. It automatically depends on its parent asset `{name}`.

This means examples are not a special concept — they are regular assets that flow through the same retrieval API, the same dependency resolution, and the same build pipeline. The only distinction is naming convention and the implicit dependency.

### Asset Types and Templates

Each asset type defines a **template** that maps the uploaded source into a full file tree. For typed assets, the template also generates the example asset. The source is stored as-is; the template is applied at retrieval time. This means templates can evolve without re-uploading assets.

| Type       | Upload Shape                          | Template Generates                              |
| ---------- | ------------------------------------- | ----------------------------------------------- |
| `generic`  | Zip containing asset files            | Passed through (no transformation)              |
| `model`    | A `.gltf` or `.glb` file             | Loader code, README, example asset              |
| `hdri`     | An `.hdr` or `.exr` file             | Environment setup, README, example asset         |
| `material` | PBR properties (color, roughness, …) | Material definition, README, example asset       |

For **generic** assets, the user provides the full file tree directly and must also upload the `{name}-example` asset separately. For typed assets, the template auto-generates both the asset and its example from the uploaded source.

### Versioning and Dependencies

Assets follow [semantic versioning](https://semver.org/). Dependencies on other assets are declared as semver ranges. At build and retrieval time, the system resolves these ranges against approved versions.

### Approval Workflow

All uploaded assets require admin approval before they are publicly visible:

1. User uploads an asset (via web UI or API).
2. The asset version is created with `approved: false`.
3. The example is **built immediately** on upload — the build output is stored but not publicly accessible.
4. An admin reviews the submission in the admin panel (`/admin`).
5. On approval, the asset and its built example become visible to all users.

Build errors are stored on the version record and surfaced in the admin panel.

## Separation of Concerns

The system is split into three independent layers: **upload/retrieval**, **install**, and **build**.

### 1. Upload and Retrieval

**Upload** accepts assets based on their type. Each type has its own upload shape:
- Generic assets are uploaded as a zip of files.
- Typed assets (model, HDRI, material) are uploaded via their specific file formats.

The raw source is stored directly. For typed assets, uploading a single file (e.g. a `.gltf`) creates both the asset and its `{name}-example` asset in the database.

**Retrieval** converts any asset — regardless of how it was uploaded — into a unified shape. It maps the asset type to its template and generates the full file tree on the fly. The retrieval API follows the [jsdelivr](https://www.jsdelivr.com/) pattern:

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/asset/{name}` | Asset metadata + list of all versions with approval status |
| GET | `/api/asset/{name}/{version}/tree` | Flat file listing of the generated file tree |
| GET | `/api/asset/{name}/{version}/raw/{path}` | Raw content of a single file |

Since examples are regular assets named `{name}-example`, they use the same endpoints:
- `/api/asset/my-model-example/1.0.0/tree`
- `/api/asset/my-model-example/1.0.0/raw/src/App.tsx`

There are no separate example-specific endpoints. The retrieval API is the same for all assets.

### 2. Install

Installing an asset means resolving its dependencies and writing everything into a local project. The install process is shared between the CLI (`npx @drawcall/market install`) and the server-side build service — both run the same logic.

**Step 1: Resolve asset versions** — Collect the target asset and all its transitive asset dependencies. Find a compatible version set across all of them using semver constraint resolution. Only approved versions are considered by default — if no approved version satisfies the constraints, the install fails. If no compatible set exists, the install fails with an error describing the conflict.

**Step 2: Resolve npm versions** — Collect all npm dependencies declared by every asset in the resolved set. Find a compatible version set across all of them using `semver.intersects`. If two assets require incompatible versions of the same npm package, the install fails.

**Step 3: Execute in parallel:**
- **npm dependencies** — Add the resolved npm dependencies to `package.json`, then run install using the detected package manager (detected via `nypm` — supports npm, pnpm, yarn, bun).
- **Asset files** — For each resolved asset, fetch its file tree and files via the retrieval API and write them to `./src/{assetName}/`.

### 3. Build

The build system uses the install layer. To build any asset (including examples), the build service:

1. Runs the **install** process described above — resolving all dependencies, downloading asset files, and collecting npm dependencies.
2. Runs a Vite build using the `v43` plugin, which handles entry point generation — the installed files are placed in the virtual filesystem and `v43` produces a runnable application.
3. Uploads the build output and captures a thumbnail screenshot.

The build logic is identical whether building an example or any other asset. For `my-model-example`, the install step resolves its dependency on `my-model` through the standard retrieval API, just like any other dependency.

If the build fails, the error is stored on the version and the asset remains unapproved.

## CLI

Install assets into a local project:

```bash
npx @drawcall/market install my-model
npx @drawcall/market install my-model@^2.0.0
npx @drawcall/market install my-model my-hdri some-material
```

By default, only approved versions are considered. If no approved version satisfies the constraints, the install fails. To include unapproved versions (e.g. for testing before admin approval):

```bash
npx @drawcall/market install my-model --unapproved
```

The CLI runs the same install process as the build service:

1. Resolves a compatible set of asset versions across all requested assets and their transitive dependencies.
2. Resolves a compatible set of npm dependency versions across all resolved assets.
3. In parallel:
   - Adds npm dependencies to `package.json` and runs install via the detected package manager.
   - Downloads asset files into `./src/{assetName}/` via the retrieval API.

No authentication is required — the CLI only reads approved assets through the public retrieval API. The `--unapproved` flag also requires no authentication; unapproved assets are accessible but not shown in the marketplace UI.

## Upload

### Web Upload (UI)

The `/upload` page provides tabs for each asset type:

- **Generic** — Upload a zip containing your file tree. The `{name}-example` asset must be uploaded separately.
- **Models** — Drag-and-drop a `.gltf` or `.glb` file. The template generates the asset and `{name}-example` automatically.
- **HDRIs** — Drag-and-drop an `.hdr` or `.exr` file.
- **Materials** — Configure PBR properties with a live preview.

All uploads require authentication (session or API key) and produce unapproved asset versions that enter the admin review queue. The example is built immediately on upload.

### API Upload

Assets can also be submitted programmatically:

```
POST /api/asset
Header: x-api-key: <your-api-key>
Content-Type: multipart/form-data

name=my-asset
version=1.0.0
type=generic
file=<zip>
```

Type-specific uploads:

```
POST /api/asset/model
POST /api/asset/hdri
POST /api/asset/material
```

Users can find their API key on the `/settings` page.

## API Endpoints

### Asset Retrieval

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/asset/{name}` | None | Asset metadata + all versions with approval status |
| GET | `/api/asset/{name}/{version}/tree` | None | File tree of the asset |
| GET | `/api/asset/{name}/{version}/raw/{path}` | None | Raw file content |

### Asset Upload

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST | `/api/asset` | Session/API key | Upload a generic asset (zip) |
| POST | `/api/asset/model` | Session/API key | Upload a model (.gltf/.glb) |
| POST | `/api/asset/hdri` | Session/API key | Upload an HDRI (.hdr/.exr) |
| POST | `/api/asset/material` | Session/API key | Upload a material |

### Admin

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/admin/unapproved` | Admin | List all unapproved asset versions |
| POST | `/api/asset/{name}/{version}/approve` | Admin | Approve an asset version |

### Users

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/users/profile` | Session | Get user profile |
| PATCH | `/api/users/profile` | Session | Update user profile |
| GET | `/api/users/api-key` | Session | Get current API key |
| POST | `/api/users/api-key/regenerate` | Session | Regenerate API key |

### Other

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/api/tags` | None | List all tags with usage counts |

## Pages

| Route | Description |
| ----- | ----------- |
| `/` | Homepage — browse and search approved assets |
| `/auth/signin` | Sign in |
| `/upload` | Upload assets (authenticated) |
| `/dashboard` | View your asset versions and their status |
| `/admin` | Review and approve pending assets (admin only) |
| `/settings` | Manage profile and API key |
| `/asset/[name]/[version]` | Asset detail page — file browser, README, example preview |

## Development

```bash
# Install dependencies (from monorepo root)
pnpm install

# Set up the database
pnpm --filter market db:generate
pnpm --filter market db:push
pnpm --filter market db:seed    # optional: seed with sample data

# Start development server
pnpm --filter market dev
```
