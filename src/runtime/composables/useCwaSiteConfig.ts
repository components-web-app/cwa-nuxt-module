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
    if (configValue === '0' || configValue === '1' || configValue === 'false' || configValue === 'true') {
      value = Boolean(JSON.parse(configValue))
    }
    return value
  }

  function getRowsFromResponse(data: CwaResource) {
    const configRows = data['hydra:member']
    if (!configRows || !Array.isArray(configRows)) {
      return
    }
    return configRows as CwaSiteConfigParameter[]
  }

  function siteConfigRowsToConfig(configRows: CwaSiteConfigParameter[]) {
    const configData: Partial<SiteConfigParams> = {}
    for (const configRow of configRows) {
      const configKey = configRow.key as keyof SiteConfigParams
      configData[configKey] = processApiConfigValue(configRow.value)
    }
    return configData
  }

  function mergeConfig(...configs: Partial<SiteConfigParams>[]): SiteConfigParams {
    return Object.assign({}, defaultSiteConfig, ...configs)
  }

  function responseToConfig(data: CwaResource, noMerge?: boolean) {
    const rows = getRowsFromResponse(data)
    if (!rows) {
      return {}
    }
    if (noMerge) {
      return siteConfigRowsToConfig(rows)
    }
    return mergeConfig(siteConfigRowsToConfig(rows))
  }

  return {
    defaultSiteConfig,
    responseToConfig,
    mergeConfig,
    processApiConfigValue,
  }
}

export default useCwaSiteConfig
