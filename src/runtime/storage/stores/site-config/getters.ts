import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { CwaSiteConfigStateInterface } from './state'

export type SiteConfigParams = {
  robotsAllowSearchEngineCrawlers: boolean
  robotsAllowAiBots: boolean
  robotsText: string
  robotsRemoveSitemap: boolean
  sitemapEnabled: boolean
  siteName: string
  fallbackTitle: boolean
  concatTitle: boolean
  maintenanceModeEnabled: boolean
  sitemapXml: string
}

const defaultSettings: SiteConfigParams = {
  robotsAllowSearchEngineCrawlers: true,
  robotsAllowAiBots: true,
  robotsText: '',
  robotsRemoveSitemap: false,
  sitemapEnabled: true,
  siteName: '',
  fallbackTitle: true,
  concatTitle: true,
  maintenanceModeEnabled: false,
  sitemapXml: '',
}

export interface CwaSiteConfigGettersInterface {
  getConfig: ComputedRef<SiteConfigParams>
}

export default function (siteConfigState: CwaSiteConfigStateInterface): CwaSiteConfigGettersInterface {
  return {
    getConfig: computed<SiteConfigParams>(() => {
      return Object.assign({}, defaultSettings, siteConfigState.config)
    }),
  }
}
