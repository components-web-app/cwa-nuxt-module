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

> **Status: design agreed, not yet implemented.**
> Companion plan: see `## Planned Feature: Nested Sub-Pages` in the API Components Bundle CLAUDE.md (`/Users/danielwest/Documents/GitHub/_CWA/api-components-bundle/CLAUDE.md`).

### What we want

Pages should support sub-pages. A conference page at `/best-conference-ever` renders a tab bar and a `<NuxtPage />` slot; child pages (`/best-conference-ever/programme`, etc.) fill that slot. Structure is admin-manageable and reusable across projects.

### How the API models it

`AbstractPage` (base of all `PageData` entities) has two distinct fields:
- `$parentRoute: ?Route` — **URL construction only**. When a route is generated for this page, prefix the path with this route's path. No rendering implication on its own.
- `$nested: bool` — **rendering instruction**. When `true`, the module must fetch and render the parent page template and display this page inside it at the next depth level.

These are intentionally separate. A page can have a prefixed URL (`$parentRoute` set) without being rendered nested (`$nested = false`) — useful for organisational URL structure or SEO without changing the render model. `$nested = true` with no `$parentRoute` is invalid and should be caught by a validation constraint in the API.

**These fields are currently not serialized** (no `@Groups` annotation). The first API bundle change is to add them to `Route:manifest:read`. Once done, the manifest response for a child route will include `parentRoute` (as an IRI) and `nested: true/false`.

### Route lifecycle (critical context)

Routes are the **publication mechanism**. A `PageData` entity exists and is editable in the admin before it has a `Route`. The parent/child relationship is set on `PageData` during drafting — before either page has a public URL. This is why hierarchy lives on `PageData`, not `Route`.

### What already exists in this module

- `module.ts` → `createDefaultCwaPages()` already generates a **nested Nuxt route tree** of `cwaPage0` → `cwaPage1` → ... (up to `pagesDepth`, default 4). Multi-segment URLs are already captured — `/a/b/c` maps to params `{cwaPage0: ['a'], cwaPage1: ['b'], cwaPage2: ['c']}`.
- `fetcher.ts` → `fetchNestedResources()` already recursively follows resource IRIs via `resourceTypeToNestedResourceProperties`. Adding `parentRoute` to the `PAGE_DATA` entry in that map is all that's needed to trigger automatic parent fetching.
- All route levels share the same `cwa-page.vue` — so `<NuxtPage />` in a parent template naturally renders another `cwa-page.vue` instance for the child level.

### Planned changes (Nuxt module)

**Step 1 — Follow `parentRoute` in the fetch graph (`src/runtime/resources/resource-utils.ts`):**
Add `parentRoute` to the `PAGE_DATA` entry in `resourceTypeToNestedResourceProperties`. The fetcher will then automatically follow the `parentRoute` IRI to fetch the parent `Route`, then call `GET /routes_manifest/<parent-id>` as a **separate request**. Parent and child manifests are cached and invalidated independently — a change to the parent layout must not invalidate the child manifest, and vice versa. Never embed parent resource data inside the child manifest response.

**Step 2 — Store parent/child resources separately:**
The resource store currently exposes a single `pageIri`. Add `parentPageIri` (and `childPageIri`) getters so `cwa-page.vue` instances can each render the right resource.

**Step 3 — Make `cwa-page.vue` depth-aware:**
`cwa-page.vue` currently always renders `$cwa.resources.pageIri.value`. It needs to determine its depth in the route tree using `useRoute().matched` (the index of the current matched route entry corresponds to which `cwaPage*` param it serves). Depth 0 → parent page resource; depth 1+ → child page resource.

**Step 4 — `<NuxtPage />` in consuming app templates (no module change needed):**
Consuming app page templates (e.g. `ConferencePageTemplate.vue`) place `<NuxtPage />` wherever child content should appear. No new `<CwaPage />` component required — standard Nuxt composition works because the nested route tree is already in place.

**Step 5 — Admin UI:**
The route/page admin panel should show a nullable "parent route" picker for any `PageData` entity (detectable because the API schema will expose `parentRoute` as a field on all `AbstractPageData`-derived types). This is a generic change — no per-project admin code.

**Step 6 — Tests (Vitest):**
- Fetcher: given a manifest response with `nested: true` and `parentRoute` IRI, verify the parent chain is fetched
- Store getters: verify `parentPageIri` and `childPageIri` are correctly derived
- `cwa-page.vue`: verify depth-aware resource selection at each route nesting level

### Design decisions

- **`<NuxtPage />` not a new `<CwaPage />` component** — The nested Nuxt route tree is already in place; `<NuxtPage />` just works once `cwa-page.vue` is depth-aware. Avoids reinventing a Nuxt primitive.
- **Hierarchy on PageData, not Route** — See "Route lifecycle" above. Must be settable in draft state before publication.
- **Automatic parent fetch via existing `fetchNestedResources` machinery** — Adding `parentRoute` to the fetch graph is a one-line change that fits naturally into the existing recursive fetch model.

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
