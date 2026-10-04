# Deprecations and temporary code

Things that exist only to support an older API, or to work around a bug someone
else will fix. Each entry says what to delete, and what has to be true first.

Add an entry whenever you leave code in place for one of those two reasons. An
entry with no precondition is not a deprecation, it is a todo.

---

## Remove when applications declare a `search` parameter

### The per-field search parameters on admin lists

API Platform 4.4 deprecated `#[ApiFilter]`, `SearchFilter`, `OrderFilter` and
`AbstractFilter`, and 6.0 removes them. The bundle moved its own resources to
`QueryParameter` filters ([api-components-bundle#289](https://github.com/components-web-app/api-components-bundle/issues/289),
merged `ab76fc8b`), where search is a **single `search` parameter** ORed across
whichever fields each resource declares.

The admin's search box binds to `search` alone, but `ListContent` still adds the
old per-field names to the request so a list keeps working against an API that
has not migrated ([#328](https://github.com/components-web-app/cwa-nuxt-module/issues/328)).

**Delete:**

- `searchFields` from `ListContent.vue`, and the `buildRequestQuery` branch that
  expands `search` into those names
- `:search-fields` from the five list pages — `layouts.vue`, `pages.vue`,
  `routes.vue`, `users.vue`, `data/[type].vue`
- the per-property names in `SearchResource.vue`, keeping only `search`
- the transition notes in the CLAUDE.md section for #328

**Precondition:** every application entity an admin list shows declares a
`search` parameter. This does not depend on the API Platform version: the
bundle's filters work on 4.4 and 5, so an application can migrate while still on
4.4. The template has migrated its `User` and `BlogArticleData` (components-web-app
`cc8f57c`, [#89](https://github.com/components-web-app/components-web-app/issues/89)).
Applications generated before that still need the same change for their `User`
and their own page data, and until they make it `users.vue` and
`data/[type].vue` depend on the old names.

The hard deadline is API Platform 6.0, which removes `#[ApiFilter]` and
`SearchFilter`. An application still using them cannot upgrade to 6.0, so an
application has to migrate by then at the latest.

---

## Remove when no application sets the public API URL

### `runtimeConfig.public.cwa.apiUrl` as the server's API URL

The URL the server renders from is `runtimeConfig.cwa.apiUrl`
(`NUXT_CWA_API_URL`), which is private and never reaches the browser. It used to
be `runtimeConfig.public.cwa.apiUrl` (`NUXT_PUBLIC_CWA_API_URL`), which put the
internal API URL in the HTML of every page — `apiUrl:"https://php.local/_api"`
on the template ([#345](https://github.com/components-web-app/cwa-nuxt-module/issues/345)).

The public key is still read, after the private one and before
`apiUrlBrowser`, so an application that has not moved its environment variable
keeps working. `server-plugin.ts` warns once per server process when it is the
key that supplied the server's URL.

**Delete:**

- the `publicApiUrl` branch of the server half of `resolveApiUrl`
  (`src/runtime/api/api-url.ts`), leaving private then browser
- the `'public'` member of `ApiUrlSource`, if nothing else reports it
- the `source === 'public'` warning in `src/runtime/server/server-plugin.ts`,
  and the `the deprecated public API URL` describe in `server-plugin.spec.ts`
- the `falls back to the deprecated public URL` cases in
  `src/runtime/api/api-url.spec.ts` and `src/runtime/cwa.spec.ts`

**Precondition:** every supported application sets `NUXT_CWA_API_URL` rather
than `NUXT_PUBLIC_CWA_API_URL`. The browser key `NUXT_PUBLIC_CWA_API_URL_BROWSER`
is not deprecated and stays: the browser has to be told where the API is.

Removing it early does not break a deployment loudly. An application that still
sets only the public key would fall back to `apiUrlBrowser`, which is usually the
public URL of the same API — so the server would start routing its own requests
back out through the edge instead of reaching the API directly, and only the
latency and the cache behaviour would say so.

---

## Remove when every API exposes a health endpoint

### A 404 from the readiness probe counts as ready

`/_cwa/readiness` requests the API's `/_/health`
([api-components-bundle#312](https://github.com/components-web-app/api-components-bundle/issues/312))
and reports 503 for anything that says the API is not answering. A **404** is
deliberately treated as **ready**, with a warning naming the URL tried.

That endpoint does not exist on any released bundle. A hard 503 would leave
every current site permanently un-ready, so the pod would never enter service
and the deploy would never come up — a diagnostic that can brick a rollout is
worse than one that occasionally over-reports. A 404 also proves the request was
routed: TCP connected, TLS validated, PHP answered and Symfony matched nothing.

The cost is narrow and stated rather than defended: an `apiUrl` pointing at the
Nuxt app itself would also 404 and read as ready. The warning names the URL.

**Delete:**

- the `status === 404` branch in `classifyReadiness` (`src/runtime/server/readiness.ts`),
  so a 404 falls through to the `status >= 400` branch — or make it not ready,
  whichever is right at the time
- `a 404 is ready but reported, because the API may predate the health endpoint`
  in `src/runtime/server/readiness.spec.ts`, and
  `is ready but warns when the API has no health endpoint` in
  `cwa-readiness.get.spec.ts`
- this entry, and the paragraph in the CLAUDE.md readiness section

**Precondition:** every supported application runs a bundle exposing `/_/health`.
Until then a 404 is the normal answer, not a fault.

---

## Temporary workarounds pending an upstream fix

### Realpathing `page.file` so Nuxt can filter layer pages out of prefetch

Nuxt drops page chunks from the app entry's `dynamicImports` in `build:manifest`,
but it builds that list with `relative(srcDir, page.file)` and compares it with
Vite's manifest keys. When a layer is extended by a **filesystem path** that goes
through a symlink — `extends: ['./node_modules/@cwa/nuxt/dist/layer']`, which is
how every application installs this module through pnpm — `page.file` is the
symlink path and the manifest key is the realpath. The two never match, so every
`/_cwa` admin page and every auth page is prefetched on every public page
([#329](https://github.com/components-web-app/cwa-nuxt-module/issues/329),
upstream [nuxt/nuxt#36401](https://github.com/nuxt/nuxt/issues/36401), with a
reproduction at
[silverbackdan/nuxt-layer-symlink-prefetch](https://github.com/silverbackdan/nuxt-layer-symlink-prefetch)).

A layer extended by a **bare specifier** is unaffected — that resolves through
`realpath` already.

**Delete:**

- the `if (!nuxt.options.dev)` block in `src/module.ts` that registers the
  `pages:extend` hook (`toRealPath` / `realpathPages`), and `realpathSync` from
  the `node:fs` import
- the `page file realpath (#329)` describe in `src/module.spec.ts`, and
  `realpathSync` from that file's `node:fs` mock
- the `#329` section in CLAUDE.md

**Precondition:** the upstream fix, [nuxt/nuxt#36402](https://github.com/nuxt/nuxt/pull/36402)
(in the merge queue on 2026-09-26), released, and our `meta.compatibility.nuxt`
(`>=4.5.2`, in step with `@nuxt/kit`) raised past the first release containing
it. Tracked, with the verification step, in
[#361](https://github.com/components-web-app/cwa-nuxt-module/issues/361).

The hook rewrites `page.file` to its realpath for **every** page, not just this
module's. Realpathing a path that is already real returns the same string, so it
is a no-op wherever nothing is symlinked — which is why it is safe to leave in
whether or not an application extends the layer by a bare specifier, and safe for
an application that already applies the same workaround itself.
