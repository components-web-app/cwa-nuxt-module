import { fileURLToPath } from 'url'
import { defineNuxtConfig } from 'nuxt/config'
import CwaModule from '../src/module'

const API_URL = process.env.API_URL || 'https://localhost:8443'
const API_URL_BROWSER = process.env.API_URL_BROWSER || API_URL
const HOST = process.env.HOST || '0.0.0.0'

const https = process.env.DISABLE_HTTPS
  ? false
  : {
      key: fileURLToPath(new URL('ssl/localhost.key', import.meta.url)),
      cert: fileURLToPath(new URL('ssl/localhost.crt', import.meta.url))
    }

export default defineNuxtConfig({
  modules: [
    CwaModule
  ],
  cwa: {
    apiUrl: API_URL,
    apiUrlBrowser: API_URL_BROWSER
  },
  alias: {
    '@cwa/nuxt-module': fileURLToPath(new URL('../src', import.meta.url))
  },
  typescript: {
    tsConfig: {
      include: [
        './src'
      ],
      exclude: [
        './src/**/*.spec.ts'
      ]
    }
  }
})
