import { fileURLToPath } from 'url'
import { join } from 'path'
import { defineNuxtModule, createResolver, addPluginTemplate, installModule } from '@nuxt/kit'

export interface CwaModuleOptions {
  storeName: string
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
    const runtimeDir = fileURLToPath(new URL('./runtime', import.meta.url))
    nuxt.options.build.transpile.push(runtimeDir)

    addPluginTemplate({
      src: resolve(runtimeDir, 'plugin.template.ts'),
      filename: join('cwa', 'cwa-plugin.ts'),
      options
    })

    await installModule('@pinia/nuxt')
  }
})
