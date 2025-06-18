import { consola } from 'consola'
import { defineNitroPlugin, updateSiteConfig } from '#imports'
import type { SitemapIndexRenderCtx } from '#sitemap/types'
import type { HookRobotsConfigContext } from '#robots/types'
import { parseRobotsTxt, validateRobots, asArray, NonHelpfulBots, AiBots } from '#robots/util'
import { resolveConfigEventHandler } from '#cwa/runtime/server/useFetcher'

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
      disallow: ['/_api/*', '/_cwa/*'],
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
      const { errors } = validateRobots(parsedRobotsTxt)
      if (errors.length > 0) {
        consola.error(`The user defined robots.txt contains errors:`)
        for (const error of errors)
          consola.log(` - ${error}`)
        consola.log('')
      }
      // check if the robots.txt is blocking indexing
      const wildCardGroups = parsedRobotsTxt.groups.filter((group: any) => asArray(group.userAgent).includes('*'))
      if (wildCardGroups.some((group: any) => asArray(group.disallow).includes('/'))) {
        consola.warn(`The user defined robots.txt is blocking indexing for all environments.`)
        consola.info('It\'s recommended to use the `indexable` Site Config to toggle this instead.')
      }
      ctx.groups.push(...parsedRobotsTxt.groups)
      const host = parsedRobotsTxt.groups.map(g => g.host).filter(Boolean)[0]
      if (host && ctx.event) {
        updateSiteConfig(ctx.event, {
          _context: 'cwa-robots.txt',
          url: host,
        })
      }
      ctx.sitemaps.push(...parsedRobotsTxt.sitemaps)
    }
  })
})
