import type Cwa from '#cwa/cwa'
import 'nuxt'
import type { CwaResourcesMeta, GlobalComponentNames } from '#cwa/types'

interface CwaInjections {
  $cwa: Cwa
}

interface CwaRouteMeta {
  admin?: boolean
  disabled?: boolean
  staticLayout?: GlobalComponentNames
}

declare module '#app' {
  interface Nuxt {
    cwaResources: CwaResourcesMeta
  }
  interface PageMeta {
    cwa?: CwaRouteMeta
  }
}

declare module 'nuxt/dist/app/nuxt' {
  type NuxtApp = CwaInjections
}
