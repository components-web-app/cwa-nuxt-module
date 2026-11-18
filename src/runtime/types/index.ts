import type { SelectOption } from '../composables/cwa-select-input'
import type { ImageDownscaleOptions } from '../files/image-downscale'
import type { DefineComponent, GlobalComponents } from 'vue'
import type { CwaComponentName } from '#build/cwa-component-names'

export type GlobalComponentNames = keyof GlobalComponents

export type CwaAllowedComponent = CwaComponentName | `/${string}`

export type ManagerTab = GlobalComponentNames | DefineComponent<object, object, any>
export type ComponentUi = GlobalComponentNames

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface CwaLucideIconNames {}
}

export type LucideIconName = keyof CwaLucideIconNames & string

export type CwaComponentKind = 'heading' | 'rich-text' | 'image' | 'gallery' | 'carousel' | 'video' | 'hero' | 'banner'
  | 'card' | 'card-grid' | 'section' | 'media-text' | 'columns' | 'container' | 'link' | 'button' | 'link-group' | 'tabs'
  | 'accordion' | 'quote' | 'testimonial' | 'form' | 'newsletter' | 'sign-up' | 'collection' | 'articles' | 'table'
  | 'steps' | 'file' | 'chart' | 'heatmap' | 'map' | 'contact' | 'social' | 'person' | 'people' | 'notice'

export interface CwaResourceMeta {
  name?: string
  description?: string
  instantAdd?: boolean
  defaultData?: Record<any, any>
  managerTabs?: ManagerTab[]
  ui?: ComponentUi[]
}

export interface CwaResourceConfig extends CwaResourceMeta {
  icon?: CwaComponentKind | `lucide:${LucideIconName}`
  group?: string
  image?: string
}

export interface CwaResourcesMeta {
  [type: string]: CwaResourceMeta
}

export interface CwaResourcesConfig {
  [type: string]: CwaResourceConfig
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
  resources: CwaResourcesConfig
  pagesDepth?: number
  routeCacheLimit?: number
  staticRender?: boolean
  auth?: {
    clearCachesOnSessionEnd?: string[]
  }
  realtime?: {
    enabled?: boolean
  }
  upload?: {
    image?: Partial<ImageDownscaleOptions>
  }
  pageCache?: {
    enabled?: boolean
    sharedMaxAge?: number
    staleWhileRevalidate?: number
  }
  sitemapCache?: {
    sharedMaxAge?: number
    staleWhileRevalidate?: number
  }
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

export type CwaRuntimeOptions = Omit<CwaModuleOptions, 'resources'> & {
  resources: CwaResourcesMeta
}
