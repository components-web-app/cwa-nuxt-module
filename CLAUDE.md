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

### Choosing "Live" on a route that is already live ([#341](https://github.com/components-web-app/cwa-nuxt-module/issues/341))

**The issue's premise was wrong, and the real defect was its opposite.** It reported that re-choosing **Live** on a route whose scheduled `liveAt` has passed emits nothing, so no PATCH is sent and nothing is purged. The select does emit: `useCwaSelectInput`'s computed setter emits unconditionally, and Headless UI has **no equality guard** — `useControllable`'s setter calls `onChange` on every `Listbox.select()`, which `ListboxOption`'s click handler fires for the already-selected option too. A full mount confirms it: clicking **Live** on a route live since 2020 emitted `update:liveAt` with `now`.

So the defect was a **silent destructive rewrite**: `handlePublicationStateChange('live')` wrote `new Date()` with no check that the route was already live, replacing the date it actually went live — and, per the inheritance rule above, a parent's date feeds every descendant's `effectiveLiveAt`, so the reset propagated. Nothing in the UI changed either way, because the select already read "Live" and the `datetime-local` input is gated behind the `scheduled` state, so **a live route's own date was not visible anywhere**.

Fixed by making the control idempotent and the data visible: choosing Live keeps the **stored** `liveAt` (`routePublication`, i.e. the store resource, not `localResourceData`) when the route's own stored state is already live, and only stamps `now` when coming from scheduled or draft; returning to Live after an unsaved edit restores the stored date. `RoutesTabManage` now shows **"Live since &lt;date&gt;"** for a live route — the route's **own** date, since that is what this control edits, while the badges keep reporting the effective date. Badges were deliberately left alone.

**Deliberately not built: a "Publish now" action, or a per-route cache purge.** Their only real purpose was forcing a PATCH so the page is purged, and that was [#340](https://github.com/components-web-app/cwa-nuxt-module/issues/340)'s cached-404 bug, fixed properly at the cache layer — we do not add failsafes for bad caching at every level. A global purge already exists in site settings.

**Why it was missed, and the lesson:** every `RoutesTabManage` spec is `shallow: true` and emits straight from the select stub, so the real select's behaviour was never covered — which is exactly how an issue came to assert the opposite of what the code does. `ModalSelect.spec.ts` now pins it with a real Headless UI mount and a real DOM click on the already-selected option.

---

## Page HTML caching ([#289](https://github.com/components-web-app/cwa-nuxt-module/issues/289))

**On by default**; turn it off with `cwa: { pageCache: { enabled: false } }`, and tune it with `sharedMaxAge` (unset — follow the API) and `staleWhileRevalidate` (0).

**A page's TTL follows the API's, and is no longer capped at an hour** ([#325](https://github.com/components-web-app/cwa-nuxt-module/issues/325)). `sharedMaxAge` is now **unset by default**: `buildPageCacheHeaders` takes the lowest of the configured cap (when there is one) and the lowest `s-maxage`/`Expires` across the render's API responses, so in production a page inherits API Platform's `shared_max_age` — a year in a CWA API. `FALLBACK_SHARED_MAX_AGE` (3600) applies **only** when neither is present, which is a render whose API responses carried no freshness at all. `stale-while-revalidate` is now emitted whenever it is configured above zero; it used to be dropped unless the configured cap was the binding number, which with no cap would have meant never.

**This reverses the earlier "why an hour, and why not a day" reasoning, deliberately.** That argued the TTL is only a **backstop for when purge does not happen** — a dropped `PURGE`, a misconfigured `CACHE_URL`, an edge that was never wired up — so a longer TTL buys almost nothing (a page with traffic is at ~100% hit rate within the hour; SRNTE measured 450 req/s of cached HTML with the SSR pods idle) while making a silent purge failure proportionally longer-lived. What changed is that every case the hour was covering is now covered directly: content edits purge by resource IRI, site-config changes purge via `cwa-html`, scheduled publishing is bounded by the API (api-components-bundle#227), and a **deploy** — new `/_nuxt` hashes with no resource IRI changing — runs `purge-rendered-html` and re-warms from the sitemap (components-web-app#71, #80). The API tier already runs this exact model with a year-long TTL, and pages are built only from its responses.

**What the hour still hid, and now does not.** A silent purge failure now lasts as long as the API's TTL rather than an hour, and **output that did not come from the API is not tagged at all** — a server-rendered date or "time ago", a third-party fetch, anything from `useAsyncData` outside CWA — so it never refreshes. `sharedMaxAge` is the escape hatch for both, and that is what it is for: an app whose pages carry untagged time-sensitive output should set it.

The `enabled` default still lives in **two** places that must agree — `resolvePageCacheOptions` for the runtime, and the `?? true` guarding plugin registration in `module.ts`, which cannot import the runtime helper (it resolves `#cwa/resources/resource-utils`, unavailable at module-build time). Changing only the runtime default is a no-op for an app that sets no `pageCache` key at all, which is exactly the app the default exists for.

**Enabling it by default is a deliberate alpha-stage trade** (four known applications, kept in sync with the API, no stable release). Two risks it accepts, neither detectable by the module: an app whose SSR HTML carries its **own** personalised content — a cookie-driven `useFetch`, a geo banner, a per-visitor experiment — will publish it to a shared cache, because our gates only understand CWA data; and an app whose edge does not bypass the auth cookie will serve a signed-in admin the cached anonymous page, with no admin chrome until a hard reload. Tags the rendered HTML with the API resource IRIs it was built from (`Surrogate-Key`, joined with `', '` to match `ApiPlatform\HttpCache\SouinPurger::SEPARATOR`) so the API's existing purge invalidates pages, and derives the page's `s-maxage` from the API responses that fed the render.

**Decide-then-emit, not set-then-strip.** `plugin-page-cache.server.ts` marks `event.context.cwaPageCache = {}` in `setup()` and fills it at `app:rendered`, setting no headers; `server/page-cache-plugin.ts` is the single emission point at `beforeResponse`, where the status is final. Three consequences: there is never a window in which a wrong header exists; a CWA route resolving to a redirect *before* anything renders is still caught, because the context was marked during setup; and the non-200 guard is scoped to CWA renders instead of forcing `no-store` onto every unrelated 404.

**Cacheability is the API's decision, read off its responses** — never a cookie test. `CacheHeadersEventListener::markNeverStored()` sets `private, no-store` for an authenticated request to a personalisable resource and for an unpublished-route response, so **any** response carrying `no-store`/`private` makes the whole page unstorable. `auth.signedIn` is a second gate behind it, because `personalised_resource_classes` is app-configurable and an app that trims it would otherwise start publishing admin renders.

**A 4xx never counts towards the page's cache directives; a 5xx always does** ([#324](https://github.com/components-web-app/cwa-nuxt-module/issues/324)). `CwaFetch`'s server `onResponse` skips the merge for any 4xx, whatever the resource and whether or not it was the primary fetch. Without it, a page placing an **unpublished component** — a draft of a published one, or one never published — was never cached for anonymous visitors: the render fetches that component, the API answers 404 `no-cache, private`, and one `private` made the whole page `private, no-store`. That is the normal anonymous path, not evidence of private content, and the home page is the most likely place for it.

Nothing is lost by ignoring them, because three other gates already cover what a 4xx would have told us. **A failed primary fetch marks the render unstorable at source** — see #340 below; this used to read "the page's own status decides, because `server/page-cache-plugin.ts` forces `no-store` on any non-200", **and that claim was wrong**: the Nitro hook never sees an error status, because Nuxt renders the error page as an internal 200. #324 shipped on that justification and exposed #340. **Invalidation still reaches it**: the 404'd IRI stays in `allIds` (`initResource` runs from both `setResourceFetchStatus` and `setResourceFetchError`), so it is in the `Surrogate-Key`, and creating or publishing it purges the page — equally true for a position or a group. **A signed-in render stays unstorable** through the separate `auth.signedIn` gate, which is why a 401 is ignored too: under bundle#225 a component on an unrouted page answers 401 to an anonymous request, the same "not public yet" case as the 404.

**5xx is the carve-out, and the distinction is whether anything will purge the page later.** A 404 means not public yet, and the publish that makes it public purges the page. A 500 means the render is unreliable, and nothing purges anything when the API recovers — so a page built from a failed nested fetch must not be stored. Deciding on the status alone also keeps the rule in the one place that has the status, with no resource-type test and no URL parsing, so the bare-host prefix hazard (#266) never enters it.

### The Nitro hook never sees an error status ([#340](https://github.com/components-web-app/cwa-nuxt-module/issues/340))

**Error pages were being stored for the full TTL**, so a route scheduled with a future `liveAt` stayed a cached 404 after it went live — nothing purges on a clock transition, and an anonymous 404 is exactly what a shared cache will keep. Reproduced against a built playground: `/nope-123` came back `404` with `Cache-Control: public, max-age=0, s-maxage=3600` and `Surrogate-Key: cwa-html, /_api/_/routes//nope-123`.

**We caused this. #324 (`26f06f8d`) is what exposed it**, and the justification quoted above — "the page's own status decides" — was wrong in its key claim. Before #324, a gated route's `private, no-store` 404 made the whole render unstorable and hid the gap; skipping 4xx removed the only thing that was accidentally covering it.

**The mechanism, verified in the installed packages.** Nuxt does not render the error page on the request that failed. `@nuxt/nitro-server@4.5.2/dist/runtime/handlers/error.mjs:27` fires an internal `localFetch('/__nuxt_error', { headers: { …reqHeaders, 'x-nuxt-error': 'true' } })`, and `nitropack/dist/runtime/internal/app.mjs:100` routes that through the same node handler — so **our `beforeResponse` hook runs on the internal request**, whose status is `getResponseStatus(event)` on a fresh event, i.e. **200** (`renderer.mjs:234`). The `statusCode !== 200` guard therefore never fires, and we emit a full cacheable decision. `error.mjs:42-48` then copies **every** header of that internal response onto the real 404, and h3 does not run `onBeforeResponse` on the outer error path (`h3@1.15.11/dist/index.mjs:2325-2335`: the error handler's `send` sets `event.handled`, and the `if (event.handled) return` above the `onBeforeResponse` call short-circuits).

It is not limited to a plain 404. **Any** error goes through the same handler, so a 500 and a CWA route resolving to an error behave identically. The internal error render also re-runs CWA route middleware against the original URL — which is why the stale 404 carried the route's own IRI in its `Surrogate-Key`, and why saving the route did purge it.

**Two guards, both at `app:rendered`, no new emission point.**

1. **`plugin-page-cache.server.ts` declines the error render.** `event.headers.get('x-nuxt-error')` is read in `setup()` and the hook writes `{ unstorable: true }`. **The request header is the signal, not `nuxtApp.payload.error` and not the `/__nuxt_error` path.** The path is `joinURL(app.baseURL, '/__nuxt_error')`, so a `startsWith('/__nuxt_error')` test silently stops matching for an app served under a sub-path; `payload.error` is a mutable reactive field that `clearError()` empties — and `FetchStatusManager` calls `clearError()` on a primary-fetch success (#313) — so it is a render outcome rather than a request fact. The header is set by Nuxt's own handler as its re-entrancy guard, is baseURL-independent, and is readable synchronously before anything renders.
2. **A failed primary fetch marks the render unstorable at source.** `CwaFetch.markUnstorable()` flips the same per-request `cacheState` that `onResponse` folds API responses into; `FetchStatusManager.onPrimaryFetchError(handler)` fires it from `setFinalResourceFetchError` whenever `finishFetchShowError` is true — the primary fetch's own resource failed — and `Cwa` wires the two together. `onResponse` deliberately does not know which response is the primary fetch (that was the reason for #324's blanket 4xx skip); `FetchStatusManager` does.

**Honest accounting: guard 1 alone passes every case the e2e covers; guard 2 alone does not.** Rebuilt and measured all four combinations. With neither, the two 404 cases are stored. With guard 2 only, a **page that throws on a route the API serves** still goes out as `500` with `s-maxage=600` and a surrogate key — because the error render's own route fetch succeeds, so nothing marks it unstorable. With guard 1 only, everything passes. Guard 2 is therefore not what closes #340; it is kept because it is the rule the #324 change was supposed to honour, it holds without depending on `x-nuxt-error` remaining a Nuxt contract, and it makes `apiHttpCacheState` truthful for anything that reads it later.

**The guard must stay in the decision, not in the emission.** `page-cache-plugin.ts`'s `statusCode !== 200` check is unchanged and still earns its place for a CWA render that ends non-200 without an error page (a redirect, `setResponseStatus`); it simply cannot be the only gate.

`test/e2e/page-cache-error-headers.mjs` is the faithful guard, because **only the real renderer produces the outer response** — the unit and integration specs can assert the decision object but not the headers Nuxt copies onto the 404. It asserts a live page is stored and tagged, that a missing route, a route not live yet, an API failure and a throwing page each come back `no-store` with **no** `Surrogate-Key`, and that the scheduled route is stored the moment the stub API starts serving it.

**The API folds both scheduled transitions into `s-maxage` itself** (api-components-bundle#240). `CacheHeadersEventListener::findNextTransition()` caps an anonymous response at the earliest of its own `Expires` — a publishable draft's scheduled date, set by `PublishableEventListener` before the `isGranted` return — and, for classes in `http_cache.scheduled_expiry_resource_classes` (default `Route`, `RoutableInterface`, `ResourceManifest`), the next route `liveAt`. So the lowest `s-maxage` across a render already carries every clock-driven change. The module still reads `Expires` separately; that is now redundant but harmless, and it is converted using **that response's own `Date` header**, never `Date.now()` — comparing a server-issued absolute time against the local clock is exactly the [#262](https://github.com/components-web-app/cwa-nuxt-module/issues/262) bug.

`max-age=0` is hard-coded, not an option: a browser cache cannot be purged, and stale HTML referencing a previous build's `/_nuxt` hashes 404s and leaves a blank page. IRI filtering uses `getResourceTypeFromIri`, not `startsWith('/_api/')`, which is wrong for a bare-host API (#266) and would admit the bare `/` that `allIds` holds for the primary fetch path — registering every page under one shared surrogate key.

### Three things that bite, in order of how much

1. **The TTL is the consuming app's API config.** A page can never be cached longer than the shortest `s-maxage` the API returned, and since #325 that value *is* the page's TTL unless the app caps it. The bundle ships **no** `http_cache` defaults, so it is entirely the app's `api_platform.defaults.cache_headers.shared_max_age`. **An app on `shared_max_age: 60` gets 60-second pages**, and no module setting can lengthen that. Raising it is an API config change, and it is safe to raise — the API's own entries are purge-invalidated exactly as the HTML now is, and clock-driven transitions are capped, so the two mechanisms cover each other.
2. **Edge bypass for authenticated requests is a deployment prerequisite.** The module deliberately emits no `Vary: Cookie` (cookie cardinality collapses the hit rate). The shared cache must bypass requests carrying the auth cookie. This is not a content leak — two independent gates guarantee a cached entry is anonymous — but a signed-in admin served a cached page sees no draft content and no admin chrome until a hard reload.
3. **Go-live bounding is global.** `findNextLiveAt` is `MIN(liveAt)` over future dates across the **whole routes table**, so any pending go-live anywhere shortens every page's TTL. Over-conservative, therefore safe: a route's effective date is always the latest in its chain, so every real transition is some route's own `liveAt`, and the minimum can expire a response early but never late.

ISR/SWR route rules fight this: Nitro's cache is not in Souin's purge graph, so `module.ts` warns at build time when `pageCache.enabled` meets the same `staticRender` detection added for #262.

### The `cwa-html` surrogate key — a cross-repo contract

Every cacheable HTML response carries the constant key **`cwa-html`** alongside the resource IRIs, so the bundle can purge *all* rendered pages when a site-wide resource changes. The name is an interface contract shared with api-components-bundle#232 and must match on both sides — like `explicitAllowOnly` and `SouinPurger::SEPARATOR`'s `', '`, a mismatch fails silently by matching nothing. It is exported as `RENDERED_HTML_SURROGATE_KEY`; any token not starting with `/` is safe from colliding with a resource IRI.

This exists because a resource can shape every page without the front end ever holding it as a resource. **Site config is that case**: `siteName`, `concatTitle`, `maintenanceModeEnabled` and the robots settings come through `server/useFetcher.ts`'s own `$fetch`, never enter the resources store, and so appear in neither the accumulator nor `allIds`. Tagging pages with the site-config member IRIs was considered and rejected — it only works for resources the front end fetches *and can enumerate*, so every future site-wide resource would need the same bespoke plumbing.

The key is only emitted on a page the module actually caches; a declined or unstorable render carries no key at all. Purging it drops every cached page at once and the traffic lands on SSR together, which is why the bundle's class list that triggers it should stay short, and why this is driven by a write on an already-secured resource rather than by a purge endpoint anyone could call.

### The Route collection tag a route write purges — a cross-repo contract (api-components-bundle#313, for #344)

Every Route write (create, update, delete) purges the Route **collection** IRI, so a response tagged with it is dropped by any route write. In the CWA template that tag is exactly **`/_api/_/routes`**; each route's own tag is **`/_api/_/routes/<path>`**, e.g. `/_api/_/routes//my-route` (the double slash is the leading `/` of the path). Pinned by `features/main/route_purge_tags.feature` in the bundle, with the harness serving the API under `/_api`.

- **The `/_api` comes from the route import prefix** (`prefix: /_api` in the template's `config/routes/*.yaml`), not from Caddy (which uses `handle`, not `handle_path`, so the path reaches php unchanged) and not from a request base path. So the purged tag is the same whether the write came from HTTP, a console command, fixtures or a messenger worker. It is the same string as the `@id` the API returns, so emit the tag as the API spells it; do not rebuild it from `apiUrl`.
- **A route going live on its `liveAt` date purges nothing.** It is not a write. A cached sitemap tagged with this key still needs its own TTL to pick up a clock-based go-live.

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

### Purging everything the API has cached ([#326](https://github.com/components-web-app/cwa-nuxt-module/issues/326))

Site settings has a **Purge all cached data** action calling `SiteConfig.purgeHttpCache()` → `POST /_/http_cache/purge` (api-components-bundle#291): `ROLE_ADMIN`, no body, **204**, flushing the API and HTML caches together.

**It is a sibling endpoint, not a scope on the existing one.** `/_/rendered_html/purge` is declared `input: false`, which is what pins that no body or query string can widen its purge; a scope parameter would have reversed that guarantee. So `purgePageCache()` is untouched and `purgeHttpCache()` sits beside it, identical in shape. There is deliberately no API-only option — pages are rendered from API responses, so dropping the API without the HTML leaves pages built from the old data.

**A 501 is reported as "nothing was purged", never as success.** The bundle returns 501 when the deployment's purger cannot flush at all — anything but a Souin purger, or no known invalidation URL. Claiming a purge there would be exactly the lie the bundle refused to tell, so it has its own message rather than joining the generic failure branch. 401/403 and every other status stay ordinary errors.

**The action is available whether or not page caching is enabled**, which is why the section is no longer wrapped in `v-if="pageCacheEnabled"`. The API cache exists regardless of `pageCache.enabled` — that option only governs whether *this app's* rendered HTML is cached — so hiding the action with the page-cache section would have left an operator with no way to drop stale API data in the configuration where it matters just as much. With page caching off the section is titled **Cached data**, carries a note that pages are rendered fresh so the purge covers the API cache only, and shows neither the page-cache purge nor the warm.

**The warm is offered straight after a successful full purge, but only when page caching is enabled** — `server/cwa-page-cache-warm.post.ts` is registered only then, so the button would 404 otherwise. It calls the same `warmPageCache()`, confirmation and all, rather than a second code path.

**Unverified, and worth knowing before an operator presses it:** what Souin's flush does to its Redis store. If it flushes the whole database and that database is shared, the flush takes the rest with it.

---

## Admin-only code is kept out of the entry chunk ([#331](https://github.com/components-web-app/cwa-nuxt-module/issues/331))

The runtime singletons are constructed for every visitor, so anything they import at module scope lands in the Nuxt app entry and is `modulepreload`ed on every page. They were statically importing the confirm dialog, the component-focus overlay, `luxon` and an XML validator; Nuxt additionally imports the layer's `error.vue` statically (`nuxt-root.vue`: `import ErrorComponent from '#build/error-component.mjs'` — unavoidable), which pulled in the full-screen error page and its WebGL particle animation.

**Measured on the playground** by reading the Nuxt app entry's `preload` set out of `.output/server/chunks/virtual/precomputed.mjs` and summing the real chunk files: **36 chunks / 643,720 B raw / 227,115 B gzip → 18 chunks / 427,905 B raw / 152,556 B gzip**, i.e. **−215,815 B raw (−33.5 %), −74,559 B gzip**. The issue's own figures were taken on the components-web-app template, whose entry is larger, so the absolute numbers there differ; every relative claim held.

What moved, and why each is safe:

- **`luxon` → `new Date().toISOString()`** (`resources/resources-manager.ts`, `…/cta/CurrentResourceCta.vue`). Both uses were `DateTime.local().toUTC().toISO()`, which emits `…Z`, not `…+00:00` — byte-identical to `toISOString()`. That matters because `resources-manager.ts:210` **string-compares** `publishedAt` against now, so a format change would silently stop a just-published resource counting as published. `luxon` and `@types/luxon` are gone from `package.json`.
- **`ConfirmDialog` → `await import()`** in `confirmDelete`, `confirmDiscardAddingResource` and `confirmStackChange`, all already `async` and all immediately `await dialog.reveal(...)`. This is what drags `@headlessui/vue` (via `DialogBox`'s auto-imported `<CwaUiFormButton>`) and `@popperjs/core` in.
- **`ComponentFocus` → `await import()`** in `ResourceStackManager.createFocusComponent`, now `async`. With the confirm dialog this also removes the last entry-graph edge to `@vueuse/core`.
- **`<LazyCwaErrorPage>`** in `layer/error.vue`. Nuxt renders the error component inside `nuxt-root`'s `<Suspense>`, so it still server-renders; a client-side `showError()` now fetches the chunk first.
- **`fast-xml-parser` → `await import()`** inside the `sitemapXml` branch, which makes `SiteConfig.saveConfig` **`async`** — a deliberate public-API change, one in-repo caller (`settings.vue`), already `async`.
- **`LazyCwaAdminResourceManagerLayoutPageOverlay`** in `CwaRootLayout.vue`. `OutdatedContentNotice` beside it is deliberately left static: it renders in the **`v-else`, non-admin** branch, so making it lazy would cost every anonymous visitor a request.

**The `createApp`/`defineExpose` trap.** `createApp(defineAsyncComponent(() => import(…)))` looks like the obvious fix and is wrong: `mount()` then returns the *async wrapper's* proxy, while `ComponentFocus`'s `defineExpose({ redraw })` is on the inner component — so `redrawFocus()`'s `focusProxy.redraw()` throws. Use `await import()` and pass the resolved component to `createApp`.

**The staleness guard.** The `await` opens a window in which `removeFocusComponent()` can run (the `showManager` watcher does exactly that), which would leave an orphan overlay mounted after the focus was dismissed. `removeFocusComponent` increments `focusGeneration`; `createFocusComponent` captures it after its own leading `removeFocusComponent()` and bails if it changed. This also makes two overlapping calls safe.

**The unmount and the mount must stay in one synchronous block after the import.** `createFocusComponent` originally removed the mounted overlay *first* and awaited the import afterwards, which put a real gap between them: a cached dynamic import still resolves in a fresh task, so the browser gets a rendering opportunity with nothing mounted, and `ComponentFocus` is what dims the whole window around the selection — so **every selection change flashed the page bright**, and the first one waited on the network. The import is now awaited before anything is torn down, and `removeFocusComponent()` runs immediately before `createApp().mount()`. Measured through the container's child count across a selection change: `[1, 0, 0, 0, …]` before, `[1, 1, 1, …]` after.

The same method now also **does nothing at all when the mounted overlay is already the right one** — the live `domElements` ref is recorded as `focusDomElements` and compared against the incoming stack item's. `iri` is passed as the manager's own `currentIri` computed, the same object every time, so that ref is the only prop that can differ. Re-clicking the component already selected used to rebuild the overlay invisibly (the rebuild predates #331; only the gap was new) and now creates nothing, and a draft↔published swap on one element keeps the overlay mounted and recolours reactively instead of blinking. `refreshFocusForIri` still rebuilds when a component remounts with a fresh `ManageableResource`, because that is a new ref.

**`focusGeneration` is incremented at the top of the method, before either early return.** Every call supersedes whatever is in flight, including the one that then decides it has nothing to do — otherwise selecting B and returning to A before B's import resolves would take the no-op path without cancelling B, and **B's overlay would mount over A's selection**. Pinned in `resource-stack-manager.focus.spec.ts`, which needs the real `watch` and so cannot live in `resource-stack-manager.spec.ts`, where it is mocked away at file level.

**`useNuxtApp()` is read before the `await`, deliberately.** This path is client-only today (`document.createElement`), and on the client Nuxt sets the app context permanently, so resolving it after an await would work — but hoisting it costs nothing and removes any chance of a #263/#313 repeat if the path ever runs server-side.

**The build-output guard** (`test/e2e/entry-bundle-markers.mjs`, folded into `pnpm run test:e2e`) is the only thing that can catch a regression: bundle size is not unit-testable, and a static import added anywhere in the singletons' graph reintroduces this silently. It resolves the entry's `preload` set from the built manifest and fails on marker strings — `Invalid DateTime`, `InvalidXml`, `headlessui`, `preventOverflow`, `OES_texture_half_float`. Markers, not a byte budget, so dependency bumps don't produce false failures. `OES_texture_half_float` is a WebGL literal inside `BackgroundParticles.vue` rather than the component name, which a compiler change could stop emitting. `ssr-concurrent-status.mjs` additionally asserts the 404 page server-renders its `<canvas>` — proven non-vacuous, since no non-error page contains one — because the lazy error page is the one change that could break SSR while every status stayed correct.

---

## The layer is published as the `@cwa/nuxt/layer` subpath export

An application should extend the layer by its **package specifier**, not by a path into `node_modules`:

```ts
extends: ['@cwa/nuxt/layer']
```

The export names the config file, not the directory — `"./layer": "./dist/layer/nuxt.config.ts"` — because an `exports` map cannot name a directory and does not need to. `@nuxt/kit`'s `extends` resolver only intercepts filesystem paths and `~`/`@` aliases, so a bare specifier falls through to c12, which resolves it with exsolve and sets the layer's `cwd` to the resolved file's **dirname**. Node applies `realpath` on the way, which is what makes this matter: a layer resolved this way has a real `cwd`, so nuxt#36401 never applies to it. The old path form still works — it is a filesystem path, so the `exports` map never applies — and an application that keeps it keeps the prefetch bug, which is why the `pages:extend` workaround above stays until every application has moved.

**The two are complementary, not alternatives.** The workaround fixes every application without a config change; the export removes the cause for an application that adopts it and is a no-op for the workaround, since realpathing an already-real path returns the same string.

**Upgrading is one-directional:** the export exists only from this build onwards, so an application changing `extends` must take the module upgrade at the same time. The reverse is safe — upgrade first, change `extends` later.

Closes the layer half of [#273](https://github.com/components-web-app/cwa-nuxt-module/issues/273); the `.` subpath is still the only other export.

---

## Every public page prefetched the admin and auth pages ([#329](https://github.com/components-web-app/cwa-nuxt-module/issues/329))

Nuxt removes page chunks from the app entry's `dynamicImports` in `build:manifest`, so pages are not prefetched. It builds the exclusion list with `relative(srcDir, page.file)` and compares it against Vite's manifest keys — and when a layer is extended by a **filesystem path that goes through a symlink**, those two strings are different spellings of the same file. `page.file` keeps the symlink path; Vite resolved the module through `realpath`. Nothing matches, so every `/_cwa` admin page and every auth page is a prefetch hint on every public page.

This is the module's problem to fix, not each application's: the module registers those pages, and `extends: ['./node_modules/@cwa/nuxt/dist/layer']` is how every application installs it through pnpm. A layer extended by a **bare specifier** resolves through `realpath` and is filtered correctly — which is the clean long-term route, but it needs a config change in every app, and the hook needs none.

**The workaround is a `pages:extend` hook that rewrites `page.file` to its realpath**, in `module.ts` after the two `extendPages` passes — so it also covers the `cwa-page.vue` catch-alls, which have the same problem under a published install. Two deliberate choices:

- **It realpaths every page, not only this module's.** Realpathing an already-real path returns the same string, so it is a no-op wherever nothing is symlinked — the module's own playground is unaffected — and it also helps an application whose own pages are symlinked. Scoping it to the module's directory would have required comparing realpaths on both sides anyway, because `import.meta.url` is already resolved while `page.file` is not.
- **Production only** (`if (!nuxt.options.dev)`). `build:manifest` returns early in dev, so there is nothing to gain there, and dev's watcher expects the symlink paths.

Upstream: [nuxt/nuxt#36401](https://github.com/nuxt/nuxt/issues/36401), reproduction at [silverbackdan/nuxt-layer-symlink-prefetch](https://github.com/silverbackdan/nuxt-layer-symlink-prefetch). Removal conditions are in `DEPRECATIONS.md`.

**Measured** on a symlinked copy of the playground (identical tree, `extends` pointed at a symlink to `src/layer`), comparing the entry-derived prefetch set replayed from the built `precomputed.mjs`: **92 links / 480,304 B raw / 180,842 B gzip → 33 links / 276,794 B / 95,885 B**. The un-symlinked playground, where the hook is a no-op, builds **33 links / 276,791 B / 95,880 B** — three bytes apart, so the hook restores exactly the behaviour Nuxt intended rather than inventing one. A real production render of `/login` went from 89 prefetch hints (491,524 B) to 62 (399,500 B), with 1.9 KB less HTML, and `/login`, `/forgot-password`, `/reset-password/:username/:token` and `/_cwa/pages` all still resolve. Daniel measured 80 → 23 hints on the template.

**The trap: the playground cannot reproduce this**, because it extends the layer by a real relative path (`./../src/layer`). So no build-output guard in this repo can catch a regression of #329 — a prefetch assertion in `test/e2e/entry-bundle-markers.mjs` would pass with or without the hook. The behaviour is pinned in `module.spec.ts` instead (`page file realpath (#329)`), and the only faithful check is a throwaway copy whose `extends` goes through a symlink. The dev-gate case passes vacuously against a missing hook, so it was mutation-tested.

**Prefetch is not the same mechanism as a nested dynamic import.** `vue-bundle-renderer` walks `dynamicImports` exactly **one level** from each entrypoint and rendered module, and for each dynamic dependency adds only that chunk's *static* import graph. A chunk reached only through a nested dynamic import is never prefetched at all — which is why the TipTap editor is neither preloaded nor prefetched (#332), and why a `build:manifest` hook setting `prefetch = false` under the layer path was rejected as the fix here. The admin pages' bytes live in shared `_hash.js` chunks with no `src` key, so a path-based flag reaches only the page chunks themselves; simulated against a symlinked build it recovered 19 of the 54 links that realpathing recovers, leaving ~120 KB of admin-only shared chunks behind. It would also have suppressed `CwaRootLayout.vue`, which every public page wants.

---

## The admin UI is never prefetched ([#336](https://github.com/components-web-app/cwa-nuxt-module/issues/336))

On Nuxt 4.5 every anonymous visitor started getting prefetch hints for the admin `Header`, `ResourceManager`, `LayoutPageOverlay` and everything they import — on the template, an anonymous `/login` went from **18 hints / 126,665 B raw / 47,104 B gzip** to **59 / 303,962 B / 114,868 B**. `Header` alone accounts for +31 files / +127,329 B, because it *statically* imports `PageResourceAdminModal.vue`, which drags in `useItemPage`, the modal/form stack, `RoutesTab` and `cwa-form-input`.

**It is not a Nuxt regression, and pinning Nuxt at 4.4.8 was never the fix.** Both of Nuxt's `build:manifest` filters (pages, and global components) are byte-identical between 4.4.8 and 4.5.2, as is the layouts template. What changed is the **client manifest**, and the mechanism is worth keeping because it is counter-intuitive:

- `vue-bundle-renderer` walks `dynamicImports` one level from each id in `entrypoints ∪ ssrContext.modules`. `ssrContext.modules` holds **source paths**, so a rendered chunk is a prefetch root only if the Vite manifest has an entry under that same source key.
- Under **Vite 7 / Rollup** the root-layout chunk got **no `facadeModuleId`**, so Vite keyed it `_D4X7aU3e.js`. `ssrContext.modules`' `…/layer/layouts/CwaRootLayout.vue` matched nothing, and the layout's admin children were never walked. Cause, from the chunk's own tail: it exported `{pe as C, ne as _}` — the frozen interop namespace `genDynamicImport(file, { interopDefault: true })` produces, with **no `default`** — so Rollup could not treat it as that module's facade. It was the **only** dynamic entry in the whole 4.4.8 build without a source key (62 with, 1 without); 4.5.2 has none.
- Under **Vite 8 / Rolldown** the same chunk (5,016 B → 5,610 B, same modules) exports `{z as default, …}`, gets its facade, and is keyed by its source path. The layout becomes a second prefetch root and its four lazy children — plus their static closures — follow.

**The cross-test that settles it.** Holding one side fixed and swapping the other, for `ids = {entry, layout}`:

| | vbr 2.3.1 (4.4.8's renderer) | vbr 2.3.2 (4.5.2's renderer) |
|---|---|---|
| 4.4.8 manifest | 22 prefetch / 128,285 B — admin **absent** | 23 / 128,532 B — admin **absent** |
| 4.5.2 manifest | **61** / 305,137 B — admin **present** | **61** / 305,137 B — admin **present** |

Swapping the renderer changes nothing; swapping the manifest is the whole effect. (2.3.1 → 2.3.2 did change — `precomputeDependencies` stopped baking each module's dynamic-import prefetch into its own set and propagating it up static-import chains, storing `modules[id].dynamicImports` for a runtime walk instead — but that is a **narrowing** change and cannot add hints. 2.4.0 is unchanged in this respect.) Nuxt 4.5 also rewrote the hint-emitting block in `renderer.mjs` to honour `~lazyHydratedModules` / `~neverHydratedModules`; that is inert here, since we use no `hydrate-*` and `dependencyOptions` stays `undefined`.

**4.5 is the more correct of the two.** On 4.4.8 the root-layout chunk — needed to hydrate every page — was only ever a `prefetch` hint and never `modulepreload`ed, because nothing could attribute it. We were relying on an accident, so this is ours to fix.

### The fix: a `build:manifest` filter in `module.ts`

```ts
for (const chunk of Object.values(manifest)) {
  if (chunk.src && isAdminSource(chunk.src)) continue
  chunk.dynamicImports = chunk.dynamicImports?.filter(id => !isAdminSource(id))
}
```

`isAdminSource` matches `relative(srcDir, …)` of `runtime/templates/components/main/admin/` and `…/core/admin/` — the same base Nuxt's own two hooks use, and `import.meta.url` is already a real path (#329) so it matches `facadeModuleId`. Directory-scoped rather than a list of components, so a new admin component is covered without anyone remembering. Measured on the template against two builds of this module differing only in the hook: anonymous `/login` goes from **59 hints / 304,089 B raw / 114,869 B gzip** to **23 / 154,299 B / 54,148 B**, and `modulepreload` stays byte-identical at 37 links / 610,388 B.

**Why a manifest filter works here when #329 rejected one.** #329 would have had to set `prefetch = false` on hash-keyed shared chunks with no `src`, which reached 19 of 54 links. This strips **edges keyed by the target's source id**, and `Header.vue` / `ResourceManager.vue` / `LayoutPageOverlay.vue` all have source keys on 4.5 — removing the edge takes the whole downstream static closure with it. `CwaRootLayout.vue` itself is untouched and stays preloaded. Hints are the only consumer: the import edge lives in the chunk's own code and `__vite__mapDeps`, so the admin UI still loads on demand (verified — the header chunk's filename is still in the layout chunk and absent from the HTML).

**An admin chunk's own dynamic imports are left alone.** A visitor must never prefetch admin, but an admin who has already loaded the chrome should keep its internal prefetching, or every manager tab costs a cold fetch. The exemption is keyed on `chunk.src`, which is the honest expression of it: **an anonymous `_hash.js` chunk has no `src` and cannot be identified as admin** — but it can never be a prefetch root either (`ssrContext.modules` only ever holds source paths), so filtering it is inert.

**Two things the rule does not reach, deliberately:**

- **`core/ConfirmDialog.vue` is not under an admin directory** and, on Rolldown, is not even a manifest key — it is merged into an anonymous chunk the entry dynamic-imports. It is admin-only in practice (`confirmDelete`, `confirmDiscardAddingResource`, `confirmStackChange`), but no path rule can reach it. `ComponentFocus.vue` *is* under `main/admin/` and *is* caught.
- **`ErrorPage.vue` stays prefetched** (25,373 B raw, the second-largest hint on both versions, from #331's `LazyCwaErrorPage`). It is the one thing you want already present when something has gone wrong.

**No dev gate**, unlike #329's `pages:extend` hook. `build:manifest` *does* fire in dev, but with a two-entry stub manifest (`@vite/client` + the entry) that carries no `dynamicImports`, so a gate would be dead code — and Nuxt's own global-component filter, the closest analogue, has none either. `module.spec.ts` pins the absence of the branch rather than asserting on a stub, because a test fed the dev stub passes with or without a gate — the #329 vacuity trap.

**Latent, and recorded here rather than filed upstream:** Nuxt's own page and global-component filters are gated on `if (chunk.isEntry)`. On Vite 8 more rendered chunks are manifest roots, so a page or a global component dynamically imported from a **non-entry** chunk would escape them. It does not bite in the template today — the only non-entry roots are `CwaRootLayout.vue`, an anonymous ResourceManager-tabs chunk, and `cwa/layouts/primary.vue`, whose one dynamic import is an app SVG. Ours deliberately has no such gate, which `module.spec.ts` mutation-tests by re-adding it.

**The playground reproduces this, unlike #329**, because the layout chunk's source key does not depend on symlinks. So `test/e2e/prefetch-hints.mjs` (in `pnpm run test:e2e`) is a real guard: it replays `getRequestDependencies` for a rendered `CwaRootLayout.vue` and fails on an admin manifest key, an admin chunk file, or the markers `Sign out` (Header) and `Add Component` (ResourceManager). It **fails first if the layout has no manifest key, or if the manifest holds no admin keys at all** — without those two checks it would pass exactly as it would have on 4.4.8, for the wrong reason.

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

## The error page says when the site is empty, and when the API is not answering ([#346](https://github.com/components-web-app/cwa-nuxt-module/issues/346))

Two first-hour failures looked the same as any other error. A new site with no
routes gave a 404 at `/` with **Go back home** hidden (we are already home) and
the sign-in CTA gated on 401/403 — so the only person who could act had nothing
prominent to act on. And an unreachable API produced a generic 500, or Souin's
*Gateway Timeout* after 10s on a cold start, pointing at nothing.

**The issue overstates the first one slightly, and the correction matters for the
tests.** A `<ClientOnly>` footer already renders **Go to admin** or **Sign in →**
on every error page. So it is not "nothing to click", it is "nothing that reads
as a way in" — and `wrapper.html().includes('/login')` therefore **passes today
for the wrong reason**. Every CTA assertion is scoped to a
`data-testid="error-actions"` block, and one test asserts the footer link is
still the only `/login` on a non-root 404, so the file cannot go vacuous.

### Status code alone cannot tell the cases apart

ofetch's `statusCode` getter is `response && response.status`, so a connection
failure carries **no status**, and `createError` defaults it to 500 — identical
to an API 500. The invalid-resource error (`Not Saved. The response was not a
valid CWA Resource`) is a plain `Error` with no status either. So the flag is
set at the fetch site, where the difference is still visible:

```ts
if (error.statusCode === undefined) return !!error.request
return [502, 503, 504].includes(error.statusCode)
```

`!!error.request` is what separates a request that went out and got nothing from
one that was never made. **An API 500 is deliberately not unreachable** — the API
answered.

**`data` is the only transport, and it was free.** `H3Error.toJSON()` emits only
`message`, `statusCode`, `statusMessage` and `data`, and nitro ships that object
to `/__nuxt_error` as a **query string**. Every field on `CwaResourceError` is a
non-enumerable `defineProperty`, so the old `data: error` serialised to literally
`{"name":"CwaResourceError"}` — nothing read it, and its one virtue was
accidental: it did not leak `request`. It is now `{ apiUnreachable: true }` or
nothing. `experimental.parseErrorData` defaults to true, but an app can turn it
off, so the page reads `data` through a string-tolerant parse.

**`error.request` is the absolute internal API URL** and must never reach the
browser. It is logged server-side only. It is already in the Pinia payload via
`error.asObject`, which is #345's problem and deliberately untouched here — a
spec asserts the API origin never appears in anything passed to `showError`,
mutation-tested by putting `asObject` back.

### Maintenance and a starting API cannot be confused

The maintenance 503 is thrown in `server-middleware.ts` and never reaches
`setResourceFetchError`, so it carries no flag — and it cannot even occur when
the API is down, because `resolveConfigEventHandler` returns `undefined` first
and the maintenance branch is gated on `if (resolvedConfig)`. Keying on the flag
rather than the status is what keeps them apart, and the test that earns its
place is the one that fails when the rule is rewritten as `[500,502,503,504].includes(statusCode)`.

**A 503 from a container coming live is the case this copy is for**, not a
counter-example: "isn't responding **yet**" is literally true of it. The proper
fix for that window is the readiness route above — gate the traffic, and a
visitor never reaches this page during startup. The page is what is left for
deployments with no readiness gating.

### Copy

- **A 404 at `/`** — *No page here yet* / *Sign in to create one.* with a sign-in
  CTA. **`/` is a heuristic and is not disguised as anything else**: the copy is
  true of any 404 at the root regardless of whether the site is empty, and it
  claims nothing about the rest of the site. Proving "no routes at all" would cost
  `GET /_/routes?perPage=1` on a path that is already failing, which also fails
  when the API is down, and would change nothing we say.
- **Not on any other 404.** A mistyped URL on a public site is an ordinary miss;
  a login CTA there advertises an admin surface to everyone who fat-fingers a
  link. The footer link is the right weight for that case.
- **API unreachable** — *The site's API isn't responding yet* / *Please try
  again in a moment.*, with **no** sign-in link, because signing in needs the
  same API. It takes precedence over the empty-site case, which cannot co-occur
  anyway.

### The unhandled rejection in the same failure

`route-middleware.ts` calls `siteConfig.loadConfig(...)` **unawaited**, and
`loadConfig` had no error handling — so every SSR request with the API down threw
an unhandled rejection, and left `isLoading` stuck true. `loadConfig` now resets
`isLoading` and **rethrows** (an awaited caller, `settings.vue`, must still see
the failure rather than silently render defaults and save them back), and the
middleware — the caller that discards the promise — catches and logs.

**Deliberately not built:** reading `Retry-After` (usually absent, a new field to
thread through for nothing), and auto-retry on the error page (it turns a real
outage into a silently looping page, and it is a behaviour change rather than a
copy change).

---

## The health check stopped calling the API, and readiness became its own route ([#342](https://github.com/components-web-app/cwa-nuxt-module/issues/342))

`/_cwa/healthcheck` returned a static OK, but it was not a static request.
`server-middleware.ts` is registered with **no route**, so it runs for every
Nitro request, and it fetched `/_/site_config_parameters` **before** its skip
check. So every probe hit PHP. With the API down the probe still said OK; with
the API slow it waited, unbounded, past a 1s Kubernetes probe timeout.

**Two things the issue did not say, and both shaped the fix:**

- **`/_nuxt/*` never reaches the middleware**, so no asset skip is needed. Nitro
  unshifts its static handler ahead of every scanned handler, and h3
  short-circuits once that returns a body.
- **`/__sitemap__/*` and `/robots.txt` must NOT be skipped.** The middleware's
  `updateSiteConfig(e, …)` is the only thing feeding nuxt-site-config, and
  `skipMaintenanceChecks()` deliberately runs *after* the fetch for exactly that
  reason — it skips **maintenance**, not **config**. So the fix is a new early
  return, not a change to that helper.

**The skip is two exact paths, not `startsWith('/_cwa')`.** `/_cwa/pages` and
the rest of the admin UI are real renders that want the site config. It splits
on `?` because h3's `_decodePath` puts the query string in `e.path`, so
`allowedPaths.includes(e.path)` already misses `/robots.txt?x=1` — a pre-existing
bug this does not fix, but must not repeat. `module.spec.ts` pins that `/about`
**and** `/_cwa/pages` still resolve the config, which is the guard against the
list widening into a prefix test.

It also closes an exposure by accident: the maintenance block reads
`getRequestURL(e).pathname`, which **includes** the baseURL, and tests
`startsWith('/_cwa')` — so under a sub-path baseURL, maintenance mode returned
503 to the liveness probe and would have had the pod restarted.

### `/_cwa/readiness`

Registered **unconditionally**, unlike the warm route, because readiness is
always meaningful. It requests the API's `/_/health`
(api-components-bundle#312) at the server-resolved API URL, with
`credentials: 'omit'`, `ignoreResponseError: true` and **`redirect: 'manual'`**,
and returns 200 `{status:'OK'}` or 503 `{status:'UNAVAILABLE'}` with
`cache-control: no-store`.

- **Never `''` or `/`.** The API answers `/` with a trailing-slash 301, so the
  entrypoint is a redirect hazard — and not following redirects is what makes
  the probe honest.
- **Not `/_/site_config_parameters`.** Souin caches it, so a cached 200 would
  report ready while PHP was dead.
- **A 3xx is not ready**, and the `location` is logged: a redirect means the
  configured URL is not the API's address. Following it can turn an SSO wall
  into a false 200.
- **A 4xx other than 404 is ready** — the API answered; readiness is "can it
  serve", not "am I allowed". **A 404 is ready with a warning**, which is a
  transition recorded in `DEPRECATIONS.md`, not a permanent rule.
- **The URL, the status and the error stay out of the response body** — it is
  unauthenticated — and go to `consola` server-side.

**No caching or debouncing of the result.** A stale "ready" served after the API
fell over is the exact failure this exists to prevent.

**The probe timeout must be shorter than the caller's, and that is a contract
with the template.** 2000ms by default, so we answer 503 *with a logged reason*
rather than being killed mid-request; a Kubernetes readiness probe therefore
needs `timeoutSeconds` of at least 3. Both settings live in private
`runtimeConfig.cwa.readiness` (`NUXT_CWA_READINESS_PATH` /
`NUXT_CWA_READINESS_TIMEOUT`), defu'd in **outside** the `pageCache.enabled`
block. Unlike `pageCacheWarm`, the numbers live in **one** place — `module.ts`
imports `READINESS_DEFAULTS` from `runtime/server/readiness.ts`, which has no
virtual-alias imports.

**The site-config fetch now has a 5s timeout** (half Souin's 10s backend
timeout), and the trade-off is worth stating: a timed-out fetch returns
`undefined`, so the render proceeds on `options.siteConfig` defaults **and
maintenance mode is not enforced**. It is the only number here with a
correctness cost.

**Untested, and knowingly so:** that timeout. `useFetcher.ts` has no spec and
cannot get one cheaply — it imports `useRuntimeConfig` from `#imports` and the
`addServerTemplate` virtual `#cwa/server-options.ts`, neither of which vitest
can intercept. Every other spec mocks `./useFetcher` wholesale. A spec that
appeared to cover it would be asserting against a mock of the thing under test.

`cwa-readiness.get.spec.ts` drives the real handler over **real ofetch against a
real `node:http` server**, which is the only way to prove `redirect: 'manual'`
and the timeout actually reach undici rather than being dropped — the options
object alone proves nothing. It also asserts the visitor's cookie is never sent
and the API origin never appears in the response body.

---

## Maintenance mode verified the admin's JWT with the API, not by decoding it

Anyone could walk past the maintenance screen. `server-middleware.ts` gated the
bypass on `jwtDecode(cookies.api_component)`, and `jwt-decode` **only
base64-decodes — it performs no signature check at all**. Every value the gate
read was therefore attacker-controlled: `roles`, `exp`, and the `cwa_auth=1`
cookie tested alongside them. A hand-written `{"roles":["ROLE_ADMIN"],"exp":<future>}`
with a junk signature and two cookies was enough, and no API request was involved
in the decision.

**Low severity, and worth being precise about why.** The pages a bypasser then
sees are rendered from API responses made with their own invalid cookie, so the
API serves them the anonymous public site. Nothing private leaks; what fails is
that maintenance mode does not hide the site.

**The fix was already in the repo, one directory over.** `cwa-page-cache-warm.post.ts`
forwarded the incoming cookie to the API's `/me` and read `roles` off the
**verified** response, added precisely because — as the #315 notes put it —
`server-middleware.ts` "only decodes the JWT without verifying it, which is too
weak". That function moved to `server/is-admin.ts` unchanged and both callers use it.

- **The decode stays as a cheap pre-filter.** No cookies, a wrong `cwa_auth`, no
  admin role, a missing or past `exp`, or a decode that throws all refuse without
  touching the network — so maintenance mode does not turn every anonymous hit
  into an API round trip. Only a request already presenting a live-looking admin
  token costs a `/me`.
- **`/me` is what grants the bypass**, with a 3s timeout, and **it fails closed**:
  a timeout, a non-2xx or any throw shows the maintenance page. An admin shown
  maintenance because the API is sick is the right outcome.
- **The timeout is a constant, not an option.** `runtimeConfig.cwa.pageCacheWarm`
  is registered only when page caching is enabled, and nothing has asked for this
  to be tunable.

`server-middleware.spec.ts` pins it: the API refusing a well-formed admin claim
still 503s, and each pre-filter refusal asserts `/me` was **not** called. The
existing bypass test now asserts it **was** — a mock never asserted on is not
proven live. Mutation-tested by restoring the unverified bypass, which fails two.

---

## Deprecations and temporary code

Code kept only to support an older API, or to work around someone else's bug, is logged in **`DEPRECATIONS.md`** with the condition that has to be true before it can be deleted. Add an entry whenever you leave something in place for one of those reasons — an entry with no precondition is a todo, not a deprecation.

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

## The published package could not be installed ([#273](https://github.com/components-web-app/cwa-nuxt-module/issues/273))

Everything under `src/runtime/` and `src/layer/` ships, so an import there is a promise to every consuming app. Several were promises the package could not keep, and the repo could not notice: the **playground declares `@headlessui/vue`, `@tailwindcss/vite` and `@resvg/resvg-js` itself**, so nothing in this repo ever exercised the package as an app receives it.

**Proven by packing and installing, not by reading.** A fresh Nuxt 4.5 app with the tarball and nothing else failed twice: first `[nuxt-og-image] satori renderer missing dependencies: satori, @resvg/resvg-js`, then `Rolldown failed to resolve import "@headlessui/vue" from …/dist/runtime/templates/components/core/DialogBox.vue`.

### What moved, and the rule behind each

- **`@headlessui/vue` → `dependencies`.** Nine shipped `.vue` files import it. **Not a peer:** there is no v2 — `1.7.23` has been latest throughout — so `^1.7.23` dedupes with any app on `^1`, and a peer would force a line into every app's `package.json` for nothing. Two copies would cost bytes rather than correctness: context is `provide`/`inject` keyed by module-level `Symbol(...)`, so only composing an app's `<ListboxOption>` inside our `<Listbox>` would break, and every CWA usage is self-contained. Its `useId` defers to Vue 3.5's, so ids do not diverge across copies either. This is what #236 already accepted in principle — Headless UI injects no theme or config, so a hard dependency is safe.
- **`@nuxt/kit` and `@nuxt/schema` → `dependencies`.** `@nuxt/kit` is a real top-level import of `dist/module.mjs`; `@nuxt/schema` is emitted into `dist/module.d.mts` and `dist/types.d.mts`. Both resolved only through pnpm's default hoisting — the `unbuild` trap above, one layer out.

  **The cost is contractual and invisible in the diff: `^4.5.2` now ships to every app.** It must stay in step with `meta.compatibility.nuxt` and with the `moduleDependencies` versions; raising one without the others gives an app two Nuxt toolchains or a version error it cannot act on.
- **The five `@nuxtjs/seo` sub-modules → `dependencies`** at the same ranges `@nuxtjs/seo` uses, so they dedupe to one copy rather than installing a second `nuxt-site-config`. They are named in `moduleDependencies` and their `#site-config/…` aliases are imported by shipped code, but they were only ever reachable transitively.
- **Removed: `@takumi-rs/core` and `@nuxtjs/color-mode`.** Neither is referenced anywhere in `src`. Takumi is an *optional peer of `nuxt-og-image`*, so putting it in our `dependencies` never helped: under an isolated install it sits in our own deps directory where og-image cannot see it, and setting `ogImage: { renderer: 'takumi' }` still failed on the satori check. `cwa:dark:` compiles to `@media (prefers-color-scheme: dark)` with no `.dark` class selector, so nothing needed color-mode either.
- **`@tailwindcss/vite` → `devDependencies`.** Only the playground uses it, and it declares its own.

### OG images are opt-in, and `moduleDependencies` is a function because of it

`satori` and `@resvg/resvg-js` are **optional `peerDependencies`**, not dependencies. `@resvg/resvg-js` is a native binary; forcing it onto every app and CI image to fix a case no current app hits is the wrong trade, and it joins the `sharp` family of security overrides.

`moduleDependencies` is therefore a function of `nuxt`: it requires `nuxt-og-image` **only when both renderer packages resolve** from `nuxt.options.modulesDir`. Three things make that the shape it has to be:

- **`optional: true` is not the mechanism.** `@nuxt/kit`'s `installModules` skips an entry entirely only when it is optional **and** carries no `version`, `defaults` or `overrides` — with a version it still resolves it and records an error. And `@nuxtjs/seo` is our dependency, so `nuxt-og-image` is always *resolvable*; an optional entry would still have installed it, and it would still have thrown.
- **Neither the template nor SRNTE lists `nuxt-og-image` in `modules`** — both rely entirely on this `moduleDependencies` entry. Skipping it unconditionally would have switched their OG images off silently. Both already declare all three optional packages as dependencies, so the conditional keeps them exactly as they are.
- **`cwa-page.vue` calls `defineOgImage`**, an auto-import that does not exist when og-image is absent. So `modules:done` registers a no-op `defineOgImage` (`runtime/og-image-fallback.ts`) in that case, and skips the `#og-image/components` type template. This mirrors what og-image itself does when disabled.

**What the failure looks like now.** An app with no renderer gets one build-time line — `open graph image generation is disabled. Install satori and @resvg/resvg-js to enable it.` — and a working build with no OG images. An app that lists `nuxt-og-image` in `modules` itself bypasses our gate and gets og-image's own message, which already names both packages and the install command.

### The guard: `pnpm run test:fresh-install`

`test/e2e/fresh-install.mjs` packs the module, installs the tarball into a throwaway app outside the repo with **none** of the optional packages, and builds it — twice: once with a default pnpm install, once with `hoist: false`.

**The no-hoist round is the one that earns its place, and mutation testing says so.** Demoting `@headlessui/vue` back to a devDependency fails both rounds; demoting `@nuxt/kit` **passes the default round and fails only the no-hoist one** with `Cannot find module '@nuxt/kit'`. A default install would have kept reporting green for exactly the bug that shipped.

The scratch app declares `nuxt` and `vue` and nothing else. `vue` is there because `hoist: false` also exposes *other packages'* undeclared imports — `nuxt-schema-org` imports `vue` without depending on it — and this check is about our package, not theirs. `vue` is already one of our own dependencies, so declaring it in the app hides nothing.

It is **not** in `pnpm run test`: it needs a network install and takes about 90 seconds locally. It runs in CI as its own `fresh-install` job which **`deploy-next` now depends on** — before this, a package that could not be installed would publish anyway, which is how this shipped. It is gated to `push` events, so it covers the publishing branches and stays off pull requests.

**`pnpm pack` runs `prepack`, so the check rebuilds `dist/`.** Run `pnpm run dev:prepare` afterwards to get the stub back.

### Snapshots no longer ship

`@nuxt/module-builder`'s mkdist pattern excludes `*.spec.ts` but not `*.spec.ts.snap`, so eleven snapshot files were published in `dist/runtime`. `build.config.ts` appends the missing negation in a `build:before` hook — the entry's own pattern, so nothing copies them in the first place. A `del` step in the `build` script was rejected: under the stub build `dist/runtime` is a **symlink to `src/runtime`**, so a mistimed run would delete the source snapshots.

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

## Bug: an SSR 4xx for a component was re-requested for every visitor ✅ Fixed ([#334](https://github.com/components-web-app/cwa-nuxt-module/issues/334))

The client-side counterpart of [#324](https://github.com/components-web-app/cwa-nuxt-module/issues/324), which stopped a 4xx making the **page** uncacheable. This stops the **browser** asking again for something it cannot be shown.

`ResourceLoader.ssrNoDataWithSilentError` was the only one of the three `onMounted` re-fetch conditions with no auth gate — its two siblings, `ssrPositionHasPartialData` and `refetchPublishedSsrResourceToResolveDraft`, both require `$cwa.auth.user`. So every anonymous page view re-requested every component the server render had 4xx'd, and could only get the same 4xx. Those responses are `no-store`, so each one reached PHP, plus a CORS preflight when the API is on another origin.

**The state it fires on:** `setResourceFetchError` stores `{ status: ERROR, error: error.asObject, ssr: import.meta.server }` and never sets `data`, so a server 4xx hydrates as `ssr: true` + `data === undefined` + a 4xx `statusCode` — all three parts of the condition. `asObject` is a plain object, so `statusCode` survives the payload. It is self-limiting to one retry: the client fetch rewrites `ssr` to `false` in both `setResourceFetchStatus` and `setResourceFetchError`.

**The spinner flash is downstream of that one request, not a separate defect.** `$cwa.resources.isLoading` is `!fetchesResolved || !!resourceLoadStatus.pending`, and `fetchesResolved` is not involved — `isFetchResolving` only ever reports a fetch with an unresolved *manifest*, which a standalone `fetchResource` has none of. It is `pending`, the count of `currentIds` in `IN_PROGRESS`, which `startFetchResource` sets. The same transition drives `ResourceLoader`'s own local `isLoading`. Suppressing the request removes both spinners; nothing else flips `isLoading` on an anonymous hydration.

**The gate is `(!!$cwa.auth.user || $cwa.isStaticRender)`**, and both halves earn their place:

- **A signed-in visitor keeps the retry** because the server render may have been anonymous when they are not. With page HTML caching on by default (#289), a cached anonymous page can be served to a signed-in admin — `plugin-page-cache.server.ts` gates storage on `auth.signedIn`, and edge bypass for the auth cookie is a deployment prerequisite, not something the module can enforce. The retry is how that admin still resolves a draft. An anonymous visitor has no such gap: SSR forwarded their (absent) cookie, so the client can only repeat the result.
- **A static render keeps it** because `isStaticRender` (the `ResourceLoader` computed, distinct from `Cwa.isStaticRender`) requires `status === SUCCESS`, so the re-fetch at `onMounted` never covers an errored resource. Without this half, a prerendered or ISR page whose component has since been published would stay broken until the page was re-rendered.

**`auth.user`, not `signedIn`, inside the gate.** `signedIn` is `false` while `/me` is in flight (`status` returns `LOADING`), and `user` is plain store state so there is no #260 `ComputedRef` trap. It also matches the two siblings exactly. The gate is deliberately "has a session" rather than "is an admin": draft visibility follows `publishable.permission`, which is app-configurable, so hard-coding `ROLE_ADMIN` would break an app that relaxed it.

**Reading auth at mount is safe**, traced rather than assumed: `route-middleware.ts` awaits `initClientSide()` → `auth.init()` → `refreshUser()` **before** its `isFirstClientSideRun` early return, and Nuxt awaits `app:created` (which runs that middleware inside the initial `router.replace`) before `vueApp.mount()`. The two sibling conditions already depend on this and work.

**`$cwa.auth.signedIn` is a third `watch` source**, so someone who signs in *without* reloading discovers the draft — otherwise the resource sits at `ssr: true` with nothing left to re-trigger the condition. `refreshUser` sets the cookie and the user before clearing `loading`, so by the time `signedIn` flips the gate is already satisfiable.

**Known and accepted:** a component that 401s for a reason other than draft visibility — the gated-route boundary in api-components-bundle#224, where a component reachable only via a not-yet-live route returns 401 rather than 404 — also stops being retried anonymously. Retrying could not have helped there either.

Tests: `test/integration/ssr-4xx-rehydration.spec.ts` drives the real stores and a real `node:http` API through `ResourceLoader`, asserting the requests the server actually receives and that `isLoading` never turns on; `ResourceLoader.spec.ts` pins the signed-in / signed-out / static-render branches. **Trap met writing it:** `createWrapper`'s `user` parameter has a default, so passing `undefined` for "signed out" silently produced a signed-in user and the new test passed against the unfixed code — signed out must be `null`.

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

## Bug: a component root element that changes without a remount loses its outline and its clicks ✅ Fixed ([#321](https://github.com/components-web-app/cwa-nuxt-module/issues/321))

`ManageableResource` records a component's DOM elements only on mount-shaped events: the IRI changing (`_initNewIri`), a child mounting (`componentMountedListener`), and `manageableComponentMounted` for its own IRI. **A component that replaces its own root element, or renders none until after it mounts, emits none of them**, so the recording is left pointing at an element that is no longer on the page.

Two things break together, which is why the fix belongs in the recording and not in `ComponentFocus`:

- The stack item holds that ref, `createFocusComponent` passes it to `ComponentFocus`, and the outline is measured from it. A detached element measures 0×0, and `useElementSize` reports 0 and recomputes `position`, so the outline collapses — **selected, manager open, nothing drawn**.
- The click listeners are bound to the old element, so **clicking the component does nothing**. Inside a nested group the click reaches the Container's element and selects that instead.

**The issue's `ResourceLoader` hypothesis was wrong.** Its `v-if` chain is safe: every branch change *remounts* the component, which emits `manageableComponentMounted` and re-reads. The trigger is the app component's own root — `<div v-if="editor">` in a TipTap editor, whose editor is created in `onMounted`, or any root branch that settles a tick late. Resource data is also retained through a re-fetch (`storage/stores/resources/actions.ts`), so an existing component never drops to the loader's spinner in the first place.

**Why auto-add is where it surfaces.** `AddComponentDialog`'s `watch(isInstantAddResourceSaved)` awaits `addResourceAction()` and emits `selectResource` on `nextTick`, so the component is selected the instant it is created — exactly while its root is still settling. Clicking a component that has been on the page for a while never hits it. That asymmetry is the bug: an auto-added component is an implementation detail and must behave exactly like selecting an existing one.

**The fix** is `ManageableResource.refreshElements()`, called from a new `componentUpdated` bus event that `useCwaResource` emits in `onUpdated`. It recomputes `getAllEls()`, and when the set has changed it rebinds the listeners and emits `componentMounted` so ancestors re-read too — the same path a mount already takes. The stack item holds the same ref object, so `ComponentFocus` repositions itself and no focus component is recreated.

- **Throttled at 40ms, leading and trailing**, matching `Admin.emitRedraw` exactly (`lodash-es/throttle`, created lazily on the instance). Values change on every keystroke, so the emit is frequent. **Leading must stay true** — the auto-add selection happens immediately after creation, so the first refresh has to be synchronous or the bug returns. **Trailing must stay true** — the last render of a burst is the one that settles the element. `clear()` cancels it, so a pending trailing call cannot fire against a torn-down instance.
- **Gated on `$cwa.auth.isAdmin`, read inside the callback.** `ManageableResource` only exists for admins, so a public render must do no work at all. Reading it at setup would capture the `ComputedRef` and make the gate permanently truthy — the #260 trap.
- The same detached-element guard as the mount emit, so a component updating inside a deactivated `KeepAlive` does not record elements that are off the page.

**`triggerClick` no longer swallows a dropped selection.** It waited on `watchOnce`, which is spent on the first change even when that change is the empty array `clear()` assigns, and the 1s timeout only stopped the watcher — it never resolved, so the promise hung and the `consola.error` never ran. It now watches with `watch`, re-checking each change, and resolves on timeout. Without this the late-root case fails silently: the component is never selected and nothing is logged.

Tests: `admin/auto-add-selection.spec.ts` drives the real stores, group, position, loader, manager and focus component through the auto-add path and asserts the same outcome as a control case that clicks a pre-existing component — 3 of its 4 cases failed against the old code (detached element, never selected, and a click that selected nothing), the control passed throughout. Unit cover in `admin/manageable-resource.spec.ts` (rebinding, no-op when unchanged, cancel on clear, the two `triggerClick` paths) and the two composable specs (the emit, the admin gate, the listener).

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

## The layer's admin composables live in `src/layer/_composables/` ([#330](https://github.com/components-web-app/cwa-nuxt-module/issues/330))

**Nothing but a Vue page may live under `src/layer/pages/`.** Nuxt scans the pages directory for every extension it resolves — `.js`, `.jsx`, `.mjs`, `.ts`, `.tsx`, `.vue` — so the seven composables that used to sit in `pages/_cwa/index/composables/` were each registered as a **route** with its own lazy chunk (`_cwa-index-composables-useItemPage`, path `composables/useItemPage`, …). Every one of them was also a dynamic entry of the app entry in the client manifest, so it became a `<link rel="prefetch">` hint on every **public** page — admin-only code advertised to anonymous visitors (#329, #331).

They moved to `src/layer/_composables/`, imported explicitly as `#cwa-layer/_composables/<name>`.

**Why `_composables/` and not `composables/`:** a layer's `composables/` directory is auto-imported, which would put seven admin-only composables into every consuming app's global import map under names the app never asked for — the opposite of the least-exposure principle, and a namespace collision waiting to happen. The underscore prefix means the directory matches none of Nuxt's magic directory names, so it is inert: nothing scans it, and the only way in is an explicit import. That is exactly why `src/layer/_components/` already exists beside the auto-scanned `src/layer/components/`, and `_composables/` relies on the same mechanism — **being outside every directory Nuxt scans**, not on an `ignore` pattern or a `pages:extend` hook that a consuming app could undo.

`copy-layer` (`copyfiles -u 1 "./src/layer/**" dist/`) is a wholesale glob, so a new top-level layer directory ships without any change to the build.

**The guard is `src/layer/pages.spec.ts`**, which asserts that every file the layer ships from `pages/` is a `.vue` file. It is a filesystem invariant rather than a route-table assertion because `nuxi prepare` does not emit `routes.mjs` — the route table only exists after a real build, so there is nothing for vitest to read. The built route table is the honest end-to-end check and belongs with the other build-output assertions in `test/e2e/entry-bundle-markers.mjs` (#331), not in a second mechanism of its own.

The spec ignores `*.spec.*` because `copy-layer` strips those, so the specs still under `pages/` are routes in the dev playground only and never reach the published package.

---

## `v-html` re-parses the LCP paragraph on hydration — `v-cwa-html` ([#333](https://github.com/components-web-app/cwa-nuxt-module/issues/333))

Since Vue **3.5.39** (`vuejs/core@024cf06d`, "force patch dynamic props when hydrating"), hydration re-assigns `innerHTML` on every `v-html` element even when the server HTML is byte-identical. `v-html` compiles to a *dynamic* prop — `_createElementBlock("div", { class, innerHTML: _ctx.html }, null, 8, ["innerHTML"])` — and `hydrateElement` force-patches anything in `dynamicProps` (`@vue/runtime-core/dist/runtime-core.esm-bundler.js:2207-2213`, `… || dynamicProps && dynamicProps.includes(key)`). The `isUnchangedResourceProp` escape hatch does not help: it covers only `src`/`srcset`/`href`/`poster` (`:2405`), and `patchDOMProp` assigns unconditionally with no equality check (`@vue/runtime-dom/dist/runtime-dom.esm-bundler.js:645-649`). vuejs/core#15138 reported the side effect and it was closed as intended.

So the browser throws away the server-rendered paragraphs and parses them again during hydration. On a CMS page the largest paragraph is usually the LCP element, which moves from first paint to after the JS has run — observed FCP 0.80 s against observed LCP 1.44 s on preview.cwa.rocks.

**`vCwaHtml` (`src/runtime/directives/cwa-html.ts`) is returned by `useHtmlContent`**, so a component writes `v-cwa-html="htmlContent"` instead of `v-html`:

```ts
const { vCwaHtml } = useHtmlContent(htmlContainer, htmlContent)
```

### `beforeUpdate`, never `updated`

The issue proposed `updated`. **That would have been a live regression**, and it is the reason the ordering test exists.

A `flush: 'post'` watcher job is queued with **no `job.id`** — `runtime-core.esm-bundler.js:895-919` sets `job.id = instance.uid` only in the `isPre` branch — and so is a directive's `updated` hook. Post-flush callbacks sort stably by id, so insertion order decides, and the watcher's scheduler fires synchronously when the value changes, *before* the render effect flushes and queues the directive hook. `useHtmlContent`'s anchor-conversion watcher (`html-content.ts:90-93`, `flush: 'post'`, #275) would therefore have run against the **outgoing** HTML on every edit: anchors in the new content never converted to `CwaLink`, and the `createApp` instances it had mounted orphaned inside DOM that is then discarded.

`beforeUpdate` is invoked synchronously inside `patchElement`, which is exactly where `v-html`'s prop patch happens today, so it restores the current ordering precisely. `binding.oldValue` is populated for any hook (`invokeDirectiveHook`, `:762-781`), so the `!==` guard works there. Mount is unaffected either way: the element's directive `mounted` hook is queued before the component's `onMounted`, which creates the watcher with `immediate: true` and runs it synchronously.

### Returned from the composable, not exported and not global

- **Global registration** from `runtime/plugin.ts` would put the name in every consuming app's global directive namespace whether used or not, resolve at runtime (`resolveDirective`, so a typo is a warning rather than a type error) and ship in every client bundle.
- **A standalone export** adds a public export path, and **cannot be auto-imported**: the SFC compiler emits `resolveDirective("cwa-html")` whenever the identifier is not already a setup binding, and unimport runs after that, so the name never appears for it to inject. An auto-imported directive would be a dead entry.
- **Returning it** adds one key to a composable that already returns nothing, is a compile-time local binding (`[[_unref(vCwaHtml), htmlContent.value]]`, and `_ssrGetDirectiveProps` on the server), and keeps the directive next to the container ref it shares an element with — which is what lets one spec pin the ordering contract above.

`src/runtime/directives/` is deliberately **not** in any `addImportsDir`.

### A `bind` object is not viable

The issue's third option — `useHtmlContent` returning a `bind` object so components never write a directive — was tested and rejected. `v-bind="{ innerHTML }"` does survive hydration (FULL_PROPS, `dynamicProps` is null, so the force-patch never fires), but `@vue/compiler-ssr` emits **no children** for it: `_push(\`<div${_ssrRenderAttrs(_mergeProps({class:"prose"}, _ctx.bind, _attrs))}></div>\`)`, and `ssrRenderAttrs` skips `innerHTML`. The server would render an empty container. Only a directive gets the `getSSRProps` → `_temp0.innerHTML` branch.

### The `mounted` guard, and when the saving does not land

`mounted` assigns only when `el.innerHTML !== value`, so the win depends on the browser's reserialisation of the stored string matching it. **For editor-written content it always does**: TipTap's `getHTML()` is `container.innerHTML` of a detached div (`@tiptap/core/dist/index.js:1222-1226`), so stored CWA HTML is already a fixed point. Measured as matching: bare `<br>`, `&nbsp;`, `&amp;`, `&lt;`, literal curly quotes, double-quoted attributes, attribute order, comments, empty elements.

Measured as **differing**, where `mounted` re-assigns once — today's behaviour, no worse, but no saving either: self-closed `<br/>`, numeric entities (`&#160;` → `&nbsp;`), a raw `&` in an attribute, unquoted or single-quoted attributes, uppercase tags, and boolean attributes without `=""`. All of these mean the HTML was written by something other than the editor — fixtures, the REST API, a migration.

### The win only lands per app

The module change alone changes nothing. Each app has to switch its own components, including the **components-web-app template**, which carries its own copies of `HtmlContent.vue` / `ui/AltHtmlContent.vue`. The playground copies are the worked example.

Left alone deliberately: `ConfirmDialog.vue:47` and `AddComponentDialog.vue:41` are admin UI, only ever instantiated client-side in response to an admin action. `ErrorPage.vue:115` *is* a public page that hydrates — the issue's "not hydrated on public pages" is wrong about that one — but it is gated on `v-if="stack"` and is a debug `<pre>`, never an LCP element. `playground/.../ExampleForm.vue:158` is a public hydrated `v-html` the issue missed; it is a checkbox label, so it is never an LCP candidate either.

---

## A component still being added takes changes as merge-patch ([#319](https://github.com/components-web-app/cwa-nuxt-module/issues/319))

While a component is being added (`_metadata.persisted === false`), `ResourcesManager.updateResource` applies a change to the local copy instead of PATCHing. Its `mergeWith` customiser used to **join arrays** (`b.concat(a)`), so selecting a second style stored the first twice, deselecting never removed anything, and choosing Default (`null`) threw. It now mirrors the API's merge-patch: an array or `null` replaces the stored value, and objects merge field by field. Every caller already sends the complete array, so nothing relied on joining.

---

## The page query is only forwarded to Collection fetches ([#318](https://github.com/components-web-app/cwa-nuxt-module/issues/318))

`Fetcher.fetch()` used to copy the **whole page query** onto every API request, so any `?utm_source=`, `?fbclid=` or cache-buster made every route, manifest, layout, page, group, position and component fetch for that render a distinct shared-cache key, and a valueless `?k` was sent as `k=null` with values unencoded.

Now the page query is added only to **Collection component** fetches (`{prefix}/component/collections/…`) — the only API response it changes (`CollectionApiEventListener` reads the main request's query to filter and paginate). Every other query the module sends is set on the path itself (`?published=true|false` from `useCwaResourceEndpoint`, `ResourcesManager`, and the fetcher's `publishedResource` fetch), and a path's own query is kept as it is. On a Collection, a path parameter wins over a page parameter of the same name; values are serialised with `URLSearchParams`, so a valueless parameter becomes `k=` and values are encoded. `noQuery` still skips it.

If the API ever reads the page query for another resource type, add that type to `consumesPageQuery` in `fetcher.ts`.

### Admin lists build their own query, and that is the only other caller allowed to

Narrowing `consumesPageQuery` silently broke every admin list. `ListContent` fetches `/_/layouts`, `/_/pages`, `/_/routes`, `/users` and the page-data entrypoints — none of which are Collection components — so from `0fd23d7c` until this fix **search, sort, `page` and `perPage` never reached the API**. The lists still rewrote the URL and re-fetched on every change, so they looked alive while always returning the server's default ordering and first page. Nothing failed: a list that ignores its filters is indistinguishable from one whose filters matched everything.

`ListContent.reloadItems` now merges the route query into `fetchUrl` itself and passes `noQuery: true`. **Do not fix this by widening `consumesPageQuery`** — that would put the tracking parameters back on every public render, which is the whole point of #318. The query belongs to the caller that knows it needs one.

`mergeQueryIntoPath` (`api/fetcher/query-utils.ts`) is the single implementation of the merge, used by both `Fetcher.appendQueryToPath` and `ListContent`. It is shared rather than copied because its rules are not guessable and must not drift: `URLSearchParams` serialisation (a valueless parameter becomes `k=`, values are encoded, `order[createdAt]` travels as `order%5BcreatedAt%5D` — the form `SearchResource` has always sent and the API accepts), one `?` for a path that already carries a query, and **the path's own parameter wins** over a page parameter of the same name.

**It forwards the whole route query, not a named set.** A named set would have to be a prop threaded through all five list pages, because the filter names are page-specific — `searchFields` differs per page and `isTemplate[]` exists only on `pages.vue` — and it would buy nothing: these fetches are admin-only and authenticated, so #318's shared-cache fragmentation does not apply, and the API ignores parameters it does not know (verified against api-components-bundle#297). The one module parameter that could ride along, `cwa_force`, is deleted by `NavigationGuard` (`admin/navigation-guard.ts:27`) before the route becomes active, so a list never renders holding it.

`reloadItems` used to have no error handling at all, which is the next section.

---

## An admin list that fails to load says so, and keeps what it was showing

`ListContent.reloadItems` had no error handling, and `CwaFetch` sets no `ignoreResponseError`, so a non-2xx rejected the promise and the function exited at `await response` before touching anything. `loading` stayed `true`, so the spinner ran forever over an empty page — measured `wrapper.text()` as `""`. Every call site discards the promise (`onMounted`, the route-query watcher, `useListPage.triggerReload`), so the failure was an unhandled rejection and nothing else. `SearchResource.search()` had the identical gap: `fetchingSearchResults` is set before the fetch and cleared only on the success path, so a failed search left "Loading..." in the popover permanently.

**The realistic trigger is an expired session, not the stale bookmark the #318 note described.** An admin leaves a list open, the JWT expires, and the next filter change or reload 401s. `CwaFetch`'s client `onResponse` branch fires `unauthorised.handler` (`api/fetcher/cwa-fetch.ts:55-58`), which is `Auth.onSessionEnd`'s closure (`api/auth.ts:274-278`) — it clears browser caches (#293) and **deliberately does not sign the user out**, so ofetch still rejects and nothing else happens. A 500 and an unreachable API are the next two; the 422 from a hand-edited `?order[reference]=sideways` is the least likely of the four, and an aborted request is not reachable at all, because nothing passes an `AbortSignal` and an SPA route change does not abort an in-flight fetch.

**The previous items are kept on purpose.** The state already retained them — only the spinner branch hid them — so rendering them is both the smaller change and the right one: an admin who mistypes a URL does not lose the list they were reading. The alert above the transition is what says the list is not the one the filters now describe, which is also why the items are not additionally dimmed: that would be a second mechanism for a fact the alert already states. The empty state carries `&& !loadError` so a first-load failure never renders "Sorry, no items found" under the alert, and the list branch is `v-else-if="items.length"` rather than a bare `v-else` so the transition simply has no child in that case — `hydraData` is `undefined` on a first load and the pagination would have thrown reading it.

**One generic message with the status code, no per-status catalogue.** `The list could not be loaded (422). Please try again.`, or `(network error)` when there is no status — the shape `settings.vue` already uses for its purge failures. There is deliberately **no 401 message**: "your session has expired" is actionable, but it belongs with a wider decision about what a mid-session expiry should do, given that `Auth.onSessionEnd` does not sign the user out, and putting that decision in one list component would pre-empt it. Recovery needs no button either — changing Sort or Search rewrites the query, the watcher fires and the list reloads, and `loadError` is cleared at the top of `reloadItems` so a successful retry drops the alert.

**The catch sits inside the `thisRequestId === currentRequestId.value` guard, and that placement is the whole correctness of the change.** The counter is incremented before the request, so a superseded request that later fails is still holding an old id; an unguarded catch would let a slow old 500 clear a newer in-flight request's spinner and raise a false alert over a good list. It reads like redundancy and it is not. `ListContent.spec.ts`'s `an older failure does not interrupt a newer request still loading` and `an older failure does not replace a newer success` both pass against the original code and both fail when the guard is deleted — mutation-tested, which is the only way a guard-shaped test earns its place.

**The `hydraData` write moved inside that same guard, fixing a bug that predates all of this.** It sat outside at `ListContent.vue:126-129`, so a slower *older* response overwrote a newer one's totals: measured as pagination showing `totalItems: 999` from the newer response and then reverting to `1` when the older landed, while `items` stayed the newer set. Reachable by typing in Search faster than the API answers, and nothing to do with errors — it surfaced only because drawing a `try` around those lines forces the question of which side of the guard they belong on.

**`SearchResource` gets the same treatment with a different display.** A compact popover is the wrong place for `CwaUiAlertWarning` — the alert is a full-width danger block with its own padding and outline, and the panel is `max-h-60 max-w-[300px]` — so the failure renders as a single `cwa:text-danger` line where "Loading..." would be, reading `Search failed (500)`. Retyping is the retry, so it carries no instruction. `open` gains `!!searchError` or the panel would close and the message would never be seen.

**Its late-response guard had to change to make that sound.** It compared `searchValue.value === fetchingSearchValue.value`, and `fetchingSearchValue` is overwritten by each new search — so both values are the *newest* search by the time an older response lands, and an older response passed the guard and clobbered the newer results. The request's own value is now captured in `requestedSearchValue` and compared against that, which is the request-id reasoning applied to a component that identifies its requests by the string it searched for. Pinned by `an older response does not replace newer results`, which fails against the old comparison.

## Admin list search is one `search` parameter ([#328](https://github.com/components-web-app/cwa-nuxt-module/issues/328))

API Platform deprecated `#[ApiFilter]`, `SearchFilter`, `OrderFilter` and `AbstractFilter`, so the bundle moved its resources to `QueryParameter` filters (api-components-bundle#289, merged as #297 in `ab76fc8b`). Every filter it uses exists in API Platform 4.4, and the bundle's Behat matrix runs on both `^4.4` and `^5.0`, so this does **not** need API Platform 5. Search stopped being one parameter per field ORed by `OrSearchFilter` and became **one `search` parameter per resource**, with the server deciding which fields it covers:

| Resource | `search` covers | `order[…]` | other |
|---|---|---|---|
| `/_/layouts` | `reference`, `uiComponent` | `createdAt`, `reference` | |
| `/_/pages` | `title`, `reference`, `uiComponent` | `createdAt`, `reference` | `isTemplate[]` |
| `/_/routes` | `path` | `createdAt`, `path` | |

It is case-insensitive and matches part of a value. **The URLs for sorting and `isTemplate[]` did not change**, which is why neither moved. The `isTemplate` implementation did: `SearchFilter` exact became `ExactFilter` with `BooleanQueryValue`, which maps `true`/`false` to `1`/`0`, so `isTemplate=false` now matches. The module sends the same URL either way. An invalid `order[...]` direction now returns 422.

**The browser URL carries only `search`; the legacy names are added at request time.** `ListFilter` binds its box to the single `search` parameter, so what an admin bookmarks or shares is `?search=x`. `ListContent` expands that into the per-field names as it builds the request, from a `searchFields` prop each list page declares. The prop therefore lives on **`ListContent`, not `ListFilter`** — the component that builds the request owns the transitional expansion, and `ListFilter` no longer needs to know the field names at all. A page parameter that is already set wins, so an explicit `?reference=y` is never overwritten by the search value.

**Both are sent everywhere, including `users.vue` and `data/[type].vue`.** Those two query the *application's* entities, which have no `search` until each application migrates. The template did so in components-web-app `cc8f57c` (#89, held until this change deploys), but applications generated earlier have not. API Platform ignores parameters it does not know — the bundle pins this in `features/main/page.feature` ("A per-field search parameter no longer filters pages") — so dual-sending is correct against a bundle from before the change and after it, the module never has to deploy in lockstep with an API, and those two lists start filtering the moment their entity declares a `search` parameter, with no further module change.

`SearchResource` (public as `CwaUiFormSearchResource`) sends `search` alongside what it already sent. Its `searchProperties` prop is unused in this repo but stays: it is public surface an application may be using, and least exposure governs *adding* API, not removing what apps already have.

**Deleting the transition** — the template's `User` and `BlogArticleData` are already migrated (components-web-app `cc8f57c`), so what remains is the applications that follow: remove `searchFields` from `ListContent` and the five list pages, delete `buildRequestQuery`'s expansion loop, and drop the per-field lines from `SearchResource.search()`. Nothing else refers to the legacy names. Do it only when no supported application is still relying on them; sending a parameter no one reads costs nothing, and removing it too early silently unfilters someone's admin.

**`order[field]` stays exactly as it is.** The bundle kept the URL shape (`'order[:property]' => new QueryParameter(filter: new SortFilter())`), and `URLSearchParams` sends it as `order%5Bfield%5D`, which is the form `SearchResource` has always used against this API.

---

## `CwaComponentGroup` resolves `location` to the published IRI ([#317](https://github.com/components-web-app/cwa-nuxt-module/issues/317))

A nested group's `location` may be the component's draft `iri` or its `publishedIri`; both now resolve to the same group. `ComponentGroup.vue` derives `resolvedLocation = findPublishedComponentIri(location) ?? location` and uses it for the group reference, the location lookup, the not-a-current-resource alert, the disabled check and the synchroniser. Before, passing the draft `iri` looked up a different group and the synchroniser could create a stray empty group against the draft.

`findPublishedComponentIri` treats a non-publishable resource as published and returns it unchanged, and returns `undefined` for a never-published draft, so pages, layouts and never-published drafts keep their own IRI. `hasLocation` (#276) and `isNewPosition` still read the raw prop. The getter itself had no tests; `getters.spec.ts` now pins its behaviour.

---

## A shared template page at two depths renders the deepest depth's dynamic components

**Only the dynamic `ComponentPosition` response varies by the `path` request header**, and that is what keeps this small. The bundle reads the header in exactly **one** place — `PageDataProvider.php:51`, `$request->headers->get('path')`; a repo-wide grep for `headers->get('path')` returns that line alone. Its callers are `getPageData()` and `getOriginalRequestPath()`, and the only non-fixture consumer of either is `ComponentPositionNormalizer`, at `:162` (behind the `if (!$object->pageDataProperty) return $object;` guard at `:152`) and `:105` (writing `_metadata.pageDataPath`). `Vary: path` is scoped to match: `ComponentPositionEventListener.php:49-61` returns early unless the data is a `ComponentPosition` on a `GET`, then sets it only `if ($data->getPageDataProperty())`. Nothing varies on a Route, Page, PageData, Layout or ComponentGroup.

**The variance does not propagate.** `normalizeForPageData` ends at `:225` with `$object->setComponent($component)`, read off the page-data entity by property accessor — so two depths resolve to two **distinct component IRIs**, which already coexist in the store. Only three fields on the position differ: `component`, `_metadata.pageDataPath` and `_metadata.isDynamicPosition`.

**The manifest emits a shared template Page at both depths by design.** `ManifestDepthGroupTrait.php:33-39` re-initialises `$seen` **inside** the per-depth loop; only `layout` is deduped across depths (`$emittedLayouts`). So a Page shared by a parent and a child page data, its component groups and its positions are all listed twice.

**What we then do with it, and why the parent depth is wrong.** `iriDepths` holds one depth per IRI and the loop in `setManifestIrisByDepth` ascends, so the **deepest** depth wins; `irisByDepth[0]` and `irisByDepth[1]` both contain the shared page IRI, so `pageIriAtDepth(0)` and `pageIriAtDepth(1)` return the same one and both `CwaPage` depths render the same template; and `addFetchResource` refuses the repeated position (`fetchStatus.resources.includes(event.resource)`), so exactly **one** request goes out, carrying the child's path. `ComponentPosition.vue:43` reads the single store entry. The parent depth therefore renders the **child's** dynamic component, silently — no error, no failed request, no warning until now. `depthPaths` is not affected; it is keyed by depth and stays correct.

`setManifestIrisByDepth` now emits **one** `logger.warn` per manifest naming every repeated IRI and all of its depths. Deepest-wins is deliberately unchanged: first-wins would simply break the child instead of the parent, and neither is correct.

**No site does this today and the fix is deferred.** It is not marginal when it happens — a template worth sharing between two page datas is mostly dynamic positions, since static ones would render identically twice — but it is unused, and the areas it touches are where the silent bugs live (#256 retention, #261 depth headers, #257 eviction).

**The shape it would take.** Fetch identity becomes (IRI, `path` header) so the position is requested once per depth; the store keeps IRI keys and the position entry gains a map of only the fields that vary, so `byId`, `allIds`, `currentIds` and every public IRI-keyed composable are untouched; `ComponentPosition.vue` picks its variant from the injected depth. **`fetchStatus.resources` must stay bare IRIs**: the surrogate-key filter (`api/http-cache.ts:109`) is `getResourceTypeFromIri(id) !== undefined`, a **prefix** test, so a composite id like `/_/component_positions/x::/conference` passes it and is emitted as a key the API's purger can never match — a silent loss of invalidation, the same failure mode as a mismatched `cwa-html`. `positionsByComponent` and the delete cascade would also need the depth, and Mercure's position refetch and `ResourceLoader`'s client refetch each resolve one depth today.

**What makes it tractable later:** the render depth is already available by injection — `CwaPage.vue:47` provides `'cwa-page-own-depth'`, inherited through groups and positions — so no new plumbing is needed to choose a variant at render time. Layout-level groups sit above `CwaPage` and inject the default `0`, which is right, since layouts are the one thing the manifest dedupes across depths.

**Unreproduced risk:** a shared template puts two `ComponentGroup` instances on the page for one group IRI, each with its own debounce queue and each listening to the `reorder` bus, and puts two DOM instances of one position IRI in front of an admin stack that is IRI-keyed throughout (`isResourceInStack`, `refreshFocusForIri`, `currentIri`). Whether that double-PATCHes through the #339 synchroniser or the #316 reorder queue was not tested.

### The `@type` variance guard in `isFetchStatusResourcesResolved` is dead — leave it alone

`getters.ts:334-337` compares `resourceData.data?.['@type']` against `CwaResourceTypes.COMPONENT_POSITION`, which is the string `'COMPONENT_POSITION'`, while the API sends `'ComponentPosition'` (bundle `features/assets/schema/component_position.schema.json:17`). The condition has never been true in production. Its test at `getters.spec.ts:373` constructs `'@type': CwaResourceTypes.COMPONENT_POSITION` — the enum key, not an API value — so it **passes for the wrong reason**.

**Correcting the `@type` alone would be a regression, which is why it is recorded rather than fixed.** The second half compares `apiState.headers.path` (a depth path, `/conference`) against `fetchStatus.path` (the primary IRI, `/_api/_/routes//conference`); those can never be equal either, so a "fixed" guard would return `false` for **every** page containing a dynamic position, making `isCurrentSuccessResourcesResolved` permanently false and breaking #256's early switch and #257's instant revisit together. Any future change here has to fix both halves at once and be tested against the real `'ComponentPosition'` string.

The live counterpart does work and is the precedent to follow: `storage/stores/resources/actions.ts:555-565` clears a dynamic position's `data` when it is re-fetched under a different `path` header, keyed on `_metadata.isDynamicPosition === true` — a real API field.

---

## A group the synchroniser cannot find is PATCHed with its location twice ([#339](https://github.com/components-web-app/cwa-nuxt-module/issues/339))

Loading a page as a signed-in admin sent `PATCH /_/component_groups/{id}` for groups that already belonged to the location, with the location IRI **duplicated** — `{"layouts": [X, X]}`, and `{"pages": [P, P]}` for a page's own group.

`createComponentGroupWatchHandler` (`ComponentGroup.Util.Synchronizer.ts`) fetches the group by `fullReference` when it is not in the store, and appended the location unconditionally. It now normalises the stored list to IRIs — tolerating an embedded resource, as `fetchAssociatedResources` already does — and returns without PATCHing when the location is there. The normalised list is also what a genuine PATCH sends, so an embedded resource is never echoed back as an object.

**A failed fetch is indistinguishable from "this group does not exist".** `getComponentGroupByReference` matches on `data.reference`, and a resource whose fetch errored sits in the store with `status: ERROR` and **no `data`** — so the lookup returns `undefined` either way, and the synchroniser's answer to `undefined` is fetch-by-reference-then-PATCH. That is why the fix is worth more than the redundant write it removes: **a misfire now costs a wasted GET instead of a bad write.**

**Arrival timing is not the trigger, and this is not layout-specific.** The server render does not resolve until every component group response has landed (proved by withholding them in the `test/integration` harness and watching `fetchRoute` stay pending), and the Pinia payload round-trips faithfully, so a hydrated SSR load whose fetches all succeeded never reaches this path. Page groups are affected identically to layout groups, which is what ruled out the first hypothesis — that the layout's groups arrive a round trip late because `Layout::$componentGroups` lacks `Route:manifest:read` (api-components-bundle#306). That manifest gap is real and worth fixing for the extra round trip and the late render, but it does not cause this.

**A successful PATCH would not stop it recurring.** The association it asks for already exists, so the API dedupes it, and the lookup is by `reference`, which the PATCH never touches. Every load starts from an empty store, so the cost is one spurious write per affected group **per page load, indefinitely** — not one bad write ever. Reproduced as three PATCHes on one signed-in hard reload, then one on a later reload of the same page, which is the intermittency of the underlying failure, not the write taking effect.

**The upstream cause is still unknown**: why those server-side group fetches produce no saved data. The candidates are a failed request, a response rejected by `isCwaResource` (logged `[CWA FETCH ERROR: Not a valid CWA resource]` and not saved), or a save dropped by `finishFetchResource`'s `abort || !isCurrent` guard. Settle it on a reload that PATCHes by reading `$cwa.resources.getResource(groupIri).value` — `apiState.status` and whether `data` exists — alongside the SSR log for that render.

**Coverage gap this sat in:** every existing spec mocked `fetchResource` as `vi.fn()` returning `undefined`, so the found-by-reference branch had **never been executed by any test**. Note also that `'should NOT create OR update resource IF loading is in progress'` passed only because `signedIn` was false — the class reads no loading state at all — and is renamed to say so.

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

## Large images are downscaled in the browser before upload ([#335](https://github.com/components-web-app/cwa-nuxt-module/issues/335))

**On by default.** `useCwaResourceUpload.handleInputChangeFile` passes the picked file through `downscaleImageFile` (`src/runtime/files/image-downscale.ts`) before the `FormData` is built. The argument is not only API memory — GD decodes the whole image inside the upload request at about 11.7 MB per megapixel, so a 48 MP photo peaks at ~563 MB — it is that above a certain size a bigger image gives the visitor nothing and costs them download time and the site storage.

**Defaults: 2560 px longest edge, 20 MP, quality 0.85.** 2560 is larger than anything a CWA layout renders. Quality 0.85 is the usual knee of the JPEG curve, and the not-smaller guard below means a bad choice can only cost a re-encode, never bytes.

**The defaults are chosen to sit under the template's server-side caps, and the two must be kept in step.** components-web-app accepts 20 MB uploads (`3338b9c`) and refuses over 40 MP with a 422 rather than a 500 (`d067024`, `Assert\Image(maxPixels: 40_000_000)` on `Image::$file`). The module's job is to make that refusal rare, not to replace it — a direct API upload never runs this code. **If the template's caps move, move these defaults, and say so in the docs.**

**Threshold and target are separate numbers**, because one limit conflates "is this worth touching" with "how big should it end up". `thresholdEdge` / `thresholdPixels` decide whether the file qualifies; `maxEdge` / `maxPixels` decide what it becomes. They default to the same values, so anything above the target is resized.

**Both an edge rule and a pixel rule, and it matters which triggers what.** The server's rule is pixels; the display rule is edge length. A file qualifies when it is over **either** threshold, and is scaled to fit **both** targets. With the default 2560 edge the pixel cap can never bind (2560² = 6.6 MP), and that is fine: it is the safety net for an application that raises `maxEdge` — a 20000×1000 panorama is only 20 MP, so an edge-only rule would scale it 7.8× for no server-side reason, and a pixel-only rule would leave a 8000×6000 photo at 48 MP.

**If the re-encoded file is not smaller than the original, the original is uploaded.** One size comparison, no format heuristics, and it can never make things worse. It is what covers a palette PNG decoding to 32-bit RGBA and re-encoding larger — the case that would otherwise argue for excluding PNG, which we do not want to do because transparency has to survive.

**The format is kept**: a JPEG stays a JPEG, a PNG stays a PNG, and the name, type and `lastModified` carry over.

**Excluded: SVG, GIF and animated WebP.** SVG and GIF by type; an animated WebP is detected by reading **21 bytes** of the RIFF header (`RIFF`…`WEBP`…`VP8X`, then the `ANIM` flag `0x02` at byte 20), not by guessing from the extension — a canvas round-trip would silently drop the animation. Anything outside `image/jpeg|png|webp` — AVIF included — is passed through untouched. Every failure path (no `createImageBitmap`, a decode or encode throw, an unreadable header) uploads the original; the helper never rejects.

**EXIF is applied and then dropped.** `createImageBitmap(file, { imageOrientation: 'from-image' })` bakes the orientation in, and the re-encode carries no EXIF — which also strips **GPS and camera metadata from phone photos**. A privacy gain for a public site, a loss for anyone who wants capture metadata, and one of the reasons the opt-out exists. **Known limit:** the `imageOrientation` option is ignored rather than rejected on Safari below 16.4, which would upload a rotated photo un-rotated; not defended against, and part of the manual browser check.

**No UI message about what was resized.** Graceful resizing on upload is expected; a notice invites worry. The only case worth surfacing is one that still fails the server's cap, which the template already reports.

**The decision logic is pure and the browser APIs are injected.** `resolveImageDownscaleOptions`, `isDownscalableImageType`, `isAnimatedWebpHeader`, `getDownscaleTarget` and `downscaleImageFile` are unit-tested with fake deps; `createBrowserImageDownscaleDeps` is the only untested part, because there is no canvas in happy-dom. **Encode quality, EXIF orientation and the Safari fallbacks (`createImageBitmap` resize options, `OffscreenCanvas.convertToBlob`) are proven only by a manual browser check** — do not write a test that appears to cover the encode when it is mocked end to end.

Configuration, module-wide and per call:

```ts
// nuxt.config.ts
cwa: { upload: { image: { enabled: true, thresholdEdge: 2560, thresholdPixels: 20_000_000, maxEdge: 2560, maxPixels: 20_000_000, quality: 0.85 } } }

// one field that must keep originals
const { bind } = useCwaResourceUpload(iri, 'file', 'File', { imageDownscale: { enabled: false } })
```

Per call wins over the module default, which wins over the built-in defaults; an `undefined` value never overrides. **The built-in defaults live in exactly one place** (`DEFAULTS` in `image-downscale.ts`) — unlike `pageCache`, nothing is decided at build time, so `module.ts` needs no second copy and must not grow one.

---

## CWA page routes are siblings, and their route key must stay constant ([#337](https://github.com/components-web-app/cwa-nuxt-module/issues/337))

`createDefaultCwaPages` used to register the `pagesDepth` routes as a **nested chain** — `cwaPage0` with `cwaPage1` as its child, and so on — all rendering `cwa-page.vue`, which never renders a child `<NuxtPage>`. So any CWA URL below `/` matched two or more route records while only the first ever rendered, and Nuxt read that as "a nested `<NuxtPage>` will finish the job".

**The chain, in the installed Nuxt 4.5.2:**

- `pages/runtime/page.js:193-196` — `hasChildrenRoutes` is `matched.findIndex(m => m.components?.default === Component?.type) < matched.length - 1`. Its `if (!fork) return false` escape never applies, because `PageRouteSymbol` is provided app-wide by `app/components/nuxt-root.vue:47` and re-provided by `app/components/nuxt-layout.js:137`.
- `page.js:94` and `page.js:146` are the only places `page:loading:end` is raised for a **successful** navigation (`pages/runtime/plugins/router.js:102` and `:190` fire it only on navigation failure or a router error), and both are gated on `!willRenderAnotherChild`.
- `pages/runtime/router.options.js:24-38` — the default `scrollBehavior` returns a Promise resolved only inside `hookOnce('page:loading:end', …)`. Nothing resolved it, so **vue-router never scrolled at all**: a new page opened at the previous page's scroll offset. `router.options.js:23` (`from === START_LOCATION`) is why a hard load was always fine.

**Every matched record resolves to the same component object**, verified by probing the real router: for `/a/b`, `matched[0..2].components.default` are identity-equal. So `findIndex` always returns `0`, at every level. **That is why rendering a nested `<NuxtPage />` from `cwa-page.vue` cannot fix this** — even the innermost one would compute `0 < matched.length - 1` and still decline to fire the hook. It would take a distinct component per depth, which is strictly worse than having no nesting.

**The fix: flat sibling routes, one per depth** (`/`, `/:cwaPage1`, `/:cwaPage1/:cwaPage2`, …), so a CWA URL matches exactly one record and Nuxt fires the hook itself at `page.js:94`. The path strings, param names and `pagesDepth` cap — including the 404 for a URL deeper than it — are the same ones vue-router already derived from the nested tree, so matching and ranking are unchanged.

**The `meta.key` is the load-bearing half.** `generateRouteKey` (`pages/runtime/utils.js:9-13`) also uses `matched.find(...)`, so under the nested tree the key was **accidentally the constant `/` for every CWA URL** — which is why `cwa-page.vue` was never remounted between CWA navigations, and why #256's navigation retention and the `KeepAlive` around `ResourceLoader` work. Flat routes make the key vary per path, which remounts the page component on every navigation and tears the held page down. A constant `meta.key` (`'cwa-page'`, deliberately not exported) restores exactly the old behaviour. The regression guard is that `page:finish` must **not** fire on a CWA→CWA navigation; drop the key and it fires.

**`page:finish` never fired on CWA→CWA navigation either**, for the same reason — worth knowing, because a workaround built on it is relying on something that does not happen. `<NuxtLoadingIndicator>` was the second visible symptom: `app/composables/loading-indicator.js:86-89` subscribes to the same pair, so the bar started and never completed on any page below `/`.

**No generated route may declare a `cwaPage0` param.** `api/fetcher/fetcher.ts:93` reads `route.params.cwaPage0` and treats it as a resource IRI — that param belongs to the layer route `/_cwa/:cwaPage0()` alone. A single catch-all named `:cwaPage0(.*)*` would re-create the bare-IRI 404 documented above, which is one reason the fix is N sibling routes rather than one catch-all; the other is that a catch-all makes depth unbounded.

**`page:loading:end` fires before CWA content exists**, which left a restored `savedPosition` and a cross-page `#hash` landing short. Closed by the follow-up below.

---

## The scroll waits for CWA content, but only when it has a target to hit ([#338](https://github.com/components-web-app/cwa-nuxt-module/issues/338))

`page:loading:end` fires on `nextTick` after the route change (`page.js:94`, the constant-route-key branch above), which is **before the primary fetch has resolved anything**. Measured against the real `NuxtPage` over the playground router with a replayed cassette: at the hook the mounted page is `<div class="cwa:page cwa:h-full"><!--v-if--><!--v-if--></div>` — **one element, no text, no `displayPageIri`**, with 12 of 13 resources still pending; after settling it is 10 elements and 147 characters. So vue-router applied `savedPosition` to a page of no height, and a `#hash` to an element that did not exist.

**`isLoading` alone is not the signal, and this is the part to remember.** With the replay resolving in microtasks — network lag removed — `$cwa.resources.isLoading` was **false for the whole navigation** while the DOM stayed empty for a further **~94ms**, polled at 5ms: the hook at t+7ms, content at t+101ms. Two causes, neither visible to the store: the `CwaComponent*` names `ResourceLoader` resolves are Nuxt's **async global component wrappers**, so the chunk is still being imported; and `ResourceLoader.resourceLoadBuffering` holds a spinner on a **20ms `setTimeout`**. A `nextTick` or a single `requestAnimationFrame` after `isLoading` misses this by ~20 frames. **The cymru-kitchens `router.options.ts` workaround on #337 is mistimed for exactly this reason** — it scrolls off an `isLoading` watcher alone (registered `immediate: true`, so it often fired before the new page was even fetched).

**So the wait is two-stage and target-specific**, in the pure `waitForScrollTarget` (`runtime/scroll/wait-for-scroll-target.ts`), which takes `isLoading` / `readHeight` / `onHeightChange` / `findElement` as injected functions and never touches `document` — happy-dom reports `scrollHeight` as `0` under every condition, so a DOM-reading waiter would be untestable here.

- **A restored position** resolves when `scrollHeight >= savedPosition.top + innerHeight`: the document is tall enough to *honour* the position. Falling back to "the height is stable" requires `isLoading` to be false **and the height to have changed at least once**, because during that measured 94ms window the height is stable at its empty value and a naive stability check fires there.
- **A `#hash`** resolves when the element exists.
- **`SCROLL_TARGET_TIMEOUT` is 1000ms**, a constant rather than a module option — deliberately, until something asks for it. The scroll always happens.

**Only `savedPosition` and a cross-page `#hash` defer.** A plain forward navigation still resolves `{left: 0, top: 0}` on `page:loading:end` with no wait at all, and the same-path in-page anchor branch stays synchronous. The wait returns whether it actually deferred, and a deferred hash scrolls `instant` — an animated scroll after a 400ms pause reads as a glitch. A deep-linked `#hash` on a first load (`from === START_LOCATION`) waits too, which is a deliberate divergence from Nuxt: SSR already has the content so it is a no-op there, but a static or client-only render needs it.

**`useNuxtApp()` is called once, synchronously, at the top of `scrollBehavior`.** The deferral runs inside a `requestAnimationFrame` callback, which is outside the Nuxt context, so reading it there throws — the #263 / #313 mechanism again. The regression guard counts `useNuxtApp` calls and asserts none happen after the page load flushes.

**The router options file is `splice(1, 0, …)`d into `pages:routerOptions`, never pushed.** `resolveRouterOptions` (`nuxt/dist/index.mjs:1253-1265`) unshifts per layer and then unshifts the built-in, so index 0 is always the built-in and **an app's own `app/router.options.ts` is always last**; the template spreads them in array order (`:1666`), so later wins. Pushing would put the module after the app and **silently override an application** — the one outcome that is not acceptable. Splicing at 1 beats the built-in, loses to every layer and to the app, and leaves an app that only sets `hashMode`/`scrollBehaviorType` with our `scrollBehavior` intact, because the merge is per-key. A layer `app/router.options.ts` is not an option at all: `src/layer` has no `app/` directory. Verified against a real `pnpm run dev:prepare` — the generated `.nuxt/router.options.mjs` imports ours as `routerOptions1`, spread after the built-in.

**We reproduce Nuxt's `scrollBehavior` rather than wrapping it**, because `nuxt/dist/pages/runtime/router.options` is absent from nuxt's `exports` map and cannot be imported by specifier. That means `runtime/router.options.ts` **tracks Nuxt** and has to be re-read against it on a major upgrade. One nuance is deliberately not reproduced: `isChangingPage` is an unexported internal, and with CWA's constant route key it returns `false` between every pair of CWA pages, so Nuxt's own hash behaviour there is already `instant`.

**Failure modes stated rather than defended:**

- **Images with no intrinsic dimensions** keep growing the page after `isLoading` is false, so a restored position can still land short once the height target is met early. Waiting on images is unbounded; the timeout is the bound.
- **A genuinely shorter page** never meets the height target and takes the stability fallback, or the full timeout. The browser clamps the position anyway, so the outcome is right and merely late.
- **A fetch that never settles** takes the timeout.

**Not assertable here:** the scroll position, any height, and whether `ResizeObserver` fires. happy-dom has the APIs but no layout. The manual checks are the only proof.

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

