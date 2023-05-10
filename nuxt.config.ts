import { defineNuxtConfig } from 'nuxt/config'

const API_URL = process.env.API_URL || 'https://localhost:8443'
const API_URL_BROWSER = process.env.API_URL_BROWSER || API_URL

export default defineNuxtConfig({
  modules: [
    'nuxt-vitest'
  ],
  cwa: {
    apiUrl: API_URL,
    apiUrlBrowser: API_URL_BROWSER
  },
  extends: [
    './src/layer'
  ],
  srcDir: './playground',
  typescript: {
    tsConfig: {
      include: [
        './src'
      ],
      exclude: [
        './**/*.spec.ts',
        './**/*.test.ts'
      ]
    }
  }
})
