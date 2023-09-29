import { join } from 'path'
import path from 'node:path'
import { statSync } from 'node:fs'
import _mergeWith from 'lodash/mergeWith.js'
import _isArray from 'lodash/isArray.js'
import {
  addImportsDir,
  addPlugin,
  addTemplate,
  createResolver,
  defineNuxtModule,
  extendPages,
  installModule, resolveAlias
} from '@nuxt/kit'
import { Component, ModuleOptions, NuxtPage } from '@nuxt/schema'
import { globby } from 'globby'

export interface CwaResourcesMeta {
  [type:string]: {
    name?: string,
    managerTabs?: string[]
  }
}

export interface CwaModuleOptions extends ModuleOptions {
  storeName: string
  pagesDepth?: number,
  apiUrlBrowser?: string
  apiUrl?: string,
  resources?: CwaResourcesMeta
}

function createDefaultCwaPages (
  pages: NuxtPage[],
  pageComponentFilePath: string,
  maxDepth: number
) {
  function create (currentDepth = 0) {
    const page: NuxtPage = {
      name: `cwaPage${currentDepth}`,
      path: `:cwaPage${currentDepth}*`,
      file: pageComponentFilePath,
      meta: {
        layout: 'cwa-root-layout'
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
    name: '@cwa/nuxt3',
    configKey: 'cwa',
    compatibility: {
      nuxt: '^3.0.0'
    }
  },
  defaults: {
    storeName: 'cwa',
    resources: {
      ComponentPosition: {
        name: 'Position'
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

    // modules
    await installModule('@pinia/nuxt')

    // common alias due to releasing different package names
    nuxt.options.alias['#cwa'] = resolve('./')
    // transpile runtime
    const runtimeDir = resolve('./runtime')
    nuxt.options.build.transpile.push(runtimeDir)

    // include css - dev can disable the base in options to allow usage of their own tailwind without conflict and duplication
    nuxt.options.css.unshift(resolve('./runtime/templates/assets/main.css'))
    options.tailwind.base && nuxt.options.css.unshift(resolve('./runtime/templates/assets/base.css'))

    // include auto-imports for composables
    addImportsDir(resolve('./runtime/composables'))
    addImportsDir(resolve('./runtime/composables/component'))

    const vueTemplatesDir = resolve('./runtime/templates')
    extendPages((pages: NuxtPage[]) => {
      const pageComponent = resolve(vueTemplatesDir, 'cwa-page.vue')
      createDefaultCwaPages(pages, pageComponent, options.pagesDepth || 3)
    })

    const cwaVueComponentsDir = join(vueTemplatesDir, 'components')
    const userComponentsPath = join(nuxt.options.srcDir, 'cwa', 'components')
    const extensions = nuxt.options.extensions.map(e => e.replace(/^\./g, ''))

    async function extendCwaOptions (components: Component[]) {
      const defaultResourcesConfig: CwaResourcesMeta = {}
      const userComponents = components.filter(({ filePath }) => filePath.startsWith(userComponentsPath))
      for (const component of userComponents) {
        const isDirectory = (p: string) => {
          try {
            return statSync(p).isDirectory()
          } catch (_e) {
            return false
          }
        }

        const resourceType = component.pascalName.replace(/^CwaComponents/, '')
        const tabsDir = resolveAlias(resolve(path.dirname(component.filePath), 'admin'))
        const managerTabs = []
        if (isDirectory(tabsDir)) {
          const pattern = `**/*.{${extensions.join(',')},}`
          const files = (await globby(pattern, { cwd: tabsDir })).sort()
          managerTabs.push(...files.map(file => resolve(tabsDir, file)))
        }

        defaultResourcesConfig[resourceType] = {
          // auto name with spaces in place of pascal/camel case
          name: resourceType.replace(/(?!^)([A-Z])/g, ' $1'),
          managerTabs,
          ui: []
        }
      }
      options.resources = _mergeWith({}, defaultResourcesConfig, options.resources, (a, b) => {
        if (_isArray(a)) {
          return b.concat(a)
        }
      })
      return options
    }

    nuxt.hook('modules:done', () => {
      // clear options no longer needed and add plugin
      delete options.pagesDepth
      addTemplate({
        filename: 'cwa-options.ts',
        getContents: async ({ app }) => {
          await extendCwaOptions(app.components)
          return `import { CwaModuleOptions } from '#cwa/module';
export const options:CwaModuleOptions = ${JSON.stringify(options, undefined, 2)}
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
        prefix: 'Cwa'
      })
      dirs.unshift({
        path: join(cwaVueComponentsDir, 'ui'),
        prefix: 'CwaUi'
      })

      // component dirs to be configured by application - global, so they are split and can be loaded dynamically
      dirs.unshift({
        path: join(nuxt.options.srcDir, 'cwa', 'pages'),
        prefix: 'CwaPages',
        global: true
      })

      // exclude importing those which will be for the default admin tabs and alternative ui
      const pattern = `{**/!(admin|ui)/,}*.{${extensions.join(',')},}`
      dirs.unshift({
        path: userComponentsPath,
        extensions,
        pattern,
        prefix: 'CwaComponents',
        global: true
      })
    })
  }
})
