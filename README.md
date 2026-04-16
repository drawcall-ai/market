# Market

An asset marketplace. Users upload versioned assets — bundles of files with npm and asset dependencies — that are built into live examples and published after admin approval.

## Core Concepts

### Assets

An asset has a unique **name**, a **type** (generic, model, HDRI, material, music), and **semver versions**. Each version contains source files, npm dependencies, and asset dependencies (declared as semver ranges).

The type determines upload shape. On retrieval, every asset type is converted to a unified file tree via **templates** applied at read time — templates can evolve without re-uploading assets.

| Type       | Upload Shape                          | Template Generates                              |
| ---------- | ------------------------------------- | ----------------------------------------------- |
| `generic`  | Zip containing asset files            | Passed through (no transformation)              |
| `model`    | `.gltf` or `.glb` file               | Loader code, README, example asset              |
| `hdri`     | `.hdr` or `.exr` file                | Environment setup, README, example asset         |
| `material` | PBR properties (color, roughness, ...) | Material definition, README, example asset       |
| `music`    | `.mp3`, `.wav`, `.ogg`, `.flac`      | Audio player, README                            |

### Examples

Every asset has a corresponding **example** named `{name}-example` — a buildable project demonstrating the asset. Examples are regular assets that flow through the same API, dependency resolution, and build pipeline. The only distinction is naming convention and an implicit dependency on the parent.

### Approval Workflow

1. User uploads an asset (web UI or API).
2. The version is created with `approved: false`; the example is built immediately.
3. An admin reviews in `/admin` and approves.
4. The asset and its built example become publicly visible.

## Architecture

### Packages

| Package | Description |
| ------- | ----------- |
| `@drawcall/market` (`packages/market/`) | Typed oRPC client, contracts, schemas, constants, dependency resolver, CLI binary |
| `@market/api` (`packages/api/`) | Hono + oRPC server on Cloudflare Workers |
| `@market/web` (`packages/web/`) | React frontend |
| `@market/build-service` (`packages/build-service/`) | Vite build pipeline for examples |
| `@market/db` (`packages/db/`) | Drizzle ORM schema (D1/SQLite) |

### Dependency Graph

```
@drawcall/market  (zero workspace deps)
  ^          ^              ^
@market/api  @market/web    @market/build-service
  ^
@market/db
```

`@drawcall/market` is the single source of truth for the API surface. It defines oRPC contracts, Zod validation schemas, and TypeScript types. All other packages import from it — it has no workspace dependencies itself.

### API

All API access is typesafe via [oRPC](https://orpc.dev). The contract is defined in `@drawcall/market` and implemented by `@market/api`.

**Routers:** `asset`, `upload`, `admin`, `user`, `tag`, plus a separate `internal` router for the build service.

The only non-oRPC HTTP route is `GET /api/asset/:name/:version/build/*` which serves built example output for iframe embedding.

### Install (CLI + Build Service)

Installing an asset:

1. **Resolve** — find compatible versions across all transitive asset and npm dependencies using semver constraint solving.
2. **Download** — fetch file trees and raw files via the oRPC client.
3. **Write** — place assets into `./src/{assetName}/`, merge npm deps into `package.json`, run the package manager.

The CLI (`npx @drawcall/market install`) and build service run the same resolve logic from `@drawcall/market`. The CLI adds the filesystem operations; the build service adds a Vite build step and uploads the output.

## CLI

```bash
npx @drawcall/market install my-model
npx @drawcall/market install my-model@^2.0.0
npx @drawcall/market install my-model my-hdri some-material
npx @drawcall/market install my-model --unapproved  # include unapproved versions
```

No authentication required — the CLI reads through the public API.

## Pages

| Route | Description |
| ----- | ----------- |
| `/` | Browse and search approved assets |
| `/auth/signin` | Sign in |
| `/upload` | Upload assets (authenticated) |
| `/dashboard` | Your asset versions and their status |
| `/admin` | Review and approve pending assets (admin) |
| `/settings` | Profile and API key management |
| `/asset/[name]/[version]` | Asset detail — file browser, README, example preview |

## Development

```bash
pnpm install
pnpm dev          # starts API (Wrangler) + web (Vite)
pnpm typecheck    # all packages
```
