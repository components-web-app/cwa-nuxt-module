// @vitest-environment nuxt

import { join } from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Mock } from 'vitest'
import * as nuxtKit from '@nuxt/kit'
import { scanComponentGroupDeclarations } from './component-group-declarations'
import { scanCwaConfigDeclarations } from './cwa-config-declarations'

vi.mock('@nuxt/kit', async () => {
  const actual = await vi.importActual<typeof nuxtKit>('@nuxt/kit')

  const newModule = {
    ...actual,
    addPlugin: vi.fn(),
    addImports: vi.fn(),
    addImportsDir: vi.fn(),
    tryResolveModule: vi.fn(async (id: string) => `/node_modules/${id}`),
    addTemplate: vi.fn(),
    addVitePlugin: vi.fn(),
    addServerTemplate: vi.fn(),
    addServerHandler: vi.fn(),
    addServerPlugin: vi.fn(),
    addTypeTemplate: vi.fn(),
    updateTemplates: vi.fn(),
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

vi.mock('./component-group-declarations', () => ({
  scanComponentGroupDeclarations: vi.fn(() => ({})),
}))

vi.mock('./cwa-config-declarations', () => ({
  scanCwaConfigDeclarations: vi.fn(() => ({ components: {}, ui: {}, layouts: {}, pages: {} })),
}))

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  const fs = {
    statSync: vi.fn(() => ({
      isDirectory: vi.fn(() => true),
    })),
    readFileSync: vi.fn((file: string, encoding: BufferEncoding) => file.endsWith('@iconify-json/lucide/icons.json') ? actual.readFileSync(file, encoding) : '{ "name": "@cwa/nuxt", "version": "1.0.0" }'),
  }
  return { ...fs, default: fs }
})

let moduleDefinitionCall: Parameters<typeof nuxtKit.defineNuxtModule>

beforeAll(async () => {
  await import('./module')
  moduleDefinitionCall = (nuxtKit.defineNuxtModule as Mock).mock.lastCall as Parameters<typeof nuxtKit.defineNuxtModule>
})

async function prepareMockNuxt(options = {}, nuxt?: any) {
  await import('./module')

  const [{ setup }] = moduleDefinitionCall

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

      const [{ meta }] = moduleDefinitionCall

      expect(meta).toEqual({
        name: '@cwa/nuxt',
        configKey: 'cwa',
        compatibility: { nuxt: '>=4.6.0' },
      })
    })

    test('declares the same minimum Nuxt as the @nuxt/kit it depends on, so Nuxt refuses an app too old for it', async () => {
      await import('./module')
      const { dependencies } = await import('../package.json')

      const [{ meta }] = moduleDefinitionCall

      expect(meta.compatibility.nuxt).toBe(`>=${dependencies['@nuxt/kit'].replace(/^\^/, '')}`)
    })

    test('should be called with correct defaults', async () => {
      await import('./module')

      const [{ defaults }] = moduleDefinitionCall

      expect(defaults).toEqual({
        storeName: 'cwa',
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

      const [{ moduleDependencies }] = moduleDefinitionCall

      expect(await moduleDependencies({ options: { modulesDir: ['/app/node_modules'] } })).toEqual({
        '@pinia/nuxt': {
          version: '^1.0.2',
          optional: false,
        },
        '@nuxtjs/robots': {
          version: '^7.0',
        },
        '@nuxtjs/sitemap': {
          version: '^9.0.1',
          optional: false,
          defaults: {
            cacheMaxAgeSeconds: 0,
            sitemaps: {
              cwa: {
                sources: ['/__sitemap__/cwa-urls'],
                chunks: true,
              },
            },
          },
        },
        'nuxt-link-checker': {
          version: '^6.0',
        },
        'nuxt-og-image': {
          version: '^7.0',
        },
        'nuxt-schema-org': {
          version: '^7.0',
        },
        'nuxt-seo-utils': {
          version: '^9.0',
        },
        'nuxt-site-config': {
          version: '^5.0.1',
        },
      })
    })

    test('the sitemap options are defaults, so an app can still choose its own server-side cache', async () => {
      await import('./module')

      const [{ moduleDependencies }] = moduleDefinitionCall
      const sitemap = (await moduleDependencies({ options: { modulesDir: ['/app/node_modules'] } }))['@nuxtjs/sitemap']

      expect(sitemap.defaults).toEqual({
        cacheMaxAgeSeconds: 0,
        sitemaps: {
          cwa: {
            sources: ['/__sitemap__/cwa-urls'],
            chunks: true,
          },
        },
      })
      expect(sitemap.overrides).toBeUndefined()
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

    test('holds page:loading:end from a plugin that runs in the browser only, after the cwa plugin (#396)', async () => {
      ;(nuxtKit.addPlugin as Mock).mockClear()
      await prepareMockNuxt({}, {
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
        },
      })
      const sources = (nuxtKit.addPlugin as Mock).mock.calls.map(([plugin]) => plugin.src)
      expect(nuxtKit.addPlugin as Mock).toHaveBeenCalledWith({ src: join('./runtime/plugin-page-loading.client'), mode: 'client' })
      expect(sources.indexOf(join('./runtime/plugin-page-loading.client'))).toBeGreaterThan(sources.indexOf(join('./runtime/plugin')))
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

      const { getContents } = (nuxtKit.addTemplate as Mock).mock.calls
        .map(([template]) => template)
        .findLast(({ filename }) => filename === 'cwa-options.ts')

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

    describe('component names constant (#352)', () => {
      const components = [
        { filePath: 'cwa/components/HtmlContent/HtmlContent.vue', pascalName: 'CwaComponentHtmlContent' },
        { filePath: 'cwa/components/HtmlContent/admin/Tab.vue', pascalName: 'CwaComponentHtmlContentAdminTab', global: true },
        { filePath: 'cwa/components/HtmlContent/ui/AltUi.vue', pascalName: 'CwaComponentHtmlContentUiAltUi', global: true },
        { filePath: 'cwa/components/WatchPastConference/WatchPastConference.vue', pascalName: 'CwaComponentWatchPastConference' },
        { filePath: 'cwa/components/WatchPastConference/ConferenceCard.vue', pascalName: 'CwaComponentWatchPastConferenceConferenceCard' },
        { filePath: 'cwa/layouts/Primary.vue', pascalName: 'CwaLayoutPrimary' },
      ]

      async function prepare() {
        const mockNuxt = await prepareMockNuxt({}, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'modules:done') {
              callback()
            }
          }),
        })
        const template = (nuxtKit.addTemplate as Mock).mock.calls
          .map(([template]) => template)
          .find(({ filename }) => filename === 'cwa-component-names.ts')
        return { mockNuxt, template }
      }

      test('generates a constant and a union type from each <Name>/<Name>.vue only', async () => {
        const { template } = await prepare()

        expect(template).toBeDefined()
        expect(template.write).toBe(true)
        expect(await template.getContents({ app: { components } })).toEqual(`export const CwaComponentNames = {
  "HtmlContent": "HtmlContent",
  "WatchPastConference": "WatchPastConference"
} as const
export type CwaComponentName = typeof CwaComponentNames[keyof typeof CwaComponentNames]
`)
      })

      test('auto-imports the constant and the type from the generated template', async () => {
        await prepare()

        expect(nuxtKit.addImports as Mock).toHaveBeenCalledWith([
          { name: 'CwaComponentNames', from: '#build/cwa-component-names' },
          { name: 'CwaComponentName', from: '#build/cwa-component-names', type: true },
        ])
      })

      test('is regenerated when a component folder is added or removed in dev', async () => {
        vi.spyOn(nuxtKit, 'createResolver').mockReturnValue({
          resolve: vi.fn((...args: string[]) => join(...args)),
          resolvePath: vi.fn(),
        })
        let watchCallback: ((event: string, path: string) => Promise<void>) | undefined
        await prepareMockNuxt({}, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'builder:watch') {
              watchCallback = callback
            }
          }),
        })

        await watchCallback!('add', 'cwa/components/NewThing/NewThing.vue')

        const [{ filter }] = (nuxtKit.updateTemplates as Mock).mock.lastCall!
        expect(filter!({ filename: 'cwa-component-names.ts' } as any)).toBe(true)
      })
    })

    describe('admin resources template (#461)', () => {
      const components = [
        { filePath: 'cwa/components/HtmlContent/HtmlContent.vue', pascalName: 'CwaComponentHtmlContent' },
        { filePath: 'cwa/components/Hero/Hero.vue', pascalName: 'CwaComponentHero' },
      ]
      const declarations = {
        components: { HtmlContent: { name: 'Body text', description: 'Text', icon: 'rich-text' as const, group: 'Text', image: '/body.webp' } },
        ui: {},
        layouts: {},
        pages: {},
      }

      afterEach(() => {
        vi.mocked(scanCwaConfigDeclarations).mockReset()
        vi.mocked(scanCwaConfigDeclarations).mockImplementation(() => ({ components: {}, ui: {}, layouts: {}, pages: {} }))
      })

      async function prepare() {
        await prepareMockNuxt({}, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'modules:done') {
              callback()
            }
          }),
        })
        const templates = (nuxtKit.addTemplate as Mock).mock.calls.map(([template]) => template)
        return {
          admin: templates.find(({ filename }) => filename === 'cwa-admin-resources.ts'),
          config: templates.find(({ filename }) => filename === 'cwa-config.ts'),
        }
      }

      test('holds the description, icon, group and image a component declares in defineCwaConfig, and the resources config never does', async () => {
        vi.mocked(scanCwaConfigDeclarations).mockReturnValue(declarations)
        const { admin, config } = await prepare()

        expect(admin.write).toBe(true)
        const adminSource = await admin.getContents({ app: { components } })
        expect(adminSource).toContain('"HtmlContent": { icon: "lucide:letter-text", group: "Text", description: "Text", descriptionHtml: "<p>Text</p>", image: "/body.webp" }')
        expect(adminSource).toContain('data-cwa-admin-icon')
        expect(adminSource).toContain('"Form": { description: "A form from the API, shown as a list of its text fields unless a UI variant lays it out.", descriptionHtml: "<p>A form from the API, shown as a list of its text fields unless a UI variant lays it out.</p>" }')
        expect(adminSource).toMatch(/"ComponentPosition": \{ description: "Dynamic components [^"<]+ below\.", descriptionHtml: "<p>Dynamic components [^"]+<\/p><p>You must [^"]+<\/p>" \}/)

        const configSource = await config.getContents({ app: { components } })
        expect(configSource).toContain('"name": "Body text"')
        expect(configSource).not.toContain('"description"')
        expect(configSource).not.toContain('"icon"')
        expect(configSource).not.toContain('"group"')
        expect(configSource).not.toContain('/body.webp')
      })

      test('imports a component folder\'s preview.webp when no image is configured', async () => {
        const fs = await import('node:fs')
        vi.mocked(fs.statSync).mockImplementation(((file: string) => ({
          isDirectory: () => !file.endsWith('.webp'),
          isFile: () => file.endsWith(join('Hero', 'preview.webp')),
        })) as any)
        const { admin } = await prepare()

        const adminSource = await admin.getContents({ app: { components } })
        vi.mocked(fs.statSync).mockImplementation((() => ({ isDirectory: () => true })) as any)

        expect(adminSource).toContain(`import preview0 from ${JSON.stringify(join('cwa/components/Hero', 'preview.webp'))}`)
        expect(adminSource).toContain('"Hero": { image: preview0 }')
        expect(adminSource).not.toContain(join('HtmlContent', 'preview.webp'))
      })

      test('inlines a component folder\'s icon.svg when no icon is configured', async () => {
        const fs = await import('node:fs')
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
        const iconFile = join('cwa/components/Hero', 'icon.svg')
        vi.mocked(fs.statSync).mockImplementation(((file: string) => ({
          isDirectory: () => !file.endsWith('.svg') && !file.endsWith('.webp'),
          isFile: () => file.endsWith(iconFile),
        })) as any)
        vi.mocked(fs.readFileSync).mockImplementation(((file: string, encoding: BufferEncoding) => file.endsWith('@iconify-json/lucide/icons.json')
          ? actual.readFileSync(file, encoding)
          : file.endsWith(iconFile) ? '<svg viewBox="0 0 10 10"><path d="M0 0h10"/></svg>' : '{ "name": "@cwa/nuxt", "version": "1.0.0" }') as any)
        const { admin } = await prepare()

        const adminSource = await admin.getContents({ app: { components } })
        vi.mocked(fs.statSync).mockImplementation((() => ({ isDirectory: () => true })) as any)
        vi.mocked(fs.readFileSync).mockImplementation(((file: string, encoding: BufferEncoding) => file.endsWith('@iconify-json/lucide/icons.json') ? actual.readFileSync(file, encoding) : '{ "name": "@cwa/nuxt", "version": "1.0.0" }') as any)

        expect(adminSource).toContain('"Hero": { icon: "file:Hero" }')
        expect(adminSource).toContain('<path d=\\"M0 0h10\\"/>')
        expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringMatching(/cwa\/components\/Hero\/icon\.svg$/), 'utf8')
      })

      test('generates the Lucide icon names as a type for the app and its nuxt.config', async () => {
        await prepare()

        const call = (nuxtKit.addTypeTemplate as Mock).mock.calls.find(([{ filename }]) => filename === 'types/cwa-lucide-icons.d.ts')
        expect(call![1]).toEqual({ nuxt: true, node: true })
        expect(call![0].write).toBe(true)
        expect(await call![0].getContents()).toContain('"map-pin": true')
      })

      test('is regenerated when a file is added to or removed from a component folder in dev', async () => {
        vi.spyOn(nuxtKit, 'createResolver').mockReturnValue({
          resolve: vi.fn((...args: string[]) => join(...args)),
          resolvePath: vi.fn(),
        })
        let watchCallback: ((event: string, path: string) => Promise<void>) | undefined
        await prepareMockNuxt({}, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'builder:watch') {
              watchCallback = callback
            }
          }),
        })

        await watchCallback!('add', 'cwa/components/Hero/preview.webp')

        const [{ filter }] = (nuxtKit.updateTemplates as Mock).mock.lastCall!
        expect(filter!({ filename: 'cwa-admin-resources.ts' } as any)).toBe(true)
      })

      test('is regenerated when an SVG in a component folder changes in dev, and nothing else is', async () => {
        vi.spyOn(nuxtKit, 'createResolver').mockReturnValue({
          resolve: vi.fn((...args: string[]) => join(...args)),
          resolvePath: vi.fn(),
        })
        let watchCallback: ((event: string, path: string) => Promise<void>) | undefined
        await prepareMockNuxt({}, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'builder:watch') {
              watchCallback = callback
            }
          }),
        })
        ;(nuxtKit.updateTemplates as Mock).mockClear()

        await watchCallback!('change', 'cwa/components/Hero/icon.svg')

        const [{ filter }] = (nuxtKit.updateTemplates as Mock).mock.lastCall!
        expect(filter!({ filename: 'cwa-admin-resources.ts' } as any)).toBe(true)
        expect(filter!({ filename: 'cwa-options.ts' } as any)).toBe(false)

        ;(nuxtKit.updateTemplates as Mock).mockClear()
        await watchCallback!('change', 'assets/logo.svg')
        expect(nuxtKit.updateTemplates).not.toHaveBeenCalled()
      })
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

      test('registers the sitemap cache plugin whether or not the page cache is enabled', async () => {
        const sitemapPlugin = expect.stringMatching(/runtime\/server\/sitemap-cache-plugin$/)

        ;(nuxtKit.addServerPlugin as Mock).mockClear()
        await prepare()
        expect(nuxtKit.addServerPlugin as Mock).toHaveBeenCalledWith(sitemapPlugin)

        ;(nuxtKit.addServerPlugin as Mock).mockClear()
        await prepare({ pageCache: { enabled: false } })
        expect(nuxtKit.addServerPlugin as Mock).toHaveBeenCalledWith(sitemapPlugin)
        expect(nuxtKit.addServerPlugin as Mock).not.toHaveBeenCalledWith(expect.stringMatching(/runtime\/server\/page-cache-plugin$/))
      })

      test('passes the sitemap cache settings to the server options the nitro plugin reads', async () => {
        await prepare({ sitemapCache: { sharedMaxAge: 60 } })

        const { lastCall: [{ getContents }] } = (nuxtKit.addServerTemplate as Mock).mock

        expect(JSON.parse(getContents().split('export const options = ')[1]).sitemapCache).toEqual({ sharedMaxAge: 60 })
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

    describe('component group declarations (#360)', () => {
      const components = [
        { filePath: 'cwa/components/HeroSection/HeroSection.vue', pascalName: 'CwaComponentHeroSection' },
        { filePath: 'cwa/components/HeroSection/ui/Wide.vue', pascalName: 'CwaComponentHeroSectionUiWide' },
        { filePath: 'cwa/components/HeroSection/admin/Tab.vue', pascalName: 'CwaComponentHeroSectionAdminTab' },
        { filePath: 'cwa/components/HeroSection/Helper.vue', pascalName: 'CwaComponentHeroSectionHelper' },
        { filePath: 'cwa/layouts/primary.vue', pascalName: 'CwaLayoutPrimary' },
        { filePath: 'cwa/pages/PrimaryPageTemplate.vue', pascalName: 'CwaPagePrimaryPageTemplate' },
        { filePath: 'cwa/pages/admin/PageTab.vue', pascalName: 'CwaPageAdminPageTab' },
        { filePath: 'components/HeaderMenuLinks.vue', pascalName: 'HeaderMenuLinks' },
      ]

      async function prepare(alias: Record<string, string> = {}) {
        await prepareMockNuxt({}, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'modules:done') {
              callback()
            }
          }),
          options: { srcDir: 'app', sitemap: {}, runtimeConfig: { public: { cwa: {} } }, alias, css: [], build: { transpile: [] }, dir: { app: '' } },
        })
        return (nuxtKit.addTemplate as Mock).mock.calls
          .map(([template]) => template)
          .filter(({ filename }) => filename === 'cwa-component-group-declarations.ts')
          .at(-1)
      }

      test('writes the scanned declarations to a typed template', async () => {
        vi.mocked(scanComponentGroupDeclarations).mockReturnValueOnce({ CwaLayoutPrimary: [{ reference: 'top', location: 'layout' }] })
        const template = await prepare()

        expect(template.write).toBe(true)
        expect(await template.getContents({ app: { components } })).toEqual(`import type { ComponentGroupDeclarations } from '#cwa/admin/stranded-component-groups'
export const componentGroupDeclarations: ComponentGroupDeclarations = {
  "CwaLayoutPrimary": [
    {
      "reference": "top",
      "location": "layout"
    }
  ]
}
`)
      })

      test('scans the CWA layouts, pages, components and their ui variants as templates, through every registered component', async () => {
        const template = await prepare()
        await template.getContents({ app: { components } })

        const [scanOptions] = vi.mocked(scanComponentGroupDeclarations).mock.lastCall!
        expect(scanOptions.templates.map(({ pascalName }) => pascalName)).toEqual([
          'CwaComponentHeroSection',
          'CwaComponentHeroSectionUiWide',
          'CwaLayoutPrimary',
          'CwaPagePrimaryPageTemplate',
        ])
        expect(scanOptions.components).toBe(components)
        expect(scanOptions.componentGroupFile).toMatch(/runtime\/templates\/components\/main\/ComponentGroup\.vue$/)
      })

      test('resolves aliased and relative imports, and nothing else', async () => {
        const template = await prepare({ '~': '/site/app' })
        await template.getContents({ app: { components } })

        const [{ resolveImport }] = vi.mocked(scanComponentGroupDeclarations).mock.lastCall!
        expect(resolveImport('~/layouts/static.vue', '/site/app/cwa/layouts/primary.vue')).toBe('/site/app/layouts/static.vue')
        expect(resolveImport('../../../components/Editor.vue', '/site/app/cwa/components/Html/Html.vue')).toBe('/site/app/components/Editor.vue')
        expect(resolveImport('lightgallery/vue', '/site/app/cwa/components/Gallery/Gallery.vue')).toBeUndefined()
      })

      test('warns once per file and reason that switches stranded-group reporting off, naming both (#367)', async () => {
        const logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn(), success: vi.fn() }
        vi.spyOn(nuxtKit, 'useLogger').mockReturnValue(logger as any)
        vi.mocked(scanComponentGroupDeclarations).mockImplementation(({ onUncheckable }) => {
          onUncheckable?.('/site/app/components/GroupWrapper.vue', 'binds reference at a location that cannot be classified')
          return {}
        })
        const template = await prepare()
        await template.getContents({ app: { components } })
        await template.getContents({ app: { components } })

        const warnings = logger.warn.mock.calls.map(([message]) => message).filter(message => message.includes('GroupWrapper.vue'))
        expect(warnings).toHaveLength(1)
        expect(warnings[0]).toContain('stranded component group')
        expect(warnings[0]).toContain('binds reference at a location that cannot be classified')
        vi.mocked(scanComponentGroupDeclarations).mockImplementation(() => ({}))
      })

      test('is not auto-imported', async () => {
        await prepare()

        const imported = vi.mocked(nuxtKit.addImports).mock.calls.flatMap(([imports]) => [imports].flat())
        expect(imported.some(({ from }) => from === '#build/cwa-component-group-declarations')).toBe(false)
      })

      test('is regenerated when any Vue file is added, changed or removed in dev, and only then', async () => {
        vi.spyOn(nuxtKit, 'createResolver').mockReturnValue({
          resolve: vi.fn((...args: string[]) => join(...args)),
          resolvePath: vi.fn(),
        })
        let watchCallback: ((event: string, path: string) => Promise<void>) | undefined
        await prepareMockNuxt({}, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'builder:watch') {
              watchCallback = callback
            }
          }),
        })
        const regenerates = async (event: string, path: string) => {
          vi.mocked(nuxtKit.updateTemplates).mockClear()
          await watchCallback!(event, path)
          const call = vi.mocked(nuxtKit.updateTemplates).mock.lastCall
          return !!call?.[0]?.filter?.({ filename: 'cwa-component-group-declarations.ts' } as any)
        }

        expect(await regenerates('change', 'components/HeaderMenuLinks.vue')).toBe(true)
        expect(await regenerates('add', 'layouts/static.vue')).toBe(true)
        expect(await regenerates('unlink', 'cwa/components/Hero/Hero.vue')).toBe(true)
        expect(await regenerates('change', 'composables/useThing.ts')).toBe(false)
        expect(await regenerates('addDir', 'components/new')).toBe(false)
      })

      test('a changed Vue file outside the CWA components does not regenerate the other CWA templates', async () => {
        vi.spyOn(nuxtKit, 'createResolver').mockReturnValue({
          resolve: vi.fn((...args: string[]) => join(...args)),
          resolvePath: vi.fn(),
        })
        let watchCallback: ((event: string, path: string) => Promise<void>) | undefined
        await prepareMockNuxt({}, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'builder:watch') {
              watchCallback = callback
            }
          }),
        })
        vi.mocked(nuxtKit.updateTemplates).mockClear()

        await watchCallback!('change', 'cwa/components/Hero/Hero.vue')

        const [{ filter }] = vi.mocked(nuxtKit.updateTemplates).mock.lastCall!
        expect(filter!({ filename: 'cwa-options.ts' } as any)).toBe(false)
        expect(filter!({ filename: 'cwa-component-names.ts' } as any)).toBe(false)
      })
    })

    describe('SFC config from defineCwaConfig (#453)', () => {
      const components = [
        { filePath: 'cwa/components/HtmlContent/HtmlContent.vue', pascalName: 'CwaComponentHtmlContent' },
        { filePath: 'cwa/components/HtmlContent/admin/GlobalTab.vue', pascalName: 'CwaComponentHtmlContentAdminGlobalTab', global: true },
        { filePath: 'cwa/components/HtmlContent/ui/AltUi.vue', pascalName: 'CwaComponentHtmlContentUiAltUi', global: true },
        { filePath: 'cwa/components/Image/Image.vue', pascalName: 'CwaComponentImage' },
        { filePath: 'cwa/layouts/primary.vue', pascalName: 'CwaLayoutPrimary' },
        { filePath: 'cwa/pages/PrimaryPageTemplate.vue', pascalName: 'CwaPagePrimaryPageTemplate' },
        { filePath: 'cwa/pages/admin/PageTab.vue', pascalName: 'CwaPageAdminPageTab' },
        { filePath: 'components/HeaderMenuLinks.vue', pascalName: 'HeaderMenuLinks' },
      ]

      const declarations = {
        components: {
          HtmlContent: {
            name: 'Body Text',
            description: '<p>Rich text</p>',
            defaultData: { html: '<p>New</p>' },
            allowMultiple: true,
            styles: { 'black-bg': { label: 'Black Background', classes: 'bg-black' } },
          },
        },
        ui: {
          CwaComponentHtmlContentUiAltUi: { styles: { tall: { label: 'Tall', classes: 'h-screen' } } },
        },
        layouts: {
          Primary: { name: 'Primary Layout', styles: { blue: { label: 'Blue', classes: 'bg-blue-600' } } },
        },
        pages: {
          PrimaryPageTemplate: { name: 'Primary Page' },
        },
      }

      async function prepare() {
        await prepareMockNuxt({}, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'modules:done') {
              callback()
            }
          }),
        })
        const templates = (nuxtKit.addTemplate as Mock).mock.calls.map(([template]) => template)
        return (filename: string) => templates.findLast(template => template.filename === filename)
      }

      afterEach(() => {
        vi.mocked(scanCwaConfigDeclarations).mockReset()
        vi.mocked(scanCwaConfigDeclarations).mockImplementation(() => ({ components: {}, ui: {}, layouts: {}, pages: {} }))
      })

      test('the generated resources config combines the SFC config with the automatic name and the managerTabs and ui found in the folders', async () => {
        vi.mocked(scanCwaConfigDeclarations).mockReturnValue(declarations)
        const template = (await prepare())('cwa-config.ts')

        expect(template.write).toBe(true)
        expect(await template.getContents({ app: { components } })).toEqual(`import type { CwaResourcesMeta, CwaTemplateConfig, CwaUiVariantConfig } from '#cwa/types'
export const resourcesConfig: CwaResourcesMeta = {
  "ComponentPosition": {
    "name": "Position",
    "instantAdd": true
  },
  "ComponentGroup": {
    "name": "Group"
  },
  "Form": {
    "name": "Form",
    "managerTabs": [],
    "ui": []
  },
  "HtmlContent": {
    "name": "Body Text",
    "managerTabs": [
      "CwaComponentHtmlContentAdminGlobalTab"
    ],
    "ui": [
      "CwaComponentHtmlContentUiAltUi"
    ],
    "defaultData": {
      "html": "<p>New</p>"
    },
    "allowMultiple": true,
    "styles": {
      "black-bg": {
        "label": "Black Background",
        "classes": "bg-black"
      }
    }
  },
  "Image": {
    "name": "Image",
    "managerTabs": [],
    "ui": []
  }
}
export const uiConfig: Record<string, CwaUiVariantConfig> = {
  "CwaComponentHtmlContentUiAltUi": {
    "styles": {
      "tall": {
        "label": "Tall",
        "classes": "h-screen"
      }
    }
  }
}
export const layoutsConfig: Record<string, CwaTemplateConfig> = {
  "Primary": {
    "name": "Primary Layout",
    "styles": {
      "blue": {
        "label": "Blue",
        "classes": "bg-blue-600"
      }
    }
  }
}
export const pagesConfig: Record<string, CwaTemplateConfig> = {
  "PrimaryPageTemplate": {
    "name": "Primary Page"
  }
}
`)
      })

      test('scans the CWA layouts, pages, components and their ui variants', async () => {
        const template = (await prepare())('cwa-config.ts')
        await template.getContents({ app: { components } })

        const [scanOptions] = vi.mocked(scanCwaConfigDeclarations).mock.lastCall!
        expect(scanOptions.templates.map(({ pascalName }) => pascalName)).toEqual([
          'CwaComponentHtmlContent',
          'CwaComponentHtmlContentUiAltUi',
          'CwaComponentImage',
          'CwaLayoutPrimary',
          'CwaPagePrimaryPageTemplate',
        ])
      })

      test('styles go into their own template, keyed by the component that renders them, without names, descriptions or default data', async () => {
        vi.mocked(scanCwaConfigDeclarations).mockReturnValue(declarations)
        const template = (await prepare())('cwa-styles.ts')

        expect(template.write).toBe(true)
        expect(await template.getContents({ app: { components } })).toEqual(`import type { CwaStyleClasses } from '#cwa/types'
export const styleClasses: CwaStyleClasses = {
  "CwaComponentHtmlContent": {
    "black-bg": "bg-black"
  },
  "CwaComponentHtmlContentUiAltUi": {
    "tall": "h-screen"
  },
  "CwaLayoutPrimary": {
    "blue": "bg-blue-600"
  }
}
`)
      })

      test('the module options template no longer carries resources, layouts or pages', async () => {
        vi.mocked(scanCwaConfigDeclarations).mockReturnValue(declarations)
        const template = (await prepare())('cwa-options.ts')

        const contents = await template.getContents({ app: { components } })
        expect(contents).not.toContain('Rich text')
        expect(contents).not.toContain('"resources"')
      })

      test('warns once per file and reason that its config is ignored, naming both', async () => {
        const logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn(), success: vi.fn() }
        vi.spyOn(nuxtKit, 'useLogger').mockReturnValue(logger as any)
        vi.mocked(scanCwaConfigDeclarations).mockImplementation(({ onUncheckable }) => {
          onUncheckable?.('/site/app/cwa/components/Hero/Hero.vue', 'uses a spread in defineCwaConfig')
          return { components: {}, ui: {}, layouts: {}, pages: {} }
        })
        const find = await prepare()
        await find('cwa-config.ts').getContents({ app: { components } })
        await find('cwa-styles.ts').getContents({ app: { components } })

        const warnings = logger.warn.mock.calls.map(([message]) => message).filter(message => message.includes('Hero.vue'))
        expect(warnings).toHaveLength(1)
        expect(warnings[0]).toContain('uses a spread in defineCwaConfig')
        expect(warnings[0]).toContain('is ignored')
      })

      test('editing a .vue under app/cwa in dev regenerates the config, styles and admin resources, and nothing else does', async () => {
        vi.spyOn(nuxtKit, 'createResolver').mockReturnValue({
          resolve: vi.fn((...args: string[]) => join(...args)),
          resolvePath: vi.fn(),
        })
        let watchCallback: ((event: string, path: string) => Promise<void>) | undefined
        await prepareMockNuxt({}, {
          hook: vi.fn((hookName, callback) => {
            if (hookName === 'builder:watch') {
              watchCallback = callback
            }
          }),
        })
        const regenerates = async (event: string, path: string) => {
          vi.mocked(nuxtKit.updateTemplates).mockClear()
          await watchCallback!(event, path)
          const call = vi.mocked(nuxtKit.updateTemplates).mock.lastCall
          return ['cwa-config.ts', 'cwa-styles.ts', 'cwa-admin-resources.ts'].map(filename => !!call?.[0]?.filter?.({ filename } as any))
        }

        expect(await regenerates('change', 'cwa/components/Hero/Hero.vue')).toEqual([true, true, true])
        expect(await regenerates('change', 'cwa/layouts/primary.vue')).toEqual([true, true, true])
        expect(await regenerates('add', 'cwa/pages/Landing.vue')).toEqual([true, true, true])
        expect(await regenerates('unlink', 'cwa/components/Hero/admin/Tab.vue')).toEqual([true, true, true])
        expect(await regenerates('change', 'components/HeaderMenuLinks.vue')).toEqual([false, false, false])
        expect(await regenerates('change', 'cwa/components/Hero/useHero.ts')).toEqual([false, false, false])
      })

      function generated(contents: string) {
        return Object.fromEntries([...contents.matchAll(/^export const (\w+): [^=]+ = (.*?)(?=^export |(?![\s\S]))/gms)]
          .map(([, name, json]) => [name, JSON.parse(json!)]))
      }

      async function generate(templateComponents: { filePath: string, pascalName: string, global?: boolean }[]) {
        const find = await prepare()
        return {
          ...generated(await find('cwa-config.ts').getContents({ app: { components: templateComponents } })),
          ...generated(await find('cwa-styles.ts').getContents({ app: { components: templateComponents } })),
        }
      }

      describe('UI variant styles', () => {
        const heroComponents = [
          { filePath: 'cwa/components/Hero/Hero.vue', pascalName: 'CwaComponentHero' },
          { filePath: 'cwa/components/Hero/ui/Plain.vue', pascalName: 'CwaComponentHeroUiPlain', global: true },
          { filePath: 'cwa/components/Hero/ui/Unconfigured.vue', pascalName: 'CwaComponentHeroUiUnconfigured', global: true },
          { filePath: 'cwa/components/Hero/ui/Tall.vue', pascalName: 'CwaComponentHeroUiTall', global: true },
        ]
        const heroStyles = {
          bordered: { label: 'Bordered', classes: 'border' },
          rounded: { label: 'Rounded', classes: 'rounded' },
        }

        beforeEach(() => {
          vi.mocked(scanCwaConfigDeclarations).mockReturnValue({
            components: { Hero: { name: 'Hero', allowMultiple: true, styles: heroStyles } },
            ui: {
              CwaComponentHeroUiPlain: { name: 'Plain hero' },
              CwaComponentHeroUiTall: { name: 'Tall hero', styles: { tall: { label: 'Tall', classes: 'h-screen' } } },
            },
            layouts: {},
            pages: {},
          })
        })

        test('a variant without styles offers and renders the primary\'s styles', async () => {
          const { uiConfig, styleClasses } = await generate(heroComponents)

          expect(uiConfig.CwaComponentHeroUiPlain).toEqual({ name: 'Plain hero', allowMultiple: true, styles: heroStyles })
          expect(uiConfig.CwaComponentHeroUiUnconfigured).toEqual({ allowMultiple: true, styles: heroStyles })
          expect(styleClasses.CwaComponentHeroUiPlain).toEqual({ bordered: 'border', rounded: 'rounded' })
          expect(styleClasses.CwaComponentHeroUiUnconfigured).toEqual({ bordered: 'border', rounded: 'rounded' })
        })

        test('a variant with styles offers only its own', async () => {
          const { uiConfig, styleClasses } = await generate(heroComponents)

          expect(uiConfig.CwaComponentHeroUiTall).toEqual({ name: 'Tall hero', styles: { tall: { label: 'Tall', classes: 'h-screen' } } })
          expect(styleClasses.CwaComponentHeroUiTall).toEqual({ tall: 'h-screen' })
        })
      })

      describe('the Form type and its parts', () => {
        const appVariants = [
          { filePath: 'cwa/components/Form/ui/ExampleForm.vue', pascalName: 'CwaComponentFormUiExampleForm', global: true },
          { filePath: 'cwa/components/Form/_parts/FormChildEntry.vue', pascalName: 'CwaComponentFormPartsFormChildEntry', global: true },
        ]
        const appForm = { filePath: 'cwa/components/Form/Form.vue', pascalName: 'CwaComponentForm', global: true }

        async function extendComponents(scanned: { pascalName: string, filePath: string }[]) {
          let extend: ((components: any[]) => void) | undefined
          await prepareMockNuxt({}, {
            hook: vi.fn((hookName, callback) => {
              if (hookName === 'components:extend') {
                extend = callback
              }
            }),
          })
          const components = [...scanned]
          extend!(components)
          return components.filter(({ pascalName }) => pascalName === 'CwaComponentForm')
        }

        describe('with no app Form/Form.vue', () => {
          test('the Form type has the module\'s config and resolves to the module\'s renderer', async () => {
            const { resourcesConfig } = await generate([])
            expect(resourcesConfig.Form).toEqual({
              name: 'Form',
              managerTabs: [],
              ui: [],
            })

            const forms = await extendComponents([])
            expect(forms).toHaveLength(1)
            expect(forms[0]).toMatchObject({ global: true, export: 'default', kebabName: 'cwa-component-form' })
            expect(forms[0].filePath).toMatch(/runtime\/templates\/components\/resources\/Form\/Form\.vue$/)
          })

          test('an app\'s Form/ui/X.vue is offered as a Form variant', async () => {
            const { resourcesConfig, uiConfig } = await generate(appVariants)

            expect(resourcesConfig.Form.ui).toEqual(['CwaComponentFormUiExampleForm'])
            expect(resourcesConfig.Form.name).toBe('Form')
            expect(Object.keys(uiConfig)).toEqual(['CwaComponentFormUiExampleForm'])
          })
        })

        test('an app\'s own Form/Form.vue overrides the module\'s config and renderer', async () => {
          vi.mocked(scanCwaConfigDeclarations).mockReturnValue({
            components: { Form: { name: 'Enquiry' } },
            ui: {},
            layouts: {},
            pages: {},
          })
          const { resourcesConfig } = await generate([appForm, ...appVariants])
          expect(resourcesConfig.Form).toEqual({
            name: 'Enquiry',
            managerTabs: [],
            ui: ['CwaComponentFormUiExampleForm'],
          })

          expect(await extendComponents([appForm])).toEqual([appForm])
        })

        test('a _parts/ SFC is never offered as a variant', async () => {
          const { resourcesConfig, uiConfig } = await generate([
            appForm,
            ...appVariants,
            { filePath: 'cwa/components/Form/ui/_parts/Label.vue', pascalName: 'CwaComponentFormUiPartsLabel', global: true },
          ])

          expect(Object.keys(resourcesConfig)).toEqual(['ComponentPosition', 'ComponentGroup', 'Form'])
          expect(resourcesConfig.Form.ui).toEqual(['CwaComponentFormUiExampleForm'])
          expect(Object.keys(uiConfig)).toEqual(['CwaComponentFormUiExampleForm'])
        })
      })

      test('warns once per file naming the keys its kind does not allow', async () => {
        const logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn(), success: vi.fn() }
        vi.spyOn(nuxtKit, 'useLogger').mockReturnValue(logger as any)
        vi.mocked(scanCwaConfigDeclarations).mockImplementation(({ onIgnoredKeys }) => {
          onIgnoredKeys?.('/site/app/cwa/components/Hero/ui/Wide.vue', ['description', 'instantAdd'])
          return { components: {}, ui: {}, layouts: {}, pages: {} }
        })
        const find = await prepare()
        await find('cwa-config.ts').getContents({ app: { components } })
        await find('cwa-styles.ts').getContents({ app: { components } })

        const warnings = logger.warn.mock.calls.map(([message]) => message).filter(message => message.includes('Wide.vue'))
        expect(warnings).toHaveLength(1)
        expect(warnings[0]).toContain('description')
        expect(warnings[0]).toContain('instantAdd')
        expect(warnings[0]).toContain('ignored')
      })

      describe('a defineCwaConfig call the scanner does not read', () => {
        async function callSites() {
          const logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn(), success: vi.fn() }
          vi.spyOn(nuxtKit, 'useLogger').mockReturnValue(logger as any)
          await prepare()
          const plugin = vi.mocked(nuxtKit.addVitePlugin).mock.calls
            .map(([registered]) => registered as any)
            .findLast(registered => registered?.name === 'cwa:define-cwa-config-call-sites')
          const transform = (code: string, id: string) => plugin.transform(code, id)
          const warnings = () => logger.warn.mock.calls.map(([message]) => message as string).filter(message => message.includes('defineCwaConfig'))
          return { plugin, transform, warnings }
        }
        const call = `<script setup lang="ts">\ndefineCwaConfig({ name: 'Hero' })\n</script>\n`

        test('a call in a file outside the scanned folders warns once naming the file', async () => {
          const { plugin, transform, warnings } = await callSites()
          expect(plugin.enforce).toBe('pre')

          transform(call, 'components/HeaderMenuLinks.vue')
          transform(call, 'components/HeaderMenuLinks.vue?vue&type=script&setup=true&lang.ts')
          transform(`defineCwaConfig({ name: 'Hero' })`, 'cwa/components/Hero/useHero.ts')

          expect(warnings()).toHaveLength(2)
          expect(warnings()[0]).toContain('components/HeaderMenuLinks.vue')
          expect(warnings()[0]).toContain('has no effect')
          expect(warnings()[1]).toContain('cwa/components/Hero/useHero.ts')
        })

        test('a call in a scanned file does not warn', async () => {
          const { transform, warnings } = await callSites()

          transform(call, 'cwa/components/Hero/Hero.vue')
          transform(call, 'cwa/components/Hero/ui/Wide.vue')
          transform(call, 'cwa/layouts/primary.vue')
          transform(call, 'cwa/pages/PrimaryPageTemplate.vue')
          transform(`<script setup lang="ts">\nconst props = defineProps()\n</script>\n`, 'components/HeaderMenuLinks.vue')

          expect(warnings()).toEqual([])
        })
      })

      test('auto-imports neither generated template', async () => {
        await prepare()

        const imported = vi.mocked(nuxtKit.addImports).mock.calls.flatMap(([imports]) => [imports].flat())
        expect(imported.some(({ from }) => ['#build/cwa-config', '#build/cwa-styles'].includes(from))).toBe(false)
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
      const [{ moduleDependencies }] = moduleDefinitionCall
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

      expect(dependencies['nuxt-og-image']).toEqual({ version: '^7.0' })
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
      expect(nuxtKit.addImports).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'defineOgImage' }))
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
