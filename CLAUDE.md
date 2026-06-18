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

**Target: 70% statement coverage** (6353 statements total, ~4447 needed).

| Date | Stmt % | Notes |
|------|--------|-------|
| Baseline | ~42% | Before coverage push |
| 2026-06-10 | 44.56% | actions.ts, resources.ts, storage.ts, cwa-resource-model.ts |
| 2026-06-11 | 47.97% | cwa-select-input, cwa-collection-resource, cwa-image, cwa-image-resource, ComponentGroup.Util.Positions debounce, resource-stack-manager listenCurrentIri |
| 2026-06-11 | 48.44% | resource-stack-manager isComponentGroupDisabled + filterDisabledStackItems (3rd constructor arg was missing from test factory) |
| 2026-06-12 | 49.95% | resource-stack-manager completeStack/selectStackIndex/insertResourceStackItem/redrawFocus/removeFocusComponent; manageable-resource private getters; api-documentation getComponentMetadata; cwa.ts delegation methods; cwa-resource detached DOM + getCurrentStyleName; cwa-resource-manageable watcher/listener branches |
| 2026-06-15 | 55.91% | resources-manager: deleteResource, doResourceRequest (errors/callbacks/fetchBatch/404 swallow), updateResource branches (FormData/headers/not-persisted/publish/forcePublishedVersion), getWaitForRequestPromise bug fix (reactive .value guard + wrong loop nesting), confirmDiscardAddingResource event-set paths, initAddResource, setAddResourceEventResource, addResourceAction (guard clauses/sort-value/componentPositions/publish/pageDataProperty/requestCompleteFn) |
| 2026-06-15 | 56.46% | resource-stack-manager: currentIri forcePublishedVersion branches, resetStack(true), getClosestStackItemByType matching/non-matching, selectStackIndex (not-editing/empty/out-of-range/confirm-dialog confirmed+cancelled), listenEditModeChange _isEditingLayout reset, contextStack truthy/falsy lastContextTarget, isPopulating+isContextPopulating truthy cases |
| 2026-06-16 | ~56.5% | ModalRadioTabs (new component, fully tested), useParentPageDataLoader (new composable, fully tested), PageAdminModal+PageDataAdminModal updated with tab-radio parent picker (Bug 1+2 fixes) |
| 2026-06-17 | 55.58% | Steps 8+9 code added net new statements; fetcher/resources/CwaPage/cwa-page/RoutesTab/RoutesTabManage/PageAdminModal/PageDataAdminModal specs all present. Slight % drop from new code volume. |

**Key patterns established:**
- Lodash `debounce` with fake timers: `vi.useFakeTimers()` + `vi.runAllTimers()` (or `vi.advanceTimersByTime(n)` to avoid triggering other timers)
- `vi.hoisted()` cannot use `ref()`/`reactive()` — use plain objects `{ value: ... }` or `var` + factory in `vi.mock()`
- Reactive route mock: `var mockRoute: {...}` + `mockRoute = reactive({...})` inside `vi.mock('vue-router', async () => {...})`
- Vue `computed` caches — make mock data `reactive()` so computed re-evaluates when mock state changes
- `vi.clearAllMocks()` in `beforeEach` is critical when capturing listeners/callbacks from `mock.calls` — stale calls from prior tests cause `find()` to return the wrong callback
- Capturing Vue watcher callbacks: `vi.spyOn(vue, 'watch').mockImplementation((_source, cb) => { watchCallback = cb; return vi.fn() })`
- Private TypeScript class getters: access via `(instance as any).prop` at runtime despite compile-time `private` modifier

**High-ROI remaining targets (uncovered statements est.):**
- `resources-manager.ts` (33.2%) — ~380 statements, very complex class (CRUD, confirm dialogs)
- `resource-stack-manager.ts` (~60%) — remaining private methods/watchers
- `html-content.ts` (0%) — ~77 lines, creates Vue apps dynamically (hard to unit test)
- `useDataResolver.ts` (0%) — ~121 lines, uses Vue internals (hard to unit test)

## Planned Feature: Nested Sub-Pages

> **Status: All steps complete (1–9). Nested sub-pages feature done.**
> Companion plan: see `## Feature: Nested Sub-Pages` in the API Components Bundle CLAUDE.md (`/Users/danielwest/Documents/GitHub/_CWA/api-components-bundle/CLAUDE.md`).

### What we want

Pages support sub-pages. A conference page renders a tab bar and a child-page slot; child pages fill that slot. Structure is admin-manageable and reusable across projects. Rendering depth is driven by data (the manifest's `resource_iris` depth groups), not URL structure.

### How the API models it

`AbstractPage` (base of both `Page` and `AbstractPageData`) has two fields for hierarchy:

- `parentPage: ?Page` — parent is a `Page` entity (mutually exclusive with `parentPageData`)
- `parentPageData: ?AbstractPageData` — parent is any `AbstractPageData` subclass (mutually exclusive with `parentPage`)

**There is no `nested` boolean.** Having a parent means the page is nested inside it — the relationship itself is the signal.

Both fields carry `#[Groups(['Route:manifest:read'])]`, as does the `route` back-reference on `AbstractPage`. `ResourceManifestNormalizer` walks the normalised structure and emits `resource_iris` as a **`string[][]`** grouped by depth: index 0 = root/shallowest resources, last index = the requested page's resources. The `parentPage`/`parentPageData` fields are the depth boundaries. All IRIs across all groups are fetched in parallel.

**Exact manifest response for a nested PageData route** (`GET /_/resource_manifest//conference/programme`):
```json
{
  "resource_iris": [
    ["/_/routes//conference", "/_/abstract_page_data/parent-uuid", "/_/pages/parent-template-uuid"],
    ["/_/routes//conference/programme", "/_/abstract_page_data/child-uuid", "/_/pages/child-template-uuid"]
  ]
}
```

For a flat (non-nested) page, `resource_iris` always has one inner array: `[["/_/routes//my-route", ...]]`.

`parentPage` and `parentPageData` are also exposed on every individual resource GET response (not just the manifest), so the admin/draft path can walk the chain IRI-by-IRI without a manifest.

### Manifest depth group anatomy

Each inner array (`resource_iris[depth]`) is a flat list of all IRIs that belong to that rendering depth. A real group with a page template and one component group looks like:

```
[
  "/_/routes//conference",           ← ROUTE
  "/_/page_data/xxx/parent-uuid",    ← PAGE_DATA (content entity — title, custom fields)
  "/_/pages/conference-template-uuid", ← PAGE (template — uiComponent, layout IRI, componentGroup IRIs)
  "/_/component_groups/cg-uuid",     ← COMPONENT_GROUP
  "/_/component_positions/pos-uuid"  ← COMPONENT_POSITION (sortValue, resolved component IRI or null)
]
```

**What each IRI type carries when fetched:**

| IRI prefix | Entity | Key fields returned |
|---|---|---|
| `/_/routes/` | Route | `page` IRI OR `pageData` IRI (one of, not both) |
| `/_/page_data/` | PageData | All content fields (title, custom fields etc.) + `page` template IRI |
| `/_/pages/` | Page | `uiComponent`, `layout` IRI, `componentGroups` array of IRIs |
| `/_/component_groups/` | ComponentGroup | `componentPositions` (embedded objects with `component` IRI + `sortValue`) |
| `/_/component_positions/` | ComponentPosition | `component` IRI (resolved, see below), `sortValue` |

**How to identify the Page template vs the PageData in a depth group:**

The Route entity is the authoritative link. When you fetch the Route IRI from a depth group, the response includes either `page: "/_/pages/..."` (for Page-based routes) or `pageData: "/_/page_data/..."` (for PageData-based routes). This is how the module should determine the content entity for each depth:

- `route.page` is non-null → this is a Page-based depth; the Page entity is both the template and the content
- `route.pageData` is non-null → this is a PageData-based depth; the PageData entity is the content; the Page template IRI comes from `pageData.page`

Alternatively, identify by resource type:
- First IRI in the group matching `PAGE_DATA` resource type (`/page_data/` prefix) → content entity
- First IRI in the group matching `PAGE` resource type (`/_/pages/` prefix) → rendering template

**~~Bug: `pageIriAtDepth` surfaces only the Page template, not the PageData~~ — FIXED**

`pageDataIriAtDepth(depth)` added to `resources.ts` (parallel to `pageIriAtDepth`). `CwaPage.vue` now provides `'cwa-page-data-iri'` as a `ComputedRef<string | undefined>` at each depth. Template authors inject it to read PageData fields directly (title, dates, etc.) via `useCwaResource(pageDataIri)`. Returns `undefined` for Page-backed depths (no PageData in the depth group).

### Component data: how the API populates positions

The manifest is a rich prefetch list — not just Route/PageData/Page IRIs. Because `Page.componentGroups`, `ComponentGroup.componentPositions`, and `ComponentPosition.component` are all in `Route:manifest:read`, the manifest already contains:

- **ComponentGroup IRIs** (from `page.componentGroups`)
- **ComponentPosition IRIs** (embedded within each ComponentGroup in the normalized output)
- **Static component IRIs** (from `position.component`, for positions with a direct component reference)

**What the manifest cannot include**: component IRIs for `pageDataProperty` positions. The API's `ComponentPositionNormalizer` resolves `pageDataProperty` using a `path` HTTP request header. During manifest generation that header is absent, so those positions remain `component: null` in the manifest output.

**The fetch model is one primary parallel batch with a small rolling follow-up:**

1. **Fetch the manifest** → get `resource_iris[depth]` arrays (includes CG, CP, and static component IRIs)
2. **Fetch ALL manifest IRIs in one parallel batch** — when CG requests are sent with the `path` header, `ComponentPositionNormalizer` resolves `pageDataProperty` slots server-side and returns the actual component IRIs in the CG response body
3. **De-dupe and follow-up** — component IRIs returned from CG responses that are not already in-flight get queued immediately. Static component IRIs are already being fetched (they were in the manifest). `pageDataProperty` component IRIs are the only additions. De-duplication means no double requests.

The total serial depth is: **manifest → parallel batch (everything) → tiny parallel follow-up (pageDataProperty component IRIs only)**. In practice the follow-up fires as the first CG responses arrive, so it is effectively a single rolling parallel fetch.

**`pageDataProperty` resolution is server-side, not the module's responsibility.**

`ComponentPosition` has two modes:
- `component` set directly → static component; IRI is already in the manifest; fetched in the initial batch
- `pageDataProperty = 'heroImage'` → dynamic slot; API's `ComponentPositionNormalizer` intercepts normalization, reads `pageData->heroImage` via the `path` header, substitutes the real component IRI into `position.component`

**From the module's perspective, every ComponentPosition response always has a `component` IRI (or null if no component is configured) — `pageDataProperty` is never visible on the public path.** No client-side resolution needed.

For admin users, `pageDataProperty` is exposed via `ComponentPosition:read:role_admin` for the admin UI.

### Route lifecycle (critical context)

Routes are the **publication mechanism**. A `PageData` entity exists and is editable in the admin before it has a `Route`. The parent/child relationship is set on `PageData` during drafting — before either page has a public URL. This is why hierarchy lives on `AbstractPage`, not `Route`.

### Planned discussion: nested page route UI/UX

> **Status: investigated, needs design decision before implementation.**

#### How the API works (established facts)

**Route entity** (`Route.php`): a standalone entity with `path` (full URL path, unique), `name` (unique slug), `redirect` (→ another Route), `redirectedFrom` (collection of redirecting routes), `page` or `pageData` (one-to-one to the content entity). Routes are a separate resource — not embedded on Page/PageData.

**Two ways to create/set a route:**
1. `POST /_/routes` — manual: submit `{ path, name, page|pageData }`. The module submits `name = path` automatically (see `RoutesTab.vue` `validate()` hook). The full path is always stored — there is no "suffix" field.
2. `POST /_/routes/generate` — auto-generate: submit `{ page|pageData }`. The API's `RouteGenerator.create()` slugifies the title, then checks `page.getParentPageRoute()` and **prepends the parent's path** as a prefix. So for a child under `/conference`, the generated path is `/conference/chapter-title`. This endpoint is the only one that applies the prefix automatically.

**Update via PATCH/PUT** — `RouteEventListener.onPostWrite()` fires and if the path changed, automatically creates a redirect from the old path to the new one. This is transparent to the module.

**No cascade on parent route change** — if the parent's path changes from `/conference` to `/summit`, child routes (e.g. `/conference/programme`) are NOT automatically updated. However, child routes do **not** break functionally: the manifest is assembled by walking the `parentPage`/`parentPageData` entity chain, not URL structure. Navigating to `/conference/programme` still produces the correct manifest (`irisByDepth[0]` = `/summit` parent resources, `irisByDepth[1]` = `/programme` child resources) and renders correctly. The only impact is URL-convention/SEO: the child's URL prefix no longer matches the parent's canonical path. Tab-bar links stored as hard-coded route paths (rather than resolved from route entities) would also point to stale sibling paths.

**Draft state** — a child page can exist with no route. `getParentPageRoute()` returns null when the parent also has no route. `RouteGenerator` then generates just the slug with no prefix.

---

#### What the current module UI does

**`RoutesTab.vue`** (inside Page/PageData modal, "Routes" tab):
- Reads `parentPage || parentPageData` from the page resource → looks up parent resource in store → reads `data.route` (the route IRI, e.g. `/_/routes//conference`) → strips `/_/routes/` to get the path → shows as static text "Route prefix: /conference"
- This is purely informational. It is visible on the *view* screen only.
- Three screens: `view` (shows current path + Edit button + redirects tree), `manage-route` (edit form), `create-redirect`.

**`RoutesTabManage.vue`** (the edit form):
- A single full-path text input bound to `localResourceData.path` — e.g. the user must type `/conference/programme` in full.
- "SEO recommendation" = `'/' + slugify(title.toLowerCase())` — **this does NOT include the parent prefix**. For a nested page the recommendation shows just `/programme` instead of `/conference/programme`. The "Apply" button calls `handleGenerateRoute` which posts to `/routes/generate` — the API correctly adds the prefix server-side, so the *apply* flow is right but the *display* is wrong/misleading.
- No parent prefix is shown in the edit form.

**`RoutesTabView.vue`** (the view screen):
- Shows the route path via `ModalInfo`.
- Shows a redirects tree (`RouteRedirectsTree`).
- "Create New Route" button (when no route) or "Edit" button (when route exists).

**Standalone routes admin page** (`_cwa/routes.vue`):
- Flat list of all routes, ordered by date/path.
- Each row shows the path + the associated page/pageData reference + link to that page's admin modal.
- No hierarchy — doesn't show parent/child relationships.

---

#### Design decisions (resolved)

1. **Edit form uses an input group: editable prefix + editable suffix.** The `manage-route` screen shows the parent's current route path as a pre-filled prefix field alongside a suffix text input. The prefix defaults to the parent's route path (e.g. `/conference`) to encourage correct URL structure, but the user can change it — including clearing it to `/` to intentionally break from the hierarchy convention. The module assembles the full path (`prefix + suffix`) before saving. This guides toward the right structure without enforcing it.

2. **SEO recommendation encourages proper URL structure.** The recommended suffix is the slugified page/pageData title (e.g. `/programme`). The full recommended path (`/conference/programme`) is shown as a preview assembled from the current prefix + recommended suffix. "Apply SEO" still calls `POST /_/routes/generate` — the API handles redirect creation and other side effects that a local computation would miss.

3. **Cascade child path updates via a new API contract.** Two flows trigger this:

   **Manual path edit (primary flow):** When saving a changed path via `PATCH /_/routes/{id}`, the module checks whether the parent page has any child routes before saving. If yes, it asks: "Update child routes to use the new prefix? (children using a different prefix will be unchanged)." If confirmed, includes `cascadeChildPaths: true` in the PATCH body. The API applies the prefix substitution and creates redirects for all affected children within the same transaction.

   **"Apply SEO" on a parent with existing children (secondary flow):** `POST /_/routes/generate` returns the newly generated path. The module compares it against the old path. If the path changed AND the parent has child routes, it offers a follow-up confirmation and issues a second `PATCH /_/routes/{id}` with `cascadeChildPaths: true` (the path is now the new value, old path passed as context — see API contract detail). This keeps the generate endpoint simple; cascade is always a `PATCH` concern.

   In both cases the API finds all pages/pageData whose chain leads to this route's page, identifies their routes that currently use the old path as a prefix, replaces the prefix, and creates redirects from old → new paths. Children using a different prefix are untouched. See API bundle CLAUDE.md for the required implementation detail.

4. **No route, no child routes — disabled by security.** If a parent page has no route, its resources are protected by the security layer (resources without a route are not publicly accessible). A child route pointing into an unreachable parent is therefore broken for public users, not just inconvenient. Child route creation and editing is **disabled** in the UI when the parent has no route, with explanation: "Parent page has no public URL — resources are not publicly accessible. Set a route on the parent first." An existing child route from before the parent's route was removed stays in the database but shows as inactive with the same reason.

---

#### Questions for the design discussion

(All resolved above. No open questions remain on the route UI design.)

### Rendering: `<CwaPage />`

Nested page rendering uses a single mechanism for all access contexts: `<CwaPage />`, which is data-driven, not URL-depth-driven.

**For public routes:** `cwa-page.vue` reads the manifest's `resource_iris` depth groups. Index 0 = root page resources, last index = the requested page's resources. `<CwaPage />` renders the stack from root to leaf. Keepalive is managed by the component — if depth-0 resources are unchanged on navigation, the parent layer is preserved without re-render.

**For admin/draft access:** A nested page in draft has no public Route. `cwa-page.vue` is accessed via the entity IRI directly. `GET /_/resource_manifest/{uuid}` returns the same `resource_iris: string[][]` structure for any `Page` or `AbstractPageData` UUID, collapsing 4+ serial round trips into one parallel batch. The `parentPage`/`parentPageData` chain walk is a fallback only.

There is no URL-segment-depth dependency. The URL can be anything; depth is always derived from data.

---

### Display switching — two gates (critical context for Steps 1 and 3)

There are two independent mechanisms that control when the displayed page changes during navigation. Both must be understood before touching Step 3.

**Gate 1 — `isFetchResolving` (manifest completion check, `getter-utils.ts:34`)**

```ts
return !!(fetchStatus.manifest && fetchStatus.manifest.resources === undefined && fetchStatus.manifest.error === undefined)
```

Currently checks `resources === undefined` — type-agnostic gate that holds open until `finishManifestFetch` is called (which sets `resources`). **In Step 4 this will be replaced with a `fetchComplete` boolean** — the `resources` field will be renamed `irisByDepth` and set *before* the batch starts (when the manifest HTTP response arrives), so it can no longer double as a "batch complete" signal. The gate becomes `!manifest.fetchComplete`.

**Gate 2 — `displayFetchStatus` early-switch (`resources.ts:74`)**

```ts
const pageIri = this.getPageIriByFetchStatus(fetchingStatus)
if (pageIri && this.resourcesStore.current.currentIds.includes(pageIri)) {
  const pageResource = this.getResource(pageIri).value
  if (pageResource?.data && pageResource.apiState.status === CwaResourceApiStatuses.SUCCESS) {
    return fetchingStatus  // switch display NOW, before manifest batch completes
  }
}
```

An early-switch optimisation: if the target page is already in the store (previously visited), switch the display immediately without waiting for the full manifest fetch to complete. The cached data shows instantly; any updated data replaces it as responses arrive.

Currently `getPageIriByFetchStatus` derives the page IRI from `fetchStatus.path` — always the **leaf/child** page. For non-nested pages that is the only page, so it works correctly.

**The nested page problem with the current early-switch:**

For a nested page at `/conference/programme`, `fetchStatus.path` = the child route. The early-switch checks the **child** IRI against `currentIds`. This creates three navigation scenarios:

| Scenario | Early-switch behaviour | Correct? |
|---|---|---|
| First visit to `/conference/programme` | Child not in `currentIds` — no early-switch, wait for Gate 1 | Yes |
| Return to `/conference/programme` (same URL) | Child in `currentIds`, parent also cached from prior visit — switches immediately | Yes |
| `/conference/programme` → `/conference/speakers` (sibling nav) | `/speakers` child not in `currentIds` — no early-switch, wait for all resources including parent | Sub-optimal — parent is cached and could render immediately |

For sibling navigation (third case), the parent frame is already in the store but the current logic won't early-switch because it only checks the child IRI. The user sits waiting for all resources when the parent frame could have rendered immediately.

**Required fix (Step 5):** `displayFetchStatus` must become depth-aware. When a manifest with multiple depth groups is present, check the **depth-0 (root/parent)** page IRI against `currentIds` instead of the leaf. If the root is cached, switch display immediately — child data loads progressively and replaces cached data when fetched. This collapses all three scenarios into correct behaviour:

- First visit: depth-0 not in `currentIds` → wait for Gate 1 (all resources loaded)
- Return visit / same-page refresh: depth-0 in `currentIds` → switch immediately, refreshed data replaces stale data as it arrives
- Sibling nav: depth-0 (shared parent) in `currentIds` → parent frame renders immediately, child slot fills progressively

The depth-0 page IRI comes from `manifest.irisByDepth[0]` (available as soon as the manifest HTTP response arrives, before the batch fetch completes — set by the new early action in Step 4). For flat pages `irisByDepth` has one inner array; the logic is identical.

---

### What already exists in this module (relevant files)

- **`src/runtime/api/fetcher/fetcher.ts`** — Steps 1–4 complete. `fetchManifest()` calls `setManifestIrisByDepth` before `fetchBatch`; `finishManifestFetch` just sets `fetchComplete = true`. PAGE/PAGE_DATA IRIs get `manifestPath = /_/resource_manifest/{uuid}`.
- **`src/runtime/api/fetcher/fetch-status-manager.ts`** — delegates `setManifestIrisByDepth` to the store.
- **`src/runtime/storage/stores/fetcher/state.ts`** — `FetchManifestInterface` has `irisByDepth?: string[][]` and `fetchComplete?: true`. Steps 1–4 complete.
- **`src/runtime/storage/stores/fetcher/actions.ts`** — `setManifestIrisByDepth` sets `irisByDepth` pre-batch; `finishManifestFetch` sets `fetchComplete = true`. Steps 1–4 complete.
- **`src/runtime/storage/stores/fetcher/getter-utils.ts`** — `isFetchResolving` checks `!manifest.fetchComplete`. Step 4 complete.
- **`src/runtime/resources/resource-utils.ts`** — `resourceTypeToAssociatedResourceProperties`: `PAGE` and `PAGE_DATA` include `parentPage`/`parentPageData`. Step 2 complete.
- **`src/runtime/resources/resources.ts`** — `pageIriAtDepth(depth)` returns the PAGE IRI at the given render depth from `irisByDepth[depth]`; falls back to `getPageIriByFetchStatus` for depth 0 when no manifest. `displayFetchStatus` early-switch uses depth-0 IRI from `irisByDepth[0]` (or leaf fallback). Steps 1–5 complete.
- **`src/runtime/templates/cwa-page.vue`** — provides `'cwa-page-depth' = 0`, renders `<CwaPage />`. Step 6 complete.
- **`src/runtime/templates/components/main/CwaPage.vue`** — injects `'cwa-page-depth'` (default 0), renders `pageIriAtDepth(depth)` via `ResourceLoader`, provides `depth + 1`. Step 6 complete.

### Planned changes (Nuxt module)

**Step 1 — Adapt manifest consumption to `resource_iris: string[][]`** ✅ DONE

Files changed: `fetcher.ts`, `state.ts`, `actions.ts`.

`resource_iris` is now `string[][]`. Changes:
- `FetchManifestInterface.resources` → `string[][]` (was `string[]`)
- `ManifestSuccessFetchEvent.resources` → `string[][]`
- `fetchManifest()` uses `.flat()` to produce `string[]` for `fetchBatch`; passes full `string[][]` to `finishManifestFetch`

Behaviour is identical to before for flat pages (`[[...]]`). Multi-depth groups are all fetched in parallel (flattened) and the full 2D array is stored for later depth-aware use.

**Step 2 — Add `parentPage`/`parentPageData` to associated resource properties** ✅ DONE

Files changed: `resource-utils.ts`, `fetcher.ts`, `getters.ts`.

- Renamed `resourceTypeToNestedResourceProperties` → `resourceTypeToAssociatedResourceProperties` (also `TypeToNestedPropertiesMap` → `TypeToAssociatedPropertiesMap`) — map covers all associated resources to pre-fetch, not just downward children
- Renamed `fetchNestedResources` → `fetchAssociatedResources` throughout
- Added `'parentPage'` and `'parentPageData'` to `PAGE` and `PAGE_DATA` entries — fetcher now follows the parent chain for admin/draft access
- Exported `parentResourceProperties` constant from `resource-utils.ts`
- In `getChildIris` (`getters.ts`), skip `parentResourceProperties` entries — parent pages are independent admin roots, not children of the child page

**Step 3 — API bundle: unified `/_/resource_manifest/{id}` endpoint** ✅ DONE *(API work)*

`GET /_/resource_manifest/{id}` is now live. The `{id}` segment is matched with `requirements: ['id' => '(.+)']` to capture the full string including slashes.

- **`{id}` starts with `/`** → resolved as a Route path (same as the previous `routes_manifest` endpoint)
- **`{id}` is a UUID** → resolved as a `Page` or `AbstractPageData` entity (new; admin/draft access)
- **Security**: delegates to `RouteVoter::READ_ROUTE` for routes; `AbstractRoutableVoter::READ_ROUTABLE` for page entities. Public pages are accessible without auth; draft/unpublished entities require admin.
- **Response**: `{ "resource_iris": string[][] }` — same format in both cases

The fetcher already uses `/_/resource_manifest/${route.path}` for public navigation. The next module-side task (Step 4+) is to call `/_/resource_manifest/${uuid}` for admin/draft access and wire `manifestPath` accordingly.

**Step 4 — Fetch state: `irisByDepth` + `fetchComplete` + per-depth resolution tracking** ✅ DONE

Files changed: `state.ts`, `actions.ts`, `getter-utils.ts`, `fetcher.ts`, `fetch-status-manager.ts`.

**State changes (`FetchManifestInterface`):**
```ts
interface FetchManifestInterface {
  path: string
  irisByDepth?: string[][]  // set when manifest HTTP response arrives — before batch starts
  fetchComplete?: true       // set when batch completes — gates isFetchResolving
  error?: CwaResourceErrorObject
}
```

- `resources` renamed to `irisByDepth` — set by a new `setManifestIrisByDepth` action called immediately when the manifest HTTP response arrives, *before* `fetchBatch` is called
- `fetchComplete` replaces the `resources === undefined` gate in `isFetchResolving` — the gate becomes `!manifest.fetchComplete`
- `ManifestSuccessFetchEvent` drops `resources` payload; `finishManifestFetch` just sets `fetchComplete = true`
- `fetcher.ts`: after `resources = response._data?.resource_iris || []`, immediately call `setManifestIrisByDepth({ token, irisByDepth: resources })`, then `fetchBatch`, then `finishManifestFetch`

**Per-depth resolution** — computed reactively in `resources.ts` from `irisByDepth[n]` vs store state. No extra state field needed. A depth group is "resolved" when every IRI in `irisByDepth[n]` has a non-IN_PROGRESS status in the resources store (or was absent from the store and has since loaded). This drives the early-switch minimum-resources check.

**Early-switch (`displayFetchStatus`)** — check `manifest.irisByDepth[0]` for the depth-0 page IRI (available as soon as the manifest response arrives, before the batch). If depth-0 IRI is in `currentIds` and status is SUCCESS, switch display immediately. Flat pages have `irisByDepth` with one inner array — logic is identical.

**Step 5 — Depth-aware `pageIriAtDepth` and `displayFetchStatus` depth-0 check** ✅ DONE

File: `src/runtime/resources/resources.ts`.

- **`getPageIriFromDepthGroup(group: string[])`** (private) — finds the first PAGE-type IRI in a depth group
- **`pageIriAtDepth(depth: number): ComputedRef<string | undefined>`** (public) — returns the PAGE IRI at the given depth from `displayFetchStatus.manifest?.irisByDepth[depth]`; falls back to `getPageIriByFetchStatus` for depth 0 when no `irisByDepth`, returns `undefined` for depth > 0 when no manifest
- **`displayFetchStatus` early-switch** — when `fetchingStatus.manifest?.irisByDepth[0]` is present, uses the depth-0 PAGE IRI for the early-switch check instead of the leaf IRI; falls back to `getPageIriByFetchStatus` only when no `irisByDepth`

**Step 6 — `cwa-page.vue` depth-aware rendering** ✅ DONE

Files: `src/runtime/templates/cwa-page.vue`, new `src/runtime/templates/components/main/CwaPage.vue` (auto-imported as `<CwaPage />`).

**Design (agreed):**

- `cwa-page.vue` (Nuxt catch-all page in the layer) provides `depth = 0` and renders `<CwaPage />`.
- `<CwaPage />` (new public Vue component, auto-imported with `Cwa` prefix) reads `depth` from `inject`, renders `pageIriAtDepth(depth)` via `ResourceLoader` with prefix `CwaPage`, then `provide`s `depth + 1` so any nested `<CwaPage />` in a child template renders the next level automatically.
- Consuming app page templates place `<CwaPage />` wherever the child page should appear — no depth number needed.
- **SSR**: not relevant — page isn't shown until fully loaded server-side.
- **Client-side progressive rendering**: all resources fetch in parallel. Depth-0 renders immediately (from cache on sibling nav or once manifest arrives). Depth > 0 renders as soon as `pageIriAtDepth(depth)` returns a value (i.e. `irisByDepth[depth]` is available and the PAGE IRI is resolved). Until that moment, `<CwaPage />` renders nothing — matching existing component behaviour where unloaded slots are simply absent.

**Future — loading placeholders (not in this step):** Once `<CwaPage />` is in place, a configurable CSS placeholder can be shown while depth > 0 is loading: a mid-gray rounded rectangle that pulses or has a gradient-wipe shimmer (similar to the No Image placeholder). This is part of a broader plan to support loading placeholders for any component being fetched. For now, rendering nothing is the correct default.

**Step 7 — Keepalive** ✅ DONE

File: `src/runtime/templates/components/main/CwaPage.vue`.

`<ResourceLoader>` inside `<CwaPage />` is wrapped in `<KeepAlive>` with `:key="pageIri"`. Each unique IRI gets its own cached component instance. When the user navigates away and returns to the same page, the cached instance is reactivated (scroll position, internal state preserved) rather than remounted. Depth-0 IRI stays stable during sibling navigation (via the `displayFetchStatus` early-switch) so the parent layer is never unmounted at all — KeepAlive provides the additional benefit of state preservation when navigating back to a previously-visited child depth.

**Future design question — shared component group across layouts**

If Layout A and Layout B both reference the same `ComponentGroup` IRI, today's architecture re-mounts that group each time the layout changes (the whole layout tree is replaced). The *data* in the store is already shared, but the *component instance* is not. Truly sharing the instance would require hoisting the shared group outside the layout tree and rendering it independently (a "portal" pattern), with KeepAlive preserving the instance across layout switches. This is architecturally significant and independent of nested pages — do not tackle it as part of Step 7. Needs its own design discussion before any implementation.

**Step 8 — Admin UI: nested page management** ✅ DONE

Files changed: `useParentPageLoader.ts` (new), `useParentPageDataLoader.ts` (new), `ModalRadioTabs.vue` (new), `PageAdminModal.vue`, `PageDataAdminModal.vue`, `RoutesTab.vue`.

**Design (resolved):**
- **Top bar** — no structural change. Depth switching lives inside the modal.
- **`useParentPageLoader`** — new composable fetching `/_/pages` (all pages, `noQuery: true`) with stale-request cancellation. Shared by both modals.
- **`useParentPageDataLoader`** — new composable loading page data types from API docs (filtering out `AbstractPageData`) then instances per type via `docs.entrypoint[key]`. Stale-request cancellation on both. Exposes `fqcnToEntrypointKey` for type derivation.
- **`ModalRadioTabs`** — pill-tab radio component (None / Page / Data) used in both modals to select the parent type. Emits `update:modelValue` with the selected value.
- **Parent picker** — tab-radio drives `parentType` computed (two-way). Selecting "Page" shows `ModalSelect` for `parentPage`; selecting "Data" shows type dropdown then instance dropdown for `parentPageData`. Switching tabs clears the opposing field.
- **Page UI/Style visibility** — always visible in `PageAdminModal` (Bug 1 fixed — root page owns the template but child pages also need a template).
- **"Dynamic Page" visibility** — always visible in `PageDataAdminModal` (Bug 1 fixed — every PageData must have a page template).
- **Depth switcher ("Viewing" dropdown)** — both modals build a `depthChain` computed by walking `parentPage`/`parentPageData` from `$cwa.resources.getResource()`. When chain length > 1, a "Viewing" `ModalSelect` is shown above `ResourceModalTabs`. Changing selection updates `displayIri`, which drives `useItemPage` (replacing `toRef(props, 'iri')`). Labels use `reference` for Page resources and `title` for PageData resources.
- **Route prefix display** — `RoutesTab` derives `parentIri` from `props.pageResource.parentPage || parentPageData`, looks up the parent in the store, and strips `/_/routes/` from the route IRI to display "Route prefix: /conference" above the route view. Hidden when no parent or parent has no route.
- **Init from store** — a `watch` on the resource data restores `selectedParentDataType` when data first loads (not `onMounted`): if `data.parentPageData` is set, its `@type` is looked up via `getResource`, converted to an entrypoint key via `fqcnToEntrypointKey`, and assigned to `selectedParentDataType`. This repopulates the Data instance dropdown when re-opening a modal for an existing nested resource.



---

### Concrete scenario: Event page with hero + sub-page tabs

This is the primary use case driving the nested sub-pages feature and the bugs below.

**Structure:**
- An events section uses a `PageData` type (e.g. `EventData`) backed by a shared Page template (`EventTemplate`).
- Each event has title, dates, and a hero image stored on its `EventData` entity.
- The event page renders: a hero section (event-specific title/dates/image) + a tab navigation bar.
- Each tab links to a child sub-page (e.g. Line-up, Tickets, Location) — each is also a `PageData` entity with `parentPageData = eventData`.
- When navigating between tabs, the hero + nav bar must stay mounted (KeepAlive depth-0, already implemented in Step 7). Only the child slot (depth-1) changes.
- Static parent pages (via `parentPage`) follow the same pattern — the parent's content stays stable, the child slot changes.

**What the template needs (now implemented):**

`EventTemplate.vue` receives `props.iri` = the Page template IRI. `CwaPage.vue` provides `'cwa-page-data-iri'` (a `ComputedRef<string | undefined>`) at each depth. Template pattern for reading PageData fields:

```ts
const pageDataIri = inject<ComputedRef<string | undefined>>('cwa-page-data-iri')
// Read event-specific fields (title, dates, etc.) directly from the PageData entity
const { resource } = useCwaResource(pageDataIri)
```

**Per-instance component content uses `pageDataProperty` positions — NOT the PageData IRI as a ComponentGroup location.** The Page template has a `ComponentPosition` with `pageDataProperty = 'heroImage'` (or similar). The API's `ComponentPositionNormalizer` resolves that to the actual component IRI from the current PageData entity's property. The template's `<CwaComponentGroup>` always uses `location = props.iri` (the shared Page template IRI) — the component group is attached to the template, and positions within it resolve per-instance content dynamically.

**Note for fixture maintainers (components-web-app):** See `components-web-app/CLAUDE.md` for the correct fixture setup: `pageDataProperty` positions must be added to the Page template's component group; per-instance component IRIs are stored as properties on each PageData entity.

---

**Known bug: `path` header is leaf-only — parent `pageDataProperty` positions fail when a child page is active**

`createRequestHeaders` in `fetcher.ts` sets `requestHeaders.path` from `fetchStatusManager.primaryFetchPath` — a single value applied to every request in the manifest batch. `ComponentPositionNormalizer` on the API uses this header via `PageDataProvider::getPageData()` → `routeRepository->findOneByIdOrPath(path)` → `route->getPageData()` to resolve `pageDataProperty` positions.

**The problem:** when navigating to a nested child page (e.g. `/topic-1/chapter-one`), `primaryFetchPath` is the leaf URL. The route at that path resolves to a static `Page` (no PageData), so `getPageData()` returns `null`. All `pageDataProperty` positions in the parent template's component group (depth 0) silently return `component: null` — parent intro content is invisible.

**Current symptom (confirmed via `components-web-app` demo):** `/topic-1/chapter-one` renders the parent `NestedTopicTemplate` with an empty primary slot where the intro content should appear.

**Fix required:** The fetcher must send a depth-appropriate `path` header for each request rather than the global leaf path. The manifest already carries this information — each depth group (`resource_iris[depth]`) contains a route IRI from which the path can be derived:

```
depth 0 → route IRI /_/routes//topic-1 → path header "/topic-1"
depth 1 → route IRI /_/routes//topic-1/chapter-one → path header "/topic-1/chapter-one"
```

**Design sketch for the fix:**

1. After the manifest is parsed, build a `depthToPath: Map<number, string>` by extracting the ROUTE IRI from each `irisByDepth[depth]` array (the IRI matching `CwaResourceTypes.ROUTE`) and stripping the `/_/routes/` prefix to get the plain path.
2. In `createRequestHeaders(event)`, look up which depth the requested IRI belongs to (requires a `iriToDepth: Map<string, number>` index populated when the manifest arrives).
3. Use `depthToPath.get(depth)` as `requestHeaders.path` instead of `primaryFetchPath` when the depth is known; fall back to `primaryFetchPath` for resources not in the manifest (e.g. follow-up fetches for `pageDataProperty` component IRIs, which are at a known depth anyway).

Note: resources fetched as `fetchAssociatedResources` follow-ups (componentGroups → componentPositions → component) inherit the depth of the parent resource they were discovered from, so the `iriToDepth` map should propagate depth downward through the associated-resource chain as each IRI is queued.

**~~Known bug: layout component groups (nav links) not rendered for unauthenticated users~~ — FIXED (both sides)**

The API was returning `componentGroups` on a `Layout` resource as **embedded JSON-LD objects**, not IRI strings. `fetchAssociatedResources` was pushing raw objects into `nestedIris`; `fetchBatch` then tried to call `path.split('?')` on an object — a TypeError silently swallowed, so the component groups were never fetched.

**Module fix (committed):** Array items in `fetchAssociatedResources` now extract `@id` when the value is an object:
```ts
for (const value of propIris) {
  const iri = typeof value === 'string' ? value : value?.['@id']
  if (iri) nestedIris.push(iri)
}
```

**API fix (committed 2026-06-16):** `Layout` now has an explicit `Layout:read` normalization group. `getComponentGroups()` is overridden in `Layout.php` with `#[ApiProperty(readableLink: false, writableLink: false)]`, so AP4 always returns IRI strings. The module's `@id` extraction is now a defensive fallback only.

**~~Known gap: `pageDataProperty` component IRIs missing from manifests~~ — FIXED**

`ComponentPositionNormalizer.normalizeForPageData()` previously resolved `pageDataProperty` slots via the `path` HTTP request header — absent during manifest generation. As a result, manifest responses for routes with pageDataProperty positions had `component: null` for those slots, and the component IRIs never appeared in `resource_iris`.

**API fix (committed 2026-06-16):** `PageDataNormalizer` now injects `cwa_current_page_data` into the serialization context when `Route:manifest:read` is active. `ComponentPositionNormalizer` reads this context key first and falls back to the HTTP header only for non-manifest normalizations. `ManifestDepthGroupTrait.collectCurrentDepth()` now also collects string IRI values that AP4 emits for related resources where readableLink is auto-computed as false (e.g. component IRIs from `ComponentPosition.component` where `AbstractComponent` has no `Route:manifest:read` fields). Internal blank node resources (`/.well-known/genid/...`) are excluded so AP4-internal metadata IRIs (`pageDataMetadata` etc.) are not leaked into `resource_iris`.

The total serial depth for a manifest fetch is now: **manifest → parallel batch (everything, including resolved pageDataProperty component IRIs) → no follow-up needed for static positions** (they were already in the manifest). `pageDataProperty` component IRIs still require a follow-up only when they differ between pageData instances and haven't been pre-fetched.

**Step 9 — Tests (Vitest)** ✅ DONE

Specs: `fetcher.spec.ts`, `fetch-status-manager.spec.ts`, `resources.spec.ts`, `CwaPage.spec.ts`, `cwa-page.spec.ts`, `RoutesTab.spec.ts`, `RoutesTabManage.spec.ts`, `PageAdminModal.spec.ts`, `PageDataAdminModal.spec.ts`, `ModalRadioTabs.spec.ts`, `useParentPageLoader.spec.ts`, `useParentPageDataLoader.spec.ts`.

### Design decisions

- **No `$nested` boolean** — parent = nested, always. The presence of `$parentPage`/`$parentPageData` is the signal.
- **Single rendering mechanism** — `<CwaPage />` (`cwa-page.vue`) handles all contexts. Depth comes from `manifest.irisByDepth` groups or from walking the `parentPage`/`parentPageData` chain. No URL-segment-depth dependency.
- **`resource_iris` is `string[][]`** — index = rendering depth, root first. The module reads the array index directly; no client-side traversal needed to determine depth.
- **Manifest required in both public and admin contexts** — without a manifest, fetching a page by IRI is 4+ serial round trips (page → groups → positions → components). The API bundle must expose a manifest endpoint for non-route entity access. The chain walk is a fallback, not the primary path.
- **`irisByDepth` set before batch starts** — when the manifest HTTP response arrives, `irisByDepth` is stored immediately (before `fetchBatch`). This decouples "we know the depth structure" from "the batch has completed" and enables the depth-0 early-switch.
- **`fetchComplete` replaces `resources === undefined` gate** — `isFetchResolving` checks `!manifest.fetchComplete` instead of `manifest.resources === undefined`. These are the same thing in the current code; the rename just makes the intent explicit and frees `irisByDepth` to be set earlier.
- **Route concatenation is recommended, not required** — `RouteGenerator` prefixes child paths for clean URLs; the rendering mechanism does not depend on URL structure.
- **Hierarchy on AbstractPage, not Route** — must be settable before publication.
- **Keepalive by depth group** — if the same IRIs appear at depth 0 across two navigations, the parent layer is preserved without re-render.
- **Early-switch is depth-0 aware** — `displayFetchStatus` checks `manifest.irisByDepth?.[0]` for the root page IRI against `currentIds`, not the leaf. If cached, display switches immediately and stale data is replaced as fresh responses arrive. Covers first visits (wait), return visits and same-page refreshes (switch immediately), and sibling navigation (parent frame renders, child loads progressively).

---

## Tailwind v4

The module uses **Tailwind v4** (`tailwindcss: ^4.2.4`, `@tailwindcss/postcss: ^4.2.4`, `@tailwindcss/vite: ^4.2.4`). The build is CSS-first — no `tailwind.config.js`. All configuration lives in `src/tailwind/tailwind-cwa.css`.

**CSS isolation:** All utilities are scoped under a `cwa:` prefix via v4's `prefix()` import:

```css
@import 'tailwindcss/theme' layer(theme) prefix(cwa);
@import 'tailwindcss/utilities' prefix(cwa);
```

This means every Tailwind class in the module must use the `cwa:` prefix (e.g. `cwa:flex`, `cwa:bg-dark`). The compiled output is committed to the repo at `src/runtime/templates/assets/cwa.css`.

**Custom theme** is declared in `@theme {}` blocks — replaces the v3 `theme` key. **Plugins** use `@plugin` directive — replaces v3 `plugins` array. **Base reset** (`tailwind-base.css`) imports only `tailwindcss/preflight` layer(base), consumed by the layer.

**Build:** `postcss src/tailwind/tailwind-cwa.css -o ./src/runtime/templates/assets/cwa.css` via `@tailwindcss/postcss`. Vite integration (`@tailwindcss/vite`) is available but not used for the pre-compiled admin CSS — it is used by the playground for the app-side CSS.

---

## Future: CWA Admin UI Component Kit

The goal is a polished, consistent component kit for the admin UI — similar in scope to what Nuxt UI provides but built entirely inside this module with no third-party design system dependency.

**Why not Nuxt UI:** Adding it as a module dependency would force every consuming app to carry Nuxt UI as a transitive dep. More critically, CSS isolation would break: Nuxt UI injects its own theme tokens and utility classes globally, so a consuming app's Nuxt UI configuration (colours, fonts, spacing) would bleed into — and potentially override — the admin UI styles. The `cwa:` prefix isolation only protects Tailwind utilities; it does not protect against a shared Nuxt UI runtime injecting conflicting CSS variables or component styles.

**The right approach:** A self-contained component library scoped entirely within this module — styled exclusively with the `cwa:` prefixed Tailwind utilities already in place. No runtime CSS injected by a third party; no shared design tokens with the consuming app. The admin UI stays visually consistent regardless of what CSS framework or configuration the consuming app uses.

**Nuxt UI as a structural reference:** Nuxt UI's source is a good model for how to organise the kit — its separation of base/variant/size layers, slot-based composition, and headless-first primitives are patterns worth following. Refer to it when designing new components, but implement everything natively using our own `cwa:` Tailwind classes.

**Surface areas that need components:**

- **Modal UI** — inputs, selects, textareas, radio tab groups, checkboxes, buttons, info fields, section labels. These already exist in `src/runtime/templates/components/core/admin/form/` in rough form and need to be consolidated into a coherent kit.
- **Standalone admin pages** (`src/layer/pages/_cwa/`) — list views, data tables, form layouts, page-level navigation. These pages currently inherit ad-hoc styles and would benefit from shared layout primitives.
- **Manager bar** — the resource manager panel (`LazyCwaAdminResourceManager`) needs alternative style variants; the current dark-panel aesthetic should be one option, not the only one. Tab bars, stack breadcrumbs, and focus overlays are all candidates for themeable base components.
- **Base primitives** — tabs (headless, composable into modal tabs, manager tabs, radio tabs), dropdowns, badges, tooltips. Build the headless logic once; apply variant styles on top. This mirrors how Nuxt UI structures `UTab` / `USelect` etc.

**Scope:** Admin-only. Public-facing CWA components (`CwaComponent*`, layouts, page templates) are owned by consuming apps and intentionally unstyled by this module.

---

## Known Bug: ComponentFocus doesn't reposition after UI/style changes

**Symptom:** When the admin selects a component and then changes its UI variant or style class from the manager tab, the focus highlight (canvas cutout + animated outline div) stays at the old position. It does not redraw to follow the component as its layout shifts.

**Files involved:**
- `src/runtime/templates/components/main/admin/resource-manager/ComponentFocus.vue` — canvas + outline div
- `src/runtime/admin/manageable-resource.ts` — tracks `domElements`, owned by each `ManageableResource` instance
- `src/runtime/composables/cwa-resource-manageable.ts` — creates `ManageableResource`, pushes to event bus

### Case 1 — Style/class change (no remount)

`ComponentFocus` computes position via:
```ts
const position = computed(() => {
  for (const domElement of domElements.value) {
    const domRect = domElement.getBoundingClientRect()
    // ...
  }
})
```

`position` only re-evaluates when its Vue reactive deps change: `totalWidthAndHeight` (from `useElementSize` / `ResizeObserver`), `windowSize`, `reorderId`. When a CSS class change shifts the element's layout position **without changing its size**, `ResizeObserver` never fires. `totalWidthAndHeight` stays the same. `position` stays cached. `drawCanvas()` draws the old cutout.

**Fix:** The `drawCanvas()` function should read DOM rects directly (not through the cached computed) so every `redraw()` call sees the current layout. Alternatively, watch `resource.value?.data` in `ComponentFocus` and call `await nextTick(); redraw()` when it changes — this covers the patch arriving after a style/UI change.

### Case 2 — UI component change (component remounts) — two compounding problems

**Problem A — Ordering:** `admin.ts` listens to both `manageableComponentMounted` and `componentMounted` and calls `emitRedraw()`. Because event bus listeners fire in registration order, `admin.ts`'s listener fires **before** `onManageableComponentMounted` in the composable (which calls `initNewIri()` to populate the new `domElements`). So every `drawCanvas()` call from the redraw sees an empty ref.

**Problem B — Stale ref:** Each `useCwaResourceManageable` call creates its own `ManageableResource` with its own `domElements: Ref<HTMLElement[]>`. `createFocusComponent()` in `ResourceStackManager` mounts `ComponentFocus` once with `domElements: stackItem.domElements` — the OLD instance's ref. When C unmounts, `clear()` sets that ref to `[]`. When C remounts, a NEW `ManageableResource` is created with a NEW (populated) ref. The stack item still holds the OLD ref (permanently empty). `ComponentFocus` watching the old ref never recovers.

**Fix:**

In `onManageableComponentMounted` (`cwa-resource-manageable.ts`), after `initNewIri()` has populated the NEW `domElements`, update the stack item and recreate `ComponentFocus` *before* emitting `componentMounted`:

```ts
const onManageableComponentMounted = (iriMounted: string) => {
  if (iriMounted === iri.value) {
    manageableResource.initNewIri()
    $cwa.admin.resourceStackManager.refreshFocusForIri(iri.value, manageableResource.domElements)
    $cwa.admin.eventBus.emit('componentMounted', iri.value)
  }
}
```

In `ResourceStackManager`, add `refreshFocusForIri(iri, domElements)`:
```ts
public refreshFocusForIri(iri: string, domElements: Ref<HTMLElement[]>) {
  for (const item of this.currentResourceStack.value) {
    if (item.iri === iri) {
      item.domElements = domElements
      break
    }
  }
  this.createFocusComponent()
}
```

This ensures: when `componentMounted` fires (triggering `emitRedraw()` → canvas draw), `ComponentFocus` has already been recreated with the correct, populated ref. Both ordering and stale-ref problems are resolved in one change.

---

## Fixed: Same-origin absolute URLs treated as external in useHtmlContent

**File:** `src/runtime/composables/component/html-content.ts`

`hrefToUrl()` used `new URL(href)` which succeeds for any valid absolute URL (including `https://localhost:3002/some/path`). These were returned unchanged, and `CwaLink` saw them as external links (different from a bare path string), opening them in a new tab.

**Fix:** After a successful `new URL(href)`, check `url.hostname === window.location.hostname`. If same hostname, return `url.pathname + url.search + url.hash` so the router treats it as an internal path. Hostname-only (not full origin) comparison handles dev environments where links may be stored without the port (e.g. `https://localhost/page` vs `https://localhost:3002/page`) — the protocol and port may differ but the destination is still the same app. SSR guard: the check is gated on `typeof window !== 'undefined'`; on the server, absolute URLs pass through unchanged (no `window` available).

---

## Known Bug: TipTap bubble/floating menu obscured by CWA overlay

**File:** `playground/app/components/TipTapHtmlEditor.vue`

TipTap v3 (`@tiptap/vue-3` ≥ 3.x) replaced Tippy.js with `@floating-ui/dom`. The `tippyOptions` prop on `<bubble-menu>` and `<floating-menu>` **no longer exists** — it is silently ignored. Setting `zIndex` via `tippyOptions` has no effect.

The `BubbleMenu` component renders `h("div", { ref: root, ...attrs }, slots.default)`. The `BubbleMenuView` removes that element from its initial location and re-appends it via `appendTo` (defaulting to `this.view.dom.parentElement`). The element is appended inside the TipTap editor's DOM tree, which is inside a stacking context below the CWA overlay (`--cwa-z-index-overlay: 750`).

**Things tried and failed:**
- `tippyOptions` — prop doesn't exist in v3; silently ignored
- `appendTo: () => document.body` — breaks menu visibility entirely; floating-ui's `position: absolute` coordinate calculation diverges from the viewport-relative `getBoundingClientRect()` rect when the element's offset parent changes to `<body>`
- `strategy: 'fixed'` in `:options` + `style="z-index: 760"` — bubble menu does not appear when text is highlighted

**What's known:** `attrs` (including `style` and `class`) do fall through to the root div via `...attrs` in TipTap's render function. The `BubbleMenuView.show()` appends the element via `appendTo`; `BubbleMenuView.updatePosition()` calls `computePosition` async then applies `position`, `left`, `top`. The `getShouldShow` default uses `view.hasFocus()` to gate visibility.

**Next investigation needed:** Determine exactly why the bubble menu is not appearing at all. Check whether `getShouldShow` is returning false (focus detection issue), whether `updatePosition` is applying incorrect coordinates, or whether there is a different stacking context issue specific to the CWA admin context.
