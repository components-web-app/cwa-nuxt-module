import { fileURLToPath } from 'url'
import { join } from 'path'
import {
  defineNuxtModule,
  createResolver,
  addPluginTemplate,
  installModule,
  addLayout,
  extendPages,
  addImports
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
        layout: 'cwa-layout-loader'
      }
    }
    if (currentDepth === 0) {
      page.path = `/${page.path}`
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

    nuxt.options.css.push(resolve('./runtime/templates/assets/main.css'))

    // layouts and pages do not test yet
    const vueTemplatesDir = fileURLToPath(new URL('./runtime/templates', import.meta.url))
    addLayout({
      src: resolve(vueTemplatesDir, 'layouts', 'cwa-default.vue'),
      filename: join('cwa', 'layouts', 'cwa-default.vue')
    }, 'cwa-default')

    // we use a layout loader so the page does not need to use NuxtLayout and result in remounting and restarting any transitions etc. and so that we can then use NuxtLayout in there to load the correct layout
    addLayout({
      src: resolve(vueTemplatesDir, 'layouts', 'cwa-layout-loader.vue'),
      filename: join('cwa', 'layouts', 'cwa-layout-loader.vue')
    }, 'cwa-layout-loader')
    // end do not test yet

    // todo: test
    const extendPagesCallback = (pages: NuxtPage[]) => {
      const pageComponent = resolve(vueTemplatesDir, 'cwa-page.vue')
      createDefaultCwaPages(pages, pageComponent, options.pagesDepth || 3)
    }
    extendPages(extendPagesCallback)

    // clear options no longer needed and add plugin
    delete options.pagesDepth
    const lodashTemplatesDir = fileURLToPath(new URL('./templates', import.meta.url))
    addPluginTemplate({
      src: resolve(lodashTemplatesDir, 'plugin.template.ts'),
      filename: join('cwa', 'cwa-plugin.ts'),
      options
    })

    addImports([{ from: resolve('./runtime/composable.js'), name: 'useCwa' }])

    nuxt.hook('components:dirs', (dirs) => {
      dirs.unshift({
        path: resolve(join(nuxt.options.srcDir, 'cwa', 'pages')),
        prefix: 'CwaPage'
      })
      dirs.unshift({
        path: resolve(join(nuxt.options.srcDir, 'cwa', 'components')),
        prefix: 'CwaComponent'
      })
      // todo: think through and test hook set if needed
      dirs.unshift({
        path: fileURLToPath(new URL('./runtime/templates/components/utils', import.meta.url)),
        prefix: 'CwaUtils'
      })
    })
  }
})
