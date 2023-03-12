import { fileURLToPath } from 'url'
import { defineNuxtConfig } from 'nuxt/config'
import CwaModule from '../src/module'

const API_URL = process.env.API_URL || 'https://localhost:8443'
const API_URL_BROWSER = process.env.API_URL_BROWSER || API_URL

export default defineNuxtConfig({
  modules: [
    CwaModule,
    '@nuxtjs/tailwindcss',
    '@kevinmarrec/nuxt-pwa',
    '@nuxt/image-edge'
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
        '../src'
      ],
      exclude: [
        '../**/*.spec.ts',
        '../**/*.test.ts'
      ]
    }
  },
  pwa: {}
})
