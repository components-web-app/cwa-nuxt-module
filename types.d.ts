import type { Router } from 'vue-router'
import type Cwa from '#cwa/runtime/cwa'
import 'nuxt'
import type { CwaResourcesMeta, GlobalComponentNames } from '#cwa/module'

interface CwaInjections {
  $cwa: Cwa
  $router: Router
}

declare module '#app' {
  interface Nuxt {
    cwaResources: CwaResourcesMeta
  }
  interface PageMeta {
    cwa: {
      admin?: boolean
      disabled?: boolean
      staticLayout?: GlobalComponentNames
    }
  }
}

declare module 'nuxt/dist/app/nuxt' {
  type NuxtApp = CwaInjections
}
