import { join } from 'path'
import path from 'node:path'
import { statSync, readFileSync } from 'node:fs'
import _mergeWith from 'lodash/mergeWith.js'
import _isArray from 'lodash/isArray.js'
import {
  addImportsDir,
  addPlugin,
  addTemplate,
  createResolver,
  defineNuxtModule,
  extendPages,
  installModule, resolveAlias, updateTemplates
} from '@nuxt/kit'
import type { Component, NuxtPage } from '@nuxt/schema'
import type { DefineComponent, GlobalComponents } from 'vue'

export type GlobalComponentNames = keyof GlobalComponents

export type ManagerTab = GlobalComponentNames|DefineComponent<{}, {}, any>
export type ComponentUi = GlobalComponentNames

export interface CwaResourceMeta {
  name?: string,
  description?: string,
  instantAdd?: boolean,
  managerTabs?: ManagerTab[],
  ui?: ComponentUi[]
}

export interface CwaResourcesMeta {
  [type:string]: CwaResourceMeta
}

export interface CwaModuleOptions {
  appName: string
  storeName: string
  pagesDepth?: number
  apiUrlBrowser?: string
  apiUrl?: string,
  resources?: CwaResourcesMeta
  tailwind?: {
    base?: boolean
  },
  layoutName?: string
}

function createDefaultCwaPages (
  pages: NuxtPage[],
  pageComponentFilePath: string,
  maxDepth: number,
  layout?: string|undefined
) {
  function create (currentDepth = 0) {
    const page: NuxtPage = {
      name: `cwaPage${currentDepth}`,
      path: `:cwaPage${currentDepth}*`,
      file: pageComponentFilePath,
      meta: {
        cwa: true,
        layout: layout || 'cwa-root-layout'
      }
    }
    if (currentDepth === 0) {
      page.path = '/:cwaPage0*'
    }

    if (currentDepth < maxDepth) {
      const child = create(++currentDepth)
      page.children = [child]
    }
    return page
  }
  const pagesTree = create()
  pages.push(pagesTree)
}

export default defineNuxtModule<CwaModuleOptions>({
  meta: {
    name: '@cwa/nuxt',
    configKey: 'cwa',
    compatibility: {
      nuxt: '^3.6.5',
      bridge: false
    }
  },
  defaults: {
    appName: 'CWA Web App',
    storeName: 'cwa',
    resources: {
      ComponentPosition: {
        name: 'Position',
        description: '<p>Dynamic components can be used on dynamic pages to specify what component should be displayed from a data page in any given location.</p><p>You must select the reference from the data page to load into this position below.</p>',
        instantAdd: true
      },
      ComponentGroup: {
        name: 'Group'
      }
    },
    tailwind: {
      base: true
    }
  },
  async setup (options: CwaModuleOptions, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    const { version, name } = JSON.parse(
      readFileSync(resolve('../package.json'), 'utf8')
    )

    // modules
    await installModule('@pinia/nuxt')

    // common alias due to releasing different package names
    nuxt.options.alias['#cwa'] = resolve('./')
    // transpile runtime
    const runtimeDir = resolve('./runtime')
    nuxt.options.build.transpile.push(runtimeDir)

    // include css - dev can disable the base in options to allow usage of their own tailwind without conflict and duplication
    nuxt.options.css.unshift(resolve('./runtime/templates/assets/main.css'))
    options.tailwind?.base && nuxt.options.css.unshift(resolve('./runtime/templates/assets/base.css'))

    // include auto-imports for composables
    addImportsDir(resolve('./runtime/composables'))
    addImportsDir(resolve('./runtime/composables/component'))

    const vueTemplatesDir = resolve('./runtime/templates')

    extendPages((pages: NuxtPage[]) => {
      const pageComponent = resolve(vueTemplatesDir, 'cwa-page.vue')
      createDefaultCwaPages(pages, pageComponent, options.pagesDepth || 3, options.layoutName)
    })

    const cwaVueComponentsDir = join(vueTemplatesDir, 'components')
    const userComponentsPath = join(nuxt.options.srcDir, 'cwa', 'components')
    nuxt.options.alias['#cwaComponents'] = userComponentsPath

    function extendCwaOptions (components: Component[]) {
      const defaultResourcesConfig: CwaResourcesMeta = {}

      // exclude files within admin and ui folders which will not need a configuration
      const regex = /^(?!.+\/(admin|ui)\/).+.vue$/
      const allUserComponents = components.filter(({ filePath }) => filePath.startsWith(userComponentsPath))
      const componentsByPath: { [key:string]: Component } = allUserComponents.reduce((obj, value) => ({ ...obj, [value.filePath]: value }), {})
      const userComponents = allUserComponents.filter(({ filePath }) => regex.test(filePath))
      for (const component of userComponents) {
        const isDirectory = (p: string) => {
          try {
            return statSync(p).isDirectory()
          } catch (_e) {
            return false
          }
        }

        const resolveComponentNames = (dirPath: string) => {
          const componentNames: GlobalComponentNames[] = []
          if (isDirectory(dirPath)) {
            const componentFilePaths = Object.keys(componentsByPath).filter(path => path.startsWith(dirPath))
            componentFilePaths.forEach((filePath) => {
              if (componentsByPath[filePath]) {
                // @ts-ignore: Unable to resolve that pascalName exists in keyof type
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
          ui
        }
      }
      const resources = _mergeWith({}, defaultResourcesConfig, options.resources, (a, b) => {
        if (_isArray(a)) {
          return b.concat(a)
        }
      })
      return { ...options, resources }
    }

    nuxt.hook('modules:done', () => {
      // clear options no longer needed and add plugin
      delete options.pagesDepth
      delete options.tailwind
      addTemplate({
        filename: 'cwa-options.ts',
        getContents: ({ app }) => {
          return `import type { CwaModuleOptions } from '#cwa/module';
export const options:CwaModuleOptions = ${JSON.stringify(extendCwaOptions(app.components), undefined, 2)}
export const currentModulePackageInfo:{ version: string, name: string } = ${JSON.stringify({ version, name }, undefined, 2)}
`
        }
      })
      addPlugin({
        src: resolve('./runtime/plugin')
      })
    })

    nuxt.hook('components:dirs', (dirs) => {
      // component dirs from module
      dirs.unshift({
        path: join(cwaVueComponentsDir, 'main'),
        prefix: 'Cwa',
        ignore: ['**/_*/*', '**/*.spec.{cts,mts,ts}']
      })
      // dirs.unshift({
      //   path: join(cwaVueComponentsDir, 'utils'),
      //   prefix: 'CwaUtils',
      //   ignore: ['**/*.spec.{cts,mts,ts}']
      // })
      dirs.unshift({
        path: join(cwaVueComponentsDir, 'ui'),
        prefix: 'CwaUi',
        ignore: ['**/*.spec.{cts,mts,ts}']
      })

      // todo: https://github.com/nuxt/nuxt/issues/14036#issuecomment-2110180751
      // todo: components do not need to be global and can be imported using import.meta.glob("~/components/modal/*.vue"); to reduce bundle size
      // component dirs to be configured by application - global, so they are split and can be loaded dynamically
      dirs.unshift({
        path: join(nuxt.options.srcDir, 'cwa', 'layouts'),
        prefix: 'CwaLayout',
        global: true,
        ignore: ['**/*.spec.{cts,mts,ts}']
      })

      dirs.unshift({
        path: join(nuxt.options.srcDir, 'cwa', 'pages'),
        prefix: 'CwaPage',
        global: true,
        ignore: ['**/*.spec.{cts,mts,ts}']
      })

      dirs.unshift({
        path: userComponentsPath,
        prefix: 'CwaComponent',
        global: true,
        ignore: ['**/*.spec.{cts,mts,ts}']
      })
    })

    // todo: test - this will rebuild the options template when cwa files are added or deleted so that we auto-detect tabs to change in dev
    nuxt.hook('builder:watch', async (event, relativePath) => {
      // only if files have been added or removed
      if (!['add', 'unlink'].includes(event)) {
        return
      }
      const path = resolve(nuxt.options.srcDir, relativePath)
      const cwaDirs = [userComponentsPath]
      if (cwaDirs.some(dir => dir === path || path.startsWith(dir + '/'))) {
        await updateTemplates({
          filter: template => [
            'cwa-options.ts'
          ].includes(template.filename)
        })
      }
    })

    nuxt.hook('vite:extendConfig', (config) => {
      config.optimizeDeps = config.optimizeDeps || {}
      config.optimizeDeps.include = config.optimizeDeps.include || []
      config.optimizeDeps.exclude = config.optimizeDeps.exclude || []

      const lodashIndex =
        config.optimizeDeps.exclude.indexOf('lodash')
      if (lodashIndex > -1) {
        config.optimizeDeps.exclude.splice(lodashIndex, 1)
      }

      if (!config.optimizeDeps.include.includes('lodash')) {
        config.optimizeDeps.include.push('lodash')
      }
    })
  }
})
