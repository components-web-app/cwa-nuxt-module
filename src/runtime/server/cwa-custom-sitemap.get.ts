import { defaultContentType, defineEventHandler } from 'h3'
import { consola } from 'consola'
import useFetcher from '#cwa/runtime/server/useFetcher'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import useCwaSiteConfig from '#cwa/runtime/composables/useCwaSiteConfig'
import { createError, setResponseStatus } from '#imports'

// this endpoint will return a sitemap as defined by a user in the settings page
export default defineEventHandler(async (event) => {
  const { fetcher, options } = useFetcher()
  const { mergeConfig, responseToConfig } = useCwaSiteConfig()
  try {
    const data = await fetcher<CwaResource>('/_/site_config_parameters')
    const resolvedConfig = mergeConfig(options.siteConfig, responseToConfig(data, true))

    const sitemapXml = resolvedConfig.sitemapXml
    if (!sitemapXml || sitemapXml === '') {
      setResponseStatus(event, 404)
      return 'Custom sitemap not found'
    }
    defaultContentType(event, 'application/xml')
    return sitemapXml
  }
  catch (e) {
    consola.error(e)
    throw createError({
      statusCode: 500,
      statusMessage: 'Server error',
    })
  }
})
