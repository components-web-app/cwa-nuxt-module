import { defaultContentType, defineEventHandler } from 'h3'
import { consola } from 'consola'
import useFetcher from '#cwa/runtime/server/useFetcher'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import useCwaSiteConfig from '#cwa/runtime/composables/useCwaSiteConfig'
import { createError } from '#imports'

// this endpoint will return a sitemap as defined by a user in the settings page
export default defineEventHandler(async (event) => {
  const { fetcher, options } = useFetcher()
  const { mergeConfig, responseToConfig } = useCwaSiteConfig()
  try {
    const data = await fetcher<CwaResource>('/_/site_config_parameters')
    const resolvedConfig = mergeConfig(options.siteConfig, responseToConfig(data, true))

    defaultContentType(event, 'application/xml')
    const sitemapXml = resolvedConfig.sitemapXml
    if (!sitemapXml || sitemapXml === '') {
      return `<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="/__sitemap__/style.xsl"?>
<urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd http://www.google.com/schemas/sitemap-image/1.1 http://www.google.com/schemas/sitemap-image/1.1/sitemap-image.xsd" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`
    }
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
