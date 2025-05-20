import { join } from 'path'
import { describe, expect, type Mock, test, vi } from 'vitest'
import * as nuxtKit from '@nuxt/kit'

vi.mock('@nuxt/kit', async () => {
  const actual = await vi.importActual<typeof nuxtKit>('@nuxt/kit')

  const newModule = {
    ...actual,
    addPlugin: vi.fn(),
    addImportsDir: vi.fn(),
    addTemplate: vi.fn(),
    addTypeTemplate: vi.fn(),
    extendPages: vi.fn(),
    defineNuxtModule: vi.fn(),
    installModule: vi.fn(),
    createResolver: vi.fn().mockReturnValue({ resolvePath: vi.fn(), resolve: vi.fn(function (...args) { return join(...args) }) }),
  }

  return {
    ...newModule,
    default: newModule,
  }
})

vi.mock('node:fs', () => {
  return {
    default: {
      statSync: vi.fn(() => ({
        isDirectory: vi.fn(() => true),
      })),
      readFileSync: vi.fn(() => ('{ "name": "@cwa/nuxt", "version": "1.0.0" }')),
    },
  }
})

async function prepareMockNuxt(options = {}, nuxt?: any) {
  await import('./module')

  const [{ setup }] = (nuxtKit.defineNuxtModule as Mock).mock.lastCall

  const mockNuxt = Object.assign({ hook: vi.fn(), options: { runtimeConfig: { public: { cwa: {} } }, alias: {}, css: [], build: { transpile: [] }, srcDir: '' } }, nuxt || {})

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
        compatibility: { nuxt: '^3.6.5', bridge: false },
      })
    })

    test('should be called with correct defaults', async () => {
      await import('./module')

      const [{ defaults }] = (nuxtKit.defineNuxtModule as Mock).mock.lastCall

      expect(defaults).toEqual({
        appName: 'CWA Web App',
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
      })
    })
  })

  describe('setup', () => {
    test('should install additional modules', async () => {
      await prepareMockNuxt()

      expect((nuxtKit.installModule as Mock)).toHaveBeenCalledWith('@pinia/nuxt')
    })

    test('should add aliases with result of resolved paths', async () => {
      const mockNuxt = await prepareMockNuxt()
      const mockResolver = nuxtKit.createResolver.mock.results[0].value.resolve
      expect(mockResolver).toHaveBeenCalledWith('./')
      expect(mockNuxt.options.alias['#cwa']).toEqual(mockResolver('./'))
    })

    test('should add transpile directory', async () => {
      const mockNuxt = await prepareMockNuxt()
      const mockResolver = nuxtKit.createResolver.mock.results[0].value.resolve

      expect(mockResolver).toHaveBeenCalledWith('./runtime')
      expect(mockNuxt.options.build.transpile).toEqual([mockResolver('./runtime')])
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
          srcDir: '',
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

      expect(await getContents({ app: { components } })).toEqual(`import type { CwaModuleOptions } from '#cwa/module';
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
  }
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
            srcDir: './mock',
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
            srcDir: './mock',
          },
        })

        const hookCall = mockNuxt.hook.mock.calls.find(call => call[0] === 'components:dirs')

        expect(hookCall).toBeDefined()
        expect(mockDirs).toContainEqual({
          path: join(mockNuxt.options.srcDir, 'cwa', 'components'),
          prefix: 'CwaComponent',
          global: true,
          ignore: ['**/*.spec.{cts,mts,ts}'],
        })
        expect(mockDirs).toContainEqual({
          path: join(mockNuxt.options.srcDir, 'cwa', 'pages'),
          prefix: 'CwaPage',
          global: true,
          ignore: ['**/*.spec.{cts,mts,ts}'],
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

    test('should extend pages with 3 levels by default', async () => {
      let cb = null
      const mockPages = []
      const mockResolver = vi.fn(path => path)
      vi.spyOn(nuxtKit, 'createResolver').mockReturnValue({
        resolve: mockResolver,
        resolvePath: vi.fn(),
      })
      vi.spyOn(nuxtKit, 'extendPages').mockImplementation((callback) => {
        cb = callback
      })

      await prepareMockNuxt()

      expect(nuxtKit.extendPages).toHaveBeenCalledWith(cb)

      cb(mockPages)

      expect(mockPages).toEqual([
        {
          name: 'cwaPage0',
          path: '/:cwaPage0*',
          meta: { cwa: { disabled: false }, layout: 'cwa-root-layout' },
          file: mockResolver('./runtime/templates'),
          children: [
            {
              name: 'cwaPage1',
              path: ':cwaPage1*',
              meta: { cwa: { disabled: false }, layout: 'cwa-root-layout' },
              file: mockResolver('./runtime/templates'),
              children: [
                {
                  name: 'cwaPage2',
                  path: ':cwaPage2*',
                  meta: { cwa: { disabled: false }, layout: 'cwa-root-layout' },
                  file: mockResolver('./runtime/templates'),
                  children: [
                    {
                      name: 'cwaPage3',
                      path: ':cwaPage3*',
                      meta: { cwa: { disabled: false }, layout: 'cwa-root-layout' },
                      file: mockResolver('./runtime/templates'),
                    },
                  ],
                },
              ],
            },
          ],
        },
      ])
    })
  })
})
