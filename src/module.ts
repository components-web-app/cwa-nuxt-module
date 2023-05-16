import { fileURLToPath } from 'url'
import { join } from 'path'
import {
  addImportsDir,
  addPlugin,
  addTemplate,
  createResolver,
  defineNuxtModule,
  extendPages,
  installModule
} from '@nuxt/kit'
import { ModuleOptions, NuxtPage } from '@nuxt/schema'
import Bluebird from 'bluebird'

export interface CwaModuleOptions extends ModuleOptions {
  storeName: string
  pagesDepth?: number,
  apiUrlBrowser?: string
  apiUrl?: string
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
    storeName: 'cwa'
  },
  async setup (options: CwaModuleOptions, nuxt) {
    Bluebird.config({ cancellation: true })

    const { resolve } = createResolver(import.meta.url)

    // modules
    await installModule('@pinia/nuxt')

    // common alias due to releasing different package names
    nuxt.options.alias['#cwa'] = resolve('./')
    // transpile runtime
    const runtimeDir = resolve('./runtime')
    nuxt.options.build.transpile.push(runtimeDir)

    nuxt.options.css.unshift(resolve('./runtime/templates/assets/main.css'))

    const vueTemplatesDir = resolve('./runtime/templates')

    // todo: test
    const extendPagesCallback = (pages: NuxtPage[]) => {
      const pageComponent = resolve(vueTemplatesDir, 'cwa-page.vue')
      createDefaultCwaPages(pages, pageComponent, options.pagesDepth || 3)
    }

    extendPages(extendPagesCallback)

    // clear options no longer needed and add plugin
    delete options.pagesDepth
    addTemplate({
      filename: 'cwa-options.ts',
      getContents: () => `import { CwaModuleOptions } from '#cwa/module';
export const options:CwaModuleOptions = ${JSON.stringify(options, undefined, 2)}
`
    })

    addPlugin({
      src: resolve('./runtime/plugin')
    })

    addImportsDir(resolve('./runtime/composables'))

    nuxt.hook('components:dirs', (dirs) => {
      // component dirs from module
      dirs.unshift({
        path: join(vueTemplatesDir, 'components', 'main'),
        prefix: 'Cwa'
      })
      dirs.unshift({
        path: join(vueTemplatesDir, 'components', 'utils'),
        prefix: 'CwaUtils'
      })

      // component dirs to be configured by application - global, so they are split
      dirs.unshift({
        path: join(nuxt.options.srcDir, 'cwa', 'pages'),
        prefix: 'CwaPages',
        global: true
      })
      dirs.unshift({
        path: join(nuxt.options.srcDir, 'cwa', 'components'),
        prefix: 'CwaComponents',
        global: true
      })
    })
  }
})
