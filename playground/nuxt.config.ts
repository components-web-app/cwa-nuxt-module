import { defineNuxtConfig } from 'nuxt/config'

const API_URL = process.env.API_URL || 'https://localhost:8443'
const API_URL_BROWSER = process.env.API_URL_BROWSER || API_URL

export default defineNuxtConfig({
  extends: [
    '../src/layer'
  ],
  modules: [
    '../src/module',
    '@nuxtjs/tailwindcss',
    '@nuxt/image',
    '@nuxt/devtools',
    'nuxt-vitest',
    '@vite-pwa/nuxt'
  ],
  cwa: {
    apiUrl: API_URL,
    apiUrlBrowser: API_URL_BROWSER,
    resources: {
      NavigationLink: {
        name: 'Link'
      },
      HtmlContent: {
        name: 'Body Text'
      }
    },
    tailwind: {
      base: false
    }
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
