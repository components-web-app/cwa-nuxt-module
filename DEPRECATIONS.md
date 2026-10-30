# Deprecations and temporary code

Things that exist only to support an older API, or to work around a bug someone
else will fix. Each entry says what to delete, and what has to be true first.

Add an entry whenever you leave code in place for one of those two reasons. An
entry with no precondition is not a deprecation, it is a todo.

---

## Remove when the bundle defaults a page's title to `null`

### Skipping the `'Unnamed Page'` title

`AbstractPage::$title` defaults to `'Unnamed Page'`, so a page or page data with
no title stores that string. `cwa-page.vue` treats it as no title when it builds
`<title>`, so it is not joined into nested titles and page data falls back to its
page's title ([#388](https://github.com/components-web-app/cwa-nuxt-module/issues/388)).

**Delete:** `API_DEFAULT_PAGE_TITLE` and `ownTitle` in `cwa-page.vue`, and the
three `API default title` tests in `cwa-page.spec.ts`.

**First:** an api-components-bundle release with a `null` default and a migration
clearing stored `'Unnamed Page'` titles ([api-components-bundle#439](https://github.com/components-web-app/api-components-bundle/issues/439)).

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

## Remove when `deepmerge` has a patched release

### The ignored audit advisory in `pnpm-workspace.yaml`

`auditConfig.ignoreGhsas` ignores `GHSA-gcqx-w48m-w2h4` (low): deepmerge's
`mergeObject()` allows prototype poisoning of returned objects. It has **no
patched release**; 4.3.1, the latest, is vulnerable. It is reached only through
`@rollup/plugin-node-resolve`, used by `nitropack` (Nuxt's build) and `unbuild`
(`@nuxt/module-builder`), so it is build tooling and is not in a built app's
server bundle. It is ignored by ID, not by lowering the audit level, so any new
advisory still fails CI.

**Delete:** the ID (and `auditConfig` if it is empty).

**When:** a patched deepmerge is on npm, or `@rollup/plugin-node-resolve` no
longer depends on it; check with `pnpm audit` after removing it.

---

## Remove when `@tailwindcss/typography` takes the fixed major

### The `@tailwindcss/typography>postcss-selector-parser` override in `pnpm-workspace.yaml`

`@tailwindcss/typography` 0.5.20 (the playground's dependency, the latest
release) pins postcss-selector-parser 6.0.10 exactly, which has
`GHSA-rj75-hqrm-r3gf`. The fix is only in 7.1.6, so the override moves
typography's copy to `^7.1.6`. The playground's compiled CSS was byte-identical
with the override.

**Delete:** the override, once `@tailwindcss/typography` depends on
postcss-selector-parser ≥ 7.1.6; check with `pnpm audit` after removing it.

---

## Remove when the module requires an API that stores page UI names in full

### A page `uiComponent` stored without the `CwaPage` prefix

Admin-made pages used to store `uiComponent` short (`PrimaryPageTemplate`). The
admin now saves the full component name (`CwaPagePrimaryPageTemplate`), and
api-components-bundle#431 prefixes a short value on every page write, with
`silverback:api-components:prefix-page-ui-components` to fix stored rows
([#384](https://github.com/components-web-app/cwa-nuxt-module/issues/384)).
Until then a short value is still read in places.

**Delete:**

- `fullPageUiName` and the `pageUiComponentModel` computed in
  `PageAdminModal.vue` and `PageResourceAdminModal.vue`, binding the Page UI
  select straight to `localResourceData.uiComponent`, and their "stored short"
  tests
- the "still stored short" test in `src/layer/pages/_cwa/index/pages.spec.ts`
- the short-name handling in `ResourceLoader.vue` (`resourceUiComponent`) and
  `templateName()` in `admin/stranded-component-groups.ts`

**Precondition:** the module requires an api-components-bundle release
containing #431, and its upgrade notes tell sites to run the prefix command.
