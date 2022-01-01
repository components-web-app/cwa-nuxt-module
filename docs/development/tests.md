---
layout: default
title: Development
nav_order: 999
---

# Development

## Logging levels

We use [Consola](https://github.com/nuxt-contrib/consola) for debugging. As such you can set the `CONSOLA_LEVEL` environment variable ins development to get different logging levels. E.g. 4 for debug. [See available levels here](https://github.com/nuxt-contrib/consola/blob/master/src/types.js)

## Tests

### E2E Cypress tests

To run Cypress tests start a mock API in one terminal
```bash
API_PORT=3100 yarn api
```

Build and start the demo application to run your tests
```bash
yarn demo:buld
yarn demo:start
```

Run the test
```bash
yarn e2e
```

For development you can start the application in dev mode for hot-reloading
```bash
TESTING=true DISABLE_HTTPS=true API_URL=http://localhost:3100 yarn dev
```

And run Cypress tests manually with the GUI
```bash
yarn e2e:open
```

### Jest unit tests

Run the following command to execute Jest unit tests
```bash
yarn test
```

## Running a real API

If you wat to run a real API, take a look at the [Components Web App](https://github.com/components-web-app/components-web-app) template application. You can easily run the API locally with Docker Compose and adjust your environment variables so this module uses the correct API endpoint. By default, the template application's API runs at `https://localhost:8443`
