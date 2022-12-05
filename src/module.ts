import { fileURLToPath } from 'url'
import { join } from 'path'
import { defineNuxtModule, createResolver, addPluginTemplate, installModule } from '@nuxt/kit'

export interface CwaModuleOptions {
  storeName: string
  apiUrlBrowser?: string
  apiUrl?: string
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
    const { resolve } = createResolver(import.meta.url)

    await installModule('@pinia/nuxt')

    const runtimeDir = fileURLToPath(new URL('./runtime', import.meta.url))
    nuxt.options.build.transpile.push(runtimeDir)

    const templatesDir = fileURLToPath(new URL('./templates', import.meta.url))
    addPluginTemplate({
      src: resolve(templatesDir, 'plugin.template.ts'),
      filename: join('cwa', 'cwa-plugin.ts'),
      options
    })
  }
})
