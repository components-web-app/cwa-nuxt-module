import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import type { CwaSiteConfigParameter } from '#cwa/runtime/storage/stores/site-config/state'
import type { SiteConfigParams } from '#cwa/module'

export const defaultSiteConfig: SiteConfigParams = {
  indexable: true,
  robotsAllowNonSeoCrawlers: true,
  robotsAllowAiBots: true,
  robotsText: '',
  robotsRemoveSitemap: false,
  sitemapEnabled: true,
  siteName: 'CWA Web App',
  fallbackTitle: true,
  concatTitle: true,
  maintenanceModeEnabled: false,
  sitemapXml: '',
  canonicalUrl: '',
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
    const filteredConfigs = configs
      .filter(c => (c !== undefined))
      .map((c) => {
        return Object.entries(c).reduce((obj: Partial<SiteConfigParams>, [key, value]) => {
          if (value !== undefined && value !== '') {
            // @ts-expect-error key as any?
            obj[key] = value
          }
          return obj
        }, {} as Partial<SiteConfigParams>)
      })
    return Object.assign(
      {},
      defaultSiteConfig,
      ...filteredConfigs,
    )
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

  function resolvedConfigToSiteConfig(config: SiteConfigParams) {
    if (!config.indexable) {
      console.error('Indexable was not true. Debugging how this can happen')
      console.trace()
      console.log(config)
    }
    return {
      name: config.siteName,
      indexable: true,
      url: config.canonicalUrl,
    }
  }

  return {
    defaultSiteConfig,
    responseToConfig,
    mergeConfig,
    processApiConfigValue,
    resolvedConfigToSiteConfig,
  }
}

export default useCwaSiteConfig
