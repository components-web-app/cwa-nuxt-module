import tailwindcss from '@tailwindcss/vite'

// @ts-ignore excessive stack with tailwind issues in dev, not building on server
export default defineNuxtConfig({
  extends: [
    './../src/layer',
  ],
  modules: [
    '@nuxt/image',
    '@nuxt/test-utils/module',
    '@nuxtjs/seo',
    'nuxt-og-image',
    '@vite-pwa/nuxt',
    'nuxt-svgo',
  ],
  devtools: {
    enabled: true,
  },
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      charset: 'utf-8',
      htmlAttrs: {
        lang: 'en-GB',
      },
    },
  },
  css: [
    '~/assets/css/tailwind.css',
  ],
  vue: {
    compilerOptions: {
      comments: true,
    },
  },
  runtimeConfig: {
    public: {
      cwa: {
        apiUrl: 'https://localhost/_api',
        apiUrlBrowser: 'https://localhost/_api',
      },
    },
  },
  // routeRules: {
  // '/': { prerender: true },
  // breaks things like og-image caching all endpoints
  // '/**': { isr: true },
  // },
  vite: {
    plugins: [
      // @ts-ignore - builds with this bit errors here sometimes but not in prod
      tailwindcss(),
    ],
    server: {
      watch: {
        // cwa.css is compiled by tailwind:watch (PostCSS). Excluding it prevents
        // the @tailwindcss/vite plugin from treating each rebuild as a tailwind.css
        // dependency change, which would otherwise cause an HMR feedback loop.
        ignored: ['**/src/runtime/templates/assets/cwa.css', '**/src/runtime/templates/assets/base.css'],
      },
    },
  },
  typescript: {
    typeCheck: false,
  },
  cwa: {
    resources: {
      NavigationLink: {
        name: 'Link',
        description: '<p>Use this component to display a link for a website user to click so they can visit another page or URL</p>',
      },
      HtmlContent: {
        name: 'Body Text',
        description: '<p>Easily create a body of text with the ability to style and format the content using themes in keeping with your website.</p>',
      },
      Image: {
        instantAdd: true,
      },
    },
    layouts: {
      Primary: {
        name: 'Primary Layout',
        classes: {
          'Blue Background': ['bg-blue-600'],
        },
      },
    },
    pages: {
      PrimaryPageTemplate: {
        name: 'Primary Page',
        classes: {
          'Big Text': ['text-2xl'],
        },
      },
      NestedTopicTemplate: {
        name: 'Nested Topic Page',
      },
      NestedSubPageTemplate: {
        name: 'Nested Sub-Page',
      },
    },
    pageData: {
      BlogArticleData: {
        name: 'Blog Articles',
        properties: {
          image: 'Hero Image',
          htmlContent: 'Article Body',
        },
      },
      NestedPageData: {
        name: 'Nested Topics',
        properties: {
          introContent: 'Introduction Content',
        },
      },
    },
    siteConfig: {
      siteName: 'CWA Module Test Playground',
    },
  },
  ogImage: {
    // nuxt-og-image exits without registering imports when ssr:false (the test default).
    // Disabling it in tests registers no-op mock imports instead, making mockNuxtImport work.
    enabled: !process.env.VITEST,
  },
  pwa: {
    disable: import.meta.test,
    registerType: 'autoUpdate',
    manifest: {
      name: 'CWA',
      short_name: 'CWA',
      theme_color: '#212121',
      icons: [
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    workbox: {
      navigateFallback: null,
      globPatterns: ['**/*.{js,mjs,ts,json,css,html,png,svg,ico,jpg,jpeg,webp}'],
    },
    client: {
      installPrompt: true,
      // you don't need to include this: only for testing purposes
      // if enabling periodic sync for update use 1 hour or so (periodicSyncForUpdates: 3600)
      // periodicSyncForUpdates: 20
    },
    devOptions: {
      enabled: true,
      suppressWarnings: false,
      navigateFallbackAllowlist: [/^\/$/],
      type: 'module',
    },
  },
  sitemap: {
    debug: true,
  },
  svgo: {
    autoImportPath: './assets/svg/',
  },
})
