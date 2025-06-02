import { defineNitroPlugin } from '#imports'
import type { SitemapIndexRenderCtx } from '#sitemap/types'
import { resolveConfigEventHandler } from '#cwa/runtime/server/useFetcher'

export default defineNitroPlugin(async (nitroApp) => {
  nitroApp.hooks.hook('sitemap:index-resolved', async (ctx: SitemapIndexRenderCtx) => {
    const resolvedConfig = await resolveConfigEventHandler()
    if (!resolvedConfig || !resolvedConfig.sitemapXml || resolvedConfig.sitemapXml === '') {
      return
    }
    ctx.sitemaps.push({
      _sitemapName: 'cwa-custom',
      sitemap: 'https://localhost:3000/__sitemap__/cwa-custom.xml',
    })
  })
})
