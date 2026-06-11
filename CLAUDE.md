# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@cwa/nuxt` is a Nuxt 4 module providing a full UI and CMS for component-driven web apps backed by the [API Components Bundle](https://github.com/components-web-app/api-components-bundle). It ships as a Nuxt module with auto-imported composables, a Vue component library, Pinia stores, a real-time Mercure SSE layer, and an in-line admin/resource-management UI.

Package manager: **pnpm** (>=10.33.1 required).

## Commands

```bash
# First-time / after dependency changes
pnpm run dev:prepare        # compile tailwind + build stubs + nuxi prepare playground

# Development
pnpm run dev                # playground with HTTPS + Tailwind watch (concurrent)
pnpm run dev:http           # playground over HTTP only

# Build
pnpm run build              # clean, copy layer, module build, compile tailwind

# Lint
pnpm run lint
pnpm run lint:fix

# Tests
pnpm run test               # single run, verbose
pnpm run test:watch         # watch mode
pnpm run test:coverage      # with v8 coverage

# Type checking
pnpm run test:types         # vue-tsc on module + playground

# Tailwind (run independently when editing tailwind source)
pnpm run tailwind:main      # src/tailwind/tailwind-cwa.css → src/runtime/templates/assets/cwa.css
pnpm run tailwind:base      # src/tailwind/tailwind-base.css → src/runtime/templates/assets/base.css
```

To run a single test file: `pnpm vitest run --reporter=verbose src/path/to/file.spec.ts`

The compiled Tailwind CSS files are **committed to the repo**. Run `tailwind:main` / `tailwind:base` after editing Tailwind source; `build` and `dev:prepare` do this automatically.

## Architecture

### Entry points

| File | Role |
|------|------|
| `src/module.ts` | Nuxt module setup — registers pages, components, composables, plugins, server handlers, and generates `cwa-options.ts` from user config |
| `src/runtime/cwa.ts` | `Cwa` class — the single runtime object wiring together all services |
| `src/runtime/plugin.ts` | Nuxt plugin: instantiates `Cwa` (post-pinia), exposes `$cwa` via `useNuxtApp().$cwa` |
| `src/runtime/route-middleware.ts` | Global route middleware: fetches routes from the API on navigation |
| `src/layer/` | Nuxt layer extended by apps using the module (admin pages under `/_cwa/`, auth pages, root layout) |

### Service composition (`Cwa` class)

`Cwa` is constructed in the plugin and wires all services together. Public surface:

- `$cwa.resources` — `Resources`: reactive computed getters over the Pinia resources store
- `$cwa.resourcesManager` — `ResourcesManager`: CRUD operations (create, patch, delete) against the API
- `$cwa.auth` — `Auth`: login, logout, JWT handling, cookie management
- `$cwa.admin` — `Admin`: edit mode toggle, event bus (`mitt`), `resourceStackManager`
- `$cwa.siteConfig` — `SiteConfig`: reads/writes site-wide configuration
- `$cwa.forms` — `Forms`: form submission helpers
- Fetcher is private, exposed via route middleware and `fetchResource` / `fetchRoute` on resources

### Storage (Pinia)

All state lives in `src/runtime/storage/stores/`. Each store is a class with `state`, `actions`, and `getters` split into separate files, composed by a root `*-store.ts`. The `Storage` class (`src/runtime/storage/storage.ts`) instantiates all stores.

Stores: `resources`, `fetcher`, `mercure`, `apiDocumentation`, `auth`, `admin`, `error`, `siteConfig`.

### API layer (`src/runtime/api/`)

- `fetcher/cwa-fetch.ts` — thin `ofetch` wrapper targeting `apiUrl`
- `fetcher/fetcher.ts` — orchestrates resource/route fetching, manifests, nested resources, shallow fetching
- `fetcher/fetch-status-manager.ts` — tracks in-flight fetches and primary fetch state
- `mercure.ts` — SSE `EventSource` for real-time resource updates via the API's Mercure hub
- `auth.ts` — authentication flow
- `api-documentation.ts` — reads JSON-LD API docs to discover component types and metadata

### Resource types

Defined in `src/runtime/resources/resource-utils.ts`:

```
ROUTE            → /_/routes/
PAGE             → /_/pages/
LAYOUT           → /_/layouts/
PAGE_DATA        → /page_data/
COMPONENT_GROUP  → /_/component_groups/
COMPONENT_POSITION → /_/component_positions/
COMPONENT        → /component/
```

Use `ResourceTypeFromIri` / `getResourceTypeFromIri` to derive the type from an IRI — do not parse IRI strings manually.

### Admin (`src/runtime/admin/`)

- `Admin` — edit mode toggle, event bus (`redrawFocus`, `manageableComponentMounted`, `componentMounted`, `selectResource`, `reorder`)
- `ResourceStackManager` — maintains the stack of resources the user has clicked through (context for the manager panel)
- `ManageableResource` — per-component class that registers DOM elements and handles click events for admin selection
- `NavigationGuard` — blocks Nuxt navigation while admin operations are in progress

### Vue components

| Directory | Auto-import prefix | Notes |
|-----------|-------------------|-------|
| `src/runtime/templates/components/main/` | `Cwa` | Public — available to consuming apps |
| `src/runtime/templates/components/ui/` | `CwaUi` | Public UI primitives |
| `src/runtime/templates/components/core/` | *(none)* | Internal — import directly |
| `src/runtime/templates/components/utils/` | *(none)* | Internal — import directly |

Key components: `CwaComponentGroup` (renders a list of `ComponentPosition`s), `ResourceLoader` (dynamic component loader by IRI), `cwa-page.vue` (catch-all page template that fetches routes from the API).

### User-defined components (in consuming apps)

Apps place files under `app/cwa/` in their project:

```
app/cwa/components/<Name>/<Name>.vue      → CwaComponent<Name> (global)
app/cwa/components/<Name>/admin/*.vue     → admin panel manager tabs
app/cwa/components/<Name>/ui/*.vue        → UI variants selectable per component
app/cwa/layouts/<Name>.vue                → CwaLayout<Name> (global)
app/cwa/pages/<Name>.vue                  → CwaPage<Name> (global)
```

The module scans `admin/` and `ui/` subdirectories at build time and populates `managerTabs` / `ui` in the generated `cwa-options.ts`. Adding or removing these files in dev triggers a `builder:watch` hook that re-generates the options template automatically.

### Composables (`src/runtime/composables/`)

Auto-imported by the module via `addImportsDir`. Key ones:

- `useCwa()` — returns the `$cwa` instance
- `useCwaResource(iri, opts?)` — standard composable for CWA-managed Vue components; handles admin registration
- `useCwaResourceManageable(iri, opts?)` — lower-level; used internally by `ComponentGroup`
- `useCwaResourceModel(iri)` — two-way model binding for resource fields with optimistic patch

### Server (`src/runtime/server/`)

Registered by `module.ts` via `addServerHandler` / `addServerPlugin`:

- `server-middleware.ts` — reads auth cookies and proxies them upstream
- `server-plugin.ts` — Nitro plugin registered via `addServerPlugin`
- `cwa-urls.get.ts` — sitemap URL source (`/__sitemap__/cwa-urls`)
- `cwa-custom-sitemap.get.ts` — custom sitemap endpoint (`/__sitemap__/cwa-custom.xml`)
- `cwa-healthcheck.get.ts` — health endpoint (`/_cwa/healthcheck`)

**Note**: server files use direct imports (`import { createError } from 'h3'`) — they do not rely on Nitro auto-imports.

### Module options (`CwaModuleOptions`)

Configured in the consuming app's `nuxt.config.ts` under the `cwa` key:

- `resources` — per-resource-type config (`name`, `description`, `instantAdd`, `managerTabs`, `ui`, `defaultData`)
- `layouts` / `pages` / `pageData` — UI metadata for admin dropdowns
- `siteConfig` — default site-wide settings
- `pagesDepth` — depth of nested CWA route segments (default 4)
- `layoutName` — override the default `cwa-root-layout` layout

### Testing

Tests use **vitest** with `happy-dom` environment and `vitest-environment-nuxt`. The playground is used as the Nuxt `rootDir` for the test environment. Snapshot files are co-located with spec files (`.spec.ts.snap` next to `.spec.ts`). `setup.ts` at the repo root configures `@vue/test-utils` globals.

## Future: Nuxt UI Integration

**Feasibility:** Possible in principle, but blocked by a Tailwind v3 → v4 migration. The module currently uses **Tailwind v3** (compiled CSS files, `tailwind:main`/`tailwind:base` scripts, `cwa:` variant prefix — all v3 patterns). Nuxt UI v3 requires **Tailwind v4**, which uses a CSS-first `@import` approach with native cascade layers.

**CSS isolation mechanism:** Tailwind v4 supports `@import "tailwindcss" prefix(cwa)` to scope all generated utilities under a prefix — this is the right isolation primitive. The current v3 `cwa:` variant prefix is a different, incompatible approach.

**Dependency cascade concern:** Adding `@nuxt/ui` as a module dependency means every consuming app gets Nuxt UI as a transitive dep. Nuxt UI is an opinionated design system that could conflict with apps that already have their own UI libraries or CSS setup.

**Recommended scope:** Use Nuxt UI only for admin/internal components (resource manager panel, form inputs, modals, etc.) — not for public-facing components which consuming apps own. This limits the blast radius of the dependency.

**Planned migration path:**
1. Migrate the module's Tailwind build to v4 — refactor all admin component styles to use `prefix()` import isolation
2. Add `@nuxt/ui` scoped to admin components under the `cwa` prefix
3. Replace custom admin form components (`UInput`, `USelect`, `UModal`, etc.) with Nuxt UI equivalents

**Not a drop-in today** — treat as a milestone after the Tailwind v4 upgrade.
