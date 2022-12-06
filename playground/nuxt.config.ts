import { fileURLToPath } from 'url'
import { defineNuxtConfig } from 'nuxt/config'
import { NuxtModule } from '@nuxt/schema'
import CwaModule from '../src/module'

const API_URL = process.env.API_URL || 'https://localhost:8443'
const API_URL_BROWSER = process.env.API_URL_BROWSER || API_URL

// @ts-ignore
const module: NuxtModule = CwaModule

export default defineNuxtConfig({
  modules: [
    module
  ],
  cwa: {
    apiUrl: API_URL,
    apiUrlBrowser: API_URL_BROWSER
  },
  alias: {
    '@cwa/nuxt-module': fileURLToPath(new URL('../src', import.meta.url))
  },
  typescript: {
    tsConfig: {
      include: [
        '../src'
      ],
      exclude: [
        '../**/*.spec.ts'
      ]
    }
  }
})
