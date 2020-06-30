---
layout: default
title: Development
nav_order: 999
---

# Development

## Tests

### Cypress

To run Cypress tests start a mock API in one terminal
```bash
API_PORT=3100 yarn api
```

Start the demo application in dev
```bash
API_URL=http://localhost:3100 yarn dev
```

Alternatively build and start the demo application to run your tests
```bash
yarn demo:buld
yarn demo:start
```

Run the test
```bash
yarn e2e
```

