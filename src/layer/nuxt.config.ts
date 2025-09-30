import { defineNuxtConfig } from 'nuxt/config'
import { createResolver } from 'nuxt/kit'

const resolver = createResolver(import.meta.url)

export default defineNuxtConfig({
  modules: [
    resolver.resolve('./../module'),
  ],
})
