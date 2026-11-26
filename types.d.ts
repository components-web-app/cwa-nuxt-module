import type Cwa from '#cwa/cwa'
import 'nuxt'

interface CwaRouteMeta {
  admin?: boolean
  disabled?: boolean
  layout?: string
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
