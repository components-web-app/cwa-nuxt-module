# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Principles

### Principle of least exposure
Only add store getters, composable properties, or fetched resource types when there is a concrete consumer for them. Do not speculatively expose data "in case it's needed". Each addition should be justified against a real requirement and covered by a test.

### TDD process
All feature work follows this cycle:
1. Explain what we're about to do and why, with a proposed Vitest test
2. Agree on whether the test is correct (Daniel is the author and has deep system knowledge — expect discussion)
3. Write or adjust the test, then write the code to make it pass
4. Keep CLAUDE.md current throughout — update mid-task if the design shifts, not just at the end

---

## Overview

`@cwa/nuxt` is a Nuxt 4 module providing a full UI and CMS for component-driven web apps backed by the [API Components Bundle](https://github.com/components-web-app/api-components-bundle). It ships as a Nuxt module with auto-imported composables, a Vue component library, Pinia stores, a real-time Mercure SSE layer, and an in-line admin/resource-management UI.

Companion project: **API Components Bundle** (Symfony) — local source at `/Users/danielwest/Documents/GitHub/_CWA/api-components-bundle`. Example consuming project: **SRNTE** — local source at `/Users/danielwest/Documents/GitHub/srnte`.

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

### Coverage progress

**Target: 70% statement coverage** (5753 statements total, ~4027 needed).

| Date | Stmt % | Notes |
|------|--------|-------|
| Baseline | ~42% | Before coverage push |
| 2026-06-10 | 44.56% | actions.ts, resources.ts, storage.ts, cwa-resource-model.ts |
| 2026-06-11 | 47.97% | cwa-select-input, cwa-collection-resource, cwa-image, cwa-image-resource, ComponentGroup.Util.Positions debounce, resource-stack-manager listenCurrentIri |
| 2026-06-11 | 48.44% | resource-stack-manager isComponentGroupDisabled + filterDisabledStackItems (3rd constructor arg was missing from test factory) |

**Key patterns established:**
- Lodash `debounce` with fake timers: `vi.useFakeTimers()` + `vi.runAllTimers()` (or `vi.advanceTimersByTime(n)` to avoid triggering other timers)
- `vi.hoisted()` cannot use `ref()`/`reactive()` — use plain objects `{ value: ... }` or `var` + factory in `vi.mock()`
- Reactive route mock: `var mockRoute: {...}` + `mockRoute = reactive({...})` inside `vi.mock('vue-router', async () => {...})`
- Vue `computed` caches — make mock data `reactive()` so computed re-evaluates when mock state changes

**High-ROI remaining targets (uncovered statements est.):**
- `resources-manager.ts` (33.2%) — ~380 statements, very complex class (CRUD, confirm dialogs)
- `resource-stack-manager.ts` (42.12%) — ~100+ statements (many private methods/watchers)
- `cwa.ts` (69.76%) — ~25 statements
- `api-documentation.ts` (68.75%) — ~25 statements
- `html-content.ts` (0%) — ~77 lines, creates Vue apps dynamically (hard to unit test)
- `useDataResolver.ts` (0%) — ~121 lines, uses Vue internals (hard to unit test)

## Planned Feature: Nested Sub-Pages

> **Status: API manifest layer complete and tested. Module implementation not yet started.**
> Companion plan: see `## Feature: Nested Sub-Pages` in the API Components Bundle CLAUDE.md (`/Users/danielwest/Documents/GitHub/_CWA/api-components-bundle/CLAUDE.md`).

### What we want

Pages support sub-pages. A conference page renders a tab bar and a child-page slot; child pages fill that slot. Structure is admin-manageable and reusable across projects. Rendering depth is driven by data (the manifest's `resource_iris` depth groups), not URL structure.

### How the API models it

`AbstractPage` (base of both `Page` and `AbstractPageData`) has two fields for hierarchy:

- `$parentPage: ?Page` — parent is a `Page` entity (mutually exclusive with `$parentPageData`)
- `$parentPageData: ?AbstractPageData` — parent is any `AbstractPageData` subclass (mutually exclusive with `$parentPage`)

**There is no `$nested` boolean.** Having a parent means the page is nested inside it — the relationship itself is the signal. A page exists with a parent or without one; there is no intermediate "parent but not nested" state that serves a real use case.

Both fields carry `#[Groups(['Route:manifest:read'])]`. The parent entity's `$route` also carries that group. `RouteNormalizer` walks the normalised structure and emits `resource_iris` as a **`string[][]`** grouped by depth: index 0 = root/shallowest resources, last index = the requested page's resources. The `parentPage`/`parentPageData` fields are the depth boundaries. All IRIs across all groups are fetched in parallel.

### Route lifecycle (critical context)

Routes are the **publication mechanism**. A `PageData` entity exists and is editable in the admin before it has a `Route`. The parent/child relationship is set on `PageData` during drafting — before either page has a public URL. This is why hierarchy lives on `AbstractPage`, not `Route`.

### Rendering: `<CwaPage />`

Nested page rendering uses a single mechanism for all access contexts: `<CwaPage />`, which is data-driven, not URL-depth-driven.

**For public routes:** `cwa-page.vue` reads the manifest's `resource_iris` depth groups. Index 0 = root page resources, last index = the requested page's resources. `<CwaPage />` renders the stack from root to leaf. Keepalive is managed by the component — if depth-0 resources are unchanged on navigation, the parent layer is preserved without re-render.

**For admin/draft access:** A nested page in draft has no public Route. `cwa-page.vue` is accessed via the entity IRI directly. The module walks the `parentPage`/`parentPageData` chain from the fetched resource to build the same depth stack — no manifest, same rendering component.

There is no URL-segment-depth dependency. The URL can be anything; depth is always derived from data.

---

### What already exists in this module

- `module.ts` → `createDefaultCwaPages()` generates a nested Nuxt route tree of `cwaPage0` → `cwaPage1` → ... (up to `pagesDepth`, default 4). Multi-segment URLs work — `/a/b/c` maps to `{cwaPage0: ['a'], cwaPage1: ['b'], cwaPage2: ['c']}`. These are URL routing definitions, separate from rendering depth.
- `fetcher.ts` → `fetchNestedResources()` recursively follows resource IRIs via `resourceTypeToNestedResourceProperties`. `parentPage` and `parentPageData` need adding to the `PAGE_DATA` and `PAGE` entries.
- `cwa-page.vue` is the existing catch-all page component. All rendering changes happen here.

### Planned changes (Nuxt module)

**Step 1 — Update manifest consumption for `resource_iris: string[][]`:**
`resource_iris` is now an array of arrays. Update any code that reads `resource_iris` to iterate over groups. Flatten to `string[]` where needed for the existing prefetch logic. This step must not change any visible behaviour — it is a structural adaptation only.

**Step 2 — Add `parentPage`/`parentPageData` to `resourceTypeToNestedResourceProperties`:**
Add both fields to the `PAGE_DATA` and `PAGE` entries. Used by `fetchNestedResources()` for individually-fetched resources (admin/draft access, deep chains beyond manifest depth).

**Step 3 — Store: expose parent chain getters:**
Add getters so `cwa-page.vue` can answer "given this page IRI, what is its full parent chain and what depth is it at?"

**Step 4 — Make `cwa-page.vue` depth-aware:**
`cwa-page.vue` currently always renders `$cwa.resources.pageIri.value`. Change it to render the correct resource for its depth position. For manifest-loaded resources, depth = index in `resource_iris`. For individually-fetched resources, depth = parent chain length from `parentPage`/`parentPageData`. Depth 0 → root page; last index → the requested page.

**Step 5 — Keepalive in `cwa-page.vue`:**
When navigating between pages at the same nesting level (e.g. `/conference/programme` → `/conference/speakers`), depth-0 resources are unchanged — preserve the parent layer. Only re-render the changed depth level.

**Step 6 — Admin UI:**
Generic `parentPage`/`parentPageData` picker in the page/pageData admin panel. Detectable from the API schema. No per-project code needed.

**Step 7 — Tests (Vitest):**
- Manifest consumption: `resource_iris` `string[][]` is correctly parsed and all IRIs are prefetched
- Fetcher: parent chain followed via `resourceTypeToNestedResourceProperties`
- Store: parent chain getters correctly derived
- `cwa-page.vue`: correct resource selected at each depth (manifest path and IRI-walk path)

### Design decisions

- **No `$nested` boolean** — parent = nested, always. The presence of `$parentPage`/`$parentPageData` is the signal.
- **Single rendering mechanism** — `<CwaPage />` (`cwa-page.vue`) handles all contexts. Depth comes from manifest `resource_iris` groups or from walking the `parentPage`/`parentPageData` chain. No URL-segment-depth dependency.
- **`resource_iris` is `string[][]`** — index = rendering depth, root first. The module reads the array index directly; no client-side traversal needed to determine depth.
- **Route concatenation is recommended, not required** — `RouteGenerator` prefixes child paths for clean URLs; the rendering mechanism does not depend on URL structure.
- **Hierarchy on AbstractPage, not Route** — must be settable before publication.
- **Keepalive by depth group** — if the same IRIs appear at depth 0 across two navigations, the parent layer is preserved without re-render.

---

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
