import { defineNitroPlugin } from '#imports'
import type { SitemapIndexRenderCtx } from '#sitemap/types'
import type { HookRobotsConfigContext } from '#robots/types'
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
  nitroApp.hooks.hook('robots:config', async (ctx: HookRobotsConfigContext) => {
    const resolvedConfig = await resolveConfigEventHandler()
    if (!resolvedConfig) {
      return
    }
    const NonHelpfulBots = [
      'Nuclei',
      'WikiDo',
      'Riddler',
      'PetalBot',
      'Zoominfobot',
      'Go-http-client',
      'Node/simplecrawler',
      'CazoodleBot',
      'dotbot/1.0',
      'Gigabot',
      'Barkrowler',
      'BLEXBot',
      'magpie-crawler',
    ]
    const AiBots = [
      'GPTBot',
      'ChatGPT-User',
      'Claude-Web',
      'anthropic-ai',
      'Applebot-Extended',
      'Bytespider',
      'CCBot',
      'cohere-ai',
      'Diffbot',
      'FacebookBot',
      'Google-Extended',
      'ImagesiftBot',
      'PerplexityBot',
      'OmigiliBot',
      'Omigili',
    ]
    if (!resolvedConfig.robotsAllowSearchEngineCrawlers) {
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
        comment: ['Block AI Crawlers'],
        allow: [],
        disallow: ['/'],
      })
    }

    if (resolvedConfig.robotsRemoveSitemap) {
      ctx.sitemaps = []
    }
  })
})
