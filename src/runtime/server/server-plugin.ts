import type { SitemapIndexRenderCtx } from '#sitemap/types'
import type { HookRobotsConfigContext } from '#robots/types'
import { parseRobotsTxt, NonHelpfulBots, AiBots } from '#robots/util'
import { resolveConfigEventHandler } from '#cwa/server/useFetcher'
import { defineNitroPlugin } from 'nitropack/runtime'

export default defineNitroPlugin(async (nitroApp) => {
  nitroApp.hooks.hook('sitemap:index-resolved', async (ctx: SitemapIndexRenderCtx) => {
    const resolvedConfig = await resolveConfigEventHandler()
    if (!resolvedConfig || !resolvedConfig.sitemapXml || resolvedConfig.sitemapXml === '') {
      return
    }
    ctx.sitemaps.push({
      _sitemapName: 'cwa-custom',
      sitemap: '/__sitemap__/cwa-custom.xml',
    })
  })

  nitroApp.hooks.hook('robots:config', async (ctx: HookRobotsConfigContext) => {
    const resolvedConfig = await resolveConfigEventHandler()
    if (!resolvedConfig) {
      return
    }

    ctx.groups.push({
      userAgent: ['*'],
      comment: ['Block all from operational endpoints'],
      allow: [],
      disallow: ['/_cwa/*'], // _api was disallowed but is needed when client only '/_api/*',
    })

    if (!resolvedConfig.robotsAllowNonSeoCrawlers) {
      // credits to yoast.com/robots.txt
      ctx.groups.push({
        userAgent: NonHelpfulBots,
        comment: ['Block non helpful bots'],
        allow: [],
        disallow: ['/'],
      })
    }

    if (!resolvedConfig.robotsAllowAiBots) {
      ctx.groups.push({
        userAgent: AiBots,
        comment: ['Block AI crawlers'],
        allow: [],
        disallow: ['/'],
      })
    }

    if (resolvedConfig.robotsRemoveSitemap) {
      ctx.sitemaps = []
    }

    if (resolvedConfig.robotsText && resolvedConfig.robotsText !== '') {
      const parsedRobotsTxt = parseRobotsTxt(resolvedConfig.robotsText)
      ctx.groups.push(...parsedRobotsTxt.groups)
      ctx.sitemaps.push(...parsedRobotsTxt.sitemaps)
    }
  })
})
