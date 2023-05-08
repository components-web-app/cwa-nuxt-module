import { fileURLToPath } from 'url'
import { join } from 'path'
import {
  defineNuxtModule,
  createResolver,
  installModule,
  extendPages,
  addTemplate,
  addImportsDir, addPlugin
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
    name: '@cwa/nuxt-module',
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

    // transpile runtime
    const runtimeDir = fileURLToPath(new URL('./runtime', import.meta.url))
    nuxt.options.build.transpile.push(runtimeDir)

    nuxt.options.css.unshift(resolve('./runtime/templates/assets/main.css'))

    const vueTemplatesDir = fileURLToPath(new URL('./runtime/templates', import.meta.url))

    // todo: test
    const extendPagesCallback = (pages: NuxtPage[]) => {
      const pageComponent = resolve(vueTemplatesDir, 'cwa-page.vue')
      createDefaultCwaPages(pages, pageComponent, options.pagesDepth || 3)
    }

    extendPages(extendPagesCallback)

    // clear options no longer needed and add plugin
    delete options.pagesDepth
    const lodashTemplatesDir = fileURLToPath(new URL('./runtime', import.meta.url))

    addTemplate({
      filename: 'cwa-options.ts',
      getContents: () => `import { CwaModuleOptions } from '@cwa/nuxt-module/module';
export const options:CwaModuleOptions = ${JSON.stringify(options, undefined, 2)}
`
    })

    addPlugin({
      src: resolve(lodashTemplatesDir, 'plugin.ts')
    })

    addImportsDir(resolve('./runtime/composables'))

    nuxt.hook('components:dirs', (dirs) => {
      // component dirs from module
      dirs.unshift({
        path: resolve(vueTemplatesDir, 'components', 'main'),
        prefix: 'Cwa'
      })
      dirs.unshift({
        path: resolve(vueTemplatesDir, 'components', 'utils'),
        prefix: 'CwaUtils'
      })

      // component dirs to be configured by application
      dirs.unshift({
        path: resolve(join(nuxt.options.srcDir, 'cwa', 'pages')),
        prefix: 'CwaPages'
      })
      dirs.unshift({
        path: resolve(join(nuxt.options.srcDir, 'cwa', 'components')),
        prefix: 'CwaComponents'
      })
    })
  }
})
