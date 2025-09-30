import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: [
    fileURLToPath(new URL('../module', import.meta.url)),
  ],
})
