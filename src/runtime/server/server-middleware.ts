import { defineEventHandler } from 'h3'
import { consola } from 'consola'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import useCwaSiteConfig from '#cwa/runtime/composables/useCwaSiteConfig'
import { updateSiteConfig } from '#site-config/server/composables'
import useFetcher from '#cwa/runtime/server/useFetcher'

export default defineEventHandler(async (e) => {
  const { mergeConfig, responseToConfig, resolvedConfigToSiteConfig } = useCwaSiteConfig()
  const { fetcher, options } = useFetcher()
  try {
    const data = await fetcher<CwaResource>('/_/site_config_parameters')
    const resolvedConfig = mergeConfig(options.siteConfig, responseToConfig(data, true))
    updateSiteConfig(e, resolvedConfigToSiteConfig(resolvedConfig))
  }
  catch (e) {
    consola.error(e)
    return
  }
})
