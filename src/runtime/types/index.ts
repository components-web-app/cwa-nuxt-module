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
  layouts?: {
    [type: string]: CwaUiMeta
  }
  pages?: {
    [type: string]: CwaUiMeta
  }
  pageData?: {
    [resourceClass: string]: Pick<CwaUiMeta, 'name'> & {
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
