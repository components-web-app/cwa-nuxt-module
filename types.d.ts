import type Cwa from '#cwa/cwa'
import 'nuxt'
import type { GlobalComponentNames } from '#cwa/types'

interface CwaRouteMeta {
  admin?: boolean
  disabled?: boolean
  staticLayout?: GlobalComponentNames
  fetch?: {
    iri: string
    manifestPath?: string
  }
}

declare module 'nuxt/app' {
  interface NuxtApp {
    $cwa: Cwa
  }
  interface PageMeta {
    cwa?: CwaRouteMeta
  }
}
