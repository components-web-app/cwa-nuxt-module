# CWA Nuxt 3 Module

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

We have built in testing using `vitest`.

- To run tests as a one-off use `pnpm run test`
- To include coverage run `pnpm run test:coverage`
- To run tests in watch mode during development run `pnpm run test:watch`
- If you want to check coverage updates at the same time as watching for file changes you can run `pnpm run test:watch:coverage`

## Test coverage for branch `{{ current.branch }}`

![Codecov sunburst image](https://codecov.io/github/components-web-app/cwa-nuxt-module/branch/{{ current.branch }}/graphs/sunburst.svg?token=Z6GQJN413O)
