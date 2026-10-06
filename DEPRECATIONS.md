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

## Remove when node-forge and braces publish fixes

### Ignored audit advisories in `pnpm-workspace.yaml`

`auditConfig.ignoreGhsas` ignores two high advisories that have **no patched
release** (`first_patched_version` is null on both):

- `GHSA-86w9-cpqp-85rv`: node-forge ≤ 1.4.0, RSA PKCS#1 v1.5 signature
  verification. Reached only through `listhen`, the Nuxt dev server's HTTPS
  certificate tooling.
- `GHSA-vfj7-8cjw-p6xm`: braces ≤ 3.0.3, stack exhaustion on deeply nested
  patterns. Reached only through `nitropack`'s build-time `globby`, matching
  the app's own patterns.

Neither is in a built app's server bundle. They are ignored by ID, not by
lowering the audit level, so any new advisory still fails CI.

**Delete:** the two IDs (and `auditConfig` if empty), and add an override in
`overrides` instead if the fix is not picked up by a lockfile update.

**When:** node-forge > 1.4.0 and braces > 3.0.3 are on npm.

---

## Remove when `@nuxt/devtools` and `@tailwindcss/typography` take the fixed majors

### More ignored audit advisories in `pnpm-workspace.yaml`

These have patched releases, but only in a major the package that pins them
cannot load:

- `GHSA-v5rq-49vh-5v5c`, `GHSA-x6jw-m9v5-85vh`, `GHSA-g4wm-2vf7-vfgr`,
  `GHSA-858h-whjf-mvg5`: simple-git 3.36.0 and `@simple-git/argv-parser` 1.x.
  Fixed only in simple-git 4, which dropped the default export that
  `@nuxt/devtools` 3.4.2 imports, so an override breaks `dev:prepare`. Reached
  only through devtools, which runs in development only.
- `GHSA-rj75-hqrm-r3gf`: postcss-selector-parser 6.0.10, pinned exactly by
  `@tailwindcss/typography` 0.5.20 (the playground's dependency). The 7.x copies
  are overridden to `^7.1.6`.

**Delete:** the IDs, once `@nuxt/devtools` depends on simple-git ≥ 4.0.1 and
`@tailwindcss/typography` on postcss-selector-parser ≥ 7.1.6; check with
`pnpm audit` after removing them.
