import { defineNuxtConfig } from 'nuxt/config'
import { createResolver } from '@nuxt/kit'

const API_URL = process.env.API_URL || 'https://localhost:8443'
const API_URL_BROWSER = process.env.API_URL_BROWSER || API_URL

const { resolve } = createResolver(import.meta.url)

export default defineNuxtConfig({
  app: {
    head: {
      titleTemplate: '%s - CWA Playground',
      charset: 'utf-8',
      htmlAttrs: {
        lang: 'en-GB'
      }
    }
  },
  extends: [
    '../src/layer'
  ],
  modules: [
    '../src/module',
    '@nuxtjs/tailwindcss',
    '@nuxt/image',
    'nuxt-vitest',
    '@vite-pwa/nuxt'
  ],
  devtools: {
    enabled: true
  },
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
    // typeCheck: 'build',
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
  tailwindcss: {
    config: {
      content: [
        resolve('cwa/**/*.{js,vue,ts}')
      ],
      plugins: [
        require('@tailwindcss/forms')
      ]
    }
  },
  routeRules: {
    // '/': { prerender: true },
    '/**': { isr: true }
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'CWA',
      short_name: 'CWA',
      theme_color: '#212121',
      icons: [
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: null,
      globPatterns: ['**/*.{js,mjs,ts,json,css,html,png,svg,ico,jpg,jpeg,webp}']
    },
    client: {
      installPrompt: true
      // you don't need to include this: only for testing purposes
      // if enabling periodic sync for update use 1 hour or so (periodicSyncForUpdates: 3600)
      // periodicSyncForUpdates: 20
    },
    devOptions: {
      enabled: true,
      suppressWarnings: false,
      navigateFallbackAllowlist: [/^\/$/],
      type: 'module'
    }
  }
})
