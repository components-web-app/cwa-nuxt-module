# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Principles

### Principle of least exposure
Only add store getters, composable properties, or fetched resource types when there is a concrete consumer for them. Do not speculatively expose data "in case it's needed". Each addition should be justified against a real requirement and covered by a test.

### No narrative code comments
Do not add comments that explain what the code does or why a change was made — not in source, not in specs, not in Vue templates. The behaviour and the reason for it are carried by the test name and its setup, which is why a test must cover both the change and the use case that motivated it. Design rationale belongs here in CLAUDE.md or in the issue, never in the code.

Keep only what a tool reads or what is not prose: directives (`@vitest-environment`, `eslint-disable*`, `@ts-expect-error`, `@internal`, `@deprecated`), licence headers, and `todo`/`FIXME` notes. Mirrors api-components-bundle#226, which applies the same principle there.

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
- **`vi.mock('#imports')` NEVER intercepts — it fails silently. Always use `mockNuxtImport('fnName', () => impl)` from `@nuxt/test-utils/runtime` (requires `// @vitest-environment nuxt`).** Proven empirically in #265 across every spec that used it, under **both** happy-dom **and** the `nuxt` env, and for **both** compiled SFC auto-imports **and** explicit `import { x } from '#imports'` in plain `.ts`. The factory is ignored, the **real** binding is used, and **nothing errors** — the spec just asserts less than it appears to (the #263 bug lived in exactly this gap; `site-config.spec.ts` had been running the real `nuxt-site-config` `updateSiteConfig`, which threw `[nuxt] instance unavailable` into a swallowing `.catch()`, for its whole lifetime). `#imports` is a generated **aggregator** module — mocking that alias doesn't match the module id the source actually resolves to.
  - **Mocking the underlying real module DOES work** and is the alternative when `mockNuxtImport` doesn't fit: `#imports` re-exports from it, so `vi.mock('#app/nuxt', …)` intercepts `useNuxtApp` even under happy-dom (see `resource-stack-manager.spec.ts`). Same for `#app/composables/router` (`auth.spec.ts`), `#app/composables/cookie.js` (`cwa.spec.ts`), `#site-config/server/composables` (`server-middleware.spec.ts`). Only the `#imports` aggregator is dead.
  - **A mock you never assert on is not proven live.** If a mock exists only to stop a real function running, add an assertion that it *was* called — otherwise a dead mock is indistinguishable from a working one.
- Also mock `useError` and `useRoute` when testing `useHead` title logic to prevent happy-dom localStorage errors polluting `useError()`.
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

### API contract: reachability decides public access (bundle #225)

The bundle now grants public read access on one rule: **a resource is readable if and only if a Route that reaches it exists and is live now.** A Route reaches its own page *and every ancestor of that page* through `parentPage`/`parentPageData`.

What changes for the module — **no module code change is required**, this is recorded so the behaviour is not mistaken for a regression:

- **A routed child makes its whole unrouted ancestor chain public.** Fetching the parent depth's `PageData`, template `Page`, component groups and components from a child page's manifest used to 401 for anonymous visitors whenever the parent had no Route of its own, so the parent layer rendered blank while the child rendered. Those fetches now succeed. The manifest itself never changed — it always listed those IRIs.
- **A page nothing routes to is fully private, including its components.** Components placed in an unrouted page used to be publicly readable; they are now admin-only. Components not placed in any page are unchanged.
- **Denials are 401** for an anonymous request (the entry point converts them), not 403. A route gated by its go-live date is still 404, per #224.

**The `path` header contract is now pinned (relevant to cwa-nuxt-module#288).** `PageDataProvider` resolves the `path` request header as a **route path or a page data IRI**, so a depth whose page has no Route can still resolve its `pageDataProperty` positions by sending that page data's IRI. `Vary: path` is emitted on dynamic `ComponentPosition` responses whichever form the header takes. Two header values resolving to the same page data simply produce two cache entries. Bundle-side Behat scenarios now assert the resolved component IRI, so this cannot silently regress.

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
> **Decision (API #198 CLOSED — won't-do):** the manifest will **not** carry per-node metadata. The resource type is fully derivable from the IRI, so there's nothing the API can usefully add. Do **not** add fields to `NestedJsonStructure`.
> - Coarse type ← IRI prefix (`getResourceTypeFromIri`).
> - Specific component type ← `/component/{collection}/{uuid}`; reverse the `{collection}` segment via the `resourceName → endpoint` map `getComponentMetadata` already builds (e.g. `/component/images/…` → `Image`).
> - Nesting + order ← the tree shape and `children` order.
> - Instance dimensions are the only non-derivable thing, and they deliberately don't belong in the manifest (would embed component internals + couple the manifest cache to component edits). Skeleton shape/dimension defaults are **front-end config per component type**, not API data.

### Component loaders/placeholders — anti-flicker / anti-layout-shift ([#255](https://github.com/components-web-app/cwa-nuxt-module/issues/255))

**Raised as [#255](https://github.com/components-web-app/cwa-nuxt-module/issues/255).** API side is settled: no change (api-components-bundle #198 closed as won't-do — rationale above). Front-end only. Minimal per-item UI hints from the API were considered but deferred — they'd couple the manifest cache to component/UI edits, hurting cacheability, responsiveness and speed.

> **Why the manifest must NOT carry the selected `uiComponent` (definitive):** a manifest is a single cached document per route/page, and **layouts are shared across many pages**. Inlining `uiComponent` would void the whole manifest on any UI change to any element in it — and a single *shared layout* UI tweak would invalidate the manifests of **every page** using that layout (mass invalidation + a re-fetch stampede). That defeats the "individually, piecemeal, independently cacheable" design for a tiny flicker win — especially since the layout/page/component resources are already IRIs in the same parallel `fetchBatch`, so their real `uiComponent` arrives ~one round-trip after the manifest anyway. **Layering:** (1) instant type-level placeholder from the IRI-derived type; (2) mount the correct UI shell when the resource resolves from the batch. Read UI-from-resource, never UI-from-manifest.

**Goal:** let a developer register a **front-end-only placeholder/loading template per component type**, rendered in a component's slot **while its API resource is still loading**, so we (optionally) reserve correct space and show a tailored skeleton instead of a bare spinner/loader icon that pops in and shifts layout.

**Why it's viable with no API help:** the nested manifest (`resourceTree`) already gives us, up front (before `fetchBatch` resolves), the **full tree of IRIs about to load** plus their **nesting + order** — everything needed to lay out placeholders — and each IRI yields its component type (derivation above). So we can pick the right placeholder per node with **zero extra API calls and zero manifest metadata**.

**Shape to explore (design in the issue):**
- A convention for authoring a placeholder alongside a component — e.g. `app/cwa/components/<Name>/placeholder.vue` (mirrors the existing `admin/` + `ui/` subdir scanning in `module.ts` → `cwa-options.ts`), auto-registered as the loading template for `CwaComponent<Name>`.
- `ResourceLoader` / `CwaComponentGroup` render the resolved placeholder (keyed by IRI-derived type) until the resource fetch resolves, then swap to the real component — placeholder ideally occupying the same box to avoid CLS.
- Opt-in: no placeholder registered ⇒ current behaviour (or a generic default); developers choose per component whether to bother.
- Consider driving pre-content layout straight from `resourceTree` so ancestors/siblings can reserve space before any child resolves.

**Explicitly front-end only** — no API/manifest change; purely a rendering/config feature in the module. Cross-ref: api-components-bundle #198 (closed, won't-do).
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
- **Depth tracking lives in the fetcher store, never in memory** — `iriDepths` (IRI → depth) and `depthPaths` (depth → route path) are store state, derived by the `setManifestIrisByDepth` action (+ the `registerIriDepth` action for nested IRIs the manifest doesn't contain), reset per primary fetch via `resetIriDepths`. They drive the depth-aware `path` request header (`createRequestHeaders`), and **must survive the SSR→client payload**: the client builds a fresh `FetchStatusManager` and runs no manifest fetch, so in-memory Maps would start empty and every client-side re-fetch after a server-side load would fall back to `primaryFetchPath` — the *child* route. See "Bug: dynamic position loses its component after an SSR load of a nested page" below.
- **Early-switch is depth-0 aware** — `displayFetchStatus` checks `irisByDepth[0]` root page against `currentIds`; covers first visits (wait), return visits (switch immediately), sibling nav (parent renders, child loads progressively)
- **Route concatenation recommended, not required** — rendering never depends on URL structure
- **Hierarchy on AbstractPage, not Route** — settable before publication (before any route exists)

---

## Route go-live: `liveAt` and `effectiveLiveAt` ([#287](https://github.com/components-web-app/cwa-nuxt-module/issues/287))

A Route carries two dates, and conflating them is the mistake to avoid.

- **`liveAt`** is the route's **own** go-live date, and the only writable one. Nullable; a new Route is constructed with `liveAt = now`, so routes are live by default.
- **`effectiveLiveAt`** is the **latest** go-live across the route and every **routed** ancestor, and null if any of them is null. Admin-readable, never writable, and it lives in **`_metadata.effectiveLiveAt`** — it is derived per request by traversal, not a stored column (api-components-bundle#233 removed the column and the listener that maintained it). Unrouted ancestors are skipped rather than treated as null — deliberate, so a routed child under an unrouted template page stays live (the nested-pages design needs a parent editable before it has a URL).

Both are `ROLE_ADMIN`-only (`ApiProperty(security:)`, not `Groups`) and both are in `Route:redirect:read`, which matters because `RoutesTab.vue` loads its route from `/_/routes/{id}/redirects` and a watcher forces the resource back to that postfix. Before api-components-bundle#231 exposed them there, the admin could write the date but never read it.

**Badges report `effectiveLiveAt`; the control edits `liveAt`.** A live child under a scheduled parent must read "Scheduled — *the parent's date*", never "Live". `RoutesTabManage` shows the effective date read-only alongside the editable own date, built from the **store resource** rather than `localResourceData` — which `_metadata` living outside any PATCH body now makes structural rather than a discipline.

Three rules with tests pinning them:

- **`isRouteGatedByAncestor` is `effective > own`, not `effective !== own`.** `effectiveLiveAt` is server-derived and goes stale the moment an editor types a later date; `!==` would keep claiming a parent gate that no longer applies.
- **Instants are compared parsed, never as strings.** The API's `…+00:00` and our `…Z` are the same moment spelled differently.
- **An absent `effectiveLiveAt` means not live.** There is no "unknown" state and no parent hedge. These badges render only in admin components, `RouteNormalizer` sets the value for anyone who may read unpublished resources, and API Platform omits it when the chain resolves to null — so absent is null is blocked. Anyone not permitted gets a **404**, not a route with fields missing.

  The decisive argument for deleting the fallback, rather than merely tidying it: it only ever changed the outcome when `liveAt` was **present** and `effectiveLiveAt` **absent**, and both are admin-gated, so that combination cannot occur. An anonymously-fetched route reaching `RouteListRow` through `getItemFromStore` has no `liveAt` either, and already read "Not live".

  **Caveat:** `liveAt`'s visibility is hard-coded `ROLE_ADMIN` while the metadata's follows `publishable.permission`. Identical in every current config; an app setting `publishable.permission` stricter would get an admin who reads one and not the other, and would see "Not live" on a live route. Not defended against.

**`effectiveLiveAt` is named only in `src/runtime/resources/route-publication.ts`** — verified by grep, and worth keeping that way: when it was read directly in three `.vue` files as well, moving it to `_metadata` broke the badges silently, with no error and no failing test. `liveAt` is also the writable `v-model` in `RoutesTab.vue`, which is deliberate — routing the PATCH payload through a helper would obscure it.

**Editing a parent's `liveAt` does not refresh a child's badge.** `isCwaResourceSame` strips `_metadata` before comparing, so a Mercure-staged save whose only change is the effective date is discarded as unchanged, and #233 removed the listener that cascaded writes to descendants. The child updates on its next fetch. Same class as `publishable.publishedAt`, and arguably right now the value is derived — but it is a change from the column-backed behaviour.

**Timezone:** a `datetime-local` value is read as the editor's browser-local wall clock and committed as an absolute UTC instant, because the API compares against an absolute time and a naive string would be resolved by PHP's default timezone invisibly. The control states the zone it is committing to.

**The sitemap deliberately has no publication filter, and could not have one.** `server/useFetcher.ts` builds a bare `$fetch` with no cookie forwarding (not `CwaFetch`, which captures the request cookie), so the sitemap fetch is anonymous — and both `liveAt` and `_metadata.effectiveLiveAt` are admin-only, so an anonymous build has **no signal to filter on at all**. Path-prefix inference is unsound (route concatenation is recommended, not required, and the gating ancestor comes from `parentPage`, not the URL), and probing each route is N round trips during SSR.

So the gate is entirely server-side, and for non-admins `RouteExtension::applyToCollection` now applies **both** halves: `PublicationDate::andWhereActive(…, 'liveAt')` for the route's own date, and `RouteAncestorGateResolver::andWhereNotGated()` for ancestor-gated routes (api-components-bundle#234, a recursive CTE excluding a gated id set — `PublishableExtension`'s shape, so pagination and `totalItems` stay correct). `RoutableExtension` does the same for pages.

Between #233 and #234 only the own-date half existed, and a child under a scheduled parent was published to search engines as a soft-404. **That is the failure mode to remember: `GET /_/routes` does not fetch what it lists, it publishes it**, so a listing inconsistency there is not cosmetic. **If that fetch is ever made authenticated — an admin preview sitemap, say — every gate above disappears at once and a module-side filter becomes necessary.**

---

## Page HTML caching ([#289](https://github.com/components-web-app/cwa-nuxt-module/issues/289))

**On by default**; turn it off with `cwa: { pageCache: { enabled: false } }`, and tune it with `sharedMaxAge` (3600) and `staleWhileRevalidate` (0).

**Why an hour, and why not a day.** The TTL is now only a **backstop for when purge does not happen** — a dropped `PURGE`, a misconfigured `CACHE_URL`, an edge that was never wired up — because content edits purge by resource IRI, site-config changes purge via `cwa-html`, and scheduled go-lives arrive as a capped `s-maxage`. A page with any traffic is already at ~100% hit rate within an hour, so stretching to a day saves one re-render per page per hour (negligible: SRNTE measured 450 req/s of cached HTML with the SSR pods idle) while making every silent purge failure 24× longer-lived. The other uncovered case is a **deploy** — new `/_nuxt` hashes with no resource IRI changing, which a persistent CDN would serve as stale HTML pointing at dead assets; Souin's in-memory store dies with the pod, so the template is safe and a CDN in front is not. The default lives in **two** places that must agree — `resolvePageCacheOptions` for the runtime, and the `?? true` guarding plugin registration in `module.ts`, which cannot import the runtime helper (it resolves `#cwa/resources/resource-utils`, unavailable at module-build time). Changing only the runtime default is a no-op for an app that sets no `pageCache` key at all, which is exactly the app the default exists for.

**Enabling it by default is a deliberate alpha-stage trade** (four known applications, kept in sync with the API, no stable release). Two risks it accepts, neither detectable by the module: an app whose SSR HTML carries its **own** personalised content — a cookie-driven `useFetch`, a geo banner, a per-visitor experiment — will publish it to a shared cache, because our gates only understand CWA data; and an app whose edge does not bypass the auth cookie will serve a signed-in admin the cached anonymous page, with no admin chrome until a hard reload. Tags the rendered HTML with the API resource IRIs it was built from (`Surrogate-Key`, joined with `', '` to match `ApiPlatform\HttpCache\SouinPurger::SEPARATOR`) so the API's existing purge invalidates pages, and derives the page's `s-maxage` from the API responses that fed the render.

**Decide-then-emit, not set-then-strip.** `plugin-page-cache.server.ts` marks `event.context.cwaPageCache = {}` in `setup()` and fills it at `app:rendered`, setting no headers; `server/page-cache-plugin.ts` is the single emission point at `beforeResponse`, where the status is final. Three consequences: there is never a window in which a wrong header exists; a CWA route resolving to a redirect *before* anything renders is still caught, because the context was marked during setup; and the non-200 guard is scoped to CWA renders instead of forcing `no-store` onto every unrelated 404.

**Cacheability is the API's decision, read off its responses** — never a cookie test. `CacheHeadersEventListener::markNeverStored()` sets `private, no-store` for an authenticated request to a personalisable resource and for an unpublished-route response, so **any** response carrying `no-store`/`private` makes the whole page unstorable. `auth.signedIn` is a second gate behind it, because `personalised_resource_classes` is app-configurable and an app that trims it would otherwise start publishing admin renders.

**A 4xx never counts towards the page's cache directives; a 5xx always does** ([#324](https://github.com/components-web-app/cwa-nuxt-module/issues/324)). `CwaFetch`'s server `onResponse` skips the merge for any 4xx, whatever the resource and whether or not it was the primary fetch. Without it, a page placing an **unpublished component** — a draft of a published one, or one never published — was never cached for anonymous visitors: the render fetches that component, the API answers 404 `no-cache, private`, and one `private` made the whole page `private, no-store`. That is the normal anonymous path, not evidence of private content, and the home page is the most likely place for it.

Nothing is lost by ignoring them, because three other gates already cover what a 4xx would have told us. **The page's own status decides**: `server/page-cache-plugin.ts` forces `no-store` on any non-200, so a failed primary fetch is never stored regardless. **Invalidation still reaches it**: the 404'd IRI stays in `allIds` (`initResource` runs from both `setResourceFetchStatus` and `setResourceFetchError`), so it is in the `Surrogate-Key`, and creating or publishing it purges the page — equally true for a position or a group. **A signed-in render stays unstorable** through the separate `auth.signedIn` gate, which is why a 401 is ignored too: under bundle#225 a component on an unrouted page answers 401 to an anonymous request, the same "not public yet" case as the 404.

**5xx is the carve-out, and the distinction is whether anything will purge the page later.** A 404 means not public yet, and the publish that makes it public purges the page. A 500 means the render is unreliable, and nothing purges anything when the API recovers — so a page built from a failed nested fetch must not be stored. Deciding on the status alone also keeps the rule in the one place that has the status, with no resource-type test and no URL parsing, so the bare-host prefix hazard (#266) never enters it.

**The API folds both scheduled transitions into `s-maxage` itself** (api-components-bundle#240). `CacheHeadersEventListener::findNextTransition()` caps an anonymous response at the earliest of its own `Expires` — a publishable draft's scheduled date, set by `PublishableEventListener` before the `isGranted` return — and, for classes in `http_cache.scheduled_expiry_resource_classes` (default `Route`, `RoutableInterface`, `ResourceManifest`), the next route `liveAt`. So the lowest `s-maxage` across a render already carries every clock-driven change. The module still reads `Expires` separately; that is now redundant but harmless, and it is converted using **that response's own `Date` header**, never `Date.now()` — comparing a server-issued absolute time against the local clock is exactly the [#262](https://github.com/components-web-app/cwa-nuxt-module/issues/262) bug.

`max-age=0` is hard-coded, not an option: a browser cache cannot be purged, and stale HTML referencing a previous build's `/_nuxt` hashes 404s and leaves a blank page. IRI filtering uses `getResourceTypeFromIri`, not `startsWith('/_api/')`, which is wrong for a bare-host API (#266) and would admit the bare `/` that `allIds` holds for the primary fetch path — registering every page under one shared surrogate key.

### Three things that bite, in order of how much

1. **The TTL ceiling is the consuming app's API config.** A page can never be cached longer than the shortest `s-maxage` the API returned. The bundle ships **no** `http_cache` defaults, so the value is entirely the app's `api_platform.defaults.cache_headers.shared_max_age`. **An app on `shared_max_age: 60` gets 60-second pages and `pageCache.sharedMaxAge` is inert.** Raising it is an API config change, and it is safe to raise — the API's own entries are purge-invalidated exactly as the HTML now is, and clock-driven transitions are capped, so the two mechanisms cover each other.
2. **Edge bypass for authenticated requests is a deployment prerequisite.** The module deliberately emits no `Vary: Cookie` (cookie cardinality collapses the hit rate). The shared cache must bypass requests carrying the auth cookie. This is not a content leak — two independent gates guarantee a cached entry is anonymous — but a signed-in admin served a cached page sees no draft content and no admin chrome until a hard reload.
3. **Go-live bounding is global.** `findNextLiveAt` is `MIN(liveAt)` over future dates across the **whole routes table**, so any pending go-live anywhere shortens every page's TTL. Over-conservative, therefore safe: a route's effective date is always the latest in its chain, so every real transition is some route's own `liveAt`, and the minimum can expire a response early but never late.

ISR/SWR route rules fight this: Nitro's cache is not in Souin's purge graph, so `module.ts` warns at build time when `pageCache.enabled` meets the same `staticRender` detection added for #262.

### The `cwa-html` surrogate key — a cross-repo contract

Every cacheable HTML response carries the constant key **`cwa-html`** alongside the resource IRIs, so the bundle can purge *all* rendered pages when a site-wide resource changes. The name is an interface contract shared with api-components-bundle#232 and must match on both sides — like `explicitAllowOnly` and `SouinPurger::SEPARATOR`'s `', '`, a mismatch fails silently by matching nothing. It is exported as `RENDERED_HTML_SURROGATE_KEY`; any token not starting with `/` is safe from colliding with a resource IRI.

This exists because a resource can shape every page without the front end ever holding it as a resource. **Site config is that case**: `siteName`, `concatTitle`, `maintenanceModeEnabled` and the robots settings come through `server/useFetcher.ts`'s own `$fetch`, never enter the resources store, and so appear in neither the accumulator nor `allIds`. Tagging pages with the site-config member IRIs was considered and rejected — it only works for resources the front end fetches *and can enumerate*, so every future site-wide resource would need the same bespoke plumbing.

The key is only emitted on a page the module actually caches; a declined or unstorable render carries no key at all. Purging it drops every cached page at once and the traffic lands on SSR together, which is why the bundle's class list that triggers it should stay short, and why this is driven by a write on an already-secured resource rather than by a purge endpoint anyone could call.

### Warming the page cache ([#315](https://github.com/components-web-app/cwa-nuxt-module/issues/315))

Site settings has a **Warm page cache** button beside purge, calling `POST /_cwa/page-cache/warm` (`server/cwa-page-cache-warm.post.ts`, registered only when `pageCache.enabled`).

- **Anonymous and server-side, by necessity.** Requests from the admin's browser would carry the auth cookie, and the edge bypasses the cache for signed-in requests, so they would store nothing.
- **Pages come from the same list as the sitemap.** `fetchCwaPagePaths()` (`server/cwa-page-paths.ts`) is shared by the sitemap handler and the warm route. It is fetched anonymously, so ancestor-gated routes are already excluded (#234). It deliberately ignores `sitemapEnabled`.
- **Each page is requested at the `apiUrl` origin** (the in-cluster Caddy the SSR API calls already reach) **with `Host` set to the admin's public host**, so the response is stored under the same key visitors hit, and the request never leaves the cluster. Page requests carry no cookie or authorization, forward the admin's `accept` / `accept-encoding`, and don't follow redirects; only a 200 counts as warmed.
- **Admin gate:** the incoming cookie is forwarded to the API's `/me`, which verifies the JWT, and `ROLE_ADMIN` or `ROLE_SUPER_ADMIN` is required. `server-middleware.ts` only decodes the JWT without verifying it, which is too weak to guard a route that fans one request out into many renders.
- **Single-flight per pod** (a concurrent request gets 409). Limits live in private `runtimeConfig.cwa.pageCacheWarm` (`concurrency` 3 with a hard ceiling of 10, `timeout` 30s per page, `origin`), so each environment can override them with `NUXT_CWA_PAGE_CACHE_WARM_*`.
- **Progress streams as NDJSON** on the same POST (`start`, one `page` line per page, then `done`), with `application/x-ndjson` and `X-Accel-Buffering: no`. A client disconnect aborts the warm. **Streaming is proven in tests but not yet on a deployment:** whether Caddy and the ingress flush each line promptly still needs checking. The fallback if they don't is a synchronous JSON summary with a page cap (not built).
- **Local dev:** the playground's `apiUrl` is `https://localhost`, so a local warm fails its certificate check against the self-signed certificate unless `origin` is set to a plain `http://` URL.
- **Deploys don't use it.** The template's CI warm step (components-web-app#80) stays separate: it has no admin credential, and it also measures time to first byte through the ingress.

**Trap: Node's global `fetch` (undici) silently replaces a `Host` header you set**, so the warm would have stored every page under the wrong key. A real-server test caught it (`expected '127.0.0.1:56720' to be 'www.example.com'`). Anything that needs a specific `Host` must use `node:http` / `node:https`.

**Trap: in streaming tests, page timeouts must outlast the test's own timeout.** A test that held one response open with a 1s page timeout failed to catch fully buffered output, because the held request timed out and flushed everything.

**Testing note:** `vi.mock('#build/cwa-options', …)` **works**, unlike `#imports` and `#components` — `#build` is a real alias to a real directory, so vitest's resolver finds it.

---

## Admin updates are a merge-patch: only changed fields are sent

`useItemPage.saveResource` sends an update as `application/merge-patch+json` containing **only the fields where `localResourceData` differs from the stored resource** (deep comparison, lodash `isEqual`), plus any `extraData`. Creating still sends the full body. If nothing changed, no request is made and the stored resource is returned.

It used to send the whole resource, which broke on any value the API adds for display only. The case that surfaced it: `RouteNormalizer` gives a redirect route the **final** route's `page` when its own is empty, so a nested conference's parent route came back with its own `pageData` **and** its child's `page`. Saving anything on it then sent both, and the API rejected the pair with *"Please specify either page or pageData, not both."*, which blocked scheduling every parent that redirects to a child.

**The trap this creates:** `localResourceData` is a **shallow** copy (`syncLocalResourceWithStore` spreads the stored resource). An array or object edited **in place** — `roles.push(x)` — also mutates the stored copy, so the comparison sees no change and the edit is **silently not sent**. Always replace nested values (`roles = [...roles, x]`), never mutate them. Every current admin page already does; keep it that way.

---

## Clearing browser caches when a session ends ([#293](https://github.com/components-web-app/cwa-nuxt-module/issues/293))

When a session ends, the module deletes the app's API data caches so data cached while signed in cannot be read afterwards on a shared device — the residual risk left by #258.

- **Build-time detection only.** `module.ts` registers `runtime/plugin-session-caches.client` when `hasNuxtModule('@vite-pwa/nuxt')` is true, `nuxt.options.pwa.disable` is not set, and the cache list is non-empty. `@vite-pwa/nuxt` is never imported or depended on (#258). Only that module is supported; custom service workers are out of scope.
- **Which caches:** `cwa.auth.clearCachesOnSessionEnd`, default **`['cwa-api']`** (the template's runtime cache). Only named caches are deleted — **never the Workbox precache**, which would take the app shell and offline support with it. An empty list turns the feature off.
- **Three triggers, all firing through `Auth.clearSession()` or `onSessionEnd`:**
  1. **Sign-out.**
  2. **A 401 in the browser** — `CwaFetch.onUnauthorised`, called synchronously from the client branch of `onResponse`. It clears caches only while the auth cookie is `'1'`, and **never signs the user out**. The server branch of `onResponse` is unchanged.
  3. **A session found expired during the server render.** The server's `clearSession()` sets `authStore.data.sessionEnded = true` when the request *was* signed in; it reaches the browser in the Pinia payload (the #261 mechanism), and the browser clears once on startup and resets it. The server never touches `caches`. Without this, the most likely shared-device case — opening a page after the session has already expired — would clear nothing, because the browser never sees a signed-in session end.
- **Never blocks sign-out.** Clearing is fire-and-forget; a delete that throws, rejects or never settles cannot fail or delay it.
- **`wasSignedIn` is read before the cookie is cleared**, and notification happens **before** `clearSession()`'s early return while middleware is processing — otherwise it is skipped exactly when an expiry is detected in middleware.

**Limit:** a browser closed after a session, whose login has lapsed by the next visit, looks anonymous and triggers nothing. The cache's own `maxAgeSeconds` remains the only bound there.

---

## Dependencies

Everything was taken to latest on 2026-08-21 (`pnpm up --latest -r "!typescript"`), which cleared **37 audit vulnerabilities (2 critical, 28 high) down to 0**. Three constraints came out of it that must not be silently undone:

**`typescript` is held at `^6.0.3`.** Excluded from the update deliberately — TS 7 conflicts with `vue-tsc`. pnpm's `!pattern` exclusion works: `pnpm up --latest -r "!typescript"`.

**`vite` is pinned to `^8.2.2` by a catch-all override, and that is what lets nuxt 4.5 and vitest coexist.** Nuxt 4.5's `@nuxt/vite-builder` requires `vite ^8.2.0`; plenty of other packages (`@nuxt/devtools`, the SEO modules, `@tailwindcss/vite`) still ask for `^7`. Without the override the tree holds **both**, and the nuxt config hands vitest's vite-7 plugin container a rolldown builtin plugin, so **every test file fails to start** with `Missing field 'moduleType'` (`Plugin: builtin:replace`). Vitest 4.1 already accepts `vite ^8` as a peer — the versions are compatible, the *mixed tree* is not. The override replaced the old `vite@>=7.0.0 <=7.3.4: ^7.3.5` security pin, which is now redundant.

**`@pinia/nuxt` moved 0.11 → 1.0 (pinia 3 → 4), so `moduleDependencies` in `module.ts` now requires `^1.0.2`** — a **breaking change for consuming apps**, which must upgrade pinia with the module. Nuxt validates this itself and refuses to start on a mismatch (`Module @pinia/nuxt version (x) does not satisfy (y)`).

Two API migrations came with it:

- **`cookie` v2 renamed `serialize()` to `stringifySetCookie()`**, which takes the whole cookie object instead of `(name, value, options)`. `set-cookie-parser`'s parsed shape already matches, so `storage/stores/resources/actions.ts` passes it straight through. That path — forwarding upstream `Set-Cookie` headers onto our response when showing an error page — had **no test at all**; it has one now. Attribute order in the re-serialised header is the library's, not the upstream server's.
- **`@unhead/vue` resolves at two majors in this tree** (nuxt 4.5 uses v3, the SEO modules pull v2), so importing `UseHeadOptions` in `cwa-page.vue` picked whichever hoisted and clashed with the options type nuxt's own `useHead` expects. The annotation is dropped — the inferred shape is still checked against `useHead`.

**`unbuild` is now an explicit devDependency.** `build.config.ts` imports `defineBuildConfig` from it directly; it only ever resolved via hoisting from `@nuxt/module-builder`, which is fragile — a `pnpm add` of anything else can dissolve the hoist and break `vue-tsc` with `Cannot find module 'unbuild'`.

**Security overrides** (`pnpm-workspace.yaml`) still carry the transitive pins the update cannot reach on its own — `tar`, `sharp`, `valibot` and the rest. A pin whose range still matches an installed version does **not** force a re-resolve, so bumping the *floor* alone is not enough: move the match key too (`tar@<=7.5.15: ^7.5.16` → `tar@<=7.5.20: ^7.5.21`). New pinned versions also need adding to `minimumReleaseAgeExclude`.

**Verification after any dependency change:** `pnpm run dev:prepare` first (regenerates stubs and the playground), then `test`, `test:types` (module **and** playground), `lint`, `build`, `dev:build`, and boot `dev:http` — the module build passing does not prove the vite/nuxt pairing works, and the playground typecheck covers layer files the module's own `tsconfig` excludes.

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

### CSS isolation & consuming-app styling guidance (#247 — by design)

The consuming app imports the module CSS into a **low cascade layer** (`@import ".../cwa.css" layer(cwa)`). This is **intentional**: it lets app authors' own CSS win over CWA styles so their site is unhindered (before layers there were many override headaches). The trade-off: because **unlayered CSS beats every layer**, an app's **unscoped global element styles** (`h1 { color: red }`, `a { … }`, `button { … }`) also beat CWA's layered styles — including the admin UI, which renders inside the app's DOM.

**This is not fixable module-side without exactly the interference the layered import avoids** (`!important`, a second unlayered admin bundle, or Shadow DOM — all rejected). And unscoped global element selectors are an anti-pattern regardless: they leak into *everything* (third-party widgets, embeds, component libraries), not just CWA.

**Guidance for consuming apps:** scope your global element styles — put site typography on a content wrapper / `.prose` / a `@layer` / the Tailwind typography plugin, rather than bare `h1{}`/`a{}`/`button{}` selectors. A developer who scopes their globals (as they should) automatically leaves the CWA admin chrome — and all other third-party UI — untouched. If a specific admin element ever proves particularly fragile, spot-harden that one element narrowly rather than building a general isolation layer.

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

**Decision — build on Headless UI, not from scratch:** the kit **wraps `@headlessui/vue`** (already a direct dep) and styles it entirely with `cwa:` utilities to mirror the Nuxt UI look/API. Headless UI is *unstyled behaviour only* — it does **not** inject a theme or config into consuming apps the way Nuxt UI does, so the isolation concern doesn't apply to it. This buys battle-tested keyboard/ARIA/focus behaviour (and native `multiple`, plus `Combobox` for a future searchable `SelectMenu`) without reimplementing an accessible listbox. Nuxt UI's source is a free/OSS styling + structure reference we can copy from.

**Progress — first component landed: `CwaUiSelect`** (`templates/components/ui/Select.vue`, auto-imports `CwaUiSelect`; Nuxt UI `USelect` equivalent). Wraps Headless UI `Listbox`; props `options`/`modelValue`/`multiple`/`placeholder`/`disabled` via the extended `SelectInputProps` + `useCwaSelectInput` (which now also returns `selectedOptions` + `displayLabel`, and coerces the value to an array in multiple mode). The old `CwaUiFormSelect` (`ui/form/Select.vue`) is superseded — its only consumer (`_tabs/component/Ui.vue`) now uses `CwaUiSelect`; retire it in a follow-up. Next planned: a searchable `SelectMenu` (Headless UI `Combobox`) for route lookup.

**Component styles (`StyleOptions`) — unified string model.** A component declares `styles: { multiple?: boolean, classes: { <name>: string | string[] } }`. **Each style is a class string** (e.g. `'border border-gray-200'`); a `string[]` is still accepted and normalised by joining (`toClassString`). The resource's flat `uiClassNames: string[]` stores **one entry per selected style** — that style's class string — for **both** single and multiple select (single = a one-element array, multiple = N). Pure helpers `mergeSelectedStyles` / `deriveSelectedStyles` in `cwa-styles.ts` (unit-tested) map both directions; detection is an **exact string match**, in declaration order. Example: styles `{ Bordered: 'border border-gray-200', Rounded: 'rounded' }`, select both → `uiClassNames = ['border border-gray-200', 'rounded']` (1:1 with styles, no duplicate class tokens). The UI tab (`_tabs/component/Ui.vue`) renders one `CwaUiSelect` operating on style **names** — `multiple` when `styles.multiple`, otherwise a single select with a "Default" (null) option. `getCurrentStyleName` (`cwa-resource.ts`) returns the first selected style name via `deriveSelectedStyles`. (Note: old single-select data stored as a flat multi-element class array won't re-highlight — pre-alpha hard swap; a style whose value was already one joined string still matches.)

---

---

## API change: Route-level live / scheduled publication date (api-components-bundle#224 — front-end: [#287](https://github.com/components-web-app/cwa-nuxt-module/issues/287))

**Landed on the API side.** Recorded here so the module stays in sync; no module code has been written for it yet.

`Route` gains **`liveAt`** — a nullable date-time, readable and writable **only by `ROLE_ADMIN`** (it is simply absent from an anonymous route response). Three states: a past date is live, a future date is scheduled, `null` is draft / taken offline with the URL reserved.

The API resolves an **effective** go-live by inheritance and gates on that, so the module must not compute liveness from `liveAt` alone:
- effective = the **latest** date among the route's own `liveAt` and that of every ancestor page **that has a Route**; `null` anywhere in that set means not live
- an ancestor page with **no Route** contributes nothing and is skipped, so a routed child under an unrouted template page stays live

What the module will see:
- a gated route is **404** on `GET /_/routes/{path}` and `GET /_/resource_manifest/{id}` for anonymous visitors, and is absent from anonymous route and page collections — this is the sitemap source, so [#278](https://github.com/components-web-app/cwa-nuxt-module/issues/278) gets scheduled-route exclusion for free
- admins resolve, preview and edit it normally, and **drafts and scheduled routes still appear in the admin route collection** so they can be picked in link/route selectors before launch
- a route redirecting to a gated target still returns `redirectPath`, but **not** the target's `page`/`pageData` IRI — following the redirect is the only way through, and it 404s until go-live
- **known boundary:** a *component* reachable only via a gated route returns **401**, not 404. The API checks component access through an internal sub-request that deliberately still sees the 403. Do not treat a component 401 as an auth prompt in this case.
- gated denials are `Cache-Control: no-store`; anonymous route/page collection responses have `s-maxage` capped at the next go-live moment

`Route` is **not** `#[Publishable]` and has no draft twin, so `_metadata.publishable`, `publishedResource`/`draftResource` and `?published=` do not apply to it. `liveAt` is deliberately *not* named `publishedAt` partly because `getComponentMetadata` infers `isPublishable` from the presence of a `publishedAt` property (`api-documentation.ts`); keep that inference away from routes.

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
Highlighting text in an inline editor and releasing the mouse fired a `click` on the common ancestor, stealing/clearing the selection. The guard lives in **`ResourceStackManager._addToStack`** (`admin/resource-stack-manager.ts`), not the per-component `clickListener`: it bails out (preserving the current stack untouched) when there's a non-collapsed `window.getSelection()` and it's not a context click. It **must** be central — an earlier attempt guarded only the component's `clickListener`, which stopped the component re-adding itself but left the window/root `completeStack` to reset the now-empty stack, *deselecting the component you were editing*. Genuine clicks collapse the selection on mousedown so they're unaffected; `contextmenu` (right-click) left unguarded.

**[#247](https://github.com/components-web-app/cwa-nuxt-module/issues/247) — Admin UI CSS isolation: app global element styles bleed into the admin UI** ✅ Resolved (closed — by design)
Consuming-app **unscoped** global element CSS (`h1/h2/h3`, `a`, `button`, …) restyles the admin UI because CWA loads into a low `@layer cwa` (intentional, so app CSS wins for public components) and unlayered app CSS beats every layer. **Decision: not fixable module-side without the interference the layered import deliberately avoids** (`!important` / a second unlayered admin bundle / Shadow DOM — all rejected). Unscoped global element selectors are an anti-pattern anyway (they leak into all third-party UI). Resolved as **guidance**: apps should scope their global element styles — see `## Tailwind v4 → CSS isolation & consuming-app styling guidance`. Spot-harden individual admin elements only if one proves genuinely fragile.

**[#157](https://github.com/components-web-app/cwa-nuxt-module/issues/157) — Clone a resource**
Admin UI functionality to duplicate an existing resource (page, component, etc.).

**[#256](https://github.com/components-web-app/cwa-nuxt-module/issues/256) — Bug (regression): navigation reverts to a stale (last *fully-loaded*) page instead of holding the page on screen** ⚠️ Partially fixed — OPEN nested-nav regression (see "Follow-up" below)

> **⚠️ CURRENT STATE (2026-07-09, end of session — RESUME HERE):** The `displayedToken` fix below is **deployed to edge** (`@cwa/nuxt-edge`), plus the two safe follow-ups in `7060dbea`. **After that deploy Daniel reported nav "seems to be working fine for the moment"** — the all-depths `fetchHasDisplayablePage` fix likely resolved the stuck-nested behaviour. NOT yet confirmed (it was intermittent/lag-dependent) — watch for recurrence before closing #256; the diagnostic options below stay on standby. Original regression cluster (may now be resolved):
> - Switching to a nested page, then clicking a **CWA static home page** before the nested loaded → **`fetchRoute('/_/routes//')` is never called** (no HTTP), the URL changes to home, but the in-flight nested fetch (still the fetching token, never superseded) **fully loads and keeps rendering** — home never shows.
> - Switching between two **never-before-loaded nested siblings** (same data-page parent) before the first loads → **neither loads / no sub-page renders**.
> - Confirmed by Daniel: the last fully-resolved success was a **sibling nested page, NOT home**, so this is NOT the same-path short-circuit. The new route's fetch simply isn't taking over the in-flight one.
> **Leading theory:** rapid-nav supersession in the fetcher/middleware (`route-middleware.ts` fire-and-forget `fetchRoute(to).then(...)` + `startFetch` not aborting the previous in-flight primary for a *different* path, so it stays `fetchingToken`, completes, and wins). Possibly pre-existing / exposed by #250 manifest migration, possibly worsened by the `displayedToken` hold. **Decision pending (Daniel, tomorrow):** (a) revert the #256 `displayedToken` change on dev to isolate whether it caused the nested regression, (b) add dev/console logging to `fetchRoute`/`startFetch`/`finishFetch`/`displayFetchStatus` to capture the real prod sequence, or (c) build the #246 recorded-API replay harness (the only way to deterministically catch this class). I recommended (a) first to isolate.
> **Pushed this session (the safe, tested fixes only):** `fetchHasDisplayablePage` now requires **ALL depths** to have page data before a fetch can be held (was depth-0-only, which wrongly held a half-loaded nested page — parent + spinning child — when clicking away); `clearPrimaryFetch` now resets **all three** primary tokens (was successToken-only). Repro/guards in `navigation-retention.spec.ts`. The risky nested-nav orchestration fix was NOT attempted — awaiting Daniel's decision.

**Root cause (confirmed).** Not a data-drop — a headless store+gate audit (`src/runtime/resources/navigation-retention.spec.ts`) proved data is retained through `IN_PROGRESS` at every gate and the token machinery holds the old page. The real bug: the anti-flash **hold** (`displayFetchStatus` fallback) read `resolvedSuccessFetchStatus` = the **last fully-resolved success token**, which only advances in `finishFetch` when the fetch completes **before the user navigates again** (client nav is fire-and-forget — `route-middleware.ts:104`). So clicking faster than a page loads leaves the success token frozen several navs back; the hold then surfaces that stale page (home / a different conference / "a page from a few clicks ago") while the new page loads. Arriving via a redirect (SRNTE "Next Conference") is one way to strand it. Intermittent = timing-dependent.

**Fix (landed):** decouple "what fully loaded" from "what's on screen." New `primaryFetch.displayedToken` (`state.ts`) tracks the page actually displayed — a resolved success **or** a superseded, partially-loaded page we deliberately hold.
- `resolvedDisplayFetchStatus` getter (`getters.ts`) = `displayedToken` status, falling back to the (resolving-gated) success — the anti-flash hold in `displayFetchStatus` (`resources.ts`) now reads **this**, so navigation never reverts past the page the user was looking at.
- `finishFetch` advances `displayedToken` to the promoted success; `setDisplayedToken` action + `cleanupFetch` helper never delete a still-referenced (fetching/success/**displayed**) fetch, and clean up the superseded held fetch once a new page displays (no leak). `clearFetches` resets `displayedToken`.
- `FetchStatusManager.startFetch`: on a primary supersession, if the outgoing `fetchingToken` had already rendered its depth-0 page (`fetchHasDisplayablePage`), promote it to `displayedToken` and keep it alive — so rapid A→B→C holds **B** (last seen), never A. Redirect handoff covered by the same rule (page-less redirect route isn't displayable, so home stays held until the target promotes).
- **HTTP-level `AbortController` cancellation of the superseded fetch's in-flight requests deferred to a follow-up** (store already stops stale saves via `isCurrentFetchingToken`); the visible revert is fixed by the store/render change.

Reproduction + regression guard: `navigation-retention.spec.ts` (rapid-nav holds last displayed, return-to-cached never blanks, nested child never blanks the shared parent). Store units in `fetcher/getters.spec.ts` + `fetcher/actions.spec.ts`.

**[#255](https://github.com/components-web-app/cwa-nuxt-module/issues/255) — Component loaders/placeholders (anti-flicker + developer skeleton templates)**
Two phases: (1) reduce the bare `<Spinner>` flicker/layout-shift in `ResourceLoader.vue` / `ComponentGroup.vue` during loads; (2) opt-in per-component-type placeholder templates (`app/cwa/components/<Name>/placeholder.vue`, scanned like `admin/`/`ui/`) rendered until the resource resolves, laid out from the `resourceTree` (#250) so space is reserved (anti-CLS). Component type derived from the IRI — **no API/manifest metadata** (#198 won't-do; API UI hints deferred for cacheability/speed). Front-end only. See `## Nested Sub-Pages → Component loaders/placeholders`. **Next up: implementing the loader anti-flicker fixes.**

**[#257](https://github.com/components-web-app/cwa-nuxt-module/issues/257) — Feature: instant page revisit (stale-while-revalidate) + bounded LRU resource cache** (raised 2026-07-09) — ✅ **Instant-revisit + route-count LRU DONE (dev, uncommitted).** Cold-tier deferred to [#259](https://github.com/components-web-app/cwa-nuxt-module/issues/259).

**Landed (increments 1–3, `navigation-retention.spec.ts` #257 tests):**
- `RouteCacheEntry` + `routeCache: Map<routePath, {resourceTree, irisByDepth, resourceIris, cachedAt, lastAccessed}>` on the fetcher state (`markRaw` — non-reactive; read imperatively). Populated on `finishFetch` success promotion (`cacheRoute`); survives fetch cleanup.
- **Instant display**: `FetchStatusManager.startFetch` — on a revisit where `getCachedRoute(path)` hits (routeCache entry + **all** its `resourceIris` still have data in `byId`), it primes the new fetch from cache (`setManifestIrisByDepth` + `finishManifestFetch` SUCCESS + `resetCurrentResources(cached.resourceIris)` + `setDisplayedToken(newToken)`) so the existing early-switch renders the page **on the first render, no manifest round-trip**. Falls back to a normal fetch when not fully cached.
- **Design decision (Daniel):** short-circuit the *display* only — the fetch STILL runs (`continue:true`) to revalidate and patch in place (non-blanking, #256); a small layout shift is acceptable if data genuinely changed. **No route-revalidate-first gate** — the ongoing fetch catches redirects via existing #256 handling. `setDisplayedToken(newToken)` on prime is essential so background revalidation (resources → IN_PROGRESS) doesn't fall the hold back to the previous page.
- Existing behaviour change (approved): "returning to a previously-loaded page" now switches to it **instantly** (no hold-previous window). Two manager-spec mocks gained `routeCache: new Map()` (plumbing, assertions unchanged).

**Increment 4a — route-count LRU (DONE):** `FetchStatusManager.finishFetch` → `enforceRouteCacheLimit()`. Evicts least-recently-accessed (`lastAccessed`) routes over `routeCacheLimit` (**module option, default 50, overridable in `cwa` nuxt config; 0 = unbounded**). **Reference-counted** — a route's resources are dropped from `byId` (via the new `evictResources` resources-store action, which also cleans `allIds` + `publishableMapping` + `positionsByComponent`) only if no *remaining* cached route references them; **never** evicts the route(s) backing the fetching/success/displayed tokens, nor any resource in `currentIds` or an in-flight fetch. Decision (Daniel): route-count not byte-budget (simpler, pages comparable; ~50 routes ≈ a few MB); no per-resource size estimation. Tests in `navigation-retention.spec.ts` (LRU eviction, ref-counted survival, never-evict-current) + `resources/actions.spec.ts` (`evictResources` mapping cleanup).

**Deferred:** **cold non-reactive tier → [#259](https://github.com/components-web-app/cwa-nuxt-module/issues/259)** (only worth it at hundreds of cached pages / offline; reactive overhead ≈ 2–4× raw JSON but negligible at the 50-route cap). **Mercure** (Daniel: keep the subscription as-is, don't scope; auto-merge updates for non-displayed resources, require the confirm-update button when on screen — separate concern). Optional IndexedDB persistence later (#258).

**Test-touch log (all approved / additive):** manager-spec mocks gained `routeCache: new Map()` (empty → LRU early-returns; assertions unchanged); `cwa.spec` construction assertion gained the 5th `routeCacheLimit` arg (`undefined` in test). **Guardrail: do not change existing fetcher behaviour tests without asking.**

**[#258](https://github.com/components-web-app/cwa-nuxt-module/issues/258) — DX/Docs: recommended opt-in PWA setup (`@vite-pwa/nuxt`) for offline** (raised 2026-07-09) — ✅ **API marker landed; safe SW API caching now enabled. Implementation lives in the playground + template + docs (never module-shipped).**

**Not module-shipped** (same "no forced transitive deps" principle as #236): `@vite-pwa/nuxt` is a **playground/app devDependency**, never a module dep.

**The blocker was solved API-side, not by inverting the design.** The original issue proposed SWR caching "with auth/draft responses excluded", which was unimplementable by URL (draft and published share an identical URL — the primary fetch requests `/_/routes/{path}` + `/_/resource_manifest/{path}` with no `?published=` marker, and the API picks draft-vs-published from the auth cookie alone; a `urlPattern` callback is synchronous so it can't read auth state — no `document.cookie` in a SW, `cookieStore` async + Chromium-only). Rather than exclude by URL, **[api-components-bundle #200](https://github.com/components-web-app/api-components-bundle/issues/200) (`CacheHeadersEventListener`, PR #201, merged to `main`)** makes the decision legible in the response:

- An **authenticated** GET of an **affected** resource — `Route`, `ResourceManifest`, `ComponentPosition`, plus **any Publishable** resource (configurable via `http_cache.personalised_resource_classes`) — is marked **`Cache-Control: private, no-store`** (and `s-maxage` stripped).
- **Anonymous** requests, and any **unaffected** resource type (e.g. `Layout`), keep API Platform's default **`public`**.
- Deliberately **no `Vary: Cookie`** (would collapse the static cache-hit rate — cookie cardinality is huge and cookies churn); the existing `Vary: path` on dynamic positions is untouched. Same rule Souin already enforces at the edge (exclude cookie-bearing requests), now expressed so any downstream cache — CDN, proxy, **or service worker** — can honour it. Pinned by `features/main/cache_headers.feature`.

**So the SW can now cache the CWA API safely**, via NetworkFirst + a `cacheWillUpdate` that drops any response carrying `no-store`/`private`. The SW cache then only ever holds **public** data.

**Why NetworkFirst (not SWR) is the spine:** the SW cache is only ever **read offline** — online the network always wins, so an anonymous visitor can never be served a cached draft even in the window before the marker is seen. Layer discipline (settled with Daniel):
- **API sets long `s-maxage`** for the *shared* cache (Souin — remotely purgeable), and **`max-age: 0`** for the private/browser tier. A long `max-age` would put an un-purgeable copy in the **browser HTTP cache**, which a Workbox `fetch()` passes through by default — so NetworkFirst would be served that stale private copy *without ever reaching Souin*, defeating both the purge and the network-first. (`s-maxage`-only + `max-age: 0`; belt-and-braces, the SW fetch can use `{ cache: 'no-cache' }`.)
- **Residual offline leak window** — a cache outliving a **logout or cookie expiry** on one device (next user, offline, sees drafts). NetworkFirst can't reach this; **purge the SW caches on sign-out and on any 401** — now built as [#293](https://github.com/components-web-app/cwa-nuxt-module/issues/293), see `## Clearing browser caches when a session ends`. It deletes from the page with `caches.delete`, not via `postMessage` to the service worker: the page can reach Cache Storage directly, and state held in the service worker fails open on restart. Short `maxAgeSeconds` bounds what is left.

**IndexedDB persistence of #257's `routeCache`** (already `markRaw`, route-keyed, bounded, serialisable) remains a valid **complementary** page-side data tier — the page can read auth state, so it persists only when appropriate. Not either/or with the SW; the SW gives app-shell + public-API offline, IndexedDB gives auth-aware data persistence. (cross-ref #259)

**⚠️ `navigateFallback` gotcha:** `@vite-pwa/nuxt` checks `if (!('navigateFallback' in options.workbox))` and defaults it to `'/'` — **omitting the key silently serves the `/` shell for every SSR navigation**. *Presence* of the key (`navigateFallback: null`) is what disables it. The playground already does this correctly.

**Mercure offline (reality, not the issue's assumption):** `api/mercure.ts:85-86` assigns **only `onmessage`** — there is **no `onerror`, no reconnect handler, no `online`/`offline` listener** anywhere (grep-verified). So no module-level error spam (it never observes failures; console noise is the browser's native reconnect), but **"revalidate on reconnect" does not exist**. Recovery depends entirely on native EventSource reconnect replaying via the `Last-Event-ID` **header**, which only backfills if the hub runs an event store — otherwise events missed offline are **lost silently and the store stays stale**. (`lastEventId`, line 175, is only a `hubUrl` query param, used solely on an explicit `init(forceRestart)` — sign-in/sign-out.) Minor: the `init()` guard requires `readyState === 1`, so a non-forced `init()` mid-reconnect (`readyState === 0`) tears down the EventSource and discards the browser's internal last-event-id. **Worth its own follow-up issue** — a real gap independent of PWA work and a prerequisite for offline.

**Versions (verified live 2026-07-17):** `@vite-pwa/nuxt@1.1.1`. Nuxt 4 works but is **undeclared** (README/npm still say "Zero-config PWA for Nuxt 3"); real support since v0.9.0 via `compatibility: { nuxt: '>=3.6.5' }`. Update API is **`usePWA()`** (`usedPWAState`/`usePWAState` do not exist); `$pwa` is optional/client-only and `UnwrapNestedRefs`, so **`needRefresh` is a plain boolean, not a ref**. `registerType: 'prompt'` is right for CWA (admins edit inline) but **needs UI** — none exists yet, so the playground stays `autoUpdate`.

**Playground:** `@vite-pwa/nuxt@^1.1.1` is a **playground devDependency** (never a module dep), with `navigateFallback: null` and app-shell `globPatterns`. **Now also has the reference `runtimeCaching`** for the CWA API — a NetworkFirst handler keyed to the `/_api/` content paths (anchored so it does **not** match the Mercure SSE stream) whose `cacheWillUpdate` drops any response with `no-store`/`private`. This is the canonical example the template + docs mirror. The sign-out / 401 cache-purge hook is an **app-side** concern (not shown in the playground yet) — see the template/docs.

**[#259](https://github.com/components-web-app/cwa-nuxt-module/issues/259) — Feature: non-reactive cold cache tier for the route cache** (raised 2026-07-09) — deferred follow-up to #257. The route cache keeps cached resources in the **reactive** Pinia `byId`; reactive proxies (≈2–4× raw JSON heap) are wasted work for cached-but-not-displayed resources. **Negligible at the 50-route cap** (~10–25 MB effective). Only worth building when the cache is grown to **hundreds** of pages (offline #258, huge sites) or a mobile heap snapshot shows reactive `byId` > ~50–100 MB. Shape: two-tier resources store — small reactive hot set + non-reactive cold store, rehydrate on revisit. **Measure, then decide.**

**[#251](https://github.com/components-web-app/cwa-nuxt-module/issues/251) — Feature: `CwaComponentGroup` emits `componentsLoaded` / `componentsUpdated`** ✅ Complete (closed)
`CwaComponentGroup` **Vue-emits** `componentsLoaded` once all of the group's **own** positions resolve to a persisted component in a terminal API state (`SUCCESS`/`ERROR`, not `IN_PROGRESS`), then a **distinct** `componentsUpdated` (debounced) on later persisted add/publish/remove. **Payload = `{ component, position }[]`** (component IRI + its position IRI). Locked decisions: Vue emits (not the bus); pairs payload; distinct update event; own-positions-only (nested groups emit their own). Temporary/unpersisted (`__new__` / `_metadata.adding`) components are **excluded** (never fire); errored/absent components count as terminal (don't hang the event) but are **omitted from the payload**. Logic lives in the testable `useComponentGroupEvents` (`ComponentGroup.Util.Events.ts`), wired in `ComponentGroup.vue`.

**[#267](https://github.com/components-web-app/cwa-nuxt-module/issues/267) — Bug: `useCwaFileField` twice in one component throws `Cannot redefine property` in production** ✅ Complete (closed)
Prod-fatal, dev-clean — a real SSR 500. `cwa-file-field.ts` **and** `cwa-file-plugin.ts` both auto-registered a template ref via `useTemplateRef(fileProp)`, so two calls sharing a `fileProp` (e.g. a thumbnail + a hi-res URL of the same field, both defaulting to `'file'`) registered the same key twice. Vue's dev build guards that and warns; the prod build compiles the guard out, leaving a bare `Object.defineProperty` with `configurable: false` → `TypeError: Cannot redefine property: file`. **Fix: removed the implicit registration** (the maintainer's stated lean) rather than guarding it — collision gone *by construction*, and no dependence on Vue-internal `instance.refs` introspection that has no public API. `imageRef` is now **optional** in `FileOpsType`, never registered for you, and `useCwaFile` skips the mount check when it is absent. **Breaking (pre-alpha hard swap, precedent: #252):** anything wanting the already-loaded-on-mount check passes `imageRef` explicitly. See `## Composable pipeline design → fileOps`. Also fixed en route: `cwa-file.ts` imported `HTMLImageElement` from **`happy-dom` (a devDependency)** in shipped runtime code — replaced with a structural type. §3 (the `!== 0` polarity bug) landed separately in `8208e4cc`.

**[#252](https://github.com/components-web-app/cwa-nuxt-module/issues/252) — DX: multiple uploadable file fields + rename Image APIs to File/Uploadable** ✅ Complete (closed)
Multiple file fields were a faff (admin) or structurally unsupported (display). **Display side ✅ done** (hard-swap rename, pre-alpha): `withImage`/`useCwaImage`/`useCwaImageResource`/`ImageOpsType` **removed** → `withFile`/`useCwaFile`/`FileOpsType`; `withFile()` exposes its field under a single `files` map keyed by `fileProp` (reactive entries) and `useCwaComponent`'s merge accumulates the `files` key; per-field `useCwaFileField(props, { fileProp })` returns the flat refs. CLI scaffold type `'image'`→`'file'`. See `## Composable pipeline design → Built-in plugins` and `→ fileOps` (the full option reference, incl. the opt-in `imageRef`). **Admin side ✅ done (bind only):** `useCwaResourceUpload` now returns a typed `bind` object (`CwaResourceUploadBind`) to spread onto `CwaUiFormFile` (`v-bind="upload.bind"`) — covers `v-model`/`fileExists`/`disabled`/`change`/`delete`, leaving `label`/`accept` per field; default `fileDisplayType` `'Image'`→`'File'`. Deliberately **no** `<CwaResourceFileField>` wrapper and **no** `useCwaResourceUploads` — keep each field a separate composable call so fields can use different UI (avoid a monolithic component). Fully-auto `<CwaResourceFileFields>` rendering (zero declaration) was **dropped by decision** — not building it.

> **Spreading `bind` — always destructure it.** `bind` is a `ComputedRef<CwaResourceUploadBind>`. Vue only auto-unwraps refs that are **top-level** setup bindings, so `v-bind="bind"` works but `v-bind="upload.bind"` (nested access on the plain composable-return object) does **not** unwrap — it spreads the raw ref (`value`, `effect`, `[RefSymbol]`…) and TS complains `modelValue`/`fileExists` are missing (TS2345/TS2322). For one field: `const { bind } = useCwaResourceUpload(iri)`. For **multiple** fields, destructure-and-rename per call:
> ```ts
> const { bind: previewBind } = useCwaResourceUpload(iri, 'preview')
> const { bind: fileBind } = useCwaResourceUpload(iri, 'file')
> // <CwaUiFormFile v-bind="previewBind" label="…" accept="image/*" />
> // <CwaUiFormFile v-bind="fileBind"    label="…" />
> ```
> **Multi-field independence:** each `useCwaResourceUpload(iri, <prop>)` call reads/writes its own `mediaObjects[<prop>]` key, so two fields on one resource iri never couple at the composable level (guarded by the `two-field independence` tests in `cwa-resource-upload.spec.ts`). If fields *do* visibly couple in the app, it's a resource-data issue — the stored `_metadata.mediaObjects` lost a key — not this composable (see api-components-bundle #199 for the data-side gotchas: imagine on non-images, file-vs-image semantics).

**[#248](https://github.com/components-web-app/cwa-nuxt-module/issues/248) — Replace deprecated `installModule` with `moduleDependencies`**
`@nuxt/kit`'s `installModule` is `@deprecated Use module dependencies`. `module.ts` uses `await installModule('nuxt-og-image')` in `setup`. Migrate to the `moduleDependencies` field on `defineNuxtModule` and drop the import. Mechanical; verify OG-image + sitemap handlers still work.

**[#249](https://github.com/components-web-app/cwa-nuxt-module/issues/249) — Position-restricted components (`explicitAllowOnly`)** ✅ Complete (closed) — only cloning (#157) respecting it remains
Let a component **type** be opt-in only: hidden from the add dialog and rejected unless a group's `allowedComponents` explicitly lists its type IRI. Per-type, metadata-driven — declared as the Silverback class attribute `#[Silverback\ExplicitAllowOnly]`, flowing into component **type metadata**. The API already enforces the rule server-side but per-instance (`AbstractComponent::isPositionRestricted()` + `ComponentPositionValidator`); that method **is superseded and should be removed** (base + all subclass overrides) in favour of `explicitAllowOnly`. Work: (1) API — **✅ done** (api-components-bundle #196): declared via a Silverback class attribute `#[Silverback\ExplicitAllowOnly]` read by an `AttributeReader` (the bundle's own attribute system; does not affect the module, which only reads the emitted docs key), `isPositionRestricted()` removed, `VersionedDocumentationNormalizer` emits `explicitAllowOnly: true` on flagged `supportedClass` entries, and `ComponentPositionValidator` applies the reader on **both** placement paths — `validateDirectComponent` (placed component) **and** `validateDynamicPosition` (the pageDataProperty's resolved component class), so the dynamic path can no longer bypass the rule server-side. (2) module — **✅ implemented (dev)**: `explicitAllowOnly` added to `ApiDocumentationComponentMetadata`, read from the Hydra `supportedClass` in `getComponentMetadata` (absent ⇒ false); the pure `isComponentAllowedInGroup` helper (`_parts/available-components.ts`) is used by **both** placement paths — `AddComponentDialog.findAvailableComponents` (direct) **and** `useDynamicPositionSelectOptions.getPropertyOptions` (dynamic page-data-property positions) — hiding restricted types from groups that don't list them. The add dialog's Insert action is also gated by the pure `canInsertSelection` helper (`_parts/add-component-selection.ts`) so a dynamic position can't be inserted without both a chosen data type and field. Cloning (#157) must still respect it. See `## allowedComponents format contract`.

**Locked interface contract (module ⇄ bundle):** the flag is exposed as a boolean under the exact key **`explicitAllowOnly`** on each component's Hydra `supportedClass` entry, in the API docs the module already fetches (same docs that yield `isPublishable`). Class-level (not a `supportedProperty`), keyed by the same `title`/resourceName the module keys on; **absent ⇒ `false`**; no extra request. `getComponentMetadata` reads `supportedClass[n].explicitAllowOnly` with a `false` fallback, so the front-end can ship independently and activates once the bundle emits the key. `allowedComponents` (group, collection-IRI/type-level) and `ComponentPositionValidator` (server = source of truth) are unchanged. **Confirmed (bundle #196):** the docs use bare keys (`supportedClass` with each entry's bare `title`), and the bundle emits a bare `explicitAllowOnly` boolean on flagged entries — no JSON-LD `@context` alias needed; `getComponentMetadata`'s existing `supportedClass[n].explicitAllowOnly === true` read is live against the real API.

**[#245](https://github.com/components-web-app/cwa-nuxt-module/issues/245) — Investigate: do redirects fail on rapid repeated clicks?** ✅ Resolved (closed — no bug; the stale `todo` was wrong)
Diagnostic only. **Verdict: rapid repeat clicks on a redirect route always redirect** — reproduced against the #246 harness driving the REAL `route-middleware.ts` (mocked `navigateTo` re-entering the middleware as the router would) over the real fetch pipeline, with every response held so N clicks are genuinely in flight. 1/2/5 rapid clicks all land on the target, exactly one `navigateTo`. The `route-middleware.ts:64` todo is **deleted**; guard tests live in `test/integration/redirect-repeat-nav.spec.ts`.

**Why it works (two independent mechanisms — don't delete either):**
1. **Fetcher supersession** — each click mints a new primary token, so superseded clicks resolve `undefined` (`finishFetchResource` bails on a non-current token) and their `handleRouteRedirect(undefined)` no-ops. Only the winning click carries `redirectPath`. *An `undefined` from a superseded nav is CORRECT, not a failure* — the trap this investigation nearly fell into was asserting that **every** click resolves `redirectPath`.
2. **The `middlewareToken` guard** (`startedMiddlewareToken !== middlewareToken && resource?.redirectPath`) — **load-bearing, proven by mutation testing**, and the one case mechanism 1 misses: once the winning click has saved the route resource, a *late* superseded response short-circuits on the cached SUCCESS in `finishFetchResource` (SUCCESS + same path ⇒ return cached data) and resolves **WITH** `redirectPath` despite its nav being replaced. Unguarded it fires a second `navigateTo`, yanking the user back to the target from wherever they went next (verified: removing the guard ⇒ 2 redirects).

Hypothesis 1 (`waitForMiddleware` drops redirects) **disproved**: a redirect resolving while `_processingMiddleware` is set is *deferred, then fired*, not lost.

**Testing gotcha (cost real time):** `waitForMiddleware` polls a **10ms real timer**, which `settle()`/`flush()` (microtasks only) never advance — a redirect parked in that wait silently never fires, so a test can pass for the wrong reason and detect nothing. Any test touching that path needs real time (`await new Promise(r => setTimeout(r, 60))` / `vi.waitFor`). Mutation-test guard assertions here; several passed against a deliberately broken middleware until this was fixed. `replay-cwa-fetch.ts` gained `releaseLatest()` — repeat clicks queue requests on an identical path, so it is the only way to let the newer click win while an older stays in flight.

**[#246](https://github.com/components-web-app/cwa-nuxt-module/issues/246) — Integration/e2e tests with recorded API responses**
Stand up a replay layer: record real API responses (routes, manifests, nested batches, redirects, 404/401/500, Mercure `link` headers) into committed cassettes and replay them at the `ofetch`/`cwa-fetch.ts` boundary so the full pipeline (fetcher → stores → middleware → render) runs deterministically with no live API. Enables end-to-end regressions the unit suite structurally can't catch — the redirect flash fix, the #245 navigation race, nested sub-pages, error-page takeover.

**[#241](https://github.com/components-web-app/cwa-nuxt-module/issues/241) — Bug: TipTap bubble/floating menu obscured by CWA overlay** ✅ Fixed (closed, verified live)
Root cause: `TipTapHtmlEditor.vue` configured the menus with `:tippy-options`, which **TipTap v3 silently ignores** (it replaced Tippy with `@floating-ui/dom`). The real v3 props are `appendTo` and `options` (Floating UI config incl. `strategy`). With none set, the menu renders inline in the editor subtree with default `strategy: 'absolute'`, so `z-index: 760` can't clear the `z-overlay` (750) `LayoutPageOverlay`. **Fix (app-side `TipTapHtmlEditor.vue`):** replaced `:tippy-options` with `:append-to="appendToBody"` (a `script setup` const `() => document.body` — `document` isn't accessible from a template expression, which broke earlier inline attempts) + `:options="{ strategy: 'fixed' }"` on both menus, keeping `z-index: 760`. Applied to both the module **playground** and the **components-web-app** demo (demo also needed the `z-index: 760` added). The module only supplies the overlay + z-scale; the actual fix lives in the app's editor.

**[#242](https://github.com/components-web-app/cwa-nuxt-module/issues/242) — Test coverage: reach 70% statement coverage** ✅ Complete
Reached **71.0%** statement coverage (2026-06-28). See `### Coverage progress` above for the files covered.

---

## Bug: the `?published=` query went stale, sending writes to the wrong version ✅ Fixed

`useCwaResourceEndpoint` builds the endpoint every admin write goes to (`useCwaResourceModel`, `useCwaResourceUpload`) and the media URL `useCwaFile` reads. It held `query` as a **ref written by `watch(applyPostfix, …)`** — so the query only recomputed when `applyPostfix` *changed*, not when the values it is built from changed.

`applyPostfix` is `(forcePublishedVersion !== undefined || !isEditing) && publishableState === true`, and `query` is `(forcePublishedVersion || !isEditing) ? '?published=true' : '?published=false'`. Both read `forcePublishedVersion`, but only the first one gated the write. So toggling the Publish tab from **live back to draft** leaves `applyPostfix` `true` — the resource is still publishable — the watcher never fires, and the query stays `?published=true`. The next write is then sent to **the version the user is not looking at**. Same for edit mode being turned off while a published resource is selected.

It was partly self-masking: `applyPostfix` usually *does* flip as `currentIri` switches to the draft version (a draft's `publishableState` is `false`), which resets the query — so it only bites when the current resource stays published across the change.

**Fix:** `applyPostfix` and `query` are both plain `computed`s — derived, never assigned — and the two watchers plus their `onBeforeUnmount` teardown are gone (a derived value needs no teardown, and the composable no longer requires a component instance). That also makes the query **synchronous**: the old watchers were pre-flush, so a request fired in the same tick as a toggle used the previous value even when the watcher would eventually have been right.

**Why the existing tests missed it:** every case built the composable, read `query.value` once, and never changed anything afterwards — which is exactly the state the watcher got right. The three added cases in `cwa-resource-endpoint.spec.ts` mutate after setup (`forcePublishedVersion` live→draft, edit mode off, resource becoming a draft) and fail against the old implementation. `isEditing` is `shallowReactive` in the spec mock so it can be flipped — shallow deliberately, so the nested `forcePublishedVersion` stays a raw ref instead of being unwrapped.

---

## Bug: deselecting a component style left its classes on the element ✅ Fixed

`useCwaAutoClass` (applied by `useCwaResource` and `useCwaLayout`) kept a record — `activeSet` — of the classes it had put on the root element, so it could remove them when the style changed. It had a passive-detection heuristic on top: if **every** wanted token was already on the element, assume an owner (the component's own `:class`, or `ResourceLoader`'s `:class="resourceClassNames"`) is applying them, do nothing, **and clear `activeSet`**.

That test is wrong, because "all wanted tokens are present" is also true when the new set is a **subset** of what the composable itself applied. Three real failures, all in **active** mode (no parent binding — a layout via `CwaRootLayout`, or any component that does not inherit the fallthrough class):

| transition | old behaviour | correct |
|---|---|---|
| style `A` → a subset of `A` | unchanged | the dropped classes removed |
| multiple-select `A+B` → `B` | unchanged | only `A`'s classes removed |
| a style repeating a class from the template's own static `class`, then changed | strips the template's class | template class untouched |

The middle row is the visible one: **deselect one style of a multiple selection and nothing happens.**

**Fix:** drop the heuristic entirely and only ever remove what the composable itself added — `activeSet` becomes `(previous ∩ wanted) ∪ actually-added`. Passive mode then falls out for free rather than being detected: when an owner already applies the classes nothing is ever added, so `activeSet` stays empty and no class is ever stolen. It also stops the composable removing a class that came from the component's own markup.

**Why the existing tests missed it:** `cwa-resource.spec.ts` / `cwa-layout.spec.ts` mock `classList` (`contains: () => true/false` as a constant), so no test ever observed the resulting DOM, and the passive cases asserted against a `contains` that could not go stale. `cwa-auto-class.spec.ts` mounts **real elements** in both modes and asserts `element.className` — 3 of its 13 cases fail against the old implementation.

**Note on scope:** components rendered through `ResourceLoader` are passive (it binds `:class` from the resource's `uiClassNames`), and Vue's own class patch keeps those correct — verified across every transition, including multiple-select deselect. So this bug is live for **layouts** today, and for any component whose root does not receive the fallthrough class.

---

## Bug: `[nuxt] instance unavailable` — SSR auth cookies dropped on nested resources ✅ Fixed ([#263](https://github.com/components-web-app/cwa-nuxt-module/issues/263))

Fixed 2026-07-16. `CwaFetch`'s ofetch `onRequest` interceptor called `useRequestHeaders(['cookie'])`, which threw for every nested/batch resource during SSR.

**The reported mechanism ("ofetch runs interceptors asynchronously") is wrong** — `$fetchRaw`'s body runs synchronously up to its first `await`, and `callHooks` is invoked before it suspends, so `onRequest` inherits its *caller's* context.

**Real mechanism:** `useRequestHeaders` → `useRequestEvent` → `useNuxtApp()`, which **throws** (not `tryUseNuxtApp`). Nuxt's `asyncContext` defaults to `false`, so unctx holds the instance in a plain module variable and clears it at the first suspension (`callAsync`: `currentInstance = void 0`). Its `__restore()` hook only applies to code rewritten by `unctx/transform` — a **closed list** (`defineNuxtPlugin`, `defineNuxtRouteMiddleware`, `defineNuxtComponent`, `definePageMeta`). **`fetcher.ts` is an untransformed plain class, so every `await` in it destroys the Nuxt context for everything downstream.** The primary fetch reaches `onRequest` synchronously and works; everything after `await result.response` (`fetcher.ts:214`) → `fetchBatch` threw. ofetch's retry path (`await new Promise(setTimeout)` → re-enter) loses it too.

**Why it hid:** the throw surfaces as a *rejected promise*, so `fetcher.ts:169` caught it and marked each nested resource errored rather than crashing. And `credentials: 'include'` does nothing server-side (no cookie jar in undici) — that header `append` is the **only** SSR cookie forwarding — so authenticated SSR requests silently downgraded to anonymous. Not a regression despite the "latest deps" framing: `asyncContext: false` is unchanged and the interceptor hasn't changed since `dfcf3406` (Jan 2025).

**Fix:** capture the cookie **eagerly in the constructor** (live Nuxt context, via the plugin) and close over it; `onRequest` stays synchronous and context-free.

> **⚠️ Why this is safe, and the one way to make it catastrophic.** Exactly one `CwaFetch` exists per `Cwa` per plugin invocation — i.e. **per SSR request** (`new Cwa(` and `new CwaFetch(` each have exactly one non-spec call site: `plugin.ts:14`, `cwa.ts:71`). The captured cookie **must stay in the constructor closure**. Hoisting it to module scope — as `ResourceTypeFromIri` (`resource-utils.ts:79`) does with its shared singleton, mutated per-request from `cwa.ts:68` — would leak one user's auth cookie into another user's request. The constructor already requires Nuxt context (`useRuntimeConfig()`, `useCookie()`), so eager capture widens nothing, and the only cookie mutations (`signIn`/`signOut`) are client-side, so it cannot go stale mid-render.

**Rejected:** `runWithContext()` in the interceptor (always returns a Promise server-side → forces an async interceptor and changes timing); app-side `experimental.asyncContext: true` (a mitigation that pushes the burden onto every consuming app).

**Testing note:** `cwa-fetch.spec.ts` moved to `@vitest-environment nuxt` + `mockNuxtImport('useRequestHeaders', ...)` — the pre-existing `vi.mock('#imports', ...)` **was not intercepting at all**, which went unnoticed because no test ever invoked `onRequest`. Uses `useProcess()` rather than `import.meta.server` because `import.meta.server` isn't settable in this test env (see the `test.todo` in `process.spec.ts`).

---

## Bug: under concurrent SSR, one request's error status landed on another's response ✅ Fixed ([#313](https://github.com/components-web-app/cwa-nuxt-module/issues/313), [#314](https://github.com/components-web-app/cwa-nuxt-module/issues/314))

Under concurrent server renders, a 404 for one request could be set on a **different** request's response: a real page went out with a 404 status and its correct content, and the non-existent page got a 200. The page cache could then store the wrong status. Reproduced with a built playground under load: 16–20 of 20 concurrent rounds wrong, always correct when run sequentially.

**The mechanism — worse than #263.** Our route middleware is `unctx`-transformed, so after `await fetchRoute` its `__restore()` sets unctx's **module-level** `currentInstance` to its own app and **never clears it**. Any later implicit-context composable in **untransformed** code — store actions, `FetchStatusManager`, `Auth` — then resolves **whichever request resumed last**. #263 was this mechanism with nothing leaked, so it threw `NUXT_E1001`; here a concurrent request has leaked its app, so it silently resolves the wrong one.

**Two sites, and they must be fixed together.**
- `setResourceFetchError` (`storage/stores/resources/actions.ts`) called `showError`, `useResponseHeader('Set-Cookie')`, `useRequestURL()` and `navigateTo(…, 302)`.
- The primary-fetch **success** path in `FetchStatusManager` called `useError()` / `clearError()`, so one request's success could clear another's error page.
- Fixing only the first resets the context, and the second's `useError()` then throws, turning real pages into **500s**.

**The fix, same pattern as #263:** `Cwa`'s constructor captures `useNuxtApp()` while the context is live (one `Cwa` per request) and passes it to `FetchStatusManager`, which hands it to the action through `SetResourceFetchErrorEvent.nuxtApp`. Both sites run inside `nuxtApp.runWithContext(...)`. The app lives **only** on per-request instances — never in store state (it is serialised into the payload) and never at module scope. The same fix closes the unconfirmed variant where one visitor's response received another's `Set-Cookie` or 302. **#314** applies it to `Auth.clearSession`, which read `_processingMiddleware`, `useRoute()` and `useRouter()` after an `await`: `Auth` captures its own app in its constructor, and `runWithContext` returns a Promise on the server, so the existing try/catch stays **inside** the callback and results are written to locals.

**`runWithContext` is fine in a store action.** #263 rejected it only inside an ofetch **interceptor**, where it forces the interceptor async; an action is already async and the callback runs synchronously.

**Testing — three traps:**
- **vitest takes Nuxt's client branch**, where `runWithContext` calls `set()` and throws `Context conflict` whenever another app is current. Regression tests need a stand-in with **server semantics**: `(fn) => getContext(id).callAsync(app, fn)`, with the other request leaking its context via `executeAsync` + `__restore` (`test/integration/ssr-request-isolation.spec.ts`).
- `finishFetchShowError` is called **twice** in `finishFetchResource`, so a `mockImplementationOnce` on it is consumed before the success-path check. Use `mockReturnValue`.
- Unconsumed `mockImplementationOnce` queues on `showError` leak across describes in `actions.spec.ts`; `vi.restoreAllMocks()` in `beforeEach` clears them.

**The only test that exercises the real renderer is `pnpm run test:e2e`**, kept out of `pnpm run test` because it builds the playground. It serves a stub API (`test/e2e/stub-api.mjs`), fires a real page, a 404 and a non-CWA page concurrently for 20 rounds, and asserts each response carries its own status; a sequential control run proves the setup. Pre-fix it failed 8/20; fixed it passes 0/20. Run it after any change to the SSR fetch or error path.

---

## Bug: dynamic position loses its `component` after an SSR load of a nested page ✅ Fixed ([#261](https://github.com/components-web-app/cwa-nuxt-module/issues/261))

**Reported from:** SRNTE (a nested static page whose parent is a data page using the dynamic page template). Fixed 2026-07-16.

### Symptom
On a **server-side load/refresh** of the nested child page, the parent data page rendered correctly and then, moments later, its content vanished — leaving a component-position placeholder (admin) or nothing (logged out). Intermittent. Client-side *navigation* to the same page was unaffected.

### Root cause
The `path` request header is depth-aware (`createRequestHeaders`, `api/fetcher/fetcher.ts`): a depth-0 resource must be requested with the **depth-0 route path**, so the API resolves the position's `pageDataProperty` against the **parent's** page data (`ComponentPositionNormalizer::normalizeForPageData` → `PageDataProvider::getPageData()`, which reads the `path` header).

That lookup was backed by `_iriToDepth` / `_depthPaths` — **in-memory Maps on `FetchStatusManager`**, populated only by `setManifestIrisByDepth` (a live manifest fetch, or the #257 route-cache prime). On SSR the *server* built them and fetched everything correctly; the Pinia store hydrated fine, but the **client constructed a fresh `FetchStatusManager` with empty maps and never rebuilt them** — no manifest fetch runs client-side. Any client-side re-fetch then fell back to `primaryFetchPath` = the **child** route, a static page with no page data → API returned `component: null` → the component disappeared.

The client re-fetch comes from `ResourceLoader`'s `onMounted` paths: `isOutdated` (SSR data >5s old — ISR/CDN-cached), `ssrPositionHasPartialData` (admin; fires for *every* position because `usesPageTemplate` is a depth-0 global check, true whenever the parent is a data page), `refetchPublishedSsrResourceToResolveDraft` (admin), and `ssrNoDataWithSilentError`.

**Not Mercure** (ruled out): Mercure only fires when a resource actually *changes*, and although `mercure.ts` does force-refetch `ComponentPosition` messages (it knows dynamic positions can't be resolved in a Mercure serialisation — the `'no_path'` branch — so it re-checks staleness itself), it saves with `isNew: true`, staging into the **temporary `new` store** awaiting merge rather than overwriting `current.byId`. It shares the same header path, so it was latent, but it is not the trigger.

Only **depth-0** resources broke: the fallback path is the current route, which for a depth-1 resource is coincidentally correct — hence the *parent* data page vanishing while the nested child stayed.

`registerIriDepth` was collateral: `fetcher.ts` only registers nested IRIs `if (parentDepth !== undefined)`, so with empty maps those registrations never happened either.

### Fix (landed)
Moved the depth tracking into the **fetcher store** (`iriDepths` / `depthPaths` — plain objects, so they serialise into the payload), derived by the `setManifestIrisByDepth` action; `registerIriDepth` / `resetIriDepths` are now store actions. `FetchStatusManager` delegates. Single source of truth, no SSR desync possible. `registerIriDepth` is preserved intact — deriving from `irisByDepth` alone would have dropped IRIs the manifest never contained.

Reproduction + regression guard: `api/fetcher/nested-page-hydration.spec.ts` — drives the real stores through the SSR primary fetch, then simulates hydration by constructing a **new** `FetchStatusManager` over the same store, with a stubbed API that models the page-data resolution (resolves only for the `/conference` parent path). Asserts the **outcome** (the position still has its `component`), so it fails whether the fallout is a placeholder or nothing. Store behaviour moved to `storage/stores/fetcher/actions.spec.ts` ("depth tracking" describe); the manager spec's equivalent block now pins delegation.

---

## Bug: nested `ComputedRef` accesses never unwrapped ✅ Fixed ([#260](https://github.com/components-web-app/cwa-nuxt-module/issues/260))

Fixed 2026-07-16. Surfaced while investigating #261 — it's why that bug showed logged-out users an admin placeholder instead of degrading silently.

**The trap** (same as `upload.bind` in #252): Vue only auto-unwraps refs that are **top-level setup bindings**. `$cwa` is the top-level binding, so `$cwa.auth.isAdmin` is a *nested* access returning the `ComputedRef` **object** — always truthy.

1. **`ComponentPosition.vue`** — `v-else-if="$cwa.auth.isAdmin"` was effectively `v-else`, so **every visitor** saw the admin-only placeholder. Now `.value`. The *nameless* placeholder is the tell that it's the logged-out view: `pageDataProperty` is serialised `ComponentPosition:read:role_admin`, so non-admins never receive it and `:name` is `undefined`.
2. **`ResourceLoader.vue`** — `ssrNoDataWithSilentError` used bare `hasSilentError` (a `ComputedRef`), collapsing the condition to `ssr && data === undefined`, so **any** dataless SSR resource re-fetched regardless of error. Now `.value`.

**Both were invisible to the suite, and one test passed for the wrong reason.** `ComponentPosition.spec.ts` mocked `useCwa()` with **no `auth` key at all** and always supplied a truthy `componentIri`, so the placeholder branch never rendered. `ResourceLoader.spec.ts`'s "no silent error" test used `data: null`, which exits on the `data === undefined` check and never reaches the silent-error condition — changing it to `undefined` made it fail. **When mocking a getter that returns `computed()`, the mock MUST be a real `computed`** — a plain `false` passes while hiding the production bug.

**Audit done:** swept every nested `$cwa.*` access in templates against the getters that return `computed()` — `isAdmin` was the only one. Not affected: `admin.isEditing` / `admin.navigationGuardDisabled` (plain store state), `auth.user` / `resources.hasNewResources` / `config` (Pinia unwraps store state + getters). `Cwa.isStaticRender` deliberately returns a **plain boolean** for this reason.

---

## Bug: SSR resources re-fetched on a cross-clock 5s timer ✅ Fixed ([#262](https://github.com/components-web-app/cwa-nuxt-module/issues/262))

Fixed 2026-07-16. `ResourceLoader.isOutdated` re-fetched any SSR resource whose `apiState.fetchedAt` was >5s old — but `fetchedAt` is stamped with the **server's** clock and compared against the **browser's**, so it measured staleness *plus device clock skew*. A client clock >5s fast re-fetched the whole page on every server-side load; a slow clock never refreshed cached content. No threshold fixes a cross-clock comparison. Likely the trigger for #261, and explains its intermittency.

**Vestigial**: the original mechanism was `prerendered = !!nuxtApp.payload.prerenderedAt` (#136/#138). `24a94f78` swapped it for a timer to also catch **ISR** (where Nuxt sets no `prerenderedAt`); `45f66d00` made it per-resource `> 5000`. Nothing prerenders today — the playground's `routeRules` are commented out — so it only ever fired on live SSR pages.

**Fix** — the render being static is a fact, not a duration:
- **Runtime**: `Cwa.prerendered` ← `payload.prerenderedAt`, set by the plugin. Exact, but true prerendering only.
- **Build**: `staticRender` ← `module.ts` scans `routeRules` + `nitro.routeRules` for `isr`/`swr`/`prerender`, baked into `cwa-options.ts`. Overridable via `cwa: { staticRender: true }`. Needed because an ISR/SWR response is byte-identical to a fresh SSR one at runtime, and when served from cache the server never ran — there is nothing to detect.
- `Cwa.isStaticRender` combines them (plain boolean, see #260). Detection is **global, not per-route**: one ISR route means any render may be cached, and re-fetching live data is the safe default.

---

## Bug: an API URL with no path prefix breaks all resource typing and depth headers ✅ Fixed ([#266](https://github.com/components-web-app/cwa-nuxt-module/issues/266))

Fixed 2026-07-17. Found while investigating #264.

### Symptom
An app whose API is deployed at a **bare host** — `https://api.example.com`, `http://api:8000` — got `getResourceTypeFromIri()` returning `undefined` for **every IRI**, and the depth-aware `path` header (#261) never resolving. CWA was comprehensively broken for that deployment shape, which is supported: the API can be deployed anywhere.

### Root cause
`cwa.ts:68` stores the API URL's pathname as the prefix: `ResourceTypeFromIri.setPathPrefix((new URL(this.apiUrl)).pathname)`. For a bare host that pathname is **`'/'`, not `''`** — so "the API is at the domain root" was stored as a *prefix of `/`*, and every consumer treated that single slash as a string to strip or concatenate:

1. **Resource typing** — `_call` did `iri.replace(this.pathPrefix, '')`, so `'/_/routes//conference'.replace('/', '')` ate the IRI's **leading slash** → `'_/routes//conference'` → `startsWith('/_/routes/')` false → `undefined` for every IRI, across the 16 non-spec files that use it.
2. **Depth headers** — `fetcher.ts:349` and `storage/stores/fetcher/actions.ts:158` build `` `${prefix}/_/routes/` `` → `'//_/routes/'`, which matches nothing. The `path` header silently fell back to `primaryFetchPath`, **reintroducing #261's symptom for every path-less deployment regardless of the #261 fix**.
3. **Latent** — `iri.replace(prefix, '')` replaces the **first occurrence anywhere**, not a leading prefix.

### Fix (landed)
Normalised at the single write point, `ResourceTypeFromIriCls.setPathPrefix` (`resources/resource-utils.ts`) — **none of the 23 call sites changed**, since every consumer already handles an absent prefix (`getPathPrefix() || ''`), so one write-point fix covers typing *and* the depth headers:
```ts
// a root pathname means "no prefix"
this.pathPrefix = !prefix || prefix === '/' ? undefined : prefix
```
Plus a leading-only strip in `_call` (`startsWith` + `slice`, replacing `String.replace`'s first-occurrence-anywhere).

The `ResourceTypeFromIri` **singleton design is untouched** — that hazard is #264, tracked separately.

### Why it was never caught
The playground uses `apiUrl: 'https://localhost/_api'` → pathname `/_api`, so everything works. And **`resource-utils.spec.ts` never called `setPathPrefix` at all** — the entire prefix mechanism was untested in either shape.

`resource-utils.spec.ts` gained the coverage it never had: `getResourceTypeFromIri` across an unset prefix / `/_api` / `/` for **every** resource type, plus nested-route and collection IRIs, `getPathPrefix()` normalisation, and the leading-only strip. `fetcher.spec.ts` pins that a root API URL still produces `/_/routes/`-based depth paths (guarding the #261 interaction). All 11 + 1 failed first for the right reason (bare-host cases returning `undefined`; the header carrying a raw `/_/routes//conference`) while the `/_api` cases passed throughout.

> **`setPathPrefix` is a module-level singleton shared across the whole run** — always reset it in `afterEach`, or the prefix leaks into unrelated spec files.

**Trailing slashes also fixed** (follow-up, same issue): an API URL written `https://localhost/_api/` yields pathname `/_api/`, so stripping left `_/routes/…` with no leading slash — the same failure by a different route. Rather than special-casing `'/'`, `setPathPrefix` now **trims trailing slashes** (`prefix?.replace(/\/+$/, '') || undefined`), which subsumes both shapes under one rule: *trailing slashes carry no meaning in a path prefix, and a prefix of only slashes is no prefix*. Covers `/` → `undefined`, `//` → `undefined`, `/_api/` → `/_api`, `/_api` → `/_api`.

---

## Mercure: connection loss and recovery ✅ ([#286](https://github.com/components-web-app/cwa-nuxt-module/issues/286))

The EventSource previously had **only** `onmessage` — no `onerror`, no `onopen`, no `online` listener. A dropped connection was therefore silent, and recovery relied entirely on the browser replaying missed events via `Last-Event-ID`, **which only backfills if the hub runs an event store** — the template's default deployment configures none. Everything that happened while disconnected was lost and the store sat quietly stale.

**We do not trust replay.** On reconnect we refetch what is on screen. The design turns on a property of the store worth knowing: **`saveResource({ isNew: true })` discards an unchanged resource** (`isCwaResourceSame`, `storage/stores/resources/actions.ts:252`) and clears any stale pending entry. So revalidation can run unconditionally — an uneventful reconnect shows the user *nothing*, and a genuine change surfaces the **existing** "content is outdated / Update" notice (`OutdatedContentNotice` ← `hasNewResources`) rather than rewriting the page underneath them. That also answers the issue's open UI question: no new UI needed.

- `connected: Ref<boolean | undefined>` on the mercure store. **`undefined` until the first open is load-bearing** — it distinguishes an initial connect (nothing missed, do not revalidate) from a reconnect. A plain `false` default would refetch everything immediately after the first page load.
- `onerror` → records the loss (early-returns if already known, so a flapping connection does not spam).
- `onopen` → records connected; revalidates only when it was a reconnect.
- `online` → a **hint only**, acted on identically. It reports interface state, not hub reachability, so it is never treated as proof; harmless if the hub is still down, as the refetch just fails and nothing is staged.
- Revalidation defers behind the same `requestsInProgress` guard the message queue uses — staging mid-fetch would compare against a `currentIds` set that is still changing.

`mercure/state.spec.ts` pins the exact initial state shape, so it needed the new field adding.

---

## `cwa-auth` / `cwa-admin` route middleware + login redirect ✅ ([#271](https://github.com/components-web-app/cwa-nuxt-module/issues/271))

Apps had to hand-roll route protection, and `useLogin()` hard-coded `navigateTo('/')` so a `?redirect=` round trip could not be built on top of it.

**Middleware** — `src/layer/middleware/cwa-auth.ts` and `cwa-admin.ts`, auto-registered by the layer, opted into per page with `definePageMeta({ middleware: 'cwa-auth' })`. Named with the `cwa-` prefix deliberately so they cannot collide with an app's own `auth`/`admin` middleware.

**Both `await $cwa.auth.init()` before deciding, and that is the critical part.** `signedIn` is derived from a cookie that can outlive the session, and `isAdmin` reads roles off the *fetched user*, which only `init()`/`refreshUser()` populates. Deciding first would bounce a legitimate admin off their own page on a server-rendered load — worse than no guard at all. This is SSR-safe because `CwaFetch` captures the request cookie eagerly (#263), and `clearSession()` early-returns while middleware is processing.

A signed-in non-admin goes **home, not to login** (mirroring the long-standing `_cwa/index.vue` guard) — they will not gain the role by signing in again, so login would be a loop.

**`useLogin(ops?)`** takes `redirect?: MaybeRefOrGetter<string | undefined>`, resolved at sign-in time, defaulting to the current route's `redirect` query parameter — which is exactly what the middleware sets, so the round trip needs no app code. **`resolveRedirectTarget` hardens it against open redirect**: the target is attacker-supplied via a query string, so anything that is not a plain internal path falls back to `/` — external URLs, protocol-relative `//host`, `/\host` (several browsers normalise it to `//host`), relative paths, and a repeated parameter arriving as an array.

---

## Sitemap: exclude routes that are not pages ✅ ([#278](https://github.com/components-web-app/cwa-nuxt-module/issues/278) — partial, rest needs the API)

`server/cwa-urls.get.ts` mapped **every** Route to a sitemap URL. Now excluded: **redirect routes** (a Route with `redirect`/`redirectPath` 308s elsewhere — advertising it to search engines is wrong), routes with **neither `page` nor `pageData`** (they render nothing), and members without a usable `path`.

Two details that make it safe:
- **The redirect check must come first.** The API's `RouteNormalizer` copies the *final* route's `page`/`pageData` onto a redirect route when serialising, so a redirect can carry a populated `page` and would otherwise look like a real page.
- **Filtering is on positive evidence only.** Null values are omitted from API responses, so an absent key is indistinguishable from a shallower collection serialisation. If *no* member exposes `page`/`pageData`, that filter is skipped entirely rather than emptying the sitemap. A missing URL is worse than an extra one.

**Deliberately not done — needs API support:** publish/visibility filtering (Route is not publishable and the collection does not expose its page's publish state) and `priority`/`changefreq` (no such properties exist on the API's Route, and the admin exposes none).

---

## `ResourcesManager.saveResource` → `storeResource` ([#282](https://github.com/components-web-app/cwa-nuxt-module/issues/282))

Renamed 2026-08-14. **It writes straight to the store and makes NO API request** — the old name read like "persist this", which is exactly the misreading that produced the issue. Apps write via `createResource` / `updateResource` / `deleteResource` or `useCwaResourceModel`; `storeResource` is **module-internal** and stays marked `@internal`.

Free rename — verified there are **no consuming-app usages at all**: srnte, smoking-in-england-cwa, cymru-kitchens-cwa and alcohol-in-england do not reference `resourcesManager` in any form.

**Why it can't simply be private.** Three module call sites live outside the class:
- `composables/reset-password.ts` — stashes a 422 form response so the form composables can render its errors (`api/forms.ts` does the same thing directly against the store in `validateField`/`submitForm`).
- `ComponentGroup.Util.Positions.ts` ×2 — projects a reorder **locally**: the display sort number, and the `sortValue` shuffle the server will perform. Deliberately store-only, to avoid re-fetching every position.

Those are legitimate local-only writes with no API equivalent (`updateResource` would PATCH). Making it private would mean hoisting reorder logic into `ResourcesManager`, which is worse cohesion — that logic belongs next to `ComponentGroup`. TypeScript cannot express "module-internal but not app-facing" across files, so `@internal` + the name + the docs *are* the mechanism.

**History (for context):** `b7e59e48` (Mar 2023) introduced it as a convenience wrapper so `createResource`/`updateResource` could stop calling `resourcesStore.saveResource` directly, and made it public in the same commit purely because the then-layer reset-password page needed the 422 stash. It was never designed as app-facing API.

---

## Docs-audit issue batch (#269–#283) — triage + fixes (2026-08-14)

A full docs accuracy audit filed #269–#283. **Every claim was re-verified against the code before acting** — three did not hold up. Worth remembering: an audit finding is a hypothesis, not a defect.

### Fixed

- **[#281](https://github.com/components-web-app/cwa-nuxt-module/issues/281) — `useResendVerifyEmail()` hit the wrong endpoint for any non-`'current'` type.** `type` had no default and the branch was `if (type === 'current') … else resendVerifyNewEmail`, so anything unexpected (including a JS caller passing nothing) requested a *pending email change* verification. It failed **invisibly**: with no pending change the API's `ResendVerifyNewEmailAddressAction` returns 200 with no email sent, so the composable set `success = true`. Fixed by defaulting `type` to `'current'` **and** inverting the branch — either alone leaves a hole.
- **[#272](https://github.com/components-web-app/cwa-nuxt-module/issues/272) — manager-tab `disabled` typed too narrowly** (typecheck-only). Widened to `disabled?: boolean | Ref<boolean>`; zero runtime change. `MaybeRefOrGetter`/`toRef` rejected — a getter would be type-admitted but wrapped by `ref()` as a function-valued ref, advertising a shape the runtime does not support. **The issue's "the tab is then permanently disabled" claim is wrong**: `ref()` returns an existing ref unchanged and `ManagerTabs.vue` deep-unwraps it through the tabs array. Note `pnpm run test:types` does **not** cover type-level spec assertions — `tsconfig.json` excludes `**/*.spec.ts`, and `exclude` does not filter files added via `files`.
- **[#280](https://github.com/components-web-app/cwa-nuxt-module/issues/280) — pageData `metaFields[].type` declared but ignored.** Typed `'input' | 'select'` (`types/index.ts:69`) yet both admin modals rendered an unconditional `<ModalSelect v-for>`, so `type: 'input'` silently became an empty dropdown. Both now dispatch on `field.type` inside a keyed `<template v-for>`. `ModalInput`'s own `type` prop is the **HTML input type** and is deliberately not passed.
- **[#269](https://github.com/components-web-app/cwa-nuxt-module/issues/269) — `resources.page` / `.pageData` / `.displayPage` now always return a `ComputedRef`.** They early-returned a bare `undefined`, so the type was `ComputedRef | undefined` and `resources.page.value` threw — inconsistent with `resources.layout`. Each now wraps the lookup in one `computed()` returning `undefined` internally (a copy of the `layout` pattern). Backwards compatible: `.value` yields the same as before, so every existing `?.value` call site is untouched (the optional chain is simply now redundant).
- **[#276](https://github.com/components-web-app/cwa-nuxt-module/issues/276) — `<CwaComponentGroup>`'s `location` is now optional.** While `undefined` — the normal state when bound to the asynchronously-resolving `$cwa.resources.layoutIri.value` — the group renders nothing and does not start its synchroniser, so apps no longer need a `v-if` guard to suppress the "The location provided `` is not a current resource" alert. **That alert is deliberately preserved** for a location that *is* set but does not resolve (an empty string still counts as set), so genuine mistakes are not swallowed. Load-bearing consequence: the group now mounts *before* `layoutIri` resolves, so the synchroniser is started from a `watch` on `props.location` (first defined value wins) instead of directly in `onMounted`, which would otherwise never see the location and silently break admin group creation.
- **[#275](https://github.com/components-web-app/cwa-nuxt-module/issues/275) — `useHtmlContent` leaked a Vue app per link and never re-converted anchors.** The watcher source was the *container element ref*, so changed `v-html` in a still-mounted element left new `<a>` tags unconverted (internal links caused full page loads), and `createApp(...).mount(...)` per link was never paired with `unmount()`. Now `useHtmlContent(container, html?)` takes an **optional** HTML source and watches `[container, () => toValue(html)]` with **`flush: 'post'`** — pre-flush would re-convert the *outgoing* HTML, before Vue writes the new content. Backwards compatible (1-arg calls behave as before) but **call sites must pass their `htmlContent` computed to get re-conversion** — playground and the components-web-app template updated. MutationObserver rejected: it needs disconnect/reconnect guarding around our own DOM writes, and any DOM-derived trigger risks re-converting `CwaLink`'s own rendered anchors.
- **[#279](https://github.com/components-web-app/cwa-nuxt-module/issues/279) — `realtime_validate_disabled` was never read.** The API emits it on the **root** form vars (`AbstractType::buildView`, whitelisted in `FormView::OUTPUT_VARS`, required by `form_view_root.schema.json`), and **`UserLoginType` and `PasswordUpdateType` both set it `true`** — so login and password-update forms were PATCHing `{iri}/submit` on every keystroke, sending credentials to the API per keypress. `useCwaFormInput` now reads it via `fullName.split('[')[0]` and short-circuits the debounced `onInput`. The gate is deliberately narrow — an explicit `validate()` from a consuming app still fires — and is read at **debounce fire time** (a `computed`, not a setup capture) so a late-arriving form resource is respected.

### Closed as invalid / rejected

- **[#274](https://github.com/components-web-app/cwa-nuxt-module/issues/274) — INVALID.** `cwa-page.vue:78` is correct as written. The claim followed the getter's *declaration* but not Pinia: site-config is a **setup store**, which Pinia wraps in `reactive()`, so `store.getConfig` unwraps to a plain `SiteConfigParams` at runtime **and** in types. Adding `.value` would break it.
- **[#270](https://github.com/components-web-app/cwa-nuxt-module/issues/270) — reactivity claim wrong, change rejected.** `auth.user`/`.roles` are class getters over a `reactive()` store, re-invoked per access — there is no setup-time snapshot. Wrapping them in `computed()` would be breaking **and** would re-introduce the #260 nested-ref trap (a nested `$cwa.auth.user` in a template would become a permanently-truthy `ComputedRef`). Same reasoning as `Cwa.isStaticRender` returning a plain boolean.
- **[#263](https://github.com/components-web-app/cwa-nuxt-module/issues/263) — closed.** The constructor-capture fix is present (`api/fetcher/cwa-fetch.ts:16-35`) and covered; the `fix pending verification` label referred to a production-build check, which the suite cannot prove.

### Testing lessons from this batch

- **A test that only asserts "does not throw" asserts nothing.** `RoutesTab.spec.ts` exercised the post-delete `navigateTo` branch without checking the destination — which is exactly how the bare-IRI 404 (below) survived.
- **`mockImplementationOnce` queues survive `vi.clearAllMocks()`.** A leftover queued `getResource` leaked between `ComponentGroup` tests, making `locationResource` truthy and suppressing the alert — two snapshots had recorded "renders nothing" and were passing *for the wrong reason*, and outcomes were order-dependent. Reset mocks in `afterEach`.
- **Leaked fake timers mask real failures.** A failing assertion between `vi.useFakeTimers()` and `vi.useRealTimers()` leaked into three later `cwa-form-input` tests, which then hit the 5s timeout — 5 failures reported where there were 2. `afterEach(() => vi.useRealTimers())` added.
- **A mocked `watch` that is a no-op silently disables the code under test.** `ComponentGroup.spec.ts`'s `vue` mock stubbed `watch` as `vi.fn(() => {})`; it is now `vi.fn(mod.watch)` — still a spy, real behaviour.

### Adjacent finding — API bundle

`api_components_resend_email_verification` is registered at **`/verify-email/{username}/{token}`**, byte-identical to `api_components_verify_email` two entries above (`security.php:37-45`). Symfony resolves duplicate paths to the first match, so `ResendVerifyEmailAddressAction` is unreachable and **`/resend-verify-email/{username}` — the path this module calls (`api/auth.ts:97`) — is registered nowhere**. Logged in the bundle's own CLAUDE.md. With #281 fixed, that path will now be exercised and 404.

---

## Bug: a layout with an unresolvable `uiComponent` rendered a blank page silently ✅ Fixed ([#277](https://github.com/components-web-app/cwa-nuxt-module/issues/277))

When an app renames or deletes a layout component, the Layout resource's stored `uiComponent` dangles. **Vue renders an unresolvable name as an unknown HTML element** (`<cwalayoutdeletedbyapp>`), not as nothing — so the page content is technically still in the DOM, but inside an unstyled inline element with every bit of layout chrome gone. That is what reads as a blank page.

**Decision (Daniel): fall back *and* shout — never silently.** A layout is site-wide, so replacing everything with an alert (exact `ResourceLoader` parity) would let one dangling value take the whole public site down — worse than the bug. Instead:

- **Render side** (`layer/layouts/CwaRootLayout.vue`): `unresolvableUiComponent` checks the name against `instance.appContext.components` (only strings can dangle — the default layout is a component object). When set, `resolvedComponent` falls back to `LazyCwaDefaultLayout` so content still renders, a `CwaUiAlertWarning` renders above it reusing `ResourceLoader`'s message shape, and a `consola.warn` goes to the logs. The `stableLayoutUiComponent` anti-flash logic is untouched. Replaces the `todo` that sat at line 107.
- **Admin side** (`layer/pages/_cwa/index/layouts/[iri].vue`): the select silently showed *nothing* selected, since options are built only from registered `CwaLayout*` names. A stored value outside that list now gets an appended `<CleanName> (component not found)` option so the select shows the real state, plus a `CwaUiAlertWarning` beneath it. Purely presentational — nothing is mutated or saved.

**Two gotchas worth keeping:**
- The not-found option **must** live in its own computed, not inside `layoutComponentOptions` — that one is read eagerly at `:173` for `defaultResource`, *before* `localResourceData` is destructured from `useItemPage`, so referencing it there is a TDZ `ReferenceError`.
- **`vi.mock('#components')` fails outright** — `Error: Missing "#components" specifier in "nuxt" package`. It is a nuxt *virtual* module: a plain `import { componentNames } from '#components'` in a spec resolves fine, but vitest's mock-path resolver falls through to Node's `imports` field and dies. Specs must work from the real playground component names. (Same family as the `vi.mock('#imports')` trap.)

Tests: `CwaRootLayout.spec.ts` (+4) and a new `layouts/[iri].spec.ts` (11). Note the "content still renders" assertion must target the **opening tag** (`<cwalayoutdeletedbyapp`) — the bare name now legitimately appears in the warning text.

---

## Bug: CwaRootLayout captured the site config at setup ✅ Fixed ([#285](https://github.com/components-web-app/cwa-nuxt-module/issues/285))

`CwaRootLayout.vue` resolved `const siteConfigVar = $cwa.siteConfig.config` **once at setup** and read `siteConfigVar.concatTitle` inside the `useHead` `titleTemplate` callback. `getConfig` returns `mergeConfig(...)`, which builds a **fresh object** every recompute (`Object.assign({}, …)`), so the captured reference was a snapshot: changing the setting in `/_cwa/settings` had no effect until a full page reload, and because the callback never touched the computed, `useHead` had no reason to re-run either.

Fixed by reading the getter **inside** the callback. Not an unwrapping bug — see #274 above; the defect was purely reading the value outside the reactive callback. New `CwaRootLayout.spec.ts` captures the `titleTemplate` via a mocked `useHead` and flips the config after mount (fails against the old code).

---

## Bug: navigating to a resource by bare IRI always 404s ✅ Fixed

**This was the actual cause of the reported "delete the page → 404" screenshot** (URL `/_api/_/pages/{uuid}`, CWA 404 page, URL unchanged). Nothing to do with the delete itself.

**A resource IRI is a route *param*, never a path.** `getInternalResourceLink(iri)` (`composables/useCwaResourceRoute.ts`) returns `{ name: '_cwa-resource-page', params: { cwaPage0: iri } }`, and **`cwaPage0` exists only on that route** (`layer/pages/_cwa/[cwaPage0].vue`). The module's own catch-alls are `/`, `/:cwaPage1`, `/:cwaPage1/:cwaPage2`… (`createDefaultCwaPages`, `module.ts:41-44`) — **there is no `cwaPage0` among them**.

So `navigateTo(pageIri)` with a bare IRI string matches a catch-all with `params.cwaPage0` undefined, and `fetcher.fetchRoute` falls through to the route branch, requesting `/_/routes/` **+ the whole IRI**:

| Navigation | primary fetch |
|---|---|
| `navigateTo('/_api/_/pages/{uuid}')` | `/_api/_/routes//_api/_/pages/{uuid}` → **always 404** |
| `navigateTo(getInternalResourceLink(iri))` | `/_api/_/pages/{uuid}` + `/_api/_/resource_manifest/{uuid}` ✅ |

A 404 on a **primary** fetch whose path is the resource sets `showErrorPage` (`finishFetchShowError` = `isPrimary && path === resource`) → `showError` → the error page renders with the URL unchanged. Exactly the screenshot.

**Fixed in both offenders** — `RoutesTab.handleDeleteRoute` and `RouteRedirectsTree.deleteRoute`, which deliberately fall back to the IRI view when you delete the route you are currently viewing ("reload the page via the direct IRI now the route no longer exists"). The *intent* was right; they passed the bare IRI. Both now use `getInternalResourceLink(iri)` and no-op when there is no IRI.

**Why it survived:** `RoutesTab.spec.ts`'s test for this asserted only `expect(() => capturedFn!()).not.toThrow()` — it "exercised the navigateTo branch" without ever asserting the destination, so any destination passed. It now asserts the named route (and fails against the old code, verified by mutation); `RouteRedirectsTree` had no spec at all and now has one. Invariant pinned end-to-end in `test/integration/iri-view-nav.spec.ts`, which drives the real fetcher and shows both request shapes.

---

## Bug: deleting the page you are on from the header settings modal left you on a dead page ✅ Fixed

Deleting a page from the header **page settings** modal (`PageResourceAdminModal` inside `Header.vue`) dropped the admin on a 404 instead of an admin listing.

**Root cause — the redirect ran too late.** `Header.vue` did redirect (`@reload="goToAdminPagesView"` → `router.replace('/_cwa/pages')`), but `reload` is emitted from `useItemPage`'s **`saveCompleteFn`**, which `doResourceRequest` (`resources/resources-manager.ts:315`) only calls **after** `removeResource` (line 306) has already torn the page and its cascade out of the store. The unawaited `router.replace` then raced a page that no longer had any resources. `PageDataAdminModal.vue` and `RoutesTab.vue` already used the earlier hook — **`requestCompleteFn` (line 297), which runs before the removal** — and were unaffected.

**Fix:** `PageResourceAdminModal.handleDeleteClick` navigates from `requestCompleteFn` and **awaits** it, so we have left the page before the resource is deleted from the store. It only does so when the modal is for the page currently on screen (`props.iri === $cwa.resources.displayPageIri.value`) — from `/_cwa/routes/[iri]` the modal overlay's own back-to-list behaviour is unchanged. Destination follows `PageDataAdminModal`: a Page → `_cwa-pages`, a PageData → `_cwa-data-type` for its type (`fqcnToEntrypointKey`), falling back to `_cwa-data`.

- `query: { cwa_force: 'true' }` is included so the admin `NavigationGuard` cannot silently swallow the navigation (`abortNavigation()` with no argument returns `false` — a **silent** block, no error page). Same precedent as `goToTemplate`; the guard strips the query before redirecting, so the final URL is clean.
- `Header.goToAdminPagesView` is kept as a fallback but now returns early when `pageIsAdmin` — otherwise its unconditional `/_cwa/pages` would override the modal's data-type destination once the modal has already navigated.

Tests: `PageResourceAdminModal.spec.ts` (new — asserts the callback is passed as the **`requestCompleteFn`** argument, both destinations, the no-key fallback, and no navigation when the deleted page is not the one on screen) + a `Header.spec.ts` case for the fallback guard.

---

## Bug: empty component-group `location` when adding a component to an unpublished draft ✅ Fixed

**Reported from:** SRNTE (adding a component inside a static page nested in a data page). Fixed 2026-07-10.

### Symptom
Adding a component raised a red box: **"The location provided `` is not a current resource"** (`ComponentGroup.vue` — `:location` was empty). Refreshing the page made it show (the unpublished draft is local-only and vanishes on reload).

### Root cause
`useCwaComponent` computed `publishedIri` as `findPublishedComponentIri(iri).value` with no fallback. `findPublishedComponentIri` (`storage/stores/resources/getters.ts`) returns `undefined` for a **draft that has never been published** — and that `undefined` is **relied on by other callers** (the `Publish.vue` toggle target, `resource-stack-manager`'s `forcePublishedVersion`), so it must not be changed to fall back at the getter. A never-published draft is still a valid component-group location, so passing `undefined` as `<CwaComponentGroup :location>` produced the empty-location warning.

### Fix (landed)
Scoped to `useCwaComponent` (`src/runtime/composables/cwa-component.ts`), **not** the getter:
```ts
const publishedIri = computed(() => $cwa.resources.findPublishedComponentIri(iri.value).value ?? iri.value)
```
Falls back to the component's own IRI when there is no published version. The getter keeps returning `undefined` (comment added) so `Publish.vue` / `resource-stack-manager` are unaffected.

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

### Follow-up (separate) — [#245](https://github.com/components-web-app/cwa-nuxt-module/issues/245) ✅ Resolved — no bug
The original `route-middleware.ts:64` todo — "redirects do not work if clicking a redirect route quickly multiple times" — was reproduced against the #246 harness and **does not happen**: rapid repeat clicks always redirect and land on the target. The todo is deleted and #245 closed; static tracing's read that the redirect *resolution* logic is correct was right, and the suspected `waitForMiddleware` / `_processingMiddleware` race was disproved (a redirect landing mid-navigation is deferred, then fired). See the #245 entry under `## Open GitHub Issues` for the mechanisms and the real-timer testing gotcha.

---

## A component still being added takes changes as merge-patch ([#319](https://github.com/components-web-app/cwa-nuxt-module/issues/319))

While a component is being added (`_metadata.persisted === false`), `ResourcesManager.updateResource` applies a change to the local copy instead of PATCHing. Its `mergeWith` customiser used to **join arrays** (`b.concat(a)`), so selecting a second style stored the first twice, deselecting never removed anything, and choosing Default (`null`) threw. It now mirrors the API's merge-patch: an array or `null` replaces the stored value, and objects merge field by field. Every caller already sends the complete array, so nothing relied on joining.

---

## The page query is only forwarded to Collection fetches ([#318](https://github.com/components-web-app/cwa-nuxt-module/issues/318))

`Fetcher.fetch()` used to copy the **whole page query** onto every API request, so any `?utm_source=`, `?fbclid=` or cache-buster made every route, manifest, layout, page, group, position and component fetch for that render a distinct shared-cache key, and a valueless `?k` was sent as `k=null` with values unencoded.

Now the page query is added only to **Collection component** fetches (`{prefix}/component/collections/…`) — the only API response it changes (`CollectionApiEventListener` reads the main request's query to filter and paginate). Every other query the module sends is set on the path itself (`?published=true|false` from `useCwaResourceEndpoint`, `ResourcesManager`, and the fetcher's `publishedResource` fetch), and a path's own query is kept as it is. On a Collection, a path parameter wins over a page parameter of the same name; values are serialised with `URLSearchParams`, so a valueless parameter becomes `k=` and values are encoded. `noQuery` still skips it.

If the API ever reads the page query for another resource type, add that type to `consumesPageQuery` in `fetcher.ts`.

---

## `CwaComponentGroup` resolves `location` to the published IRI ([#317](https://github.com/components-web-app/cwa-nuxt-module/issues/317))

A nested group's `location` may be the component's draft `iri` or its `publishedIri`; both now resolve to the same group. `ComponentGroup.vue` derives `resolvedLocation = findPublishedComponentIri(location) ?? location` and uses it for the group reference, the location lookup, the not-a-current-resource alert, the disabled check and the synchroniser. Before, passing the draft `iri` looked up a different group and the synchroniser could create a stray empty group against the draft.

`findPublishedComponentIri` treats a non-publishable resource as published and returns it unchanged, and returns `undefined` for a never-published draft, so pages, layouts and never-published drafts keep their own IRI. `hasLocation` (#276) and `isNewPosition` still read the raw prop. The getter itself had no tests; `getters.spec.ts` now pins its behaviour.

---

## Reordering positions in a group ([#316](https://github.com/components-web-app/cwa-nuxt-module/issues/316))

Positions could land in the wrong order after reordering. From consistent data a single move was always correct; it went wrong when the local copy had drifted: duplicate `sortValue`s, a failed PATCH that was still mirrored locally, another editor's pending updates, and two moves inside one debounce window (only the last was sent).

`ComponentGroup.Util.Positions.ts` now:

- **One serialised queue per group** — one 1s debounce, each flush chained behind the previous one. Display numbers are cleared after every flush (including one that sends nothing) unless another reorder arrived during it.
- **Base order** is the local `sortValue` order at flush time, **target order** the display order; the positions moved are those outside the longest increasing subsequence, preferring the ones the editor moved. A single move is still **1 PATCH**, so Mercure volume is unchanged.
- **The local mirror is an exact port of the API's by-value shift** (`ComponentPositionSortValueHelper::calculateSortValue`, move branch). Do not go back to ±1 by index — it diverges as soon as values have gaps.
- **Duplicates are repaired** when detected: target values are computed in `sortValue` order and only positions whose value must change are PATCHed, highest first.
- **A failed PATCH is never mirrored**; the remaining moves and the queued debounce are dropped and display numbers cleared.
- **Pending (Mercure-staged) updates contribute only `sortValue`**, read via `Resources.getPendingResource(iri)`; everything else is re-staged. When another editor has reordered the group, the order this editor sees wins.
- An empty or non-numeric Order-field `location` is ignored.

**Trap:** storing a resource without `isNew` clears its pending update, so pending updates must be read *before* display numbers are stored on the reorder event.

Tests: the "group reorder queue against the server" describe in `ComponentGroup.Util.Positions.spec.ts` runs the real stores against a ported server-move helper.

---

## A failed API docs fetch no longer leaves the Add component dialog spinning ([#322](https://github.com/components-web-app/cwa-nuxt-module/issues/322))

Found through components-web-app#83. There, SSR stored an `http://` `docsPath`, so the browser blocked the docs fetch as mixed content. Any failed docs fetch had the same effect: the dialog stayed on its spinner until a full page reload.

- `ApiDocumentation.fetchAllApiDocumentation` clears `apiDocPromise` in `.finally()`. It used to be cleared only on success, so every later call, including `refresh = true`, rethrew the first failure.
- `AddComponentDialog` sets its loading state on every open. A failure now shows "Could not load the available components" and logs the cause. Reopening the dialog is the retry.

Deliberately out of scope: a timeout on the wait for `docsPath`, resolving `docsPath` against `apiUrlBrowser`, and requesting `''` instead of `'/'` for the entrypoint (the API answers `'/'` with a trailing-slash 301).

---

## `allowedComponents` format contract

The `:allowed-components` prop on `<CwaComponentGroup>` accepts **component collection IRIs** — relative paths without the API path prefix (e.g. `'/component/navigation_links'`). The synchroniser normalises these to the prefixed format before storing or comparing.

**Do not pass PHP FQCNs to the prop.**

**Omitting the prop means "leave it as it is", not "clear it"** ([#303](https://github.com/components-web-app/cwa-nuxt-module/issues/303)). The prop has no default, so a template without `:allowed-components` passes `undefined` and the synchroniser makes no PATCH. That keeps a list set by fixtures or the REST API. Pass `:allowed-components="null"` to clear it on purpose. Previously the prop defaulted to `null`, so the first admin page load silently wiped any list set elsewhere.

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
| `withFile(fileOps?)` | `useCwaFile` | `fileOps` — see `### fileOps` below |

`useCwaCollectionResource` is a thin wrapper over its plugin (BC safe).

**File fields (#252 — renamed from Image):** the file APIs handle any uploadable file, not just images. `withFile()` exposes a field under a single **`files` map keyed by `fileProp`** (default `'file'`) on the `useCwaComponent` return — use it multiple times for multiple fields (`files.heroImage.contentUrl`, `files.thumbnail.contentUrl`). Entries are `reactive`, so nested refs unwrap in templates (no `.value`). `useCwaComponent`'s plugin merge **accumulates** the `files` key across plugins rather than shallow-overwriting it. For the per-field, named-at-call-site style, `useCwaFileField(props, { fileProp })` returns the flat refs (`contentUrl`, `displayMedia`, `handleLoad`, `loaded`) — same `useCwaFile` under the hood. Old `withImage`/`useCwaImage`/`useCwaImageResource`/`ImageOpsType` were **removed** (hard swap, pre-alpha). CLI scaffold type `'image'` → `'file'`. **Admin side of #252 done** — `useCwaResourceUpload` returns the typed `bind` object; spread it per field (always destructure — see the #252 issue entry). The `<CwaResourceFileField>` wrapper was dropped by decision.

### `fileOps`

The options object shared by `withFile(fileOps?)`, `useCwaFileField(props, fileOps?)` and `useCwaFile(iri, ops)`. All three fields are optional.

| Option | Default | Purpose |
|---|---|---|
| `fileProp` | `'file'` | Which uploadable field on the resource to read — the key into `_metadata.mediaObjects`. Also the `files` map key for `withFile`. |
| `imagineFilterName` | *(none)* | Selects the imagine variant from that field's media list (e.g. `'thumbnail'`); falls back to the first item when no variant matches. |
| `imageRef` | *(none)* | **Opt-in** template ref used for one thing only: the already-loaded-on-mount check (below). |

**What `imageRef` is for.** An `<img>` decoded from cache can finish loading *before* Vue attaches the `@load` listener, so `@load` never fires and `loaded` would stay `false` forever — placeholder stuck over a fully-loaded image. `imageRef` lets `useCwaFile` read the element's own load state (`complete` / `naturalHeight`) once on mount and call `handleLoad()` itself. It is the **only** consumer of the ref; everything else (`contentUrl`, `displayMedia`) is derived from resource data. Omit it and `@load` is the sole source of truth — which is correct for any non-image file field, since only an `<img>` can report its own load state.

**It must resolve to a real `<img>`** — either directly, or as the root element of a component:

```ts
// bare element — ref="file" on <img>
const imageRef = useTemplateRef<unknown>('file')
const { loaded } = useCwaFileField(props, { imageRef })

// component (NuxtImg) — ref="file" on <NuxtImg>; resolves to the component
// instance, which is unwrapped to its root <img> via $el
```

Both shapes are supported. Anything that can't report img load state (a `<div>`, an unmatched ref name → `null`, a non-image field) is ignored and waits for `@load`. Previously this was `imageRef.value?.naturalHeight !== 0`, where `undefined !== 0` is **true**, so a null/component ref auto-fired `handleLoad()` on mount and defeated load detection entirely (#267 §3, fixed in `8208e4cc`).

> **`imageRef` is never registered for you (#267).** It used to be auto-created via `useTemplateRef(fileProp)`. Two calls sharing a `fileProp` therefore registered the same key twice: Vue's **dev** build guards this and only warns, but the **prod** build compiles the guard out, leaving a bare `Object.defineProperty` with `configurable: false` → `TypeError: Cannot redefine property: file`. Dev-clean, prod-fatal — it caused a real SSR 500. Registration is now the caller's job, which removes the collision *by construction*: two calls that don't register a ref cannot collide. It also fixes an invisible coupling — the implicit ref only ever worked if you happened to name your template ref exactly the `fileProp`, and silently did nothing otherwise.
>
> **vue-tsc gotcha — annotate the ref.** `useTemplateRef('file')` infers its type *from the template*; if that template also reads the composable's own result (`files.file.contentUrl`), the inference is circular and vue-tsc raises `TS7022: 'imageRef' implicitly has type 'any' … referenced directly or indirectly in its own initializer`. Pass an explicit generic — `useTemplateRef<unknown>('file')` — to break the cycle. `unknown` is the honest annotation: on a component the value is the instance, not an `HTMLImageElement`.

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

