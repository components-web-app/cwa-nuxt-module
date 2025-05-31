import { $fetch } from 'ofetch'
import { defineNitroPlugin } from 'nitropack/runtime'
// @ts-expect-error this is a file built in the module
import { options } from '#cwa/server-options.ts'
import { useRuntimeConfig } from '#imports'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import useCwaSiteConfig from '#cwa/runtime/composables/useCwaSiteConfig'

export default defineNitroPlugin(async (nitroApp) => {
  const { mergeConfig, responseToConfig } = useCwaSiteConfig()
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
    const resolvedConfig = mergeConfig(options.siteConfig, responseToConfig(data))
    nitroApp.hooks.hook('site-config:init', ({ siteConfig }) => {
      siteConfig.push({
        name: resolvedConfig.siteName,
        indexable: resolvedConfig.indexable,
      })
    })
  }
  catch (e) {
    console.error(e)
    return
  }
})
