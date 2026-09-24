// @vitest-environment nuxt

import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Mock } from 'vitest'
import * as nuxtKit from '@nuxt/kit'

vi.mock('@nuxt/kit', async () => {
  const actual = await vi.importActual<typeof nuxtKit>('@nuxt/kit')

  const newModule = {
    ...actual,
    addPlugin: vi.fn(),
    addImports: vi.fn(),
    addImportsDir: vi.fn(),
    tryResolveModule: vi.fn(async (id: string) => `/node_modules/${id}`),
    addTemplate: vi.fn(),
    addServerTemplate: vi.fn(),
    addServerHandler: vi.fn(),
    addServerPlugin: vi.fn(),
    addTypeTemplate: vi.fn(),
    extendPages: vi.fn(),
    defineNuxtModule: vi.fn(),
    installModule: vi.fn(),
    hasNuxtModule: vi.fn(() => false),
    createResolver: vi.fn().mockReturnValue({ resolvePath: vi.fn(), resolve: vi.fn(function (...args) { return join(...args) }) }),
    extendRouteRules: vi.fn(),
  }

  return {
    ...newModule,
    default: newModule,
  }
})

const { mockRealpathSync } = vi.hoisted(() => ({
  mockRealpathSync: vi.fn((file: string) => file),
}))

vi.mock('node:fs', () => {
  return {
    default: {
      statSync: vi.fn(() => ({
        isDirectory: vi.fn(() => true),
      })),
      readFileSync: vi.fn(() => ('{ "name": "@cwa/nuxt", "version": "1.0.0" }')),
      realpathSync: mockRealpathSync,
    },
  }
})

async function prepareMockNuxt(options = {}, nuxt?: any) {
  await import('./module')

  const [{ setup }] = (nuxtKit.defineNuxtModule as Mock).mock.lastCall

  const defaultOptions = {
    srcDir: 'app', sitemap: {}, runtimeConfig: { public: { cwa: {} } }, alias: {}, css: [], build: { transpile: [] }, dir: { app: '' },
  }
  const mockNuxt = Object.assign({ hook: vi.fn() }, nuxt || {}, { options: { ...defaultOptions, ...(nuxt?.options || {}) } })

  await setup(options, mockNuxt)

  return mockNuxt
}

describe('CWA module', () => {
  describe('params', () => {
    test('should be called with correct meta', async () => {
      await import('./module')

      const [{ meta }] = (nuxtKit.defineNuxtModule as Mock).mock.lastCall

      expect(meta).toEqual({
        name: '@cwa/nuxt',
        configKey: 'cwa',
        compatibility: { nuxt: '>=3.16' },
      })
    })

    test('should be called with correct defaults', async () => {
      await import('./module')

      const [{ defaults }] = (nuxtKit.defineNuxtModule as Mock).mock.lastCall

      expect(defaults).toEqual({
        storeName: 'cwa',
        resources: {
          ComponentPosition: {
            name: 'Position',
            description: '<p>Dynamic components can be used on dynamic pages to specify what component should be displayed from a data page in any given location.</p><p>You must select the reference from the data page to load into this position below.</p>',
            instantAdd: true,
          },
          ComponentGroup: {
            name: 'Group',
          },
        },
        siteConfig: {
          canonicalUrl: '',
          indexable: true,
          robotsAllowNonSeoCrawlers: true,
          robotsAllowAiBots: true,
          robotsText: '',
          robotsRemoveSitemap: false,
          sitemapEnabled: true,
          siteName: 'CWA Web App',
          fallbackTitle: true,
          concatTitle: true,
          maintenanceModeEnabled: false,
          sitemapXml: '',
        },
      })
    })

    test('should require correct dependent modules', async () => {
      await import('./module')

      const [{ moduleDependencies }] = (nuxtKit.defineNuxtModule as Mock).mock.lastCall

      expect(await moduleDependencies({ options: { modulesDir: ['/app/node_modules'] } })).toEqual({
        '@pinia/nuxt': {
          version: '^1.0.2',
          optional: false,
        },
        '@nuxtjs/robots': {
          version: '^6.0',
        },
        '@nuxtjs/sitemap': {
          version: '^8.0',
          optional: false,
          defaults: {
            sitemaps: {
              cwa: {
                sources: ['/__sitemap__/cwa-urls'],
                chunks: true,
              },
            },
          },
        },
        'nuxt-link-checker': {
          version: '^5.0',
        },
        'nuxt-og-image': {
          version: '^6.0',
        },
        'nuxt-schema-org': {
          version: '^6.0',
        },
        'nuxt-seo-utils': {
          version: '^8.1',
        },
        'nuxt-site-config': {
          version: '^4.0.8',
        },
      })
    })
  })

  describe('setup', () => {
    test('does not call the deprecated installModule — deps are declared via moduleDependencies (#248)', async () => {
      await prepareMockNuxt()
      expect(nuxtKit.installModule).not.toHaveBeenCalled()
    })

    test('should add aliases with result of resolved paths', async () => {
      const mockNuxt = await prepareMockNuxt()
      const mockResolver = nuxtKit.createResolver.mock.results[0].value.resolve
      expect(mockResolver).toHaveBeenCalledWith('./runtime')
      expect(mockResolver).toHaveBeenCalledWith('./layer')
      expect(mockNuxt.options.alias['#cwa']).toEqual(mockResolver('./runtime'))
      expect(mockNuxt.options.alias['#cwa-layer']).toEqual(mockResolver('./layer'))
    })

    test('should add transpile directory', async () => {
      const mockNuxt = await prepareMockNuxt()
      const mockResolver = nuxtKit.createResolver.mock.results[0].value.resolve

      expect(mockResolver).toHaveBeenCalledWith('./runtime')
      expect(mockNuxt.options.build.transpile).toEqual([mockResolver('./runtime')])
    })

    test('should add server template add server handler', async () => {
      const mockResolver = vi.fn(path => path)
      vi.spyOn(nuxtKit, 'createResolver').mockReturnValueOnce({
        resolve: mockResolver,
        resolvePath: vi.fn(),
      })

      const mockOptions = {
        mock: true,
        foo: 'bar',
        apiUrl: 'api-url',
        apiUrlBrowser: 'api-url-browser',
        siteConfig: {
          opA: 'valA',
        },
      }
      await prepareMockNuxt(mockOptions, {
        hook: vi.fn((hookName, callback) => {
          if (hookName === 'modules:done') {
            callback()
          }
        }),
        options: {
          runtimeConfig: { public: { cwa: {} } },
          alias: {},
          css: [],
          build: {
            transpile: [],
          },
          dir: { app: '' },
          sitemap: {},
        },
      })

      expect((nuxtKit.addServerTemplate as Mock)).toHaveBeenCalled()

      const { lastCall: [{ filename, getContents }] } = (nuxtKit.addServerTemplate as Mock).mock

      expect(filename).toEqual('#cwa/server-options.ts')

      expect(getContents()).toEqual(`export const options = {
  "siteConfig": {
    "opA": "valA"
  }
}
`)

      expect(nuxtKit.addServerHandler as Mock).toHaveBeenCalledWith({
        handler: './runtime/server/server-middleware',
      })
    })

    /**
     * `staticRender` tells `ResourceLoader` to re-fetch payload-hydrated resources on mount. It has
     * to be resolved at build time: an ISR/SWR-cached response is indistinguishable from a fresh SSR
     * one at runtime, and when served from cache the server never ran. See #262.
     */
    describe('staticRender detection from routeRules', () => {
      async function getStaticRender(nuxtOptions: any, moduleOptions: any = {}) {
        await prepareMockNuxt({ mock: true, ...moduleOptions }, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'modules:done') {
              callback()
            }
          }),
          options: {
            runtimeConfig: { public: { cwa: {} } },
            alias: {},
            css: [],
            build: { transpile: [] },
            dir: { app: '' },
            sitemap: {},
            ...nuxtOptions,
          },
        })
        const { lastCall: [{ getContents }] } = (nuxtKit.addTemplate as Mock).mock
        const contents = await getContents({ app: { components: [] } })
        return JSON.parse(contents.split('export const options:CwaModuleOptions = ')[1].split('\nexport const')[0]).staticRender
      }

      test('is false when the app has no routeRules', async () => {
        expect(await getStaticRender({})).toBe(false)
      })

      test('is false when routeRules contain no static rules', async () => {
        expect(await getStaticRender({ routeRules: { '/**': { ssr: true }, '/api/**': { cors: true } } })).toBe(false)
      })

      test.each([
        ['isr', { '/**': { isr: true } }],
        ['swr', { '/**': { swr: 60 } }],
        ['prerender', { '/': { prerender: true } }],
      ])('is true when any route rule is %s', async (_name, routeRules) => {
        expect(await getStaticRender({ routeRules })).toBe(true)
      })

      test('detects rules declared under nitro.routeRules', async () => {
        expect(await getStaticRender({ nitro: { routeRules: { '/**': { isr: true } } } })).toBe(true)
      })

      test('an explicit staticRender option overrides detection', async () => {
        expect(await getStaticRender({ routeRules: { '/**': { isr: true } } }, { staticRender: false })).toBe(false)
        expect(await getStaticRender({}, { staticRender: true })).toBe(true)
      })
    })

    describe('session end cache clearing', () => {
      const pluginSrc = join('./runtime/plugin-session-caches.client')

      async function prepare(nuxtOptions: any, moduleOptions: any = {}, pwaInstalled = true) {
        ;(nuxtKit.hasNuxtModule as Mock).mockReturnValue(pwaInstalled)
        ;(nuxtKit.addPlugin as Mock).mockClear()
        const mockNuxt = await prepareMockNuxt({ ...moduleOptions }, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'modules:done') {
              callback()
            }
          }),
          options: {
            runtimeConfig: { public: { cwa: {} } },
            alias: {},
            css: [],
            build: { transpile: [] },
            dir: { app: '' },
            sitemap: {},
            ...nuxtOptions,
          },
        })
        const { lastCall: [{ getContents }] } = (nuxtKit.addTemplate as Mock).mock
        const contents = await getContents({ app: { components: [] } })
        const generated = JSON.parse(contents.split('export const options:CwaModuleOptions = ')[1].split('\nexport const')[0])
        const registered = (nuxtKit.addPlugin as Mock).mock.calls.some(([plugin]) => plugin.src === pluginSrc)
        return { mockNuxt, generated, registered }
      }

      afterEach(() => {
        ;(nuxtKit.hasNuxtModule as Mock).mockReturnValue(false)
      })

      test('registers the client plugin with the default cwa-api cache when @vite-pwa/nuxt is installed and enabled', async () => {
        const { mockNuxt, generated } = await prepare({ pwa: {} })

        expect(nuxtKit.hasNuxtModule).toHaveBeenCalledWith('@vite-pwa/nuxt', mockNuxt)
        expect(nuxtKit.addPlugin as Mock).toHaveBeenCalledWith({ src: pluginSrc, mode: 'client' })
        expect(generated.auth).toEqual({ clearCachesOnSessionEnd: ['cwa-api'] })
      })

      test('passes a configured cache list through to the runtime', async () => {
        const { generated, registered } = await prepare({ pwa: {} }, { auth: { clearCachesOnSessionEnd: ['api-a', 'api-b'] } })

        expect(registered).toBe(true)
        expect(generated.auth).toEqual({ clearCachesOnSessionEnd: ['api-a', 'api-b'] })
      })

      test('registers nothing when @vite-pwa/nuxt is not installed', async () => {
        const { generated, registered } = await prepare({}, { auth: { clearCachesOnSessionEnd: ['cwa-api'] } }, false)

        expect(registered).toBe(false)
        expect(generated.auth).toBeUndefined()
      })

      test('registers nothing when the @vite-pwa/nuxt service worker is disabled', async () => {
        const { generated, registered } = await prepare({ pwa: { disable: true } }, { auth: { clearCachesOnSessionEnd: ['cwa-api'] } })

        expect(registered).toBe(false)
        expect(generated.auth).toBeUndefined()
      })

      test('registers nothing when the configured list is empty', async () => {
        const { generated, registered } = await prepare({ pwa: {} }, { auth: { clearCachesOnSessionEnd: [] } })

        expect(registered).toBe(false)
        expect(generated.auth).toBeUndefined()
      })
    })

    test('should add template', async () => {
      const mockOptions = {
        mock: true,
        foo: 'bar',
      }
      await prepareMockNuxt(mockOptions, {
        hook: vi.fn((hookName, callback) => {
          if (hookName === 'modules:done') {
            callback()
          }
        }),
        options: {
          runtimeConfig: { public: { cwa: {} } },
          alias: {},
          css: [],
          build: {
            transpile: [],
          },
          dir: { app: '' },
          sitemap: {},
        },
      })

      expect((nuxtKit.addTemplate as Mock)).toHaveBeenCalled()

      const { lastCall: [{ filename, getContents }] } = (nuxtKit.addTemplate as Mock).mock

      expect(filename).toEqual('cwa-options.ts')

      const components = [
        {
          filePath: '',
        },
        {
          filePath: 'cwa/components/HtmlContent/HtmlContent.vue',
          pascalName: 'CwaComponentHtmlContent',
        },
        {
          filePath: 'cwa/components/HtmlContent/admin/Tab.vue',
          pascalName: 'CwaComponentHtmlContentAdminTab',
        },
        {
          filePath: 'cwa/components/HtmlContent/admin/GlobalTab.vue',
          pascalName: 'CwaComponentHtmlContentAdminGlobalTab',
          global: true,
        },
        {
          filePath: 'cwa/components/HtmlContent/ui/AltUi.vue',
          pascalName: 'CwaComponentHtmlContentUiAltUi',
          global: true,
        },
      ]

      expect(await getContents({ app: { components } })).toEqual(`import type { CwaModuleOptions } from '#cwa/types';
export const options:CwaModuleOptions = {
  "mock": true,
  "foo": "bar",
  "resources": {
    "HtmlContent": {
      "name": "Html Content",
      "managerTabs": [
        "CwaComponentHtmlContentAdminGlobalTab"
      ],
      "ui": [
        "CwaComponentHtmlContentUiAltUi"
      ]
    }
  },
  "staticRender": false
}
export const currentModulePackageInfo:{ version: string, name: string } = {
  "version": "1.0.0",
  "name": "@cwa/nuxt"
}
`)

      expect((nuxtKit.addTypeTemplate as Mock)).toHaveBeenCalled()

      const { lastCall: [{ filename: tFilename, write, getContents: tGetContents }] } = (nuxtKit.addTypeTemplate as Mock).mock

      expect(tFilename).toEqual('types/cwa.d.ts')
      expect(write).toEqual(true)
      expect(await tGetContents()).toEqual(`interface CwaRouteMeta {
  admin?: boolean
  disabled?: boolean
  staticLayout?: GlobalComponentNames
  fetch?: {
    iri: string
    manifestPath?: string
  }
}
export * from 'vue-router'
declare module 'vue-router' {
  interface RouteMeta {
    cwa?: CwaRouteMeta
  }
}`)
    })

    test('should add imports directory', async () => {
      const mockResolver = vi.fn(path => path)
      vi.spyOn(nuxtKit, 'createResolver').mockReturnValue({
        resolve: mockResolver,
        resolvePath: vi.fn(),
      })

      await prepareMockNuxt()

      expect(mockResolver).toHaveBeenCalledWith('./runtime/composables')

      expect(nuxtKit.addImportsDir as Mock).toHaveBeenCalledWith(mockResolver('./runtime/composables'))
    })

    describe('page cache warm route', () => {
      const warmHandler = {
        route: '/_cwa/page-cache/warm',
        method: 'post',
        handler: expect.stringMatching(/runtime\/server\/cwa-page-cache-warm\.post$/),
      }

      async function prepare(moduleOptions: any = {}, runtimeConfig: any = { public: { cwa: {} } }) {
        ;(nuxtKit.addServerHandler as Mock).mockClear()
        return prepareMockNuxt({ ...moduleOptions }, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'modules:done') {
              callback()
            }
          }),
          options: {
            runtimeConfig,
            alias: {},
            css: [],
            build: { transpile: [] },
            dir: { app: '' },
            sitemap: {},
          },
        })
      }

      test('registers the warm route when the page cache is enabled', async () => {
        await prepare()

        expect(nuxtKit.addServerHandler as Mock).toHaveBeenCalledWith(warmHandler)
      })

      test('does not register the warm route when the page cache is disabled', async () => {
        await prepare({ pageCache: { enabled: false } })

        expect(nuxtKit.addServerHandler as Mock).not.toHaveBeenCalledWith(warmHandler)
      })

      test('adds private runtime config defaults so each setting can be overridden per environment', async () => {
        const mockNuxt = await prepare()

        expect(mockNuxt.options.runtimeConfig.cwa).toEqual({
          apiUrl: '',
          pageCacheWarm: { concurrency: 3, timeout: 30000, origin: '' },
          readiness: { path: '/_/health', timeout: 2000 },
        })
        expect(mockNuxt.options.runtimeConfig.public.cwa).not.toHaveProperty('pageCacheWarm')
      })

      test('registers the readiness route whether or not the page cache is enabled', async () => {
        const readinessHandler = {
          route: '/_cwa/readiness',
          handler: expect.stringMatching(/runtime\/server\/cwa-readiness\.get$/),
        }
        await prepare()
        expect(nuxtKit.addServerHandler as Mock).toHaveBeenCalledWith(readinessHandler)

        await prepare({ pageCache: { enabled: false } })
        expect(nuxtKit.addServerHandler as Mock).toHaveBeenCalledWith(readinessHandler)
      })

      test('adds the readiness defaults whether or not the page cache is enabled', async () => {
        const mockNuxt = await prepare({ pageCache: { enabled: false } })

        expect(mockNuxt.options.runtimeConfig.cwa).toEqual({
          apiUrl: '',
          readiness: { path: '/_/health', timeout: 2000 },
        })
      })

      test('keeps warm settings the app has configured', async () => {
        const mockNuxt = await prepare({}, { public: { cwa: {} }, cwa: { pageCacheWarm: { concurrency: 5, origin: 'http://caddy' } } })

        expect(mockNuxt.options.runtimeConfig.cwa.pageCacheWarm).toEqual({ concurrency: 5, timeout: 30000, origin: 'http://caddy' })
      })
    })

    describe('api url runtime config (#345)', () => {
      async function prepare(moduleOptions: any = {}, runtimeConfig: any = { public: { cwa: {} } }) {
        return prepareMockNuxt({ ...moduleOptions }, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'modules:done') {
              callback()
            }
          }),
          options: {
            runtimeConfig,
            alias: {},
            css: [],
            build: { transpile: [] },
            dir: { app: '' },
            sitemap: {},
          },
        })
      }

      test('declares the public keys so an app that sets neither still honours the environment variables', async () => {
        const mockNuxt = await prepare({}, { public: {} })

        expect(mockNuxt.options.runtimeConfig.public.cwa).toEqual({ apiUrl: '', apiUrlBrowser: '' })
      })

      test('keeps the public values an app has configured', async () => {
        const mockNuxt = await prepare({}, { public: { cwa: { apiUrlBrowser: 'https://www.example.com/_api' } } })

        expect(mockNuxt.options.runtimeConfig.public.cwa).toEqual({ apiUrl: '', apiUrlBrowser: 'https://www.example.com/_api' })
      })

      test('declares the private key whether or not the page cache is enabled', async () => {
        const mockNuxt = await prepare({ pageCache: { enabled: false } })

        expect(mockNuxt.options.runtimeConfig.cwa.apiUrl).toBe('')
      })

      test('keeps the private value an app has configured', async () => {
        const mockNuxt = await prepare({}, { public: { cwa: {} }, cwa: { apiUrl: 'http://php/_api' } })

        expect(mockNuxt.options.runtimeConfig.cwa.apiUrl).toBe('http://php/_api')
      })

      test('does not publish the private key to the browser', async () => {
        const mockNuxt = await prepare({}, { public: { cwa: {} }, cwa: { apiUrl: 'http://php/_api' } })

        expect(mockNuxt.options.runtimeConfig.public.cwa).toEqual({ apiUrl: '', apiUrlBrowser: '' })
      })
    })

    describe('hooks', () => {
      test('should install plugin', async () => {
        const mockResolver = vi.fn(path => path)
        vi.spyOn(nuxtKit, 'createResolver').mockReturnValue({
          resolve: mockResolver,
          resolvePath: vi.fn(),
        })

        const mockNuxt = await prepareMockNuxt({}, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'modules:done') {
              callback()
            }
          }),
          options: {
            runtimeConfig: { public: { cwa: {} } },
            alias: {},
            css: [],
            build: {
              transpile: [],
            },
            dir: { app: './mock' },
            sitemap: {},
          },
        })

        const hookCall = mockNuxt.hook.mock.calls.find(call => call[0] === 'modules:done')

        expect(hookCall).toBeDefined()

        expect(nuxtKit.addPlugin as Mock).toHaveBeenCalledWith({ src: './runtime/plugin' })
      })

      test('should add paths for component dirs and page dirs', async () => {
        const mockResolver = vi.fn(path => path)
        vi.spyOn(nuxtKit, 'createResolver').mockReturnValue({
          resolve: mockResolver,
          resolvePath: vi.fn(),
        })

        const mockDirs = []
        const mockNuxt = await prepareMockNuxt({}, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'components:dirs') {
              callback(mockDirs)
            }
          }),
          options: {
            runtimeConfig: { public: { cwa: {} } },
            alias: {},
            css: [],
            build: {
              transpile: [],
            },
            dir: { app: './mock' },
            sitemap: {},
          },
        })

        const hookCall = mockNuxt.hook.mock.calls.find(call => call[0] === 'components:dirs')

        expect(hookCall).toBeDefined()
        expect(mockDirs).toContainEqual({
          path: join('mock', 'cwa', 'components'),
          prefix: 'CwaComponent',
          global: true,
          ignore: ['**/*.spec.{cts,mts,ts}'],
        })
        expect(mockDirs).toContainEqual({
          path: join('mock', 'cwa', 'pages'),
          prefix: 'CwaPage',
          global: true,
          ignore: [
            '**/admin/*',
            '**/*.spec.{cts,mts,ts}',
          ],
        })
        expect(mockDirs).toContainEqual({
          path: join(mockResolver('./runtime/templates'), 'components', 'ui'),
          prefix: 'CwaUi',
          ignore: ['**/*.spec.{cts,mts,ts}'],
        })
        expect(mockDirs).toContainEqual({
          path: join(mockResolver('./runtime/templates'), 'components', 'main'),
          prefix: 'Cwa',
          ignore: ['**/_*/*', '**/*.spec.{cts,mts,ts}'],
        })
      })
    })

    function capturePageCallbacks() {
      const callbacks: ((pages: any[]) => void)[] = []
      const mockResolver = vi.fn(path => path)
      vi.spyOn(nuxtKit, 'createResolver').mockReturnValue({
        resolve: mockResolver,
        resolvePath: vi.fn(),
      })
      vi.spyOn(nuxtKit, 'extendPages').mockImplementation((callback) => {
        callbacks.push(callback)
      })
      return { callbacks, mockResolver }
    }

    test('registers sibling routes per depth so a CWA route matches a single record (#337)', async () => {
      const { callbacks, mockResolver } = capturePageCallbacks()
      const mockPages: any[] = []

      await prepareMockNuxt()

      expect(callbacks).toHaveLength(2)

      callbacks[0](mockPages)

      const meta = { cwa: { disabled: false }, layout: 'cwa-root-layout', key: 'cwa-page' }
      const file = mockResolver('./runtime/templates')

      expect(mockPages).toEqual([
        { name: 'cwaPage0', path: '/', meta, file },
        { name: 'cwaPage1', path: '/:cwaPage1', meta, file },
        { name: 'cwaPage2', path: '/:cwaPage1/:cwaPage2', meta, file },
        { name: 'cwaPage3', path: '/:cwaPage1/:cwaPage2/:cwaPage3', meta, file },
        { name: 'cwaPage4', path: '/:cwaPage1/:cwaPage2/:cwaPage3/:cwaPage4', meta, file },
      ])
    })

    test('no generated route declares a cwaPage0 param, which the fetcher reads as an IRI', async () => {
      const { callbacks } = capturePageCallbacks()
      const mockPages: any[] = []

      await prepareMockNuxt()
      callbacks[0](mockPages)

      expect(mockPages.filter(page => page.path.includes(':cwaPage0'))).toEqual([])
    })

    test('pagesDepth limits how many path segments are matched', async () => {
      const { callbacks } = capturePageCallbacks()
      const mockPages: any[] = []

      await prepareMockNuxt({ pagesDepth: 2 })
      callbacks[0](mockPages)

      expect(mockPages.map(page => page.path)).toEqual([
        '/',
        '/:cwaPage1',
        '/:cwaPage1/:cwaPage2',
      ])
    })

    test('second extendPages pass sets cwa-root-layout as default for pages without explicit layout', async () => {
      const callbacks: ((pages: any[]) => void)[] = []
      vi.spyOn(nuxtKit, 'extendPages').mockImplementation((callback) => {
        callbacks.push(callback)
      })

      await prepareMockNuxt()

      const noLayout: any = { name: 'app-page', path: '/app', meta: { cwa: { disabled: true } } }
      const explicitLayout: any = { name: 'styled-page', path: '/styled', meta: { layout: 'alternate-layout' } }
      const disabledLayout: any = { name: 'no-layout', path: '/no-layout', meta: { layout: false } }
      const withChildren: any = { name: 'parent', path: '/parent', children: [{ name: 'child', path: 'child' }] }

      const pages = [noLayout, explicitLayout, disabledLayout, withChildren]
      callbacks[1](pages)

      expect(noLayout.meta.layout).toBe('cwa-root-layout')
      expect(explicitLayout.meta.layout).toBe('alternate-layout')
      expect(disabledLayout.meta.layout).toBe(false)
      expect(withChildren.children[0].meta.layout).toBe('cwa-root-layout')
    })

    describe('scroll behaviour router options', () => {
      async function captureRouterOptionsHook() {
        vi.spyOn(nuxtKit, 'createResolver').mockReturnValue({
          resolve: vi.fn((...args: string[]) => join(...args)),
          resolvePath: vi.fn(),
        } as never)
        const mockNuxt = await prepareMockNuxt()
        const call = (mockNuxt.hook as Mock).mock.calls.find(([name]: [string]) => name === 'pages:routerOptions')
        return call?.[1] as (context: { files: { path: string, optional?: boolean }[] }) => void
      }

      test('the module router options are added after the built-in ones', async () => {
        const hook = await captureRouterOptionsHook()
        const files = [{ path: '/nuxt/pages/runtime/router.options', optional: true }]

        hook({ files })

        expect(files.map(file => file.path)).toEqual([
          '/nuxt/pages/runtime/router.options',
          join('./runtime/router.options'),
        ])
      })

      test('an application router options file is left last so it still wins', async () => {
        const hook = await captureRouterOptionsHook()
        const files = [
          { path: '/nuxt/pages/runtime/router.options', optional: true },
          { path: '/app/app/router.options.ts' },
        ]

        hook({ files })

        expect(files.map(file => file.path)).toEqual([
          '/nuxt/pages/runtime/router.options',
          join('./runtime/router.options'),
          '/app/app/router.options.ts',
        ])
      })
    })

    describe('page file realpath (#329)', () => {
      afterEach(() => {
        mockRealpathSync.mockImplementation(file => file)
      })

      async function capturePagesExtendHook(nuxt?: any) {
        const mockNuxt = await prepareMockNuxt({}, nuxt)
        const call = (mockNuxt.hook as Mock).mock.calls.find(([name]) => name === 'pages:extend')
        return call?.[1]
      }

      test('rewrites a page file that resolves through a symlink', async () => {
        mockRealpathSync.mockImplementation(file => file.replace('/node_modules/@cwa/nuxt/dist/', '/node_modules/.pnpm/@cwa+nuxt/node_modules/@cwa/nuxt/dist/'))
        const hook = await capturePagesExtendHook()
        const page: any = { name: 'forgot-password', path: '/forgot-password', file: '/app/node_modules/@cwa/nuxt/dist/layer/pages/forgot-password.vue' }

        hook([page])

        expect(page.file).toBe('/app/node_modules/.pnpm/@cwa+nuxt/node_modules/@cwa/nuxt/dist/layer/pages/forgot-password.vue')
      })

      test('leaves a page file that is already a real path', async () => {
        mockRealpathSync.mockImplementation(file => file)
        const hook = await capturePagesExtendHook()
        const page: any = { name: 'index', path: '/', file: '/app/app/pages/index.vue' }

        hook([page])

        expect(page.file).toBe('/app/app/pages/index.vue')
      })

      test('rewrites child pages', async () => {
        mockRealpathSync.mockImplementation(() => '/real/layer/pages/_cwa/index/settings.vue')
        const hook = await capturePagesExtendHook()
        const child: any = { name: '_cwa-index-settings', path: 'settings', file: '/app/link/layer/pages/_cwa/index/settings.vue' }
        const parent: any = { name: '_cwa-index', path: '/_cwa', children: [child] }

        hook([parent])

        expect(child.file).toBe('/real/layer/pages/_cwa/index/settings.vue')
      })

      test('keeps the file of a page that cannot be resolved', async () => {
        mockRealpathSync.mockImplementation(() => {
          throw new Error('ENOENT')
        })
        const hook = await capturePagesExtendHook()
        const page: any = { name: 'virtual', path: '/virtual', file: 'virtual:some-generated-page.vue' }

        expect(() => hook([page])).not.toThrow()
        expect(page.file).toBe('virtual:some-generated-page.vue')
      })

      test('is not registered in dev, where the prefetch filter does not run', async () => {
        const mockNuxt = await prepareMockNuxt({}, {
          options: {
            dev: true,
            sitemap: {},
            runtimeConfig: { public: { cwa: {} } },
            alias: {},
            css: [],
            build: { transpile: [] },
            dir: { app: '' },
          },
        })

        expect((mockNuxt.hook as Mock).mock.calls.find(([name]) => name === 'pages:extend')).toBeUndefined()
      })
    })

    describe('admin prefetch hints (#336)', () => {
      const mainAdmin = '../runtime/templates/components/main/admin'
      const coreAdmin = '../runtime/templates/components/core/admin'
      const header = `${mainAdmin}/header/Header.vue`
      const resourceManager = `${mainAdmin}/resource-manager/ResourceManager.vue`
      const componentFocus = `${mainAdmin}/resource-manager/ComponentFocus.vue`
      const groupTab = `${mainAdmin}/resource-manager/_tabs/group/Group.vue`
      const listContent = `${coreAdmin}/ListContent.vue`
      const layout = '../layer/layouts/CwaRootLayout.vue'
      const defaultLayout = '../runtime/templates/components/main/DefaultLayout.vue'

      async function captureBuildManifestHook(overrides: Record<string, unknown> = {}) {
        const mockNuxt = await prepareMockNuxt({}, { options: overrides })
        const call = (mockNuxt.hook as Mock).mock.calls.find(([name]) => name === 'build:manifest')
        return call?.[1]
      }

      test('strips admin components from a rendered layout chunk', async () => {
        const hook = await captureBuildManifestHook()
        const manifest: any = {
          [layout]: { src: layout, file: 'layout.js', isDynamicEntry: true, dynamicImports: [header, resourceManager, defaultLayout] },
        }

        hook(manifest)

        expect(manifest[layout].dynamicImports).toEqual([defaultLayout])
      })

      test('strips admin components from the app entry', async () => {
        const hook = await captureBuildManifestHook()
        const manifest: any = {
          'entry.js': { src: 'entry.js', file: 'entry.js', isEntry: true, dynamicImports: [componentFocus, defaultLayout] },
        }

        hook(manifest)

        expect(manifest['entry.js'].dynamicImports).toEqual([defaultLayout])
      })

      test('strips components under the core admin directory', async () => {
        const hook = await captureBuildManifestHook()
        const manifest: any = {
          [layout]: { src: layout, file: 'layout.js', dynamicImports: [listContent, defaultLayout] },
        }

        hook(manifest)

        expect(manifest[layout].dynamicImports).toEqual([defaultLayout])
      })

      test('keeps the dynamic imports of a chunk that is itself admin', async () => {
        const hook = await captureBuildManifestHook()
        const manifest: any = {
          [resourceManager]: { src: resourceManager, file: 'rm.js', isDynamicEntry: true, dynamicImports: [groupTab, componentFocus] },
        }

        hook(manifest)

        expect(manifest[resourceManager].dynamicImports).toEqual([groupTab, componentFocus])
      })

      test('keeps a component whose path only begins with the admin directory name', async () => {
        const hook = await captureBuildManifestHook()
        const administration = '../runtime/templates/components/main/administration/Report.vue'
        const manifest: any = {
          [layout]: { src: layout, file: 'layout.js', dynamicImports: [administration] },
        }

        hook(manifest)

        expect(manifest[layout].dynamicImports).toEqual([administration])
      })

      test('leaves static imports, css and assets untouched', async () => {
        const hook = await captureBuildManifestHook()
        const manifest: any = {
          [layout]: { src: layout, file: 'layout.js', imports: [header], css: ['Header.css'], assets: ['logo.svg'], dynamicImports: [header] },
        }

        hook(manifest)

        expect(manifest[layout].imports).toEqual([header])
        expect(manifest[layout].css).toEqual(['Header.css'])
        expect(manifest[layout].assets).toEqual(['logo.svg'])
      })

      test('leaves a chunk with no dynamic imports alone', async () => {
        const hook = await captureBuildManifestHook()
        const manifest: any = {
          'Header.css': { file: 'Header.css', resourceType: 'style' },
        }

        expect(() => hook(manifest)).not.toThrow()
        expect(manifest['Header.css']).toEqual({ file: 'Header.css', resourceType: 'style' })
      })

      test('filters a shared chunk that carries no source of its own', async () => {
        const hook = await captureBuildManifestHook()
        const manifest: any = {
          '_shared.js': { file: 'shared.js', dynamicImports: [header, defaultLayout] },
        }

        hook(manifest)

        expect(manifest['_shared.js'].dynamicImports).toEqual([defaultLayout])
      })

      test('is not gated on dev, so the same manifest is filtered either way', async () => {
        const hook = await captureBuildManifestHook({ dev: true })
        const manifest: any = {
          [layout]: { src: layout, file: 'layout.js', dynamicImports: [header, defaultLayout] },
        }

        hook(manifest)

        expect(manifest[layout].dynamicImports).toEqual([defaultLayout])
      })
    })
  })

  describe('open graph image renderer (#273)', () => {
    beforeEach(() => {
      ;(nuxtKit.addImports as Mock).mockClear()
      ;(nuxtKit.addTypeTemplate as Mock).mockClear()
    })

    afterEach(() => {
      ;(nuxtKit.tryResolveModule as Mock).mockImplementation(async (id: string) => `/node_modules/${id}`)
      ;(nuxtKit.hasNuxtModule as Mock).mockReturnValue(false)
    })

    async function getModuleDependencies(nuxt: any = { options: { modulesDir: ['/app/node_modules'] } }) {
      await import('./module')
      const [{ moduleDependencies }] = (nuxtKit.defineNuxtModule as Mock).mock.lastCall
      return moduleDependencies(nuxt)
    }

    async function prepareWithModulesDone(ogImageInstalled: boolean) {
      ;(nuxtKit.hasNuxtModule as Mock).mockImplementation((name: string) => name === 'nuxt-og-image' && ogImageInstalled)
      return prepareMockNuxt({ mock: true }, {
        hook: vi.fn((hookName, callback) => {
          if (hookName === 'modules:done') {
            callback()
          }
        }),
        options: {
          modulesDir: ['/app/node_modules'],
          runtimeConfig: { public: { cwa: {} } },
          alias: {},
          css: [],
          build: { transpile: [] },
          dir: { app: '' },
          sitemap: {},
        },
      })
    }

    test('requires nuxt-og-image when both renderer packages resolve', async () => {
      const dependencies = await getModuleDependencies()

      expect(dependencies['nuxt-og-image']).toEqual({ version: '^6.0' })
      expect(nuxtKit.tryResolveModule).toHaveBeenCalledWith('satori', ['/app/node_modules'])
      expect(nuxtKit.tryResolveModule).toHaveBeenCalledWith('@resvg/resvg-js', ['/app/node_modules'])
    })

    test.each(['satori', '@resvg/resvg-js'])('omits nuxt-og-image when %s is not installed', async (missing) => {
      ;(nuxtKit.tryResolveModule as Mock).mockImplementation(async (id: string) => id === missing ? undefined : `/node_modules/${id}`)

      const dependencies = await getModuleDependencies()

      expect(dependencies['nuxt-og-image']).toBeUndefined()
      expect(dependencies['@pinia/nuxt']).toEqual({ version: '^1.0.2', optional: false })
    })

    test('declares the og image component types when nuxt-og-image is installed', async () => {
      await prepareWithModulesDone(true)

      const filenames = (nuxtKit.addTypeTemplate as Mock).mock.calls.map(([{ filename }]) => filename)

      expect(filenames).toContain('types/cwa-og-image.d.ts')
      expect(nuxtKit.addImports).not.toHaveBeenCalled()
    })

    test('registers a no-op defineOgImage when nuxt-og-image is absent, so cwa-page still builds', async () => {
      await prepareWithModulesDone(false)

      const filenames = (nuxtKit.addTypeTemplate as Mock).mock.calls.map(([{ filename }]) => filename)

      expect(filenames).not.toContain('types/cwa-og-image.d.ts')
      expect(nuxtKit.addImports).toHaveBeenCalledWith({
        name: 'defineOgImage',
        as: 'defineOgImage',
        from: 'runtime/og-image-fallback',
      })
    })
  })
})
