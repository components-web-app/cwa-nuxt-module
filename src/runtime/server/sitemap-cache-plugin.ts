import type { H3Event } from 'h3'
import { setResponseHeader } from 'h3'
import { defineNitroPlugin } from 'nitropack/runtime'
import { buildSitemapCacheHeaders } from '#cwa/api/sitemap-cache'
import { useSitemapCacheSettings } from './sitemap-cache-config'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event: H3Event) => {
    if (event.context._isSitemap !== true) {
      return
    }

    if (event.node.res.statusCode !== 200) {
      return
    }

    const { apiUrl, options } = useSitemapCacheSettings()
    const decision = buildSitemapCacheHeaders({ apiUrl, options })

    setResponseHeader(event, 'Surrogate-Key', decision.surrogateKey)
    setResponseHeader(event, 'Cache-Control', decision.cacheControl)
  })
})
