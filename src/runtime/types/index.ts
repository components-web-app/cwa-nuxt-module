import type { SelectOption } from '../composables/cwa-select'
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

export interface CwaStyle {
  label: string
  classes: string
}

export interface CwaStyles {
  [key: string]: CwaStyle
}

export interface CwaTemplateConfig {
  name?: string
  styles?: CwaStyles
}

export interface CwaUiVariantConfig {
  name?: string
  styles?: CwaStyles
  allowMultiple?: boolean
}

export interface CwaComponentMeta extends CwaTemplateConfig, CwaUiVariantConfig {
  instantAdd?: boolean
  defaultData?: Record<any, any>
}

export interface CwaComponentAdminConfig {
  description?: string
  icon?: CwaComponentKind | `lucide:${LucideIconName}` | `./${string}.svg`
  group?: string
  image?: string
}

export interface CwaComponentConfig extends CwaComponentMeta, CwaComponentAdminConfig {}

export interface CwaResourceMeta extends CwaComponentMeta {
  managerTabs?: ManagerTab[]
  ui?: ComponentUi[]
}

export interface CwaResourceConfig extends CwaResourceMeta, CwaComponentAdminConfig {}

export interface CwaResourcesMeta {
  [type: string]: CwaResourceMeta
}

export interface CwaResourcesConfig {
  [type: string]: CwaResourceConfig
}

export interface CwaStyleClasses {
  [componentName: string]: {
    [key: string]: string
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
  pageData?: {
    [resourceClass: string]: {
      name?: string
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
