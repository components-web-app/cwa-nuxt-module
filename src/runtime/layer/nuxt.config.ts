import { fileURLToPath } from 'url'
import CwaModule from '../../module'
export default defineNuxtConfig({
  modules: [
    CwaModule
  ],
  alias: {
    '@cwa/nuxt3': fileURLToPath(new URL('../../', import.meta.url))
  }
})
