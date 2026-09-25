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

### Keep CLAUDE.md short
Record the **rule** and the **trap**, with the issue link — not the investigation, measurements or history. Those belong in the issue. Delete a section once its rule is enforced by a test and nothing about it is surprising.

### Changelog — every change, every release
`CHANGELOG.md` is maintained continuously. Any change that affects the published package adds **one short line** under `## [Unreleased]`, linking the PR (`[#123](…/pull/123)`) or the commit (`[abc1234](…/commit/<sha>)`). Tooling, CI and docs-only changes do not need a line.

To release: rename `## [Unreleased]` to `## [x.y.z] - YYYY-MM-DD`, add a fresh empty `## [Unreleased]` above it, update the compare links at the bottom, set `package.json`'s version, and push a `vX.Y.Z` tag. The `release` CI job (`scripts/changelog-section.mjs`) **refuses to publish when that version has no changelog entries**, then creates the GitHub release for the tag with that section as its notes (marked pre-release for a `-` version). `scripts/release.sh` also refuses a tag that does not match `package.json`.

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
- `cwa-healthcheck.get.ts` — liveness (`/_cwa/healthcheck`); `cwa-readiness.get.ts` — readiness (`/_cwa/readiness`)
- `cwa-page-cache-warm.post.ts`, `page-cache-plugin.ts`, `sitemap-cache-plugin.ts` — page/sitemap caching

**Note**: server files use direct imports (`import { createError } from 'h3'`) — they do not rely on Nitro auto-imports.

### Module options (`CwaModuleOptions`)

Configured in the consuming app's `nuxt.config.ts` under the `cwa` key:

- `resources` — per-resource-type config (`name`, `description`, `instantAdd`, `managerTabs`, `ui`, `defaultData`)
- `layouts` / `pages` / `pageData` — UI metadata for admin dropdowns
- `siteConfig` — default site-wide settings
- `pagesDepth` — depth of nested CWA route segments (default 4)
- `layoutName` — override the default `cwa-root-layout` layout

### Testing

Tests use **vitest** with `happy-dom` and `vitest-environment-nuxt`, with the playground as the Nuxt `rootDir`. Snapshots are co-located (`.spec.ts.snap`). `setup.ts` configures `@vue/test-utils` globals. `pnpm run test:e2e` builds the playground and runs the build-output and real-renderer guards in `test/e2e/` (not part of `pnpm run test`); `pnpm run test:fresh-install` packs and installs the package into a throwaway app (CI job gating publishing).

**Mocking rules:**
- **`vi.mock('#imports')` never intercepts, and fails silently** — the real binding runs ([#265](https://github.com/components-web-app/cwa-nuxt-module/issues/265)). Use `mockNuxtImport` (`@vitest-environment nuxt`), or mock the real underlying module (`#app/nuxt`, `#app/composables/router`, `#app/composables/cookie.js`, `#site-config/server/composables`, `nitropack/runtime`).
- `vi.mock('#components')` errors outright; `vi.mock('#build/cwa-options')` works.
- **A mock never asserted on is not proven live** — assert it was called.
- **When mocking a getter that returns `computed()`, the mock must be a real `computed`** — a plain value hides the #260 nested-ref trap.
- A no-op mocked `watch` silently disables the code under test; spy with `vi.fn(mod.watch)`.
- `mockImplementationOnce` queues survive `vi.clearAllMocks()` — reset in `afterEach`. Always `vi.useRealTimers()` in `afterEach`.
- `vi.hoisted()` cannot use `ref()`/`reactive()`; make mock data `reactive()` so computeds re-evaluate.
- `ResourceTypeFromIri.setPathPrefix` is a module singleton — reset it in `afterEach`.
- happy-dom has no layout (`scrollHeight` is 0) and no canvas — inject DOM reads rather than asserting on them.
- **Mutation-test guard assertions** (break the code, watch the test fail). Several past tests passed for the wrong reason.

---

## Deprecations and temporary code

Code kept only for an older API, or to work around someone else's bug, is logged in **`DEPRECATIONS.md`** with the condition that must hold before it can be deleted.

---

## SSR and Nuxt context — the rules that caused the worst bugs

- **Untransformed code loses the Nuxt context at its first `await`** (`asyncContext: false`). `fetcher.ts`, store actions, `FetchStatusManager`, `Auth` are plain classes. Worse, a transformed middleware's `__restore()` leaks its app into unctx's module variable, so a later implicit composable resolves **another concurrent request's app** ([#263](https://github.com/components-web-app/cwa-nuxt-module/issues/263), [#313](https://github.com/components-web-app/cwa-nuxt-module/issues/313), [#314](https://github.com/components-web-app/cwa-nuxt-module/issues/314)).
  - Capture what you need **in a constructor** while the context is live (`CwaFetch` captures the request cookie; `Cwa` captures `useNuxtApp()` and hands it down), then use `nuxtApp.runWithContext(...)`.
  - **One `Cwa`/`CwaFetch` per SSR request.** Captured request state must stay in instance closures — never module scope, never store state (it is serialised).
  - `runWithContext` in an **ofetch interceptor** is rejected (forces it async); in an action it is fine.
  - Read `useNuxtApp()` before any `await` / `requestAnimationFrame` even on client-only paths.
- **Nested `ComputedRef` accesses are not unwrapped in templates** ([#260](https://github.com/components-web-app/cwa-nuxt-module/issues/260)). `$cwa.auth.isAdmin` in a template is an always-truthy object — use `.value`. `auth.user`/`auth.roles` and `Cwa.isStaticRender` are deliberately plain values; don't wrap them in `computed`. The same trap applies to `useCwaResourceUpload`'s `bind` — always destructure it.
- **Never compare a server-issued time against the browser clock** ([#262](https://github.com/components-web-app/cwa-nuxt-module/issues/262)). Static-render detection is `payload.prerenderedAt` plus build-time `staticRender` (routeRules with `isr`/`swr`/`prerender`, or `cwa.staticRender`).
- **Depth tracking (`iriDepths`, `depthPaths`) lives in the fetcher store**, so it survives SSR→client hydration and the depth-aware `path` header stays right on client re-fetches ([#261](https://github.com/components-web-app/cwa-nuxt-module/issues/261)).
- `ResourceLoader`'s SSR-4xx re-fetch is gated on `auth.user || isStaticRender` — an anonymous visitor would only get the same 4xx ([#334](https://github.com/components-web-app/cwa-nuxt-module/issues/334)).

## API URL and path prefix

- **`resolveApiUrl(runtimeConfig, isServer)`** (`api/api-url.ts`) is the only way to get the API URL. Server: `runtimeConfig.cwa.apiUrl` → `public.cwa.apiUrl` (deprecated) → `public.cwa.apiUrlBrowser` → fallback. Client: never touches `runtimeConfig.cwa` (not even to read it). Anything new that needs the URL must call it ([#345](https://github.com/components-web-app/cwa-nuxt-module/issues/345)).
- The fallback is `https://api-url-not-set.invalid` — `.invalid` can never resolve, because `CwaFetch` forwards visitors' cookies.
- Public and private `cwa.apiUrl*` keys are declared unconditionally in `module.ts` so env overrides apply.
- **Path prefix:** a bare-host API has no prefix; `normaliseApiPathPrefix` trims trailing slashes so `/`, `//` → none and `/_api/` → `/_api` ([#266](https://github.com/components-web-app/cwa-nuxt-module/issues/266)). Stripping is leading-only. Use `getResourceTypeFromIri`, never `startsWith('/_api/')`.

## Nested sub-pages and the manifest

- There is no `nested` flag: a page with `parentPage`/`parentPageData` is nested. Rendering never depends on URL structure.
- `GET /_/resource_manifest/{id}` returns `resource_iris: NestedJsonStructure[]` — one `{ iri, children }` tree per depth, root first. `{id}` starting `/` is a route path; a UUID is a page/page data (admin). Stored as `resourceTree` and flattened into `irisByDepth` **before** `fetchBatch` starts. **Do not add fields to `NestedJsonStructure`** — type is derivable from the IRI (API #198 won't-do), and `uiComponent` must never be in the manifest (a shared layout change would invalidate every page's manifest).
- `cwa-page.vue` provides depth 0; `<CwaPage />` renders `pageIriAtDepth(depth)` and provides depth + 1, `'cwa-page-data-iri'` and `'cwa-page-own-depth'`. An auto-fallback `<CwaPage />` is appended if a template omits it and deeper resources exist.
- Reachability decides public access (bundle #225): a routed child makes its unrouted ancestors public; an unrouted page is fully private. Anonymous denials are 401; a gated route is 404.
- The `path` header may be a route path or a page data IRI; only dynamic `ComponentPosition` responses vary by it (`Vary: path`).
- **A template page shared at two depths renders the deepest depth's dynamic components**; `setManifestIrisByDepth` warns. Deferred — a fix must keep `fetchStatus.resources` as bare IRIs (surrogate keys).
- The `@type` guard in `isFetchStatusResourcesResolved` is dead (compares against `'COMPONENT_POSITION'`); **fixing only the `@type` would break early-switch** — both halves must change together.

## Navigation, fetch tokens and the route cache

- `displayFetchStatus` holds the **displayed** page (`primaryFetch.displayedToken`) while a new one loads, never the last *fully-resolved* one ([#256](https://github.com/components-web-app/cwa-nuxt-module/issues/256)). A superseded fetch is held only if **all** its depths had page data.
- A redirect aborts its fetch with reason `'redirect'`; `finishFetch` then keeps the previous page instead of promoting a page-less route. Errors are never aborted, so they surface.
- Rapid repeat redirect clicks are safe ([#245](https://github.com/components-web-app/cwa-nuxt-module/issues/245)): superseded clicks resolve `undefined` (correct), and the `middlewareToken` guard in `route-middleware.ts` is load-bearing. `waitForMiddleware` polls a real 10ms timer — tests need real time.
- **Instant revisit** ([#257](https://github.com/components-web-app/cwa-nuxt-module/issues/257)): `routeCache` (`markRaw`) primes a fully-cached route on `startFetch`; the fetch still runs to revalidate. LRU by route count (`routeCacheLimit`, default 50, 0 = unbounded), ref-counted, never evicting current/in-flight resources.
- **A resource IRI is a route param, never a path**: navigate with `getInternalResourceLink(iri)` (`_cwa-resource-page`, `cwaPage0`). `navigateTo(iri)` always 404s.
- **CWA page routes are flat siblings with a constant `meta.key` (`'cwa-page'`)** ([#337](https://github.com/components-web-app/cwa-nuxt-module/issues/337)). Nested records stop `page:loading:end` firing; dropping the key remounts the page on every navigation. No generated route may declare `cwaPage0`.
- **Scroll restore waits for content** only for `savedPosition` or a cross-page `#hash` ([#338](https://github.com/components-web-app/cwa-nuxt-module/issues/338)); `isLoading` alone is too early. `runtime/router.options.ts` reproduces Nuxt's `scrollBehavior` (re-read on Nuxt majors) and is **spliced at index 1** of `pages:routerOptions` so apps and layers still override it.
- **The page query is only forwarded to Collection component fetches** ([#318](https://github.com/components-web-app/cwa-nuxt-module/issues/318)). Admin lists merge their own query via `mergeQueryIntoPath` with `noQuery: true` — don't widen `consumesPageQuery`.

## Page HTML caching ([#289](https://github.com/components-web-app/cwa-nuxt-module/issues/289))

On by default (`cwa.pageCache.enabled`; the `?? true` in `module.ts` and `resolvePageCacheOptions` must agree). Tags HTML with API resource IRIs in `Surrogate-Key` (joined `', '`), plus `cwa-html`.

- **Decide-then-emit:** `plugin-page-cache.server.ts` decides at `app:rendered`; `server/page-cache-plugin.ts` emits at `beforeResponse`.
- **TTL follows the lowest API `s-maxage`/`Expires`** (converted using that response's own `Date`), capped by optional `sharedMaxAge`; 3600 only when nothing carries freshness ([#325](https://github.com/components-web-app/cwa-nuxt-module/issues/325)). `max-age=0` always. Untagged time-sensitive output needs `sharedMaxAge`.
- **Cacheability is the API's decision:** any `no-store`/`private` response makes the page unstorable, plus an `auth.signedIn` gate. **4xx responses are ignored, 5xx always count** ([#324](https://github.com/components-web-app/cwa-nuxt-module/issues/324)).
- **The Nitro hook never sees an error status** — Nuxt renders errors via an internal 200 `/__nuxt_error` request and copies its headers ([#340](https://github.com/components-web-app/cwa-nuxt-module/issues/340)). The error render is declined via the `x-nuxt-error` request header (not the path, not `payload.error`), and a failed primary fetch calls `CwaFetch.markUnstorable()`.
- Deployment prerequisites: the edge must bypass the auth cookie (no `Vary: Cookie`), and an app with its own personalised SSR output must disable page caching.
- **`cwa-html`** (`RENDERED_HTML_SURROGATE_KEY`) is a cross-repo contract with api-components-bundle#232 — the bundle purges it for site-wide changes.
- **Purge all** (`purgeHttpCache()` → `POST /_/http_cache/purge`) is separate from `purgePageCache()`; a 501 means nothing was purged ([#326](https://github.com/components-web-app/cwa-nuxt-module/issues/326)).
- **Warm** (`POST /_cwa/page-cache/warm`, [#315](https://github.com/components-web-app/cwa-nuxt-module/issues/315)): anonymous, admin-gated via `/me`, single-flight per pod, NDJSON progress, pages from `fetchCwaPagePaths()`. Uses `node:http(s)` because undici replaces `Host`. Behind Caddy's automatic HTTPS, `NUXT_CWA_PAGE_CACHE_WARM_ORIGIN` must be `https://` ([#343](https://github.com/components-web-app/cwa-nuxt-module/issues/343)); never add `rejectUnauthorized: false` or `servername`.
- ISR/SWR route rules conflict with it; `module.ts` warns.

## Sitemap

- `cwa-urls.get.ts` excludes redirect routes (checked first — they carry the target's `page`) and page-less routes, on positive evidence only ([#278](https://github.com/components-web-app/cwa-nuxt-module/issues/278)). The anonymous fetch is the whole publication filter — if it is ever authenticated, a module-side filter becomes necessary.
- `@nuxtjs/sitemap`'s per-process cache is off (`cacheMaxAgeSeconds: 0` in `defaults`); `server/sitemap-cache-plugin.ts` emits `s-maxage` (`cwa.sitemapCache.sharedMaxAge`, 600) and `Surrogate-Key: cwa-html, <prefix>/_/routes` ([#344](https://github.com/components-web-app/cwa-nuxt-module/issues/344)). The prefix comes from `resolveApiUrl` + `normaliseApiPathPrefix`, not the `ResourceTypeFromIri` singleton. The Route collection tag is a contract with api-components-bundle#313/#317.

## Route go-live ([#287](https://github.com/components-web-app/cwa-nuxt-module/issues/287), [#341](https://github.com/components-web-app/cwa-nuxt-module/issues/341))

- `liveAt` is the route's own, writable date; `_metadata.effectiveLiveAt` is the latest across routed ancestors, read-only. Both admin-only. **Badges show effective; the control edits own.**
- `effectiveLiveAt` is read **only** in `resources/route-publication.ts`. `isRouteGatedByAncestor` is `effective > own`; compare parsed instants; absent effective means not live.
- Choosing **Live** on an already-live route keeps its stored `liveAt` (Headless UI emits on re-selecting the selected option).
- `datetime-local` values are browser-local, committed as UTC.
- `Route` is not publishable — keep `publishedAt` inference away from it.

## Security and server routes

- **Maintenance bypass is verified with the API's `/me`** (`server/is-admin.ts`), with a cheap JWT-decode pre-filter; fails closed, 3s timeout.
- `/_cwa/healthcheck` and `/_cwa/readiness` skip the site-config fetch (exact paths, split on `?`) ([#342](https://github.com/components-web-app/cwa-nuxt-module/issues/342)). **Never skip `/__sitemap__/*` or `/robots.txt`** — they need site config.
- `/_cwa/readiness` probes the API's `/_/health` with `redirect: 'manual'`, no cookies, 2s default timeout (`runtimeConfig.cwa.readiness`); 3xx = not ready, non-404 4xx = ready. No caching of the result. The k8s probe timeout must be ≥ 3s.
- The site-config fetch has a 5s timeout; on timeout maintenance mode is not enforced.
- `useLogin` redirects go through `resolveRedirectTarget`, which rejects anything but a plain internal path ([#271](https://github.com/components-web-app/cwa-nuxt-module/issues/271)). `cwa-auth`/`cwa-admin` middleware `await auth.init()` before deciding.
- Session end clears the named PWA runtime caches (`cwa.auth.clearCachesOnSessionEnd`, default `['cwa-api']`, never the precache) on sign-out, a client 401, or an expiry found during SSR ([#293](https://github.com/components-web-app/cwa-nuxt-module/issues/293)).
- The error page flags `apiUnreachable` (no status + a request, or 502/503/504) via `data` only; `error.request` must never reach the browser ([#346](https://github.com/components-web-app/cwa-nuxt-module/issues/346)).

## Bundle and packaging

- **Admin code stays out of the entry chunk** ([#331](https://github.com/components-web-app/cwa-nuxt-module/issues/331)): `ConfirmDialog`, `ComponentFocus`, `fast-xml-parser` are `await import()`ed; no `luxon` (use `toISOString()`, `publishedAt` is string-compared). Guarded by `test/e2e/entry-bundle-markers.mjs`. Don't `createApp(defineAsyncComponent(...))` — it loses `defineExpose`. `createFocusComponent`'s `focusGeneration` increment and synchronous unmount+mount are load-bearing.
- **Admin UI is never prefetched**: a `build:manifest` filter strips dynamic-import edges to `main/admin/` and `core/admin/` ([#336](https://github.com/components-web-app/cwa-nuxt-module/issues/336)). Guarded by `test/e2e/prefetch-hints.mjs`.
- **Symlinked layer pages**: a production `pages:extend` hook realpaths `page.file` (nuxt/nuxt#36401, [#329](https://github.com/components-web-app/cwa-nuxt-module/issues/329)). Apps should `extends: ['@cwa/nuxt/layer']`.
- **Only `.vue` files under `src/layer/pages/`** — anything else becomes a route; layer composables live in `src/layer/_composables/` ([#330](https://github.com/components-web-app/cwa-nuxt-module/issues/330)).
- **Shipped code is a dependency promise** ([#273](https://github.com/components-web-app/cwa-nuxt-module/issues/273)): anything imported from `src/runtime` or `src/layer` must be in `dependencies`. `satori` + `@resvg/resvg-js` are optional peers; `nuxt-og-image` is required only when both resolve (with a no-op `defineOgImage` otherwise). `@nuxt/kit`'s range must track `meta.compatibility.nuxt`.
- **`v-cwa-html`** (returned by `useHtmlContent`) avoids Vue 3.5.39's hydration re-parse of `v-html`; it uses `beforeUpdate`, never `updated`, so anchor conversion sees the new HTML ([#333](https://github.com/components-web-app/cwa-nuxt-module/issues/333)).

## Dependencies

- **`typescript` held at `^6`** (TS 7 breaks `vue-tsc`): `pnpm up --latest -r "!typescript"`.
- **`vite` pinned to `^8` by override** — a mixed vite 7/8 tree stops every test file starting.
- `@pinia/nuxt ^1` is required by `moduleDependencies` (breaking for apps).
- Security overrides live in `pnpm-workspace.yaml`; move the match key as well as the floor, and add new versions to `minimumReleaseAgeExclude`.
- After any dependency change: `dev:prepare`, `test`, `test:types`, `lint`, `build`, `dev:build`, boot `dev:http`.

## Tailwind v4

CSS-first config in `src/tailwind/tailwind-cwa.css`; every class uses the `cwa:` prefix (`prefix(cwa)`). Compiled CSS is committed. Apps import it into a low `@layer cwa` by design, so an app's unscoped global element styles beat admin styles — apps should scope their globals ([#247](https://github.com/components-web-app/cwa-nuxt-module/issues/247)).

## Admin UI

- **Component kit ([#236](https://github.com/components-web-app/cwa-nuxt-module/issues/236))**: wraps `@headlessui/vue`, styled only with `cwa:` utilities; no Nuxt UI (it would inject theme into apps). `CwaUiSelect` done; `CwaUiFormSelect` superseded; searchable `SelectMenu` next.
- **Component styles**: `styles: { multiple?, classes: { name: string } }`; `uiClassNames` stores one class string per selected style (`mergeSelectedStyles` / `deriveSelectedStyles`). `useCwaAutoClass` removes only classes it added itself.
- **Updates are merge-patch with changed fields only** (`useItemPage.saveResource`). `localResourceData` is a shallow copy — replace nested values, never mutate in place. A not-yet-persisted component merges locally with the same semantics: arrays and `null` replace ([#319](https://github.com/components-web-app/cwa-nuxt-module/issues/319)).
- `useCwaResourceEndpoint`'s `query`/`applyPostfix` are plain computeds — never watcher-written.
- `ManageableResource.refreshElements()` (via `componentUpdated`, throttled 40ms leading+trailing, admin-gated) keeps outlines and clicks on a root element that changes without a remount ([#321](https://github.com/components-web-app/cwa-nuxt-module/issues/321)).
- Text-selection drags don't deselect: the guard is central in `ResourceStackManager._addToStack` ([#254](https://github.com/components-web-app/cwa-nuxt-module/issues/254)).
- Deleting the page on screen navigates from `requestCompleteFn` (before store removal), with `cwa_force`.
- Admin lists keep their previous items and show an alert on failure; error handling sits **inside** the request-id guard. List search sends one `search` parameter plus the legacy per-field names (`searchFields` on `ListContent`) until every app has migrated ([#328](https://github.com/components-web-app/cwa-nuxt-module/issues/328)).
- `ResourcesManager.storeResource` writes to the store only (no API request) and is `@internal` ([#282](https://github.com/components-web-app/cwa-nuxt-module/issues/282)).
- A layout whose `uiComponent` doesn't resolve falls back to the default layout **and** shows a warning ([#277](https://github.com/components-web-app/cwa-nuxt-module/issues/277)).

## Component groups and positions

- **`allowedComponents`** takes prefix-free collection IRIs (`/component/navigation_links`); the synchroniser adds the prefix. **Omitted means "leave it"; `null` clears** ([#303](https://github.com/components-web-app/cwa-nuxt-module/issues/303)). Never pass PHP FQCNs. The API omits a null list, so a group with no `allowedComponents` key has no list and **is** synced ([#351](https://github.com/components-web-app/cwa-nuxt-module/issues/351)); `[]` is normalised to `null`, as the API stores it, or it would re-PATCH on every load.
- **`explicitAllowOnly`** (bare boolean on the docs `supportedClass`, absent = false) hides a type unless a group lists it; `isComponentAllowedInGroup` is used for direct and dynamic positions ([#249](https://github.com/components-web-app/cwa-nuxt-module/issues/249)). Cloning ([#157](https://github.com/components-web-app/cwa-nuxt-module/issues/157)) must respect it.
- `location` is optional (renders nothing until set; synchroniser starts from a watch) and resolves to the published IRI ([#276](https://github.com/components-web-app/cwa-nuxt-module/issues/276), [#317](https://github.com/components-web-app/cwa-nuxt-module/issues/317)). `useCwaComponent`'s `publishedIri` falls back to the draft IRI; `findPublishedComponentIri` itself must keep returning `undefined` for never-published drafts.
- The synchroniser does not PATCH a group already associated with its location ([#339](https://github.com/components-web-app/cwa-nuxt-module/issues/339)); the upstream cause of the missing group data is still unknown.
- **Reordering** ([#316](https://github.com/components-web-app/cwa-nuxt-module/issues/316)): one serialised queue per group; moves chosen outside the longest increasing subsequence; the local mirror ports the API's by-value shift exactly; a failed PATCH is never mirrored. Read pending updates **before** storing display numbers.
- `CwaComponentGroup` emits `componentsLoaded` / `componentsUpdated` with `{ component, position }[]` for its own positions ([#251](https://github.com/components-web-app/cwa-nuxt-module/issues/251)).

## Mercure ([#286](https://github.com/components-web-app/cwa-nuxt-module/issues/286))

Replay is not trusted. On reconnect (`connected` going `false` → `true`; `undefined` until the first open) or an `online` event, on-screen resources are refetched with `isNew: true` — unchanged ones are discarded, changes surface through the existing outdated-content notice.

## Composables

- **`useCwaComponent(props, plugins?, ops?)`** is the recommended entry point (#238/#239): returns `resource`, `exposeMeta` plus merged plugin results; `defineExpose(exposeMeta)` is still required. Plugins: `withCollection()`, `withFile(fileOps?)` (exposes a `files` map keyed by `fileProp`; the merge accumulates `files`).
- **File fields** ([#252](https://github.com/components-web-app/cwa-nuxt-module/issues/252), [#267](https://github.com/components-web-app/cwa-nuxt-module/issues/267)): `fileOps` = `fileProp` (default `'file'`), `imagineFilterName`, `imageRef`. **`imageRef` is never registered for you** (auto-registration crashed prod) — pass `useTemplateRef<unknown>('file')` explicitly if you need the loaded-on-mount check. Admin: `useCwaResourceUpload(iri, prop)` returns `bind`; one call per field.
- **Uploads downscale images in the browser** by default (2560px / 20MP / 0.85, `cwa.upload.image`, per-call `imageDownscale`), keeping the original when not smaller; skips SVG, GIF and animated WebP ([#335](https://github.com/components-web-app/cwa-nuxt-module/issues/335)). Defaults must stay under the template's server caps (20 MB, 40 MP). Built-in defaults live only in `image-downscale.ts`.
- **Forms** (#172): `useCwaFormInput`, `useCwaForm`, `useCwaFormRepeated`, `useCwaFormCollection` — scaffolding only; see `playground/app/cwa/components/ExampleForm/`. Checkbox unchecked is `null`, not `""`; collection prototype is on `formEntry.prototype`. `realtime_validate_disabled` on the root form suppresses per-keystroke validation ([#279](https://github.com/components-web-app/cwa-nuxt-module/issues/279)).
- `useHtmlContent(container, html?)` — pass the HTML source so anchors re-convert on change ([#275](https://github.com/components-web-app/cwa-nuxt-module/issues/275)).
- `resources.page` / `.pageData` / `.displayPage` always return a `ComputedRef` ([#269](https://github.com/components-web-app/cwa-nuxt-module/issues/269)); read site config **inside** reactive callbacks ([#285](https://github.com/components-web-app/cwa-nuxt-module/issues/285)).
- A failed API docs fetch clears `apiDocPromise` so it can be retried ([#322](https://github.com/components-web-app/cwa-nuxt-module/issues/322)).

## Future ideas

- Component placeholders per type (`app/cwa/components/<Name>/placeholder.vue`) laid out from `resourceTree` — front-end only ([#255](https://github.com/components-web-app/cwa-nuxt-module/issues/255)).
- Non-reactive cold tier for the route cache — only at hundreds of cached pages ([#259](https://github.com/components-web-app/cwa-nuxt-module/issues/259)).
- `mockCwaResource` test utility (separate `test-utils` export); `defineCwaComponent()` macro.
