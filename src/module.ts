import { fileURLToPath } from 'url'
import { defineNuxtModule, createResolver, addPluginTemplate } from '@nuxt/kit'
import { join } from 'path'

export interface CwaModuleOptions {

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
  },
  setup (options: CwaModuleOptions, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    const runtimeDir = fileURLToPath(new URL('./runtime', import.meta.url))
    nuxt.options.build.transpile.push(runtimeDir)

    addPluginTemplate({
      src: resolve(runtimeDir, 'plugin.ts'),
      filename: join('cwa', 'cwa-plugin.ts'),
      options
    })
  }
})
