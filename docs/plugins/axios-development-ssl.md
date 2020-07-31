---
layout: default
parent: Plugins
nav_order: 4
---
# Axios - Development SSL

During development, you'll want to add the CA certificate path into your config.

## Example

Remember to include this plugin in your nuxt config.

plugins/axios.js

```js
const https = require('https')
const fs = require('fs')

export default function ({ $axios }) {
  if (process.env.NODE_ENV === 'production') return

  const caCrt = fs.readFileSync('/certs/rootCA.pem')
  const httpsAgent = new https.Agent({ ca: caCrt, keepAlive: false })

  $axios.onRequest((config) => {
    config.httpsAgent = httpsAgent
  })
}
```
