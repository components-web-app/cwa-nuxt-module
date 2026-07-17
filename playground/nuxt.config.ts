import tailwindcss from '@tailwindcss/vite'

// @ts-ignore excessive stack with tailwind issues in dev, not building on server
export default defineNuxtConfig({
  extends: [
    './../src/layer',
  ],
  modules: [
    '@nuxt/ui',
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
      Form: {
        name: 'Example Form',
        description: '<p>Demonstrates all form field types: text, password, select, radio, checkbox, multi-select, and collections.</p>',
      },
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
  // PWA is opt-in and app-level — @vite-pwa/nuxt is a devDependency of the PLAYGROUND, never of
  // the module itself (a module dep would force a service worker on every consuming app — the
  // same transitive-dep anti-pattern rejected in #236). See #258 for the full vetted write-up.
  pwa: {
    disable: import.meta.test,
    // NOTE: 'autoUpdate' is a playground convenience. Real apps should use 'prompt' (#258): CWA
    // admins edit inline, and an auto-updating SW can swap assets mid-edit. 'prompt' needs UI —
    // usePWA() -> $pwa?.needRefresh -> $pwa.updateServiceWorker(true) — gated on $cwa.admin.isEditing.
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
      // MUST be written explicitly, even as null. @vite-pwa/nuxt checks
      // `if (!('navigateFallback' in options.workbox))` and defaults it to '/', which would serve
      // the '/' app shell for every SSR navigation. Presence of the key is what disables it.
      navigateFallback: null,
      // App-shell precache.
      globPatterns: ['**/*.{js,mjs,ts,json,css,html,png,svg,ico,jpg,jpeg,webp}'],
      // CWA API runtime caching — safe as of api-components-bundle #200 (`CacheHeadersEventListener`,
      // merged to main). See #258 for the full design.
      //
      // Why this is now safe. Draft and published responses share an IDENTICAL URL — the primary
      // fetch requests `/_/routes/{path}` and `/_/resource_manifest/{path}` (api/fetcher/fetcher.ts)
      // with no `?published=` marker, and the API decides draft-vs-published from the auth cookie
      // alone. A URL-keyed cache therefore cannot tell an admin's draft from a public response, and
      // a `urlPattern` callback is synchronous so it cannot read auth state (a SW has no
      // `document.cookie`; `cookieStore` is async + Chromium-only). The fix is NOT a URL denylist —
      // there is no distinguishing URL. Instead the API now marks any authenticated response on an
      // affected resource (Route, ResourceManifest, ComponentPosition, any Publishable) with
      // `Cache-Control: private, no-store`; anonymous responses stay `public`. `cacheWillUpdate`
      // below drops anything carrying `no-store`, so the SW cache only ever holds public data —
      // the same rule Souin enforces at the edge.
      //
      // NetworkFirst, not SWR: the SW cache is only ever READ offline. Online the network always
      // wins, so an anonymous visitor can never be served a cached draft even in the window before
      // the `no-store` marker is seen. The residual offline concern (a cache outliving a
      // logout/session-expiry on one device) is handled by purging the caches on sign-out and on
      // any 401 — an app-side concern, see #258.
      runtimeCaching: [
        {
          // Anchored to the API path prefix so the Mercure SSE stream (a different path) is NOT
          // matched — a broad API-origin pattern would swallow it and break real-time updates.
          urlPattern: ({ url }) => /\/_api\/(?:_\/(?:routes|resource_manifest|pages|layouts|component_groups|component_positions)|page_data|component)\b/.test(url.pathname),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'cwa-api',
            networkTimeoutSeconds: 3,
            cacheableResponse: {
              // Only 200s AND drop anything the API marked non-cacheable. Workbox does not honour
              // `Cache-Control: no-store` for an explicitly-configured route, so this is asserted
              // explicitly via a header check.
              statuses: [200],
              headers: {},
            },
            plugins: [
              {
                // The authoritative gate: never store a response the API flagged as personalised.
                cacheWillUpdate: async ({ response }) => {
                  const cc = response.headers.get('cache-control') || ''
                  if (/no-store|private/.test(cc)) {
                    return null
                  }
                  return response.status === 200 ? response : null
                },
              },
            ],
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24, // short — the offline tier is a convenience, not a store
            },
          },
        },
      ],
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
