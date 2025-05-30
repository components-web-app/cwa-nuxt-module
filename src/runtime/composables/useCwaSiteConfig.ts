import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import type { CwaSiteConfigParameter } from '#cwa/runtime/storage/stores/site-config/state'
import type { SiteConfigParams } from '#cwa/module'

export const defaultSiteConfig: SiteConfigParams = {
  indexable: true,
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

export function useCwaSiteConfig() {
  function processApiConfigValue(configValue: any) {
    let value = configValue
    if (configValue === '1' || configValue === 'false') {
      value = Boolean(value)
    }
    return value
  }

  function validateConfigResponse(data: CwaResource) {
    const configRows = data['hydra:member']
    if (!configRows || !Array.isArray(configRows)) {
      return
    }
    return configRows as CwaSiteConfigParameter[]
  }

  function siteConfigResponseDataToConfig(configRows: CwaSiteConfigParameter[]) {
    const configData: Partial<SiteConfigParams> = {}
    for (const configRow of configRows) {
      const configKey = configRow.key as keyof SiteConfigParams
      configData[configKey] = processApiConfigValue(configRow.value)
    }
    return configData
  }

  return {
    defaultSiteConfig,
    validateConfigResponse,
    siteConfigResponseDataToConfig,
  }
}

export default useCwaSiteConfig
