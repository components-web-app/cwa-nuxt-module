import { defineNuxtConfig } from 'nuxt/config'
import { fileURLToPath } from 'url'
import CwaModule from '..'

export default defineNuxtConfig({
  modules: [
    CwaModule
  ],
  cwa: {},
  alias: {
    '@cwa/nuxt-module': fileURLToPath(new URL('../src', import.meta.url)),
  },
  typescript: {
    tsConfig: {
      "include": [
        "./src"
      ],
      "exclude": [
        "./src/**/*.spec.ts"
      ]
    }
  }
})
