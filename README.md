<!---
This file is auto-generate by a github hook please modify README.template.md if you don't want to lose your work
-->
# CWA Nuxt Module (in development)

[![codecov](https://codecov.io/github/components-web-app/cwa-nuxt-module/branch/feat/manager-tabs/graph/badge.svg?token=Z6GQJN413O)](https://app.codecov.io/gh/components-web-app/cwa-nuxt-module/tree/feat/manager-tabs)

This module is designed to work with the [API Component Bundle](https://github.com/components-web-app/api-components-bundle) and will provide a full user-interface and utilities to easily create custom web apps with an advanced in-line content management system

## CWA Module in Action

### Template using this module for front-end and API Components Bundle for back-end
https://github.com/components-web-app/components-web-app/tree/v3

### Template application deployed online
https://cwa-v3-silverback-web-apps.vercel.app/

## Upgrading

### To `defineCwaConfig` and keyed styles ([#453](https://github.com/components-web-app/cwa-nuxt-module/issues/453))

Components, UI variants, layouts and pages now declare their own config in the SFC with the `defineCwaConfig` macro. `cwa.resources`, `cwa.layouts` and `cwa.pages` are no longer read from `nuxt.config.ts` (`cwa.pageData` stays there), and the `styles` option of `useCwaResource` / `useCwaComponent` is gone.

1. **Move each config entry into its SFC.** `cwa.resources.<Type>` goes into `app/cwa/components/<Type>/<Type>.vue`, `cwa.layouts.<Name>` into `app/cwa/layouts/<Name>.vue` and `cwa.pages.<Name>` into `app/cwa/pages/<Name>.vue`:

   ```vue
   <script setup lang="ts">
   defineCwaConfig({
     name: 'Body Text',
     description: '<p>Rich text for the page body</p>',
     instantAdd: true,
     defaultData: { html: '<p>New text</p>' },
   })
   </script>
   ```

   Components take `name`, `description`, `instantAdd`, `defaultData`, `styles` and `multipleStyles`. Layouts and pages take `name` and `styles`. A `ui/<Variant>.vue` takes `name` (shown in the Ui tab), `styles` and `multipleStyles`: a variant declaring `styles` offers only its own, and one that does not inherits the primary component's. Any other key is reported when the app builds and ignored. A resource type is configured only by `<Type>/<Type>.vue`; other SFCs in its folder (helpers in `_parts/`, say) are neither resource types nor variants. Manager tabs and UI variants are still found from the `admin/` and `ui/` folders. The argument must be a single object literal: a variable, spread, function call, computed key or interpolated template literal, or a second call in the same file, is reported when the app builds and that file's config is ignored. Called in any other file it has no effect, and the build warns once for that file. With implicit auto-imports off, import it: `import { defineCwaConfig } from '#imports'`.

2. **Convert each style to a key with a label and classes.** The key is what content stores, so pick one you will not need to rename; the label can change freely.

   ```ts
   // before: useCwaComponent(props, [], { styles: { multiple: true, classes: { 'Black Background': ['bg-black', 'text-white'] } } })
   defineCwaConfig({
     multipleStyles: true,
     styles: {
       'black-bg': { label: 'Black Background', classes: 'bg-black text-white' },
     },
   })
   ```

   Layout and page `classes: { 'Label': '…' }` become `styles: { key: { label: 'Label', classes: '…' } }` in the same way. A style's classes are resolved when the page renders (on the server too), against the styles of the SFC that renders the resource: the component, or the UI variant it uses, the layout, the page. Changing a style's classes in code changes every component using it on the next deploy. Switching a component's UI variant in the admin keeps only the stored keys the new variant's styles define.

3. **Update the content that already has a style.** `uiClassNames` now stores `style:<key>`, and anything else in it renders nothing. Either re-select the styles in the admin, or rewrite the stored values once, for example:

   ```js
   const keys = { HtmlContent: { 'bg-black text-white': 'black-bg' } }
   const migrated = resource.uiClassNames.map(entry => keys[resource['@type']]?.[entry] ? `style:${keys[resource['@type']][entry]}` : entry)
   ```

   and `PATCH` `{ uiClassNames: migrated }` to each resource, adding `?published=true` for a live publishable component so no draft is created.

4. **Forms become UI variants of `Form`.** The module ships the bundle's `Form` type: its config and a default renderer that lists a form's text fields. Delete any copy of a Form renderer from your app and keep only your forms, each as `app/cwa/components/Form/ui/<Name>.vue` with its helper SFCs in `Form/_parts/`; they are found as Form variants without an app `Form/Form.vue`. Stored `uiComponent` values change to the variant's full global name (`ExampleForm` becomes `CwaComponentFormUiExampleForm`). An app that adds its own `Form/Form.vue` replaces both the module's renderer and its config.

5. **`getCurrentStyleName` is replaced by `styleKeys`**, a computed from `useCwaResource` / `useCwaComponent` listing every stored style key, in stored order:

   ```ts
   // before: const filled = computed(() => getCurrentStyleName(resource.value.data) === 'Filled')
   const { styleKeys } = useCwaComponent(props)
   const filled = computed(() => styleKeys.value.includes('filled'))
   ```

6. **Removed with no replacement:** `useCwaAutoClass` and the `autoClass` option (the root layout and `ResourceLoader` apply the classes), and `$cwa.resourcesConfig`, `$cwa.setResourceMeta`, `$cwa.layoutsConfig` and `$cwa.pagesConfig`.

## Development

- Run `pnpm run dev:prepare` to generate type stubs.
- Use `pnpm run dev` to start [playground](./playground) in development mode.

### Linting

- Run `pnpm run lint` or `pnpm run lint:fix`

### Testing

The module is tested in four layers. Each feature is proven here, in this module. The template's own e2e suite is for projects built from the template, not for module features.

#### 1. Unit and component tests (Vitest)

- `pnpm run test`: a single run. Specs sit next to the code they cover (`*.spec.ts`).
- `pnpm run test:coverage`: the same, with coverage.
- `pnpm run test:watch` (or `pnpm run test:watch:coverage`): watch mode during development.
- `pnpm vitest run --reporter=verbose path/to/file.spec.ts`: one file.

#### 2. Build-output guards

`pnpm run test:e2e` builds the playground and runs `pnpm run test:e2e:guards` against that build:

- **Bundle budgets:** the entry chunk and an anonymous visitor's page preloads hold no admin or on-demand code, and stay within their gzip budgets (`test/e2e/entry-bundle-markers.mjs`, `test/e2e/visitor-page-preloads.mjs`). Lower a budget when the bundle shrinks. Never raise it just to pass.
- **Prefetching:** admin chunks are never prefetched (`test/e2e/prefetch-hints.mjs`).
- **Server responses:** status codes, page-cache headers on errors, sitemap cache headers, and that the server's API URL is never published to the browser.

`pnpm run test:types` type-checks the module and the playground. `pnpm run test:fresh-install` packs the package and installs it into a throwaway app.

#### 3. Admin browser tests: rehearsed against the real API, replayed in CI

The admin features (selecting, adding, ordering, publishing, Clone, Move, the shared-component badge and so on) are tested in a real browser with Playwright Test (`test/browser/admin.spec.mjs`).

CI never talks to a live API. Each scenario is **rehearsed** once against a real API, and the rehearsal (every request and response) is committed. CI **replays** it: the recorded responses play the part of the API, and any request missing from the rehearsal fails the scenario. This tests the module against what the real bundle actually answers, with no Docker or registry in CI.

**Replay** (what CI runs on the lts leg):

```bash
pnpm run dev:build
pnpm run test:browser                        # all scenarios
pnpm run test:browser --grep " 23\. "        # one scenario
```

**Rehearse** (record against the real API) whenever a scenario, its seed data or the module's requests change:

1. Run the template application locally at `https://localhost` with the API Components Bundle version you are testing against, and an `admin`/`admin` user.
2. `pnpm run dev:build`
3. `pnpm run test:browser:rehearse` (or `--grep " 23\. "` for one scenario).
4. Commit the changed files in `test/browser/rehearsals/`.

Rules:

- **Seed your own data.** Each scenario creates the layout, pages, routes and components it needs through the API (`test/browser/seed.mjs`), and never relies on the template's fixtures.
- **The bundle version is recorded.** It goes into every rehearsal file. A feature that needs a newer bundle is rehearsed against that bundle, and the changelog names it as the minimum version.
- **One proxy sees everything.** The proxy (`test/browser/rehearsal.mjs`) sits between the playground and the API, so it sees server-side and browser requests alike. It serves Mercure itself as a silent stream, so recordings are deterministic.
- **Defaults:** the template's Caddy root CA and the bundle version are read from the `components-web-app-php-1` container. Override them with `REHEARSAL_CA`, `REHEARSAL_BUNDLE`, `REHEARSAL_PHP_CONTAINER` or `REHEARSAL_API`.
- **No sleeps.** A console error or page error fails a scenario unless the scenario allows it. Wait for a positive signal, never a fixed delay.
- **The recorder is tested too.** `test/browser/rehearsal.spec.ts` (part of `pnpm run test`) records against a fake API and replays with it stopped. It covers: the answer after a write, unrecorded requests failing, the `path` fallback, origin and Mercure rewriting, cookie redaction, and CORS.

#### 4. Before you push

`pnpm run lint:fix`, `pnpm run test`, and `pnpm run dev:build && pnpm run test:e2e:guards && pnpm run test:browser`.

## Test coverage for branch `feat/manager-tabs`

![Codecov sunburst image](https://codecov.io/github/components-web-app/cwa-nuxt-module/branch/feat/manager-tabs/graphs/sunburst.svg?token=Z6GQJN413O)
