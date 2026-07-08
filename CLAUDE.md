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

**Target: 70% statement coverage — ✅ ACHIEVED.** Last recorded: **71.0%** (5021/7071 statements, 2026-06-28). Branches 65.5%, functions 65.5%, lines 71.5%.

**Key patterns established:**
- `vi.mock('#imports')` does NOT intercept compiled SFC auto-imports — use `mockNuxtImport('fnName', () => impl)` from `@nuxt/test-utils/runtime` instead. Also mock `useError` and `useRoute` when testing `useHead` title logic to prevent happy-dom localStorage errors polluting `useError()`.
- Lodash `debounce` with fake timers: `vi.useFakeTimers()` + `vi.runAllTimers()` (or `vi.advanceTimersByTime(n)` to avoid triggering other timers)
- `vi.hoisted()` cannot use `ref()`/`reactive()` — use plain objects `{ value: ... }` or `var` + factory in `vi.mock()`
- Reactive route mock: `var mockRoute: {...}` + `mockRoute = reactive({...})` inside `vi.mock('vue-router', async () => {...})`
- Vue `computed` caches — make mock data `reactive()` so computed re-evaluates when mock state changes
- `vi.clearAllMocks()` in `beforeEach` is critical when capturing listeners/callbacks from `mock.calls` — stale calls from prior tests cause `find()` to return the wrong callback
- Capturing Vue watcher callbacks: `vi.spyOn(vue, 'watch').mockImplementation((_source, cb) => { watchCallback = cb; return vi.fn() })`
- Private TypeScript class getters: access via `(instance as any).prop` at runtime despite compile-time `private` modifier

**Files brought to ~100% during the 70% push (2026-06-28):** `api/auth.ts`, `admin/manageable-resource.ts`, `admin/resource-stack-manager.ts`, `resources/resources-manager.ts`, `server/server-middleware.ts`, `composables/popper.ts`, `composables/component/html-content.ts`, `templates/components/core/useDataResolver.ts`, and the admin Vue components (`ResourceManager`, `ComponentFocus`, `LayoutPageOverlay`, `Header`, `DataPage`, `DynamicPage`, `ListContent`, `PageAdminModal`, `PageDataAdminModal`, `RoutesTab`).

**Largest remaining 0% file (intentionally skipped):** `templates/components/ui/BackgroundParticles.vue` (~379 statements) — canvas particle animation, low value to unit-test.

---

## Nested Sub-Pages

> **Status: Complete.** All steps done including RoutesTabManage prefix/suffix redesign, cascade child paths, outbound forward UI, and auto-fallback `<CwaPage />`.
> Companion plan: API Components Bundle CLAUDE.md (`/Users/danielwest/Documents/GitHub/_CWA/api-components-bundle/CLAUDE.md`).

### How the API models hierarchy

`AbstractPage` (base of both `Page` and `AbstractPageData`) has:

- `parentPage: ?Page` — parent is a `Page` entity (mutually exclusive with `parentPageData`)
- `parentPageData: ?AbstractPageData` — parent is any `AbstractPageData` subclass

**There is no `nested` boolean.** Having a parent IS the signal. Both fields are in `Route:manifest:read`.

### Manifest format

`GET /_/resource_manifest/{id}` returns `{ "resource_iris": NestedJsonStructure[] }` — outer array indexed by rendering depth (root first); each depth is a recursive tree node `{ iri, children }` preserving component containment:

```json
{
  "resource_iris": [
    { "iri": "/_/routes//conference", "children": [ { "iri": "/_/page_data/parent-uuid", "children": [ { "iri": "/_/pages/parent-template-uuid", "children": [ { "iri": "/_/component_groups/cg-uuid", "children": [] } ] } ] } ] },
    { "iri": "/_/routes//conference/programme", "children": [ { "iri": "/_/page_data/child-uuid", "children": [ { "iri": "/_/pages/child-template-uuid", "children": [] } ] } ] }
  ]
}
```

- `{id}` starting with `/` → resolved as Route path; UUID → resolved as Page or AbstractPageData entity (admin/draft access)
- `resourceTree` (the raw `NestedJsonStructure[]`) and the derived flat `irisByDepth: string[][]` are both stored in `FetchManifestInterface` — set immediately when the manifest HTTP response arrives, before `fetchBatch`
- `fetchComplete` gates `isFetchResolving` (not `irisByDepth`) — see `getter-utils.ts`

> **✅ Migrated to the nested per-depth manifest (module #250, API `api-components-bundle` #197).**
> `resource_iris` is now `NestedJsonStructure[]` — outer array by depth (root first); each depth is a recursive `{ iri, children }` tree (children always present; empty for leaves; `iri` is a bespoke DTO field, not `@id`). Preserves component containment for future placeholder/skeleton rendering.
>
> **What landed (module side):**
> - `NestedJsonStructure` type + `resourceTree?: NestedJsonStructure[]` on `FetchManifestInterface` (`storage/stores/fetcher/state.ts`) — the raw tree is retained for the *future* placeholder work; **no rendering change yet**.
> - Pure `flattenManifestNode(node): string[]` (`storage/stores/fetcher/manifest-utils.ts`, unit-tested) — node `iri` + all descendants' `iri`, depth-first.
> - Construction changed, **semantics unchanged**: `irisByDepth: string[][]` is derived by flattening each depth's tree (`resourceIris.map(flattenManifestNode)`) in the store action; `fetchBatch` input is `resourceTree.flatMap(flattenManifestNode)` in `fetcher.ts`; `_iriToDepth`/`_depthPaths` in `fetch-status-manager.ts` flatten the tree for the same maps. All `pageIriAtDepth`/early-switch consumers in `resources.ts` read `irisByDepth` unchanged.
> - `setManifestIrisByDepth` event now carries `{ token, resourceIris: NestedJsonStructure[] }` (was `irisByDepth: string[][]`).
> - Fetcher spec manifest fixtures updated to the nested shape.
>
> **Deliberate follow-up (not done):** per-node placeholder metadata (UI name, dimensions, position sort…) — do not add fields to `NestedJsonStructure` until that work starts. The retained `resourceTree` is the hook for it.
>
> **API emit reference:** each depth node's `iri` is the resource IRI; `children` are the nested/related resource IRIs reachable without crossing the `parentPage`/`parentPageData` boundary (route → pageData → page → componentGroups → positions → components). Blank-node/internal IRIs are excluded (same exclusions as the old flat list).

### Rendering

- `cwa-page.vue` provides `depth = 0`, renders `<CwaPage />`
- `<CwaPage />` injects `'cwa-page-depth'`, renders `pageIriAtDepth(depth)` via `ResourceLoader` with prefix `CwaPage`, provides `depth + 1`
- Consuming app page templates place `<CwaPage />` wherever the child page slot should appear
- Auto-fallback: if depth N template lacks `<CwaPage />` but depth N+1 resources exist, a fallback `<CwaPage :auto-fallback="true" />` is appended after mount
- KeepAlive wraps `<ResourceLoader>` with `:key="pageIri"` — depth-0 stays mounted during sibling navigation via early-switch

**Template pattern for reading PageData fields:**

```ts
const pageDataIri = inject<ComputedRef<string | undefined>>('cwa-page-data-iri')
const { resource } = useCwaResource(pageDataIri)
```

`CwaPage.vue` provides `'cwa-page-data-iri'` at each depth. Returns `undefined` for Page-backed depths. `pageDataProperty` positions are resolved server-side — the module sees a `component` IRI, never a `pageDataProperty` string on the public path.


### Design decisions (reference)

- **No `$nested` boolean** — parent = nested; `parentPage`/`parentPageData` presence is the signal
- **Single rendering mechanism** — `<CwaPage />` handles all contexts; depth from `irisByDepth`, not URL structure
- **`resource_iris` is `NestedJsonStructure[]`** — outer array = rendering depth (root first); each depth a `{ iri, children }` tree. Flattened per-depth into `irisByDepth: string[][]` for existing consumers; raw tree retained as `resourceTree` for future placeholder rendering
- **Manifest for both public and admin** — UUID-based manifest collapses 4+ serial round trips into one parallel batch
- **`irisByDepth` set before batch starts** — decouples "we know depth structure" from "batch complete"
- **Early-switch is depth-0 aware** — `displayFetchStatus` checks `irisByDepth[0]` root page against `currentIds`; covers first visits (wait), return visits (switch immediately), sibling nav (parent renders, child loads progressively)
- **Route concatenation recommended, not required** — rendering never depends on URL structure
- **Hierarchy on AbstractPage, not Route** — settable before publication (before any route exists)

---

## Tailwind v4

The module uses **Tailwind v4** (`tailwindcss: ^4.2.4`, `@tailwindcss/postcss: ^4.2.4`, `@tailwindcss/vite: ^4.2.4`). The build is CSS-first — no `tailwind.config.js`. All configuration lives in `src/tailwind/tailwind-cwa.css`.

**CSS isolation:** All utilities are scoped under a `cwa:` prefix via v4's `prefix()` import:

```css
@import 'tailwindcss/theme' layer(theme) prefix(cwa);
@import 'tailwindcss/utilities' prefix(cwa);
```

Every Tailwind class in the module must use the `cwa:` prefix (e.g. `cwa:flex`, `cwa:bg-dark`). The compiled output is committed at `src/runtime/templates/assets/cwa.css`.

**Custom theme** is declared in `@theme {}` blocks. **Plugins** use `@plugin` directive. **Base reset** (`tailwind-base.css`) imports only `tailwindcss/preflight` layer(base).

**Build:** `postcss src/tailwind/tailwind-cwa.css -o ./src/runtime/templates/assets/cwa.css` via `@tailwindcss/postcss`.

---

## Future: CWA Admin UI Component Kit (#236)

The goal is a polished, consistent component kit for the admin UI with no third-party design system dependency.

**Why not Nuxt UI:** A module dependency forces it as a transitive dep on all consuming apps. Nuxt UI injects its own theme tokens globally — a consuming app's Nuxt UI config (colours, fonts, spacing) would bleed into and override admin UI styles. The `cwa:` prefix isolation only protects Tailwind utilities; it cannot protect against a shared Nuxt UI runtime.

**Approach:** Self-contained component library scoped entirely within this module, styled exclusively with `cwa:` prefixed Tailwind utilities. Nuxt UI's source is a good structural reference — its slot-based composition and headless-first primitives are patterns worth following, implemented natively.

**Surface areas:**
- **Modal UI** — inputs, selects, textareas, radio tab groups, checkboxes, buttons, info fields, section labels (`src/runtime/templates/components/core/admin/form/`)
- **Standalone admin pages** (`src/layer/pages/_cwa/`) — list views, data tables, form layouts
- **Manager bar** — resource manager panel tab bars, stack breadcrumbs, focus overlays; themeable base components
- **Base primitives** — tabs (headless, composable), dropdowns, badges, tooltips

**Scope:** Admin-only. Public-facing CWA components remain unstyled.

---

---

## Open GitHub Issues

All open issues from [components-web-app/cwa-nuxt-module](https://github.com/components-web-app/cwa-nuxt-module/issues). Last synced 2026-06-26.

**[#244](https://github.com/components-web-app/cwa-nuxt-module/issues/244) — DX: `useCwaLayout()` composable** ✅ Complete
`useCwaLayout(opts?)` in `src/runtime/composables/cwa-layout.ts`. Returns `{ layout, uiClassNames }`. Auto-applies `uiClassNames` via shared `useCwaAutoClass`. Opt out: `{ autoClass: false }`. Passive detection mirrors `useCwaResource`. Playground and components-web-app template updated.

**[#236](https://github.com/components-web-app/cwa-nuxt-module/issues/236) — Feature: CWA Admin UI Component Kit**
See `## Future: CWA Admin UI Component Kit` above.

**[#253](https://github.com/components-web-app/cwa-nuxt-module/issues/253) — Bug: selecting a large component auto-scrolls to its top even when in view** ✅ Fixed
`isElementOutsideViewport` (`admin/resource-stack-manager.ts`) now returns true only when the element does **not overlap** the visible region (entirely above `yOffset`, below `visibleBottom`, or off the sides) instead of the old "any edge outside" (`top < yOffset || bottom > visibleHeight || …`), which was always true for anything taller than the viewport. A large element that straddles the viewport is left in place, so selecting a big HTML Content area no longer yanks to its top when the bottom is already in view.

**[#254](https://github.com/components-web-app/cwa-nuxt-module/issues/254) — Bug: text-selection drag ending outside an inline editor deselects the component** ✅ Fixed
Highlighting text in an inline editor (TipTap `HtmlContent`) and releasing the mouse over a parent component fired a `click` on the common ancestor, stealing the selection. `ManageableResource.clickListener` (`admin/manageable-resource.ts`) now ignores a `click` when there's a non-collapsed `window.getSelection()` (the tail of a drag-select) — genuine clicks collapse the selection on mousedown so they're unaffected; `contextmenu` left unguarded.

**[#247](https://github.com/components-web-app/cwa-nuxt-module/issues/247) — Admin UI CSS isolation: app global element styles bleed into the admin UI**
Consuming-app global element CSS (`h1/h2/h3`, `a`, `button`, …) restyles the CWA admin UI. Two compounding causes: (1) CWA's compiled CSS loads into a low-priority `@layer cwa`, and **unlayered** app CSS beats every layer — so a plain `h1 { color: red }` outranks `.cwa\:text-light` despite lower specificity; (2) much of the admin UI is bare semantic tags (`<h3>` in `header/_parts/Menu.vue`, `<p>/<b>` in `RoutesTabManage.vue`) with no scoped defense. No isolation boundary exists today. Recommended fix (under #236): a `.cwa-admin` root wrapper + scope CWA utilities under it (specificity win) + scoped defensive reset + layer-order guidance. Shadow DOM rejected as too heavy.

**[#157](https://github.com/components-web-app/cwa-nuxt-module/issues/157) — Clone a resource**
Admin UI functionality to duplicate an existing resource (page, component, etc.).

**[#251](https://github.com/components-web-app/cwa-nuxt-module/issues/251) — Feature: `CwaComponentGroup` emits `componentsLoaded` / `componentsUpdated`** ✅ Complete (closed)
`CwaComponentGroup` **Vue-emits** `componentsLoaded` once all of the group's **own** positions resolve to a persisted component in a terminal API state (`SUCCESS`/`ERROR`, not `IN_PROGRESS`), then a **distinct** `componentsUpdated` (debounced) on later persisted add/publish/remove. **Payload = `{ component, position }[]`** (component IRI + its position IRI). Locked decisions: Vue emits (not the bus); pairs payload; distinct update event; own-positions-only (nested groups emit their own). Temporary/unpersisted (`__new__` / `_metadata.adding`) components are **excluded** (never fire); errored/absent components count as terminal (don't hang the event) but are **omitted from the payload**. Logic lives in the testable `useComponentGroupEvents` (`ComponentGroup.Util.Events.ts`), wired in `ComponentGroup.vue`.

**[#252](https://github.com/components-web-app/cwa-nuxt-module/issues/252) — DX: multiple uploadable file fields + rename Image APIs to File/Uploadable** ✅ Complete (closed)
Multiple file fields were a faff (admin) or structurally unsupported (display). **Display side ✅ done** (hard-swap rename, pre-alpha): `withImage`/`useCwaImage`/`useCwaImageResource`/`ImageOpsType` **removed** → `withFile`/`useCwaFile`/`FileOpsType`; `withFile()` exposes its field under a single `files` map keyed by `fileProp` (reactive entries) and `useCwaComponent`'s merge accumulates the `files` key; per-field `useCwaFileField(props, { fileProp })` returns the flat refs. CLI scaffold type `'image'`→`'file'`. See `## Composable pipeline design → Built-in plugins`. **Admin side ✅ done (bind only):** `useCwaResourceUpload` now returns a typed `bind` object (`CwaResourceUploadBind`) to spread onto `CwaUiFormFile` (`v-bind="upload.bind"`) — covers `v-model`/`fileExists`/`disabled`/`change`/`delete`, leaving `label`/`accept` per field; default `fileDisplayType` `'Image'`→`'File'`. Deliberately **no** `<CwaResourceFileField>` wrapper and **no** `useCwaResourceUploads` — keep each field a separate composable call so fields can use different UI (avoid a monolithic component). Fully-auto `<CwaResourceFileFields>` rendering (zero declaration) was **dropped by decision** — not building it.

**[#248](https://github.com/components-web-app/cwa-nuxt-module/issues/248) — Replace deprecated `installModule` with `moduleDependencies`**
`@nuxt/kit`'s `installModule` is `@deprecated Use module dependencies`. `module.ts` uses `await installModule('nuxt-og-image')` in `setup`. Migrate to the `moduleDependencies` field on `defineNuxtModule` and drop the import. Mechanical; verify OG-image + sitemap handlers still work.

**[#249](https://github.com/components-web-app/cwa-nuxt-module/issues/249) — Position-restricted components (`explicitAllowOnly`)** ✅ Complete (closed) — only cloning (#157) respecting it remains
Let a component **type** be opt-in only: hidden from the add dialog and rejected unless a group's `allowedComponents` explicitly lists its type IRI. Per-type, metadata-driven — declared as the Silverback class attribute `#[Silverback\ExplicitAllowOnly]`, flowing into component **type metadata**. The API already enforces the rule server-side but per-instance (`AbstractComponent::isPositionRestricted()` + `ComponentPositionValidator`); that method **is superseded and should be removed** (base + all subclass overrides) in favour of `explicitAllowOnly`. Work: (1) API — **✅ done** (api-components-bundle #196): declared via a Silverback class attribute `#[Silverback\ExplicitAllowOnly]` read by an `AttributeReader` (the bundle's own attribute system; does not affect the module, which only reads the emitted docs key), `isPositionRestricted()` removed, `VersionedDocumentationNormalizer` emits `explicitAllowOnly: true` on flagged `supportedClass` entries, and `ComponentPositionValidator` applies the reader on **both** placement paths — `validateDirectComponent` (placed component) **and** `validateDynamicPosition` (the pageDataProperty's resolved component class), so the dynamic path can no longer bypass the rule server-side. (2) module — **✅ implemented (dev)**: `explicitAllowOnly` added to `ApiDocumentationComponentMetadata`, read from the Hydra `supportedClass` in `getComponentMetadata` (absent ⇒ false); the pure `isComponentAllowedInGroup` helper (`_parts/available-components.ts`) is used by **both** placement paths — `AddComponentDialog.findAvailableComponents` (direct) **and** `useDynamicPositionSelectOptions.getPropertyOptions` (dynamic page-data-property positions) — hiding restricted types from groups that don't list them. The add dialog's Insert action is also gated by the pure `canInsertSelection` helper (`_parts/add-component-selection.ts`) so a dynamic position can't be inserted without both a chosen data type and field. Cloning (#157) must still respect it. See `## allowedComponents format contract`.

**Locked interface contract (module ⇄ bundle):** the flag is exposed as a boolean under the exact key **`explicitAllowOnly`** on each component's Hydra `supportedClass` entry, in the API docs the module already fetches (same docs that yield `isPublishable`). Class-level (not a `supportedProperty`), keyed by the same `title`/resourceName the module keys on; **absent ⇒ `false`**; no extra request. `getComponentMetadata` reads `supportedClass[n].explicitAllowOnly` with a `false` fallback, so the front-end can ship independently and activates once the bundle emits the key. `allowedComponents` (group, collection-IRI/type-level) and `ComponentPositionValidator` (server = source of truth) are unchanged. **Confirmed (bundle #196):** the docs use bare keys (`supportedClass` with each entry's bare `title`), and the bundle emits a bare `explicitAllowOnly` boolean on flagged entries — no JSON-LD `@context` alias needed; `getComponentMetadata`'s existing `supportedClass[n].explicitAllowOnly === true` read is live against the real API.

**[#245](https://github.com/components-web-app/cwa-nuxt-module/issues/245) — Investigate: do redirects fail on rapid repeated clicks?**
Diagnostic. Surfaced during the redirect flash fix. Static tracing suggests the redirect resolution logic is correct; any remaining symptom is likely a `route-middleware.ts` navigation-timing race (`waitForMiddleware` / `_processingMiddleware` / `navigateTo`). Reproduce first (needs the #246 harness); close + delete the stale `todo` if no bug exists. See `## Bug: flash of blank page ... ✅ Fixed → Follow-up`.

**[#246](https://github.com/components-web-app/cwa-nuxt-module/issues/246) — Integration/e2e tests with recorded API responses**
Stand up a replay layer: record real API responses (routes, manifests, nested batches, redirects, 404/401/500, Mercure `link` headers) into committed cassettes and replay them at the `ofetch`/`cwa-fetch.ts` boundary so the full pipeline (fetcher → stores → middleware → render) runs deterministically with no live API. Enables end-to-end regressions the unit suite structurally can't catch — the redirect flash fix, the #245 navigation race, nested sub-pages, error-page takeover.

**[#241](https://github.com/components-web-app/cwa-nuxt-module/issues/241) — Bug: TipTap bubble/floating menu obscured by CWA overlay**
TipTap v3 dropped Tippy.js in favour of `@floating-ui/dom`; `tippyOptions` is silently ignored. Menu renders inside the editor's stacking context, below `--cwa-z-index-overlay: 750`. `appendTo: () => document.body` breaks positioning; `strategy: 'fixed'` + inline z-index stops the menu appearing entirely. Root cause unknown — next step is diagnosing whether `getShouldShow` (focus detection), `updatePosition` coordinates, or a stacking context issue is responsible. File: `playground/app/components/TipTapHtmlEditor.vue`.

**[#242](https://github.com/components-web-app/cwa-nuxt-module/issues/242) — Test coverage: reach 70% statement coverage** ✅ Complete
Reached **71.0%** statement coverage (2026-06-28). See `### Coverage progress` above for the files covered.

---

## Bug: flash of blank page when a primary fetch resolves to a redirect / page-less route ✅ Fixed

**Reported from:** SRNTE (`/next-conference` route). Investigated & fixed 2026-06-30.

### Symptom
Navigating *through* a route that immediately redirects elsewhere — a redirect Route resource, or a non-CWA Nuxt page that calls `navigateTo` in middleware — briefly blanked the currently-displayed page before the destination page painted.

### Root cause
`displayFetchStatus` (`src/runtime/resources/resources.ts`) was already correct: while a new primary fetch is in progress it keeps the previously-rendered page visible, falling back to `resolvedSuccessFetchStatus` until the new page is ready.

The gap was in `finishFetch` (`src/runtime/storage/stores/fetcher/actions.ts`): when **any** primary fetch finished it was promoted to `primaryFetch.successToken` and the previous success token deleted — with no check that the finished fetch resolved to a renderable page. A redirect Route resource (`redirectPath`, no `page`) therefore became the displayed success state, so `getPageIriByFetchStatus` / `getLayoutIriByFetchStatus` returned `undefined` and the page rendered blank until the redirect *target's* fetch completed.

### Fix (landed)
The redirect is signalled explicitly rather than inferred. `fetcher.ts`'s `doRedirect` branch already aborts the fetch token (`api/fetcher/fetcher.ts`); it now passes an **abort reason**: `abortFetch(token, 'redirect')`.

- `FetchStatus` carries `abortReason?: FetchAbortReason` (`'redirect'`) — `storage/stores/fetcher/state.ts`
- `abortFetch(event: { token, reason? })` stores the reason — `storage/stores/fetcher/actions.ts`
- `FetchStatusManager.abortFetch(token, reason?)` forwards it — `api/fetcher/fetch-status-manager.ts`
- `finishFetch` retains the previous page: when the finishing token was aborted **as a redirect** *and* is still the current `fetchingToken`, it clears `fetchingToken`, drops the redirect fetch, and leaves the previous `successToken` + its resources untouched. The redirect **target** fetch ("C") becomes the new primary fetch and takes over when it resolves.

**Why this is safe for errors:** only redirects are aborted. A 404/401/500 primary fetch is *not* aborted, so it falls through to normal promotion and surfaces via `showError` (Nuxt global error takeover, `storage/stores/resources/actions.ts`). If the redirect *target* itself fails, the user sees that error — they are never stranded on the old page. Covered by regression tests in `actions.spec.ts` ("redirect retention" describe), `fetch-status-manager.spec.ts`, and `fetcher.spec.ts`.

### App-side mitigation (still valid in SRNTE, keeps `/next-conference` as a stable URL)
1. Point the in-app "Next Conference" nav link directly at `nextConference.routePath` (as `HeroSection.vue` already does) so in-app navigation never hops through the redirect route.
2. Mark `next-conference.vue` with `definePageMeta({ cwa: { disabled: true } })` so a direct/external hit doesn't fire a doomed primary fetch.

The module fix above means any API-driven redirect Route resource is robust without these per-app workarounds.

### Follow-up (separate, unconfirmed) — [#245](https://github.com/components-web-app/cwa-nuxt-module/issues/245)
The original `route-middleware.ts:64` todo — "redirects do not work if clicking a redirect route quickly multiple times" — was investigated and is **not** addressed by the flash fix. Static tracing suggests the redirect *resolution* logic is correct and any remaining symptom is a middleware navigation-timing race (`waitForMiddleware` / `_processingMiddleware` / `navigateTo`), not a fetcher-store concern. Opened as #245 to confirm whether a bug exists (reproduce first) before writing speculative code.

---

## `allowedComponents` format contract

The `:allowed-components` prop on `<CwaComponentGroup>` accepts **component collection IRIs** — relative paths without the API path prefix (e.g. `'/component/navigation_links'`). The synchroniser normalises these to the prefixed format before storing or comparing.

**Do not pass PHP FQCNs to the prop.**

| Layer | Input format | Conversion |
|---|---|---|
| `<CwaComponentGroup :allowed-components>` prop | Prefix-free IRI (e.g. `/component/navigation_links`) | Synchroniser adds prefix before PATCH/POST |
| API PATCH `allowedComponents` field | Prefixed IRI or PHP FQCN | Server converts FQCN → IRI automatically |
| `CwaFixtureBuilder->group('nav', allow: [NavigationLink::class])` | PHP FQCN | Builder converts FQCN → IRI before persisting |

**IRI prefix normalisation:** The API path prefix (e.g. `/_api`) is derived at runtime from `new URL(apiUrl).pathname` via `ResourceTypeFromIri.getPathPrefix()`. The synchroniser normalises incoming prop values; `AddComponentDialog` strips the prefix before comparing against `getComponentMetadata()` endpoints (already prefix-free). Both sides are always compared without prefix.

---

## Form Composables (#172) ✅ Complete

> All four composables and the sample component are done. See `playground/app/cwa/components/ExampleForm/` for the reference implementation.

### Core design principle

The module provides **scaffolding composables only** — no built-in input components. Consuming apps wrap their own inputs.

### API formView shape

Every form resource has a `formView` tree with `vars`, `children`, and optionally `prototype` (for CollectionType). Key `vars` fields:
- `full_name` — submit key (e.g. `contact_form[name]`)
- `action` — endpoint for both per-field PATCH and final submit (format: `{absolute-iri}/submit`)
- `method` — `"POST"` (create) or `"PATCH"` (edit)
- `valid: null | true | false` — `null` = untouched
- `errors: string[]` — populated after validation or submit
- `value`, `label`, `required`, `block_prefixes`, `attr` — field metadata
- Choice fields: `choices`, `expanded` (true = radio/checkbox, false = select), `multiple`
- Checkbox: `checked` boolean — initialise `value` from `vars.checked ? '1' : null`, NOT from `vars.value`

### Public composable API

```ts
// Per-field
const { value, vars, errors, valid, displayErrors, onBlur, onInput, validate } =
  useCwaFormInput(toRef(props, 'iri'), 'contact_form[email]')

// Form-level submit
const { submit, submitting, success, formErrors, unregisteredFieldErrors } =
  useCwaForm(toRef(props, 'iri'))

// RepeatedType (password + confirm)
const { first, second } = useCwaFormRepeated(toRef(props, 'iri'), 'reset_password[password]')

// CollectionType
const { entries, addEntry, removeEntry, vars } =
  useCwaFormCollection(toRef(props, 'iri'), 'tags')
```

**`displayErrors`** is true when: field blurred, OR field previously valid then became invalid (show immediately), OR submit was attempted. `valid` is gated on `hasBlurred || hasInteracted || isSubmitAttempted` — prevents untouched fields going green because a sibling PATCH included them.

**Checkbox pattern:** `!!checkbox.value.value` as getter; `v ? '1' : null` as setter. Unchecked value must be `null` (not `""`) — Symfony's `BooleanToStringTransformer` maps only `null` → `false`.

**CollectionType:** Prototype is at `formEntry.prototype` (not `vars.prototype`). `addEntry()` deep-clones it, replaces `__name__` with the next index.

| Legacy type | Composable |
|---|---|
| `text`, `email`, `password`, `textarea`, `checkbox` | `useCwaFormInput` |
| `choice` | `useCwaFormInput` — read `vars.choices`, `expanded`, `multiple` |
| `repeated` | `useCwaFormRepeated` |
| `collection` | `useCwaFormCollection` |
| `button` / `submit` | `useCwaForm.submitting` + `submit()` |

### Known concerns

- **`hasInteracted` + sibling response:** When field B validates, it sends all field values including A's. The API returns A's state too, which may differ from A's last-known state. The gate prevents display flickering but store data for A could silently go stale. Watch for A's visual state resetting unexpectedly after B validates.
- **Concurrent collection entry validation:** Rapid edits across two entries (faster than 300ms debounce) cause PATCH responses to interleave — each overwrites the full formView, potentially resetting the other entry's state briefly. The debounce makes this rare in practice.

---

## Composable pipeline design (#238 / #239)

`useCwaComponent` is the recommended entry point for app-level CWA components. `useCwaResource` remains unchanged for power users.

### Plugin type

```ts
interface CwaResourcePluginContext {
  iri: Ref<string>
  resource: ComputedRef<CwaResource | undefined>
  $cwa: Cwa
}
type CwaResourcePlugin<T extends object = object> = (ctx: CwaResourcePluginContext) => T
```

Plugins are factory functions: they close over their own options and return a function receiving the shared context.

### useCwaComponent

```ts
// src/runtime/composables/cwa-component.ts
useCwaComponent(props: IriProp, plugins?: CwaResourcePlugin[], ops?: CwaResourceUtilsOps)
```

- Calls `useCwaResource(toRef(props, 'iri'), ops)` internally
- Calls `getResource()` and exposes `resource` directly (no two-step)
- Runs each plugin with `{ iri, resource, $cwa }` context, merges results into return
- `defineExpose(exposeMeta)` still required in the component (cannot be automated without a Vite macro)

### DX before / after

```ts
// Before (Title.vue):
const props = defineProps<IriProp>()
const { getResource, exposeMeta } = useCwaResource(toRef(props, 'iri'))
const resource = getResource()
defineExpose(exposeMeta)

// After:
const props = defineProps<IriProp>()
const { resource, exposeMeta } = useCwaComponent(props)
defineExpose(exposeMeta)

// With plugins (combination previously impossible):
const props = defineProps<IriProp>()
const { resource, exposeMeta, collectionItems } = useCwaComponent(props, [withCollection()])
defineExpose(exposeMeta)
```

### Built-in plugins

| Factory | Backed by | Factory opts |
|---|---|---|
| `withCollection()` | `useCwaCollectionResource` | none currently |
| `withFile(fileOps?)` | `useCwaFile` | `fileProp`, `imagineFilterName`, `imageRef` |

`useCwaCollectionResource` is a thin wrapper over its plugin (BC safe).

**File fields (#252 — renamed from Image):** the file APIs handle any uploadable file, not just images. `withFile()` exposes a field under a single **`files` map keyed by `fileProp`** (default `'file'`) on the `useCwaComponent` return — use it multiple times for multiple fields (`files.heroImage.contentUrl`, `files.thumbnail.contentUrl`). Entries are `reactive`, so nested refs unwrap in templates (no `.value`). `useCwaComponent`'s plugin merge **accumulates** the `files` key across plugins rather than shallow-overwriting it. The default template ref name for load detection is the `fileProp`. For the per-field, named-at-call-site style, `useCwaFileField(props, { fileProp })` returns the flat refs (`contentUrl`, `displayMedia`, `handleLoad`, `loaded`) — same `useCwaFile` under the hood. Old `withImage`/`useCwaImage`/`useCwaImageResource`/`ImageOpsType` were **removed** (hard swap, pre-alpha). CLI scaffold type `'image'` → `'file'`. **Admin side of #252 (bind object + `<CwaResourceFileField>` wrapper) still TODO.**

---

## Future Ideas

### `mockCwaResource` test utility
A developer-facing helper for unit-testing components that use `useCwaResource` without spinning up the full stack:

```ts
import { mockCwaResource } from '@cwa/nuxt/test-utils'
const { wrapper } = mockCwaResource('/component/titles/123', { '@type': 'Title', title: 'Hello world' })
```

Keep in a separate `test-utils` export so it doesn't add to production bundle size.

### `defineCwaComponent()` macro
Shorthand replacing the four mandatory lines every display component has (`defineProps`, `useCwaResource`, `getResource`, `defineExpose`). Would need to be a Vite/unplugin macro — not a runtime composable — so `defineProps` and `defineExpose` can be called at the correct scope.

---

