import { defineNuxtConfig } from 'nuxt/config'
import CwaModule from '..'

export default defineNuxtConfig({
  modules: [
    CwaModule
  ],
  cwa: {
    addPlugin: true
  }
})
