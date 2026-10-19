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
`CHANGELOG.md` is maintained continuously. Any change that affects the published package adds **one short line** under `## [Unreleased]`, always linking the **commit** (`[abc12345](…/commit/<sha>)`) or the **PR** (`[#123](…/pull/123)`), plus the issue when there is one. An issue link alone is not enough. Tooling, CI and docs-only changes do not need a line.

To release: rename `## [Unreleased]` to `## [x.y.z] - YYYY-MM-DD`, add a fresh empty `## [Unreleased]` above it, update the compare links at the bottom, set `package.json`'s version, and push a `vX.Y.Z` tag. The `release` CI job (`scripts/changelog-section.mjs`) **refuses to publish when that version has no changelog entries**, then creates the GitHub release for the tag with that section as its notes (marked pre-release for a `-` version). `scripts/release.sh` also refuses a tag that does not match `package.json`.

**`@cwa/nuxt` is staged, never published directly** ([#350](https://github.com/components-web-app/cwa-nuxt-module/issues/350)). `release.sh` runs `npm stage publish` through trusted publishing (OIDC, no token), and the version goes live only when a maintainer approves it with 2FA on npmjs.com → Staged Packages, or with `npm stage approve <id>`. Its npm trusted publisher is stage-only, so a direct `publish` from CI is rejected. `@cwa/nuxt-edge` publishes directly, because it publishes on every push. Staging needs npm ≥ 11.15, hence `npx npm@^11.15`, and packs with npm rather than pnpm — safe only while `package.json` has no `workspace:`/`catalog:` specifiers. The dist-tag is fixed when a version is staged. Rehearse locally with `GITHUB_REF_NAME=vX.Y.Z npm_config_dry_run=true ./scripts/release.sh`. The GitHub release is created when the version is staged, so delete it if the staged version is rejected. **The dist-tag is chosen by `scripts/release-dist-tag.mjs`:** a stable version is `latest`; a pre-release is also `latest` **while no stable version is on npm**, so `npm i @cwa/nuxt` gets the newest alpha until 2.0.0 ships; after that a pre-release goes under its own tag (`alpha`, `beta`, `rc`) and never displaces a stable `latest`. Only one tag can be set, because staging fixes the tag and CI can stage but not run `dist-tag add`, so until 2.0.0 the `alpha` tag stays where it was.

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
- `$cwa.orphanedResources` — `OrphanedResources`: the orphan report, requesting a scan, and deleting one orphan
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
- **SSR's request headers are a cross-repo contract with api-components-bundle#442.** The bundle's `warm-http-cache` command copies them in `HttpCache\Warm\ModuleRequestHeaders` so the API cache is warmed under the keys SSR asks for: `accept` (`cwa-fetch.ts`), `preload` (`preload-headers.ts`, one list per resource type joined with `,`; part of the key because Vulcain adds `Vary: Preload`) and `path` (`createRequestHeaders()` and `manifestDepthPath()`). A change to any of them must also be made in the bundle, or the warm fills entries SSR never reads.

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
- **Vitest 5 clears every mock's calls before each test.** A call made once at module load (e.g. `defineNuxtModule`) must be captured in `beforeAll`, as `module.spec.ts` does.
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
  - Since Nuxt 4.6 the browser build keeps the app in a plain singleton, not `unctx` (the server still uses `unctx`), so a spec models the leak with `getNuxtAppCtx().set(otherApp)` — a context from `unctx`'s `getContext` is not the one Nuxt reads.
  - `runWithContext` in an **ofetch interceptor** is rejected (forces it async); in an action it is fine.
  - Read `useNuxtApp()` before any `await` / `requestAnimationFrame` even on client-only paths.
- **Nested `ComputedRef` accesses are not unwrapped in templates** ([#260](https://github.com/components-web-app/cwa-nuxt-module/issues/260)). `$cwa.auth.isAdmin` in a template is an always-truthy object — use `.value`. `auth.user`/`auth.roles` and `Cwa.isStaticRender` are deliberately plain values; don't wrap them in `computed`. The same trap applies to `useCwaResourceUpload`'s `bind` — always destructure it.
- **Never compare a server-issued time against the browser clock** ([#262](https://github.com/components-web-app/cwa-nuxt-module/issues/262)). Static-render detection is `payload.prerenderedAt` plus build-time `staticRender` (routeRules with `isr`/`swr`/`prerender`, or `cwa.staticRender`).
- **Depth tracking (`iriDepths`, `depthPaths`) lives in the fetcher store**, so it survives SSR→client hydration and the depth-aware `path` header stays right on client re-fetches ([#261](https://github.com/components-web-app/cwa-nuxt-module/issues/261)).
- **Hydration always rewrites an `<input>`'s `value`** from the client state, so a value the browser filled in before hydration is lost ([#386](https://github.com/components-web-app/cwa-nuxt-module/issues/386)). `onMounted` is too late to read it; the auth `InputField` reads it in a directive's `created` hook, which runs before the patch.
- `ResourceLoader`'s SSR-4xx re-fetch is gated on `auth.user || isStaticRender` — an anonymous visitor would only get the same 4xx ([#334](https://github.com/components-web-app/cwa-nuxt-module/issues/334)).

## API URL and path prefix

- **`resolveApiUrl(runtimeConfig, isServer)`** (`api/api-url.ts`) is the only way to get the API URL. Server: `runtimeConfig.cwa.apiUrl` → `public.cwa.apiUrl` (deprecated) → `public.cwa.apiUrlBrowser` → fallback. Client: never touches `runtimeConfig.cwa` (not even to read it). Anything new that needs the URL must call it ([#345](https://github.com/components-web-app/cwa-nuxt-module/issues/345)).
- The fallback is `https://api-url-not-set.invalid` — `.invalid` can never resolve, because `CwaFetch` forwards visitors' cookies.
- Public and private `cwa.apiUrl*` keys are declared unconditionally in `module.ts` so env overrides apply.
- **Path prefix:** a bare-host API has no prefix; `normaliseApiPathPrefix` trims trailing slashes so `/`, `//` → none and `/_api/` → `/_api` ([#266](https://github.com/components-web-app/cwa-nuxt-module/issues/266)). Stripping is leading-only. Use `getResourceTypeFromIri`, never `startsWith('/_api/')`. `ResourceTypeFromIri` is a process-wide singleton written per request, safe only because the prefix never varies between requests; revisit if the API URL ever does ([#264](https://github.com/components-web-app/cwa-nuxt-module/issues/264), won't fix).

## Nested sub-pages and the manifest

- There is no `nested` flag: a page with `parentPage`/`parentPageData` is nested. Rendering never depends on URL structure.
- `GET /_/resource_manifest/{id}` returns `resource_iris: NestedJsonStructure[]` — one `{ iri, children }` tree per depth, root first. `{id}` starting `/` is a route path; a UUID is a page/page data (admin). Stored as `resourceTree` and flattened into `irisByDepth` **before** `fetchBatch` starts. **Do not add fields to `NestedJsonStructure`** — type is derivable from the IRI (API #198 won't-do), and `uiComponent` must never be in the manifest (a shared layout change would invalidate every page's manifest).
- `cwa-page.vue` provides depth 0; `<CwaPage />` renders `pageIriAtDepth(depth)` and provides depth + 1, `'cwa-page-data-iri'` and `'cwa-page-own-depth'`. An auto-fallback `<CwaPage />` is appended if a template omits it and deeper resources exist.
- Reachability decides public access (bundle #225): a routed child makes its unrouted ancestors public; an unrouted page is fully private. Anonymous denials are 401; a gated route is 404.
- The `path` header may be a route path or a page data IRI; only dynamic `ComponentPosition` responses vary by it (`Vary: path`).
- **A dynamic position renders the component resolved for the page on screen** ([#368](https://github.com/components-web-app/cwa-nuxt-module/issues/368)). Its IRI is the same on every page-data page, so the store holds whichever path it was last fetched for. `resources.positionComponentIri` renders the stored `component` only when the position's `apiState.headers.path` equals the displayed manifest's path at its depth (`manifestDepthPath`), which keeps admin edits; otherwise it renders what the displayed manifest nests under the position (nothing if nothing). Never copy the API's fallback rules (empty, unpublished, not allowed → the static component) from page data — the manifest already applied them. The store no longer empties a dynamic position on re-fetch: that was the blank.
- **`pageDataProperty` is only serialised for admins** (`ComponentPosition:read:role_admin`). Outside the admin a dynamic position is known by `_metadata.isDynamicPosition` — gating on `pageDataProperty` silently skips every visitor (#368 shipped that way; specs must use the visitor shape). A visitor's Mercure page-data message re-fetches every on-screen dynamic position when a property holding a component changed, since it cannot see which property a position is bound to.
- **Admin page-data editing uses the page data at the position's depth** (`resources.pageDataIriOf(iri)`, the depth `iriDepths` records, as the `path` header does) — never `pageDataIri`, which is the routed (deepest) page's: on a nested URL that wrote a shallower position's component into the child's page data.
- **A template page shared at two depths** renders each depth's dynamic components from the manifest (#368), but its dynamic positions are fetched and refreshed with the deepest depth's `path` only, so a shallower depth shows a change to which component its page data holds after the next navigation; `setManifestIrisByDepth` warns. Deferred — a fix must keep `fetchStatus.resources` as bare IRIs (surrogate keys).
- The `@type` guard in `isFetchStatusResourcesResolved` is dead (compares against `'COMPONENT_POSITION'`); **fixing only the `@type` would break early-switch** — both halves must change together.

## Navigation, fetch tokens and the route cache

- `displayFetchStatus` holds the **displayed** page (`primaryFetch.displayedToken`) while a new one loads, never the last *fully-resolved* one ([#256](https://github.com/components-web-app/cwa-nuxt-module/issues/256)). A superseded fetch is held only if **all** its depths had page data.
- A redirect aborts its fetch with reason `'redirect'`; `finishFetch` then keeps the previous page instead of promoting a page-less route. Errors are never aborted, so they surface.
- Rapid repeat redirect clicks are safe ([#245](https://github.com/components-web-app/cwa-nuxt-module/issues/245)): superseded clicks resolve `undefined` (correct), and the `middlewareToken` guard in `route-middleware.ts` is load-bearing. `waitForMiddleware` polls a real 10ms timer — tests need real time.
- **Instant revisit** ([#257](https://github.com/components-web-app/cwa-nuxt-module/issues/257)): `routeCache` (`markRaw`) primes a fully-cached route on `startFetch`; the fetch still runs to revalidate. LRU by route count (`routeCacheLimit`, default 200 since the #259 index fixes, 0 = unbounded), ref-counted, never evicting current/in-flight resources.
- **Store work scales with the page on screen, never with every stored resource** ([#259](https://github.com/components-web-app/cwa-nuxt-module/issues/259)): Mercure's pending check reads `currentIds`; `allIds` membership is a non-reactive `Set` that rebuilds itself when `allIds` is replaced or changes size (hydration, delete, evict); `getComponentGroupByReference` reads `groupIrisByReference` (in state for hydration; the first group in `componentGroupIds` wins a shared reference); route eviction is ref-counted, and a position leaves `positionsByComponent` through a non-reactive position → components index. Traps: `splice` on `allIds` sets every later index through the proxy, so replace the array; a group's `reference` and the route cache change only through the actions (`saveResource`, `uncacheRoute`), or the indexes go stale. With these, heap (~3 KB per resource) is the only cost that grows: no cold tier until a tab holds ~30k resources (~100 MB), and then IndexedDB eviction with #258, not an in-memory tier. Rerun the #259 benchmark against the largest real site as sites grow.
- **A server-side route redirect is an `external` `navigateTo` to `baseURL` + `redirectPath`** ([#389](https://github.com/components-web-app/cwa-nuxt-module/issues/389)): an internal one makes Nuxt load the whole target page before sending the 308. One hop is enough because the API's `redirectPath` is already the end of the chain. The client stays internal, because there `external` reloads the page. A redirecting route's manifest lists the **target's** resources: the browser fetches them during the redirect by design (no second round trip), but on the server the 308 discards them, so there the manifest's batch waits for the route lookup and is skipped on a redirect (`Fetcher`'s `isServer`).
- **Editing does not follow links or route redirects** ([#157](https://github.com/components-web-app/cwa-nuxt-module/issues/157)), because the admin most likely wants to edit the link they clicked. Redirects are followed only when navigation is enabled (`!$cwa.navigationDisabled`: not editing, or clone mode's Enable Navigation). Trap: the middleware and the fetcher's redirect abort (`followsRedirects`, handed in by `Cwa`) must use the same condition, or the old page stays on screen under the new URL.
- **`page:loading:end` waits for the CWA page load** ([#396](https://github.com/components-web-app/cwa-nuxt-module/issues/396)): Nuxt awaits its handlers in turn, so `plugin-page-loading.client.ts` holds it until `pageLoadProgress` reaches 100 or the fetch ends, never on a `cwa.disabled` page. `<NuxtLoadingIndicator>` and the scroll to top then wait for the new page to show. The plugin must register before those handlers do, so it stays a plugin. `<CwaLoadingIndicator>` passes `estimatedProgress` to show CWA's percentage: never drive the bar with `set()`, which restarts Nuxt's timed animation from 0. Read the route from `router.currentRoute`; `useRoute()` in `app.vue` lags behind it.
- **A resource IRI is a route param, never a path**: navigate with `getInternalResourceLink(iri)` (`_cwa-resource-page`, `cwaPage0`). `navigateTo(iri)` always 404s.
- **CWA page routes are flat siblings with a constant `meta.key` (`'cwa-page'`)** ([#337](https://github.com/components-web-app/cwa-nuxt-module/issues/337)). Nested records stop `page:loading:end` firing; dropping the key remounts the page on every navigation. No generated route may declare `cwaPage0`.
- **Scroll restore waits for content** only for `savedPosition` or a cross-page `#hash` ([#338](https://github.com/components-web-app/cwa-nuxt-module/issues/338)); `isLoading` alone is too early. `runtime/router.options.ts` reproduces Nuxt's `scrollBehavior` (re-read on Nuxt majors) and is **spliced at index 1** of `pages:routerOptions` so apps and layers still override it.
- **The page query is only forwarded to Collection component fetches** ([#318](https://github.com/components-web-app/cwa-nuxt-module/issues/318)). Admin lists merge their own query via `mergeQueryIntoPath` with `noQuery: true` — don't widen `consumesPageQuery`.

## Page HTML caching ([#289](https://github.com/components-web-app/cwa-nuxt-module/issues/289))

On by default (`cwa.pageCache.enabled`; the `?? true` in `module.ts` and `resolvePageCacheOptions` must agree). Tags HTML with API resource IRIs in `Surrogate-Key` (joined `', '`), plus `cwa-html`.

- **Decide-then-emit:** `plugin-page-cache.server.ts` decides at `app:rendered`; `server/page-cache-plugin.ts` emits at `beforeResponse`.
- **TTL follows the lowest API `s-maxage`/`Expires`** (converted using that response's own `Date`), capped by optional `sharedMaxAge`; 3600 only when nothing carries freshness ([#325](https://github.com/components-web-app/cwa-nuxt-module/issues/325)). `max-age=0` always. Untagged time-sensitive output needs `sharedMaxAge`.
- **Cacheability is the API's decision:** any `no-store`/`private` response makes the page unstorable, plus an `auth.signedIn` gate. **4xx responses are ignored, 5xx always count** ([#324](https://github.com/components-web-app/cwa-nuxt-module/issues/324)). **An incomplete render is never stored** ([#401](https://github.com/components-web-app/cwa-nuxt-module/issues/401)): `FetchStatusManager.onIncompleteRender` → `markUnstorable()` when the primary fetch fails, when any fetch finally fails with a 5xx or no status (network error), or when `getFetchedCurrentResource` times out. Decide it from the fetch's final outcome, never in `CwaFetch`'s `onResponse`: ofetch runs it on every attempt, and a shed request whose retry succeeds leaves a complete page.
- **A visitor's position whose component is not live has no `component`** (absent or `null`, the same; [api-components-bundle#492](https://github.com/components-web-app/api-components-bundle/issues/492)/[#493](https://github.com/components-web-app/api-components-bundle/pull/493), bundle 2.0.0-alpha.27): the page is tagged with the position's IRI, never the component's; the bundle purges the position and `manifest:<page>` on a publication change. A scheduled go-live purges nothing, so the page expires through the position's or manifest's `Expires` (#325). Saves replace a resource's data, never merge, so a re-fetch keeps no earlier component IRI.
- **The Nitro hook never sees an error status** — Nuxt renders errors via an internal 200 `/__nuxt_error` request and copies its headers ([#340](https://github.com/components-web-app/cwa-nuxt-module/issues/340)). The error render is declined via `nuxtApp.ssrContext.error` — Nuxt's typed flag, set for the `/__nuxt_error` render and for inline error rendering alike; not the path, not `payload.error` (our `clearError()` empties it), and not the `x-nuxt-error` header, which Nuxt 4.6 stopped sending, and a failed primary fetch calls `CwaFetch.markUnstorable()`.
- Deployment prerequisites: the edge must bypass the auth cookie (no `Vary: Cookie`), and an app with its own personalised SSR output must disable page caching.
- **`cwa-html`** (`RENDERED_HTML_SURROGATE_KEY`) is a cross-repo contract with api-components-bundle#232 — the bundle purges it for site-wide changes.
- **Purge all** (`purgeHttpCache()` → `POST /_/http_cache/purge`) is separate from `purgePageCache()`; a 501 means nothing was purged ([#326](https://github.com/components-web-app/cwa-nuxt-module/issues/326)).
- **Purge one page** ([api-components-bundle#484](https://github.com/components-web-app/api-components-bundle/issues/484), bundle 2.0.0-alpha.25): the page settings modal's Info tab, only for the page on screen, sends `purgeHttpCache(body)` with the route paths, every IRI in the displayed manifest, and `manifest:<IRI>` for each page and page data. **That endpoint flushes everything when there is no body**, so the body comes only from `pageCachePurgeBody` (`admin/page-cache-purge.ts`, out of the entry), which returns none when there is nothing to purge and leaves an empty list out (the API 422s it). The full purge is presented as a last resort.
- **Warm** (`POST /_cwa/page-cache/warm`, [#315](https://github.com/components-web-app/cwa-nuxt-module/issues/315)): anonymous, admin-gated via `/me`, single-flight per pod, NDJSON progress, pages from `fetchCwaPagePaths()`. Uses `node:http(s)` because undici replaces `Host`. Behind Caddy's automatic HTTPS, `NUXT_CWA_PAGE_CACHE_WARM_ORIGIN` must be `https://` ([#343](https://github.com/components-web-app/cwa-nuxt-module/issues/343)); never add `rejectUnauthorized: false` or `servername`.
- ISR/SWR route rules conflict with it; `module.ts` warns.

## Sitemap

- `cwa-urls.get.ts` excludes redirect routes (checked first — they carry the target's `page`) and page-less routes, on positive evidence only ([#278](https://github.com/components-web-app/cwa-nuxt-module/issues/278)). The anonymous fetch is the whole publication filter — if it is ever authenticated, a module-side filter becomes necessary.
- `@nuxtjs/sitemap`'s per-process cache is off (`cacheMaxAgeSeconds: 0` in `defaults`); `server/sitemap-cache-plugin.ts` emits `s-maxage` (`cwa.sitemapCache.sharedMaxAge`, 600) and `Surrogate-Key: cwa-html, <prefix>/_/routes` ([#344](https://github.com/components-web-app/cwa-nuxt-module/issues/344)). The prefix comes from `resolveApiUrl` + `normaliseApiPathPrefix`, not the `ResourceTypeFromIri` singleton. The Route collection tag is a contract with api-components-bundle#313/#317.

## Route go-live ([#287](https://github.com/components-web-app/cwa-nuxt-module/issues/287), [#341](https://github.com/components-web-app/cwa-nuxt-module/issues/341))

- `liveAt` is the route's own, writable date; `_metadata.effectiveLiveAt` is the latest across routed ancestors, read-only. Both admin-only. **Badges show effective; the control edits own.**
- `effectiveLiveAt` is read **only** in `resources/route-publication.ts`. `isRouteGatedByAncestor` is `effective > own` and `effective > now` ([#378](https://github.com/components-web-app/cwa-nuxt-module/issues/378)), with the browser clock the badges use (`RoutesTabView` passes them one `now`), so a passed parent date stops holding the page back; compare parsed instants; absent effective means not live.
- Choosing **Live** on an already-live route keeps its stored `liveAt` (Headless UI emits on re-selecting the selected option).
- `datetime-local` values are the editor's **computer** time, committed as a UTC instant (`…Z`), with the zone stated next to the control. The conversion lives only in `resources/date-time-input.ts`, which also trims API instants to millisecond precision before parsing (`toMillisecondPrecision`): ECMAScript only guarantees three fractional digits, and the orphan report's `generatedAt` carries microseconds (api-components-bundle#354); its spec pins fixed zones through `process.env.TZ`, because CI runs in UTC, where a bug that saved the typed time as UTC would pass.
- `Route` is not publishable — keep `publishedAt` inference away from it.

## Security and server routes

- **Maintenance bypass is verified with the API's `/me`** (`server/is-admin.ts`), with a cheap JWT-decode pre-filter; fails closed, 3s timeout.
- `/_cwa/healthcheck` and `/_cwa/readiness` skip the site-config fetch (exact paths, split on `?`) ([#342](https://github.com/components-web-app/cwa-nuxt-module/issues/342)). **Never skip `/__sitemap__/*` or `/robots.txt`** — they need site config.
- `/_cwa/readiness` probes the API's `/_/health` with `redirect: 'manual'`, no cookies, 2s default timeout (`runtimeConfig.cwa.readiness`); 3xx = not ready, non-404 4xx = ready. No caching of the result. The k8s probe timeout must be ≥ 3s.
- The site-config fetch has a 5s timeout; on timeout maintenance mode is not enforced.
- **Every `/_cwa` page is guarded by `cwa-admin`**, set on the `/_cwa` parent's `definePageMeta` as an **imported function**, not the string name: the module's own type check does not know layer middleware names. Nuxt runs middleware from every matched route, so children inherit it. The parent's older `onBeforeMount` redirect ran only in the browser.
- `useLogin` redirects go through `resolveRedirectTarget`, which rejects anything but a plain internal path ([#271](https://github.com/components-web-app/cwa-nuxt-module/issues/271)). `cwa-auth`/`cwa-admin` middleware `await auth.init()` before deciding. **On the server they never redirect a visitor they cannot see signed in**: with a cross-origin API the auth cookie belongs to the API's host and never reaches the Nuxt server, so the server render sees an anonymous visitor even for a signed-in admin. The browser decides instead: Nuxt re-runs route middleware during hydration (`router.replace` in `app:created`) and follows a returned redirect, and there `auth.init()` uses the browser's cookie. A signed-in non-admin is still sent home on the server, where the answer is known.
- Session end clears the named PWA runtime caches (`cwa.auth.clearCachesOnSessionEnd`, default `['cwa-api']`, never the precache) on sign-out, a client 401, or an expiry found during SSR ([#293](https://github.com/components-web-app/cwa-nuxt-module/issues/293)).
- **Throttled email requests** ([#353](https://github.com/components-web-app/cwa-nuxt-module/issues/353), api-components-bundle#331): password reset and both resend-verification endpoints return **429 with `Retry-After`**. `retryAfterSeconds` (`api/retry-after.ts`) reads seconds, or an HTTP date measured against the response's **own `Date` header** — never the browser clock (#262); with no `Date` it gives up and the copy says "shortly". `useResendVerifyEmail` exposes a ticking `retryIn` that the admin user page uses to disable resend with a countdown; the password reset shows no countdown (24 h default). A **503** means the send failed and nothing was saved, so the previous link still works and an immediate retry is fine: both say "The email couldn't be sent. Please try again." with no countdown. A **400** (empty body) is the API refusing to build the link — no allowed or parseable `Origin`/`Referer` and no `user.email_links.default_origin` — so it says "Please contact the site administrator.", not "try again", and `consola.warn`s the likely cause ([#356](https://github.com/components-web-app/cwa-nuxt-module/issues/356)). `useResendVerifyEmail` resets `success` when a request starts ([#355](https://github.com/components-web-app/cwa-nuxt-module/issues/355)); `useForgotPassword` does not need to: once it succeeds, a submit is "Back to Login", which only navigates and sends no second reset request. **Cross-origin, the browser only exposes `Retry-After` if the API lists it in CORS `expose_headers`** — the template is same-origin, so it works; otherwise there is no countdown.
- **Cancelling a pending email change** is a dedicated `PATCH { newEmailAddress: null }` via `resourcesManager.updateResource`, not the page's Save, which would also send any unsaved edits.
- The error page flags `apiUnreachable` (no status + a request, or 502/503/504) via `data` only; `error.request` must never reach the browser ([#346](https://github.com/components-web-app/cwa-nuxt-module/issues/346)).

## Bundle and packaging

- **Admin code stays out of the entry chunk** ([#331](https://github.com/components-web-app/cwa-nuxt-module/issues/331)): `ConfirmDialog`, `ComponentFocus`, `fast-xml-parser` are `await import()`ed; no `luxon` (use `toISOString()`, `publishedAt` is string-compared). Guarded by `test/e2e/entry-bundle-markers.mjs`. Don't `createApp(defineAsyncComponent(...))` — it loses `defineExpose`. `createFocusComponent`'s `focusGeneration` increment and synchronous unmount+mount are load-bearing.
- **Confirm dialogs go through `createConfirmDialog(vueApp, component)`** (`admin/confirm-dialog.ts`); never import `vuejs-confirm-dialog` directly. A dialog component must answer `cancel` when closed by Escape or the backdrop, as `ConfirmDialog` does, or `reveal()` never settles. Since 1.0 the library mounts its own root in `<body>` on the first `reveal()`, once, and it has the app's context only if `install(app)` ran before that; the helper loads the library lazily and installs it once per app. Components read `useNuxtApp().vueApp` in setup; `ResourcesManager` and `ResourceStackManager` are given it by `Cwa` and `import()` the helper, which keeps it out of the entry.
- **Visitors' preloads hold no admin or on-demand code** ([#382](https://github.com/components-web-app/cwa-nuxt-module/issues/382)): `ManageableResource`, `ComponentPlaceholder`, the Mercure client (`api/mercure-client.ts`), the orphan requests, the warm stream reader and `vuejs-confirm-dialog` are `import()`ed on first use, through `lazyImport` where a caller needs the module synchronously once loaded. Guarded by `entry-bundle-markers.mjs` and `visitor-page-preloads.mjs` (an anonymous SSR page's modulepreloads), each with a gzip budget: lower it when you shrink the bundle, never raise it to pass. The one exception is growth measured to come from an upstream update (Nuxt 4.6.1, vue-router 5.4.0 and @vueuse/core 15 added ~2 KB), raised only to just above the new size. A lazy import must still capture `nuxtApp` first; `Mercure` is handed it by `Cwa` and waits for `app:suspense:resolve`. Still in the entry, deliberately for now: `Admin`, `ResourceStackManager`, `ComponentGroupReorders`, `ResourcesManager`, `Forms`, `http-cache` (read in a synchronous fetch interceptor).
- **Admin UI is never prefetched**: a `build:manifest` filter strips dynamic-import edges to `main/admin/` and `core/admin/` ([#336](https://github.com/components-web-app/cwa-nuxt-module/issues/336)). Guarded by `test/e2e/prefetch-hints.mjs`.
- **Only `.vue` files under `src/layer/pages/`** — anything else becomes a route; layer composables live in `src/layer/_composables/` ([#330](https://github.com/components-web-app/cwa-nuxt-module/issues/330)).
- **Shipped code is a dependency promise** ([#273](https://github.com/components-web-app/cwa-nuxt-module/issues/273)): anything imported from `src/runtime` or `src/layer` must be in `dependencies`. `satori` + `@resvg/resvg-js` are optional peers; `nuxt-og-image` is required only when both resolve (with a no-op `defineOgImage` otherwise). `@nuxt/kit`'s range must track `meta.compatibility.nuxt`.
- **Declaration emit fails silently** ([#349](https://github.com/components-web-app/cwa-nuxt-module/issues/349)): on TS2883 (an inferred type only nameable through a pnpm-internal path, e.g. `const props = defineProps<…>()` → `LooseRequired`) `nuxt-module-build` writes an **empty** `.d.ts` and still succeeds. `pnpm build` therefore ends with `scripts/check-declarations.mjs`, which fails on any empty declaration in `dist`. Fix the source with an explicit type or a destructured `defineProps`. The TS2883 on `.nuxt/router.options.mjs` is harmless — its declaration emits.
- **`v-cwa-html`** (returned by `useHtmlContent`) avoids Vue 3.5.39's hydration re-parse of `v-html`; it uses `beforeUpdate`, never `updated`, so anchor conversion sees the new HTML ([#333](https://github.com/components-web-app/cwa-nuxt-module/issues/333)).

## Dependencies

- **`typescript` held at `^6`** (TS 7 breaks `vue-tsc`) and **`vue-tsc` pinned to `3.3.11`** (3.3.12 adds `.value` to template bindings that are not refs, vuejs/language-tools#6267): `pnpm up --latest -r "!typescript" "!vue-tsc"`.
- **`vite` pinned to `^8` by override** — a mixed vite 7/8 tree stops every test file starting.
- `@pinia/nuxt ^1` is required by `moduleDependencies` (breaking for apps).
- **Nuxt SEO v6** ([#392](https://github.com/components-web-app/cwa-nuxt-module/issues/392)): sitemap events are Nuxt's portable `RequestEvent`, not h3's `H3Event`, so server helpers that take one read only `context`. Registering `@nuxtjs/seo` 6 also switches on `nuxt-skew-protection` and `nuxt-ai-ready` (~5.5 KB gzip on every visitor's entry); the playground turns both off so the bundle guards measure the module. `h3` is a declared dependency: v5 used to bring it in.
- Security overrides live in `pnpm-workspace.yaml`; move the match key as well as the floor, and add new versions to `minimumReleaseAgeExclude`.
- **An advisory with no patched release is ignored by GHSA ID** (`auditConfig.ignoreGhsas`), only when its paths are build or dev tooling, and logged in `DEPRECATIONS.md`. Never lower the audit level. `pnpm audit`'s "Patched versions" column can name a version that does not exist; check `npm view <pkg> versions`.
- After any dependency change: `dev:prepare`, `test`, `test:types`, `lint`, `build`, `dev:build`, boot `dev:http`.

## Tailwind v4

CSS-first config in `src/tailwind/tailwind-cwa.css`; every class uses the `cwa:` prefix (`prefix(cwa)`). Compiled CSS is committed. Apps import it into a low `@layer cwa` by design, so an app's unscoped global element styles beat admin styles — apps should scope their globals ([#247](https://github.com/components-web-app/cwa-nuxt-module/issues/247)).

## Admin UI

- **Component kit ([#236](https://github.com/components-web-app/cwa-nuxt-module/issues/236))**: no Nuxt UI (it would inject theme into apps). **New kit components build on `reka-ui`** (headless, MIT, no theme injection — decided for #320, because Headless UI has no calendar or date field and its Vue version is frozen at 1.7.23). Existing Headless UI components (`CwaUiSelect`) stay until moved over. Nuxt UI (MIT) is the reference to port from: keep the MIT header in a ported file, restyle with `cwa:` utilities, and leave out its `color`/`variant`/`size` theming until the kit has a theme system.
- **Manager tabs keep the manager bar the same height between tab switches.** Lay a tab's controls out in one row — an inline `CwaUiFormLabelWrapper` label beside its control, then buttons — as the Ui, Order and Publish tabs do. Secondary text (a time zone, a status) goes inline or in a tooltip, never on its own line. Kit components used in tabs must not force a label or helper line.
- **Date and time** ([#320](https://github.com/components-web-app/cwa-nuxt-module/issues/320)): `CwaUiCalendar` and `CwaUiInputDate` are ports of Nuxt UI's Calendar and InputDate; `CwaUiDatePicker` combines them and is the one to use in the admin. Its value is always a UTC ISO string or `null`; the editor picks on their computer's clock (`toLocalDateTime`/`fromLocalDateTime` in `resources/date-time-input.ts`), the zone and its offset **at the chosen date** are named in the calendar button's hover text — deliberately not in the field, where it took space and shifted width as the date changed, and nothing before `min` (rounded up to the minute step) is ever emitted. The dynamic single/range variants are typed as `Component`, because their props differ and Vue cannot check a union at one binding.
- **Two copies of `@internationalized/date` silently break the picker**: reka-ui checks values with `instanceof`, so a value built by another copy loses its time segments with no error. This repo's lockfile was deduped for it; an app can hit it when its lockfile already holds reka-ui (Nuxt UI apps) on an older copy. `CwaUiDatePicker` warns once, naming `pnpm dedupe`, by checking its value with reka-ui's own `isZonedDateTime`. Keep our range no higher than needed so it can share reka-ui's copy.
- **Component styles**: `styles: { multiple?, classes: { name: string } }`; `uiClassNames` stores one class string per selected style (`mergeSelectedStyles` / `deriveSelectedStyles`). `useCwaAutoClass` removes only classes it added itself.
- **Updates are merge-patch with changed fields only** (`useItemPage.saveResource`). `localResourceData` is a shallow copy — replace nested values, never mutate in place. A not-yet-persisted component merges locally with the same semantics: arrays and `null` replace ([#319](https://github.com/components-web-app/cwa-nuxt-module/issues/319)).
- `useCwaResourceEndpoint`'s `query`/`applyPostfix` are plain computeds — never watcher-written.
- **`ManageableResource.getAllEls()` walks from the component's own fragment anchor (`$.subTree.el`), never `$el`**: since Vue 3.5.42 a dev-mode root of comments plus one child resolves `$el` to that child, which is past `<!--cwa-start-->`, so a component rendering nothing yet picked up the next position's elements.
- `ManageableResource.refreshElements()` (via `componentUpdated`, throttled 40ms leading+trailing, admin-gated) keeps outlines and clicks on a root element that changes without a remount ([#321](https://github.com/components-web-app/cwa-nuxt-module/issues/321)).
- Text-selection drags don't deselect: the guard is central in `ResourceStackManager._addToStack` ([#254](https://github.com/components-web-app/cwa-nuxt-module/issues/254)). Module-triggered selects (auto-add's `selectResource` → `triggerClick`, wrapped in `selectFromModule`) bypass it, so a leftover selection never blocks selecting the new component ([#379](https://github.com/components-web-app/cwa-nuxt-module/issues/379)).
- Deleting the page on screen navigates from `requestCompleteFn` (before store removal), with `cwa_force`.
- **`cwa_force` is removed from the query whatever its value, and only `'true'` forces** ([#366](https://github.com/components-web-app/cwa-nuxt-module/issues/366)): the guard redirects to drop it, so leaving any value behind (`x`, empty, repeated) redirected forever and pinned an SSR pod for any anonymous visitor.
- Admin lists keep their previous items and show an alert on failure; error handling sits **inside** the request-id guard. List search sends one `search` parameter plus the legacy per-field names (`searchFields` on `ListContent`) until every app has migrated ([#328](https://github.com/components-web-app/cwa-nuxt-module/issues/328)).
- **Scheduled publishing** ([#320](https://github.com/components-web-app/cwa-nuxt-module/issues/320)): the Publish tab offers a draft a **Schedule** toggle: off shows **Publish now** (`publishedAt` = now); on shows the date picker and **Schedule** (a future `publishedAt`). A scheduled draft opens with the toggle on, and keeps **Cancel schedule**. The API decides draft/live (`_metadata.publishable.published`). **The module never decides "published" from the browser clock** ([#373](https://github.com/components-web-app/cwa-nuxt-module/issues/373)): `updateResource` treats a PATCH as a publish only when the response is the live resource (`draft.publishedResource`) with `published: true`, and only then refreshes its positions, empties the stack and removes the draft. A browser ahead of the server gets the draft back as scheduled; deciding from the clock removed it and left `ComponentPosition` on a draft that was gone ("has not been requested"). Removing a component, even with `noCascade`, always clears its publishable mapping. **Publish now sends the literal `"publishedAt": "now"`** (api-components-bundle#407, bundle 2.0.0-alpha.13): the bundle resolves it to the server's current time, so a browser ahead of the server still publishes. Exact string only; a POST with it creates a live resource; on `?published=true` it is a 422 like any publication date change. The module sends `'now'` for every immediate publish (#381); it needs bundle 2.0.0-alpha.13 or later. The field's `min` is now; a time already past when saved is sent as now, which is exactly the Publish button's path. The admin does not notice the time passing until the next fetch — nothing is written then, so Mercure sends nothing.
- **A publish waits for the resource's own saves** ([#394](https://github.com/components-web-app/cwa-nuxt-module/issues/394)): `useCwaResourceModel` saves 250 ms after the last change and registers that waiting save with `resourcesManager.registerPendingUpdate`; an `updateResource` setting `publishedAt` sends those saves at once and waits for the resource's requests in flight before publishing. Otherwise the publish deletes the draft first and the late edit 404s.
- **Publishing over the live resource also refreshes the draft's own positions** ([#395](https://github.com/components-web-app/cwa-nuxt-module/issues/395)): a draft can sit in a position of its own (the template's fixtures do this), and the API empties that position when it deletes the draft, so refreshing only the live resource's positions left one pointing at a draft that was gone ("has not been requested").
- `ResourcesManager.storeResource` writes to the store only (no API request) and is `@internal` ([#282](https://github.com/components-web-app/cwa-nuxt-module/issues/282)).
- **Orphaned resources** ([api-components-bundle#190](https://github.com/components-web-app/api-components-bundle/issues/190)): `/_cwa/orphaned` (`_cwa-orphaned`) and a site-settings section, reached from settings and **not** the header menu. Both use one scan implementation, `useOrphanedResourceReport` in `_composables/useOrphanReport.ts` (`$cwa.orphanedResources`). **A 404 from `GET /_/orphaned_resources` means no scan yet, never an error.** The scan can be async, so after the POST the report is re-read until `generatedAt` changes: once immediately, then 5 more at 2s (~10s), then "requested, reload later" — polling longer only hammers an uncached endpoint while a worker is down. `generatedAt` carries microseconds since api-components-bundle#354, so two scans never share a value (#357); it is compared as a string and trimmed to milliseconds only for parsing. Deletes go to `POST /_/orphaned_resources/delete` ([#358](https://github.com/components-web-app/cwa-nuxt-module/issues/358); needs an api-components-bundle release containing #353): Delete → `{ iris: [iri] }`, Delete all → that section's IRIs, Delete everything → `{ all: true }`, one request each after one confirmation. The server re-scans and deletes only what is still orphaned, cascades, and refreshes the stored report — so afterwards the report is **re-read**, not edited locally, and only if that re-read fails (or 404s) are the `deleted` IRIs and `not_found` rejections removed locally. `deleteOrphans` never sends `{}`, `{ all: false }` or an empty `iris` (it returns an empty result instead), and a body naming both sends only the IRIs — `all: true` must come from Delete everything alone. IRIs are sent as listed; `?published=true` is only for View. The settings notice is advisory: a failed report load shows nothing there.
- **Orphaned files** ([#362](https://github.com/components-web-app/cwa-nuxt-module/issues/362); needs an api-components-bundle release containing #371): a second report on the same page and settings section, from `GET /_/orphaned_files`, `POST /_/orphaned_files/scan` and `POST /_/orphaned_files/delete`, on the same `$cwa.orphanedResources` service rather than a sibling class. The report, scan and poll are **one** generic `useOrphanReport` fed two sources, and the confirm → delete → re-read → local-fallback pipeline and the View logic (with the #359 fallback) are **one** `useOrphanActions`; do not copy either for a third report. Same 404 and polling rules; each report scans separately, because listing a bucket can be slow and one report's failure must not hide the other. **A file is deleted by `path` alone**, and the API deletes that path on **every** adapter where it is orphaned — so rows are keyed by `(adapter, path)`, a row delete marks every row with that path, and the service de-duplicates `paths`. **Missing files are report-only**: they never count towards Delete everything, never enter a delete body, and have View but no Delete. **Unknown files** (`unknownFiles`, added when #371 merged as #373) are files the bundle cannot prove it wrote: report-only too, no buttons at all; `{ all: true }` skips them server-side and naming one is rejected as `unknown`. **Invalid files** (`invalidFiles`, [#376](https://github.com/components-web-app/cwa-nuxt-module/issues/376), bundle 2.0.0-alpha.11) are in use but break their upload field's current rules: report-only like missing files — no Delete, no View (the row links to the resource instead), never in a delete body; a missing key is `[]`. `deleteOrphanedFiles` has the same body guard as `deleteOrphans` (`{ paths }` non-empty, or `all` exactly `true`, never both).
- **A page data resource's `@type` is its concrete class** (`BlogArticleData`), never `PageData` ([#393](https://github.com/components-web-app/cwa-nuxt-module/issues/393)): `useItemPage` closes a modal whose loaded `@type` differs from `resourceType`, so pass the real class or nothing. The Routes list passes nothing for page data.
- **The add page data form takes defaults from its link** ([#390](https://github.com/components-web-app/cwa-nuxt-module/issues/390)): `?parentPage=`, `?parentPageData=`, `?template=` (→ `page`). Never `?page=`: the list behind the modal binds it as its page number. The list forwards every query key to the API, which ignores ones page data has no filter for.
- **A page's `uiComponent` is the full `CwaPage<Name>`**, as a layout's is `CwaLayout<Name>` ([#384](https://github.com/components-web-app/cwa-nuxt-module/issues/384), api-components-bundle#431); `pagesConfig`/`layoutsConfig` are keyed by the name **without** the prefix, so strip it before a lookup. A short value stored before #431 still selects its option (`DEPRECATIONS.md`).
- A layout whose `uiComponent` doesn't resolve falls back to the default layout **and** shows a warning ([#277](https://github.com/components-web-app/cwa-nuxt-module/issues/277)).

## Component groups and positions

- **`allowedComponents`** takes prefix-free collection IRIs (`/component/navigation_links`); the synchroniser adds the prefix. **Omitted means "leave it"; `null` clears** ([#303](https://github.com/components-web-app/cwa-nuxt-module/issues/303)). Never pass PHP FQCNs. The API omits a null list, so a group with no `allowedComponents` key has no list and **is** synced ([#351](https://github.com/components-web-app/cwa-nuxt-module/issues/351)); `[]` is normalised to `null`, as the API stores it, or it would re-PATCH on every load.
- **Component names** ([#352](https://github.com/components-web-app/cwa-nuxt-module/issues/352)): `allowedComponents` entries not starting with `/` are resource names, resolved to endpoints through `getComponentMetadata` before comparing or PATCHing; IRIs still pass through, and an IRI-only list never requests the docs. **An unknown name, an `undefined` or non-string entry (a `CwaComponentNames` key read before its component exists), or docs that fail to load, syncs nothing** — dropping the name would send `[]` (unrestricted) or a partial list. `CwaComponentNames` / `CwaComponentName` come from the `cwa-component-names.ts` template (`write: true`, regenerated by `builder:watch`), built from `<Name>/<Name>.vue` only, so helper files in a component folder are not names.
- **`explicitAllowOnly`** (bare boolean on the docs `supportedClass`, absent = false) hides a type unless a group lists it; `isComponentAllowedInGroup` is used for direct and dynamic positions ([#249](https://github.com/components-web-app/cwa-nuxt-module/issues/249)). Cloning ([#157](https://github.com/components-web-app/cwa-nuxt-module/issues/157)) must respect it.
- `location` is optional (renders nothing until set; synchroniser starts from a watch) and resolves to the published IRI ([#276](https://github.com/components-web-app/cwa-nuxt-module/issues/276), [#317](https://github.com/components-web-app/cwa-nuxt-module/issues/317)). `useCwaComponent`'s `publishedIri` falls back to the draft IRI; `findPublishedComponentIri` itself must keep returning `undefined` for never-published drafts.
- **The synchroniser never creates or attaches a group whose location type has no relation** (page data, [#363](https://github.com/components-web-app/cwa-nuxt-module/issues/363)): it warns instead, because an unowned group is missing from the manifest (invisible to visitors) and is reported as orphaned. A loaded group's `allowedComponents` still syncs.
- **The synchroniser creates a group only after its lookup by reference 404s** ([#399](https://github.com/components-web-app/cwa-nuxt-module/issues/399)): `fetchResource` also returns nothing for an aborted fetch (Back to the last loaded page during a navigation aborts every fetch over 1 s old) or a 5xx, which POSTed a group that existed. A create rejected with a `reference` violation removes that error and attaches the existing group instead.
- **`maxComponents`** ([#398](https://github.com/components-web-app/cwa-nuxt-module/issues/398), api-components-bundle#467) syncs like `allowedComponents` (omitted leaves it, `null` clears, a missing key is `null`) in the **same** PATCH; anything but a positive integer warns and is not sent. Full and over-limit come only from `componentGroupCapacity` (`resources/component-group-capacity.ts`), counting `componentPositions.length` as the server does. A full group offers no add (Group tab disabled with the reason on hover, CTA options left out, stranded-merge targets without room for every position left out); over the limit only warns — nothing is ever removed.
- The synchroniser does not PATCH a group already associated with its location ([#339](https://github.com/components-web-app/cwa-nuxt-module/issues/339)); the upstream cause of the missing group data is still unknown.
- **Ordering is the server's** ([#400](https://github.com/components-web-app/cwa-nuxt-module/issues/400), api-components-bundle#475): the module never sends `sortValue` (read-only on the API). An insert anchors its position with `after`/`before` (Add to End sends none) and then reads `GET <group>/order` once; a reorder sends the visible positions in order to `PATCH <group>/order` (merge patch; a partial change, since unlisted positions keep their place); every order response lists every visible position, so after one the module stores all values and re-fetches the group if positions were added or removed, and a failed PATCH re-reads `GET <group>/order` — reconciliation never depends on Mercure, which is optional; the merge moves with `after`. Values come only from the `sortValues` those return. Ties render by `sortValue`, then IRI, as the API orders them by id (`compareSortValues`).
- **Reordering** ([#316](https://github.com/components-web-app/cwa-nuxt-module/issues/316)): the screen moves at once (display numbers) and the Order controls are never disabled by requests. One sync per group, held once per group IRI on the `Cwa` instance (`componentGroupReorders`, [#374](https://github.com/components-web-app/cwa-nuxt-module/issues/374)) — never per `CwaComponentGroup` instance, or a second mounted instance applies each move twice; moves made while a request is in flight are coalesced into one follow-up with the newest order, and display numbers are cleared only after the last one. Every write to a group's order (insert, reorder) goes through `resourcesManager.queueComponentGroupWrite`, so a stale response never overwrites a newer one. Read pending updates **before** storing display numbers.
- **Stranded groups** ([#360](https://github.com/components-web-app/cwa-nuxt-module/issues/360)) are attached groups that **no template declares**, never "not mounted" (v-if, tabs and lazy rendering made mount-based detection meaningless). `src/component-group-declarations.ts` parses SFCs with `vue/compiler-sfc` into the `cwa-component-group-declarations.ts` template (`write: true`, regenerated by `builder:watch` on any `.vue` add/change/unlink, imported only by `admin/stranded-component-groups.ts`, guarded out of the entry chunk by `test/e2e/entry-bundle-markers.mjs`). Each CWA template (layout, page, `<Name>/<Name>.vue`, `ui/*`) lists the `<CwaComponentGroup>`s reachable from it, following ordinary components by tag, default import, `#components` import and `defineAsyncComponent(() => import())`, never into another CWA template. Location kinds: `self` (`iri`/`publishedIri`, only in the template file itself), `layout` (`layoutIri`), `fixed` (literal `location-reference`), else `unknown`. **Only `self` is checked per owner; `layout`, `fixed` and `unknown` match site-wide**, because a layout group may be declared by a component on another page (srnte's HeroSection). Traps: an unreadable, unparseable or preprocessed (`lang="pug"`) file, a `v-bind` object, or a dynamic reference at an unknown location makes everything expected, so the scanner reports it through `onUncheckable` and the module warns once per file and reason ([#367](https://github.com/components-web-app/cwa-nuxt-module/issues/367)); an owner whose template is not in the map is never flagged; a group only rendered through `<component :is>`, `h()` or `resolveComponent` is not seen, so it would be flagged. Nothing is reported while `isLoading` or to non-admins. Merge PATCHes `{ componentGroup, sortValue }` per position in source order, starting at `max(max, min + n - 1) + 1` over the target's sort values — the bundle's sort helper treats a group change as a move from the old value and renumbers the target, and this start is past anything it can produce, duplicates included. The source is deleted only if every move succeeded, with `deleteResource(event, true)` because the merge was already confirmed.
- `CwaComponentGroup` emits `componentsLoaded` / `componentsUpdated` with `{ component, position }[]` for its own positions ([#251](https://github.com/components-web-app/cwa-nuxt-module/issues/251)).

## Clone ([#157](https://github.com/components-web-app/cwa-nuxt-module/issues/157))

- **A clone is the same IRI in another position, never a copy** (the published IRI for a selected draft): `POST /_/component_positions { componentGroup, component, after|before }` through `queueComponentGroupWrite`, then one `GET <group>/order`; a refused insert re-reads the group first, as add-component does. A page-data slot PATCHes the page data at the position's depth (`pageDataIriOf`). All in `admin/clone-component.ts`.
- **Clone mode lives in a module `WeakMap` keyed by `Cwa`** (`admin/clone-mode.ts`), not a field on `Cwa`: `Cwa` is in the entry, which has a few bytes of headroom. Per instance, client-only, never in the store. It ends on Cancel, Escape (not one a dialog handled or while a `role="dialog"` is open), leaving edit mode, sign-out, an add, and the source being gone: a 404, or the real API's **400 `Item not found for "<source IRI>"`** (only when it names the source; the stub once answered 404, so only the rehearsal caught it).
- **Target options come only from `cloneTargetOptions`** (`admin/clone-target-options.ts`), with the add-component rules (`componentGroupCapacity` of the target, `isComponentAllowedInGroup`, subtree with draft and published as one). Cycles are the API's to refuse (api-components-bundle#502); the module only greys them out. Trap: on a data page `filterDisabledStackItems` drops the page template's groups, so a dynamic slot's stack usually has no group; Use here comes from the closest position before any group and sits beside any group options. Specs must use the filtered stack shape.
- **Every on-screen instance** is listed by `admin/manageable-instances.ts`. Trap: it imports nothing from `vue` at runtime and is loaded by `import()`/`lazyImport` from `ComponentFocus` and `ManageableResource`: a static import adds a chunk to the entry's `__vite__mapDeps`, and a lazy module importing `vue` re-split the vue chunk (~900 B). `CloneHighlight` is an async component in the Header for the same reason.
- **Clicks in clone mode never select** ([#157](https://github.com/components-web-app/cwa-nuxt-module/issues/157)): a click puts back the selection from before it (`restorePreviousStack`), and a right-click leaves the browser's menu. Clone mode starts with Enable Navigation on, and a new page on screen (`displayPageIri`, not the route, so a redirect waits for its target) turns it off for placing. Trap: a page in the route cache shows inside the link's own click handler, so the switch-off waits a task, or the same click reaches the clone handler with navigation off and is taken as a placement. With Enable Navigation on a click only navigates. With it off, a target in the other scope is confirmed first (`ResourceManager`'s `confirmScopeChange`, kept out of the entry), but the scope switches only when a target is chosen, so the target dialog still warns about it and its Cancel leaves the scope as it was. The page/layout overlay is not drawn while cloning (checked in the lazy `LayoutPageOverlay`, not `CwaRootLayout`); `CloneHighlight` skips elements no longer in the document and redraws when the page on screen changes or finishes loading, again on the next frame: an instance registers while its page is still being swapped in (a cached page especially), when its position is not final; the Cloning bar also shows on error and admin pages, which navigation can reach.
- **Browser tests** ([#411](https://github.com/components-web-app/cwa-nuxt-module/issues/411)) are `test/browser/*.spec.mjs` (`@playwright/test`, pinned to `playwright-core`'s exact version), replayed on CI's lts leg by `pnpm run test:browser` from rehearsals in `test/browser/rehearsals/` (one gzipped JSON per scenario). `pnpm run test:browser:rehearse [--grep …]` records them through `test/browser/rehearsal.mjs`, a proxy between the playground (SSR and browser alike) and the template stack at `https://localhost` (admin/admin; the Caddy CA and bundle version are read from the `components-web-app-php-1` container, or `REHEARSAL_CA`/`REHEARSAL_BUNDLE`). Re-rehearse whenever a scenario, the seed or the module's requests change: replay fails any request missing from the rehearsal. No CI job talks to a live API. Each scenario seeds its own data through the API (`seed.mjs`) under a per-rehearsal token, never template fixtures, and the recording keeps that token so replay sends the same requests. Replay picks a recorded response by the writes completed so far, so a GET after a write gets the post-write answer; it falls back to ignoring the `path` header, whose value races during redirects. The proxy serves Mercure itself as a silent stream, so no message ever changes what a run requests. Module features are tested here, never in the template's e2e suite. A console error fails a scenario unless it allows it. No sleeps: wait for a positive signal, then `settle()` before a negative check. Traps: a recording is only as true as the bundle it was made against (the version is in each file); a Headless UI dialog's root has no size, so assert on text inside it.
- **Move ([#409](https://github.com/components-web-app/cwa-nuxt-module/issues/409), [#415](https://github.com/components-web-app/cwa-nuxt-module/issues/415)) is clone mode with `source.move`** (`{ positionIri, fromLayout, from }`): same menu, bar ("Moving"), navigation, highlight and dialog ("Move Here"), but every move is one `POST {published component IRI}/move { from, to }` (api-components-bundle#526; `ResourcesManager.send`, kept generic because the entry has no room for a named method), through the target group's write queue (the source group's for a slot target), then a re-read of the order of both groups and of the slot's page data and position when on screen. A position moved into a slot is deleted by the API, so the module drops it from the store. **Trap: `from` is captured when Move starts** (`{ componentPosition }`, or `{ pageData: pageDataIriOf(position), property }` for a slot): a dynamic position has the same IRI on every page-data page, so resolving it later finds the target page's data. Move is offered from a slot only when the page data on screen holds the component (draft and published as one), never from the template's fallback, which selects the position anyway. Source gone is a 404 or a **422 on `from`/`from.*`**; other 422s and 403s keep move mode on. Slot targets: an occupied slot is disabled (the API refuses to replace), the slot moved from on the same page data is "This is where it already is", the same slot on another page-data page is a target. Its own group's capacity does not block a position, options next to its own position are disabled, and a move out of the layout says it leaves every other page (`leavesLayout`).
- **The scope confirm lives in `CloneTargetDialog`, never before it** ([#414](https://github.com/components-web-app/cwa-nuxt-module/issues/414)): it asks "Edit the shared layout?"/"Edit the page?" only when some option is enabled; a dead end shows the reasons every option shares once (`sharedReasons`), with display names (`resourcesConfig`).
- **After a write, the placed position flashes and is selected** (`clone-mode`'s `placed`, then `selectResource` with the **position** IRI once `manageable-instances` has it — a component IRI would select every instance of a clone). `CloneHighlight` marks the instance started from (`source.positionIri`, for clone and move) by whether its elements sit inside that position's.
- "Use here" on a slot holding another component warns "This replaces …"; draft and published count as one. "Remove from this location only" deletes through `queueComponentGroupWrite`.
- **Shared components are shown by a badge and an outline** ([#416](https://github.com/components-web-app/cwa-nuxt-module/issues/416)): `ComponentUsageBadge` sits left of the manager bar's CTA and reads `/usage` per selected persisted component, re-reading when the component's `componentPositions` change; a request counter drops a slower earlier answer. `SharedInstancesHighlight` (async, outside clone mode) outlines the selection's other on-screen instances. Trap: the stack item's `domElements` may arrive unwrapped by reactivity, so the selected instance is excluded by element, not by ref identity. Both are async components in `ResourceManager`: a static import split `component-usage` into a chunk named in the visitor-preloaded `__vite__mapDeps` for the lazy ResourceManager. No note on Publish or on edit: edits stay frictionless and the badge sits beside Publish.
- **Delete reads `{iri}/usage` at delete time** (`admin/component-usage.ts`); total ≤ 1, a failed read or no position in the stack is today's delete. "Remove from this location only" on a page-data slot nulls the page data property, never the dynamic position, which every page-data page shares.

## Mercure ([#286](https://github.com/components-web-app/cwa-nuxt-module/issues/286))

Replay is not trusted. On reconnect (`connected` going `false` → `true`; `undefined` until the first open) or an `online` event, on-screen resources are refetched with `isNew: true` — unchanged ones are discarded, changes surface through the existing outdated-content notice.

**A page-data message re-fetches the on-screen dynamic positions bound to a property it changed.** The bundle publishes only the page data when an editor swaps the component a property holds — the position itself did not change, its component is resolved from the `path` — so without this the positions kept the old component until navigation. Each re-fetch carries its own depth's `path` header. (The Nuxt 2 module only re-fetched a position's own message, as `collectResourceActions` still does.)

**A position update fetches a component the store does not hold** (api-components-bundle#492): a visitor never fetched a component that was not live, so its own publication message is dropped (not in `currentIds`) and the position's update is the only way it arrives. Mercure fetches are shallow, so `processMessageQueue` fetches those components with the positions.

**A failed background (`noSave`) re-fetch of a loaded resource keeps its last good `apiState`** unless the API answered 4xx ([#375](https://github.com/components-web-app/cwa-nuxt-module/issues/375)). Trap: `startFetchResource` has already replaced SUCCESS with IN_PROGRESS (dropping `responseIri`), so `FetchStatusManager` restores a copy taken at the start, never a fresh SUCCESS.

**The hub speaks Mercure 1.0** ([#364](https://github.com/components-web-app/cwa-nuxt-module/issues/364)): subscribe with `match=*` (`topic=` is a 400 outside compatibility mode) and reconnect with `last_event_id`. No 0.x fallback — breaking during the alpha by decision. The subscriber cookie (`__Secure-mercure_access_token`) is the bundle's; the module never reads it by name and relies on `withCredentials`. A 1.0 hub sends `event: mercure` only for its own subscription events, so `onmessage` still receives updates while the bundle publishes without a `type`.

**A session end must reconnect Mercure** ([api-components-bundle#494](https://github.com/components-web-app/api-components-bundle/issues/494)): the hub authorises a subscriber only when it connects and the bundle's Mercure JWT has no `exp`, so an open connection keeps its grants until it closes. `clearSession()` calls `mercure.init(true)` even on its route-middleware early return (an expired admin's `/me` fails during navigation), but only when a session ended (the auth cookie was `'1'`). Trap: every visitor's first `/me` 401s through that path, so reconnecting regardless drops the connection each visitor is still opening. `initClientSide`'s later `init()` never helps: it skips an open connection to the same URL.

## Composables

- **`useCwaComponent(props, plugins?, ops?)`** is the recommended entry point (#238/#239): returns `resource`, `exposeMeta` plus merged plugin results; `defineExpose(exposeMeta)` is still required. Plugins: `withCollection()`, `withFile(fileOps?)` (exposes a `files` map keyed by `fileProp`; the merge accumulates `files`).
- **File fields** ([#252](https://github.com/components-web-app/cwa-nuxt-module/issues/252), [#267](https://github.com/components-web-app/cwa-nuxt-module/issues/267)): `fileOps` = `fileProp` (default `'file'`), `imagineFilterName`, `imageRef`. **`imageRef` is never registered for you** (auto-registration crashed prod) — pass `useTemplateRef<unknown>('file')` explicitly if you need the loaded-on-mount check. Admin: `useCwaResourceUpload(iri, prop)` returns `bind`; one call per field. `srcset` ([#377](https://github.com/components-web-app/cwa-nuxt-module/issues/377)) lists the field's variants with `width > 0`, each URL carrying the endpoint query, ascending, the smaller `fileSize` kept on equal widths, and is `undefined` under two (SVG has no filters). A `-1` width means the variant exists but has no file-info row, not that it was never generated.
- **Uploads downscale images in the browser** by default (2560px / 20MP / 0.85, `cwa.upload.image`, per-call `imageDownscale`), keeping the original when not smaller; skips SVG, GIF and animated WebP ([#335](https://github.com/components-web-app/cwa-nuxt-module/issues/335)). Defaults must stay under the template's server caps (20 MB, 40 MP). Built-in defaults live only in `image-downscale.ts`.
- **Forms** (#172): `useCwaFormInput`, `useCwaForm`, `useCwaFormRepeated`, `useCwaFormCollection` — scaffolding only; see `playground/app/cwa/components/ExampleForm/`. Checkbox unchecked is `null`, not `""`; collection prototype is on `formEntry.prototype`. `realtime_validate_disabled` on the root form suppresses per-keystroke validation ([#279](https://github.com/components-web-app/cwa-nuxt-module/issues/279)).
- `useHtmlContent(container, html?)` — pass the HTML source so anchors re-convert on change ([#275](https://github.com/components-web-app/cwa-nuxt-module/issues/275)).
- `resources.page` / `.pageData` / `.displayPage` always return a `ComputedRef` ([#269](https://github.com/components-web-app/cwa-nuxt-module/issues/269)); read site config **inside** reactive callbacks ([#285](https://github.com/components-web-app/cwa-nuxt-module/issues/285)).
- A failed API docs fetch clears `apiDocPromise` so it can be retried ([#322](https://github.com/components-web-app/cwa-nuxt-module/issues/322)).

## Future ideas

- Component placeholders per type (`app/cwa/components/<Name>/placeholder.vue`) laid out from `resourceTree` — front-end only ([#255](https://github.com/components-web-app/cwa-nuxt-module/issues/255)).
- `mockCwaResource` test utility (separate `test-utils` export); `defineCwaComponent()` macro.
