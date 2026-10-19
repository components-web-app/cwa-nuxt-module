# CWA Nuxt Module

[![codecov](https://codecov.io/github/components-web-app/cwa-nuxt-module/branch/{{ current.branch }}/graph/badge.svg?token=Z6GQJN413O)](https://app.codecov.io/gh/components-web-app/cwa-nuxt-module/tree/{{ current.branch }})

This module is designed to work with the [API Component Bundle](https://github.com/components-web-app/api-components-bundle) and will provide a full user-interface and utilities to easily create custom web apps with an advanced in-line content management system

## CWA Module in Action

### Template using this module for front-end and API Components Bundle for back-end
https://github.com/components-web-app/components-web-app

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

#### 4. Before you push

`pnpm run lint:fix`, `pnpm run test`, and `pnpm run dev:build && pnpm run test:e2e:guards && pnpm run test:browser`.

## Test coverage for branch `{{ current.branch }}`

![Codecov sunburst image](https://codecov.io/github/components-web-app/cwa-nuxt-module/branch/{{ current.branch }}/graphs/sunburst.svg?token=Z6GQJN413O)
