import type { SelectOption } from '../composables/cwa-select-input'
import type { DefineComponent, GlobalComponents } from 'vue'

export type GlobalComponentNames = keyof GlobalComponents

export type ManagerTab = GlobalComponentNames | DefineComponent<object, object, any>
export type ComponentUi = GlobalComponentNames

export interface CwaResourceMeta {
  name?: string
  description?: string
  instantAdd?: boolean
  defaultData?: Record<any, any>
  managerTabs?: ManagerTab[]
  ui?: ComponentUi[]
}

export interface CwaResourcesMeta {
  [type: string]: CwaResourceMeta
}

export interface CwaUiMeta {
  name?: string
  classes?: {
    [name: string]: string[] | string
  }
}

export type SiteConfigParams = {
  indexable: boolean
  robotsAllowNonSeoCrawlers: boolean
  robotsAllowAiBots: boolean
  robotsText: string
  robotsRemoveSitemap: boolean
  sitemapEnabled: boolean
  siteName: string
  fallbackTitle: boolean
  concatTitle: boolean
  maintenanceModeEnabled: boolean
  sitemapXml: string
  canonicalUrl: string
}

export interface CwaModuleOptions {
  storeName: string
  siteConfig: Partial<SiteConfigParams>
  resources: CwaResourcesMeta
  pagesDepth?: number
  // Max number of routes kept in the instant-revisit cache (#257). Default 50. Set 0 to disable
  // eviction (unbounded — not recommended on large sites).
  routeCacheLimit?: number
  // Whether the app serves HTML generated ahead of time (prerender / ISR / SWR route rules), in
  // which case resource data hydrated from the payload may be arbitrarily stale and is re-fetched on
  // mount. Auto-detected at build from the app's `routeRules` — set explicitly only to override.
  // True prerendering is additionally detected at runtime via Nuxt's `payload.prerenderedAt`; ISR
  // and SWR have no client-visible signal, hence the build-time flag.
  staticRender?: boolean
  layouts?: {
    [type: string]: CwaUiMeta
  }
  pages?: {
    [type: string]: CwaUiMeta
  }
  pageData?: {
    [resourceClass: string]: Pick<CwaUiMeta, 'name'> & {
      properties?: { [propertyName: string]: string }
      metaFields?: {
        field: string
        type: 'input' | 'select'
        label: string
        options?: SelectOption[]
      }[]
    }
  }
  layoutName?: string
}
