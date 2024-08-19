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
        lang: 'en-GB',
        class: 'bg-blue-400'
      },
      bodyAttrs: {
        class: 'bg-white'
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
    '@nuxt/test-utils/module',
    '@vite-pwa/nuxt'
  ],
  devtools: {
    enabled: true
  },
  cwa: {
    appName: 'CWA Module Test Playground',
    apiUrl: API_URL,
    apiUrlBrowser: API_URL_BROWSER,
    resources: {
      NavigationLink: {
        name: 'Link',
        description: '<p>Use this component to display a link for a website user to click so they can visit another page or URL</p>'
      },
      HtmlContent: {
        name: 'Body Text',
        description: '<p>Easily create a body of text with the ability to style and format the content using themes in-keeping with your website.</p>'
      },
      Image: {
        instantAdd: true
      }
    },
    layouts: {
      Primary: {
        name: 'Primary Layout',
        classes: {
          'Blue Background': ['bg-blue-600']
        }
      }
    },
    pages: {
      PrimaryPageTemplate: {
        name: 'Primary Page',
        classes: {
          'Big Text': ['text-2xl']
        }
      }
    },
    pageData: {
      BlogArticleData: {
        name: 'Blog Articles'
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
        resolve('nuxt.config.ts'),
        resolve('cwa/**/*.{js,vue,ts}')
      ],
      plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/typography')
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
