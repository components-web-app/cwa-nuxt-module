import { join } from 'path'
import path from 'node:path'
import { statSync, readFileSync } from 'node:fs'
import mergeWith from 'lodash-es/mergeWith'
import isArray from 'lodash-es/isArray'
import {
  addImportsDir,
  addPlugin,
  addServerHandler,
  addServerTemplate,
  addTemplate,
  addTypeTemplate,
  createResolver,
  defineNuxtModule,
  extendPages,
  installModule,
  resolveAlias,
  updateTemplates,
  useLogger,
  hasNuxtModule,
  extendRouteRules, addServerPlugin,
} from '@nuxt/kit'
import type { Component, NuxtPage } from '@nuxt/schema'
import type { DefineComponent, GlobalComponents } from 'vue'
import { defaultSiteConfig } from './runtime/composables/useCwaSiteConfig'

export type GlobalComponentNames = keyof GlobalComponents

export type ManagerTab = GlobalComponentNames | DefineComponent<object, object, any>
export type ComponentUi = GlobalComponentNames

export interface CwaResourceMeta {
  name?: string
  description?: string
  instantAdd?: boolean
  managerTabs?: ManagerTab[]
  ui?: ComponentUi[]
}

export interface CwaResourcesMeta {
  [type: string]: CwaResourceMeta
}

export interface CwaUiMeta {
  name?: string
  classes?: {
    [name: string]: string[] | string
  }
}

export type SiteConfigParams = {
  indexable: boolean
  robotsAllowNonSeoCrawlers: boolean
  robotsAllowAiBots: boolean
  robotsText: string
  robotsRemoveSitemap: boolean
  sitemapEnabled: boolean
  siteName: string
  fallbackTitle: boolean
  concatTitle: boolean
  maintenanceModeEnabled: boolean
  sitemapXml: string
  canonicalUrl: string
}

export interface CwaModuleOptions {
  storeName: string
  siteConfig: Partial<SiteConfigParams>
  resources: CwaResourcesMeta
  pagesDepth?: number
  layouts?: {
    [type: string]: CwaUiMeta
  }
  pages?: {
    [type: string]: CwaUiMeta
  }
  pageData?: {
    [resourceClass: string]: Pick<CwaUiMeta, 'name'>
  }
  layoutName?: string
}

declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    cwa: {
      apiUrl: string
      apiUrlBrowser: string
    }
  }
}

function createDefaultCwaPages(
  pages: NuxtPage[],
  pageComponentFilePath: string,
  maxDepth: number,
  layout?: string | undefined,
) {
  function getPage(currentDepth: number): NuxtPage {
    return {
      name: `cwaPage${currentDepth}`,
      path: currentDepth === 0 ? '/' : `:cwaPage${currentDepth}`,
      file: pageComponentFilePath,
      meta: {
        cwa: {
          disabled: false,
        },
        layout: layout || 'cwa-root-layout',
      },
      children: [] as NuxtPage[],
    }
  }

  function createTree(currentDepth: number) {
    const page = getPage(currentDepth)
    if (currentDepth < maxDepth) {
      const child = createTree(++currentDepth)
      page.children = [child]
    }
    return page
  }
  // pages.push(getPage(0))
  pages.push(createTree(0))
}

export const NAME = '@cwa/nuxt' as const

export default defineNuxtModule<CwaModuleOptions>({
  meta: {
    name: NAME,
    configKey: 'cwa',
    compatibility: {
      nuxt: '^3.6.5',
      bridge: false,
    },
  },
  defaults: {
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
    siteConfig: defaultSiteConfig,
  },
  async setup(options, nuxt) {
    const logger = useLogger(NAME)
    const { resolve } = createResolver(import.meta.url)

    const { version, name } = JSON.parse(
      readFileSync(resolve('../package.json'), 'utf8'),
    )

    logger.info(`Adding ${NAME} module (${name}@${version})...`)

    // modules
    if (!hasNuxtModule('@pinia/nuxt')) {
      logger.info(`Installing @pinia/nuxt for ${NAME} module...`)
      await installModule('@pinia/nuxt')
    }

    const cwaSitemap = {
      sources: ['/__sitemap__/cwa-urls'],
      chunks: true,
    }

    if (!hasNuxtModule('@nuxtjs/sitemap')) {
      logger.info(`Installing @nuxtjs/sitemap for ${NAME} module...`)

      const initialSitemaps = nuxt.options.sitemap?.sitemaps
      const extendSitemaps = initialSitemaps === true || !initialSitemaps ? {} : initialSitemaps
      const sitemaps = Object.assign({}, extendSitemaps, {
        cwa: cwaSitemap,
      })
      await installModule('@nuxtjs/sitemap', { sitemaps })
    }

    if (!hasNuxtModule('@nuxtjs/seo')) {
      logger.info(`Installing @nuxtjs/seo for ${NAME} module...`)
      await installModule('@nuxtjs/seo')
    }

    // common alias due to releasing different package names
    nuxt.options.alias['#cwa'] = resolve('./')
    // do not server-side render internal routes. Use with client-side auth values
    extendRouteRules('/_cwa/**', { ssr: false, robots: false })

    // transpile runtime
    const runtimeDir = resolve('./runtime')
    nuxt.options.build.transpile.push(runtimeDir)

    logger.info(`Configuring auto-imports for CWA composables...`)
    addImportsDir(resolve('./runtime/composables'))
    addImportsDir(resolve('./runtime/composables/component'))

    logger.info(`Configuring CWA default pages and components...`)
    const vueTemplatesDir = resolve('./runtime/templates')

    extendPages((pages: NuxtPage[]) => {
      const pageComponent = resolve(vueTemplatesDir, 'cwa-page.vue')
      createDefaultCwaPages(pages, pageComponent, options.pagesDepth || 4, options.layoutName)
    })
    const cwaVueComponentsDir = join(vueTemplatesDir, 'components')

    logger.info(`Registering user components for CWA...`)
    const userComponentsPath = join(nuxt.options.srcDir, 'cwa', 'components')
    nuxt.options.alias['#cwaComponents'] = userComponentsPath

    function extendCwaOptions(components: Component[]) {
      const defaultResourcesConfig: CwaResourcesMeta = {}

      // exclude files within admin and ui folders which will not need a configuration
      const regex = /^(?!.+\/(admin|ui)\/).+.vue$/
      const allUserComponents = components.filter(({ filePath }) => filePath.startsWith(userComponentsPath))
      const componentsByPath: { [key: string]: Component } = allUserComponents.reduce((obj, value) => ({ ...obj, [value.filePath]: value }), {})
      const userComponents = allUserComponents.filter(({ filePath }) => regex.test(filePath))
      for (const component of userComponents) {
        const isDirectory = (p: string) => {
          try {
            return statSync(p).isDirectory()
          }
          catch (_e) {
            return false
          }
        }

        const resolveComponentNames = (dirPath: string) => {
          const componentNames: GlobalComponentNames[] = []
          if (isDirectory(dirPath)) {
            const componentFilePaths = Object.keys(componentsByPath).filter(path => path.startsWith(dirPath))
            componentFilePaths.forEach((filePath) => {
              if (componentsByPath[filePath]) {
                // @ts-expect-error: Unable to resolve that pascalName exists in keyof type
                componentsByPath[filePath].global && componentNames.push(componentsByPath[filePath].pascalName)
              }
            })
          }
          return componentNames
        }

        const tabsDir = resolveAlias(resolve(path.dirname(component.filePath), 'admin'))
        const managerTabs: GlobalComponentNames[] = resolveComponentNames(tabsDir)

        const uiDir = resolveAlias(resolve(path.dirname(component.filePath), 'ui'))
        const ui: GlobalComponentNames[] = resolveComponentNames(uiDir)

        const resourceType = component.pascalName.replace(/^CwaComponent/, '')
        defaultResourcesConfig[resourceType] = {
          // auto name with spaces in place of pascal/camel case
          name: resourceType.replace(/(?!^)([A-Z])/g, ' $1'),
          managerTabs,
          ui,
        }
      }
      const resources = mergeWith({}, defaultResourcesConfig, options.resources, (a, b) => {
        if (isArray(a)) {
          return b.concat(a)
        }
      })
      return { ...options, resources }
    }

    nuxt.hook('modules:done', () => {
      logger.info(`Configuring template to propagate module options and adding plugin for ${NAME} module...`)
      // clear options no longer needed and add plugin
      delete options.pagesDepth

      addTemplate({
        filename: 'cwa-options.ts',
        getContents: ({ app }) => {
          return `import type { CwaModuleOptions } from '#cwa/module';
export const options:CwaModuleOptions = ${JSON.stringify(extendCwaOptions(app.components), undefined, 2)}
export const currentModulePackageInfo:{ version: string, name: string } = ${JSON.stringify({ version, name }, undefined, 2)}
`
        },
      })

      addTypeTemplate({
        filename: 'types/cwa.d.ts',
        write: true,
        getContents: () => /* ts */`interface CwaRouteMeta {
  admin?: boolean
  disabled?: boolean
  staticLayout?: GlobalComponentNames
}
export * from 'vue-router'
declare module 'vue-router' {
  interface RouteMeta {
    cwa?: CwaRouteMeta
  }
}`,
      })
      addPlugin({
        src: resolve('./runtime/plugin'),
      })

      addServerTemplate({
        filename: '#cwa/server-options.ts',
        getContents: () => {
          const serverOps = {
            siteConfig: options.siteConfig,
          }
          return `export const options = ${JSON.stringify(serverOps, undefined, 2)}
`
        },
      })
      addServerHandler({
        handler: resolve('./runtime/server/server-middleware'),
      })
      addServerPlugin(resolve('./runtime/server/server-plugin'))

      addServerHandler({
        route: '/__sitemap__/cwa-urls',
        handler: resolve('./runtime/server/cwa-urls.get'),
      })
      addServerHandler({
        route: '/__sitemap__/cwa-custom.xml',
        handler: resolve('./runtime/server/cwa-custom-sitemap.get'),
      })
      addServerHandler({
        route: '/_cwa/healthcheck',
        handler: resolve('./runtime/server/cwa-healthcheck.get'),
      })
    })

    nuxt.hook('components:dirs', (dirs) => {
      logger.info(`Configuring component directories for ${NAME} module...`)
      // component dirs from module
      dirs.unshift({
        path: join(cwaVueComponentsDir, 'main'),
        prefix: 'Cwa',
        ignore: ['**/_*/*', '**/*.spec.{cts,mts,ts}'],
      })
      dirs.unshift({
        path: join(cwaVueComponentsDir, 'ui'),
        prefix: 'CwaUi',
        ignore: ['**/*.spec.{cts,mts,ts}'],
      })

      // todo: https://github.com/nuxt/nuxt/issues/14036#issuecomment-2110180751
      // todo: components do not need to be global and can be imported using import.meta.glob("~/components/modal/*.vue"); to reduce bundle size
      // component dirs to be configured by application - global, so they are split and can be loaded dynamically
      dirs.unshift({
        path: join(nuxt.options.srcDir, 'cwa', 'layouts'),
        prefix: 'CwaLayout',
        global: true,
        ignore: ['**/*.spec.{cts,mts,ts}'],
      })

      dirs.unshift({
        path: join(nuxt.options.srcDir, 'cwa', 'pages'),
        prefix: 'CwaPage',
        global: true,
        ignore: ['**/*.spec.{cts,mts,ts}'],
      })

      dirs.unshift({
        path: userComponentsPath,
        prefix: 'CwaComponent',
        global: true,
        ignore: ['**/*.spec.{cts,mts,ts}'],
      })
    })

    // todo: test - this will rebuild the options template when cwa files are added or deleted so that we auto-detect tabs to change in dev
    nuxt.hook('builder:watch', async (event, relativePath) => {
      // only if files have been added or removed
      if (!['add', 'unlink'].includes(event)) {
        return
      }
      logger.info(`File added or removed - updating options for ${NAME} module...`)
      const path = resolve(nuxt.options.srcDir, relativePath)
      const cwaDirs = [userComponentsPath]
      if (cwaDirs.some(dir => dir === path || path.startsWith(dir + '/'))) {
        await updateTemplates({
          filter: template => [
            'cwa-options.ts',
            '#cwa/server-options.ts',
          ].includes(template.filename),
        })
      }
    })

    nuxt.hook('vite:extendConfig', (config) => {
      logger.info(`Extending Vite optimizeDeps config for ${NAME} module dependencies...`)
      config.optimizeDeps = config.optimizeDeps || {}
      config.optimizeDeps.include = config.optimizeDeps.include || []
      config.optimizeDeps.exclude = config.optimizeDeps.exclude || []

      const optimizeDepPackages = ['slugify', 'dayjs']

      for (const opPkg of optimizeDepPackages) {
        // does it exist in excludes? remove
        const pkgIndex = config.optimizeDeps.exclude.indexOf(opPkg)
        if (pkgIndex > -1) {
          config.optimizeDeps.exclude.splice(pkgIndex, 1)
        }

        // if not already in the includes for optimising, add it
        if (!config.optimizeDeps.include.includes(opPkg)) {
          config.optimizeDeps.include.push(opPkg)
        }
      }
    })

    logger.success(`Added ${NAME} module successfully.`)
  },
})
