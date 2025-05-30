import { defineEventHandler } from 'h3'
import { $fetch } from 'ofetch'
// @ts-expect-error this is a file built in the module
import { options } from '#cwa/server-options.ts'
import { updateSiteConfig, useRuntimeConfig } from '#imports'
import type { CwaSiteConfigParameter } from '#cwa/runtime/storage/stores/site-config/state'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import type { SiteConfigParams } from '#cwa/runtime/storage/stores/site-config/getters'

// Make the following into utils availabel server and client-side
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

function processApiValue(configValue: any) {
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
    configData[configKey] = processApiValue(configRow.value)
  }
  return configData
}
// end of functions to become utils for client and server

export default defineEventHandler(async () => {
  const { public: { cwa: { apiUrl, apiUrlBrowser } } } = useRuntimeConfig()
  const resolvedUrl = apiUrl || apiUrlBrowser || options.apiUrl || options.apiUrlBrowser || ''
  const fetcher = $fetch.create({
    baseURL: resolvedUrl,
    headers: {
      accept: 'application/ld+json,application/json',
    },
    credentials: 'include',
  })
  try {
    const data = await fetcher<CwaResource>('/_/site_config_parameters')
    const configRows = validateConfigResponse(data)
    if (configRows) {
      const serverConfig = siteConfigResponseDataToConfig(configRows)
      const resolvedConfig = Object.assign({}, defaultSettings, serverConfig)
      console.log(resolvedConfig)
      updateSiteConfig({
        name: resolvedConfig.siteName,
        // indexable: false,
        // url: 'https://admin.example.com'
      })
    }
  }
  catch (e) {
    return
  }
})
