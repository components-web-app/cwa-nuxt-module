---
layout: default
title: Installation & Configuration
nav_order: 0
---
# Installation & Configuration
{: .no_toc }

> _PLEASE BE AWARE THAT THIS IS NOT CURRENTLY WORKING, BUT IT WILL BE HOW WE EXPECT YOU ARE ABLE TO INSTALL AND CONFIGURE THIS MODULE IN YOUR OWN PROJECT_

## Table of contents
{: .no_toc .text-delta }

* TOC
{:toc}

## Recommended Installation

Please see the [Components Web App](https://github.com/components-web-app/components-web-app) template repository. This includes a complete setup with the front-end application using our own Nuxt module as well. It also includes testing frameworks setup by default so you can start writing tests for your application immediately, a `docker-compose.yaml` configuration for local development, a helm chart for Kubernetes and a complete Gitlab dev-ops configuration for a production environment.

## Installation

The package names are yet to be confirmed. We are waiting on news for this NPM organisation namespace so these are likely to change.

`yarn add @cwa/nuxt-module`

`yarn add @cwa/nuxt-module-next`

nuxt.config.js
```js
import fs from 'fs'
import path, {join} from 'path'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'

const API_URL_BROWSER = process.env.API_URL_BROWSER || 'https://localhost:8443'
const API_URL = process.env.API_URL || API_URL_BROWSER

const https = process.env.NODE_ENV === 'production' ? {} : {
  key: fs.readFileSync(path.resolve('/certs/localhost.key')),
  cert: fs.readFileSync(path.resolve('/certs/localhost.crt'))
}

export default {
  mode: 'universal',
  server: {
    host: '0.0.0.0',
    https
  },
  publicRuntimeConfig: {
    API_URL,
    API_URL_BROWSER
  },
  typescript: {
    typeCheck: {
      eslint: true
    }
  },
  buildModules: [
    '@nuxt/typescript-build'
  ],
  modules: [
    '@nuxtjs/axios',
    '@nuxtjs/auth-next',
    '@cwamodules/cwa-next'
  ],
  router: {
    middleware: ['auth', 'routeLoader']
  },
  axios: {
    credentials: true,
    progress: false
  },
  auth: {
    redirect: {
      login: '/login',
      logout: '/login',
      home: '/',
      callback: false
    },
    strategies: {
      local: {
        user: {
          autoFetch: true,
          property: ''
        },
        endpoints: {
          login: { url: '/login', method: 'post' },
          logout: { url: '/logout', method: 'post' },
          user: { url: '/me', method: 'get' }
        },
        token: {
          global: false,
          required: false
        }
      }
    }
  },
  build: {
    extend (config, _) {
      if (!config.resolve) {
        config.resolve = {}
      }
      if (!config.resolve.plugins) {
        config.resolve.plugins = []
      }

      config.resolve.plugins.push(new TsconfigPathsPlugin({ configFile: `${__dirname}/tsconfig.json` }))
    }
  },
  alias: {
    '@cwa/nuxt-module': join(__dirname, 'node_modules/@cwamodules/cwa-next/dist')
  }
}
```


tsconfig.json
```json
{
  "compilerOptions": {
    "target": "es2018",
    "module": "esnext",
    "moduleResolution": "node",
    "lib": [
      "esnext",
      "esnext.asynciterable",
      "dom"
    ],
    "esModuleInterop": true,
    "allowJs": true,
    "sourceMap": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@cwa/nuxt-module": ["./node_modules/@cwamodules/cwa-next/dist/*"],
      "~/*": [
        "./*"
      ],
      "@/*": [
        "./*"
      ]
    },
    "types": [
      "@types/node",
      "@nuxt/types",
      "types"
    ]
  },
  "exclude": [
    "node_modules"
  ]
}
```

And you're away!
