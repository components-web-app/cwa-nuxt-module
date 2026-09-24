import process from 'node:process'
import type { H3Event } from 'h3'
import { consola } from 'consola'
import type { SitemapIndexRenderCtx } from '#sitemap/types'
import type { HookRobotsConfigContext } from '#robots/types'
import { parseRobotsTxt, NonHelpfulBots, AiBots } from '#robots/util'
import { resolveConfigEventHandler } from '#cwa/server/useFetcher'
import { defineNitroPlugin, useRuntimeConfig } from 'nitropack/runtime'
import type { ApiUrlRuntimeConfig } from '#cwa/api/api-url'
import { resolveApiUrl } from '#cwa/api/api-url'

const logger = consola.withTag('@cwa/nuxt')

function hasConfiguredSiteUrl(runtimeConfig: Record<string, any>, env: Record<string, string | undefined>): boolean {
  if (env.NUXT_SITE_URL || env.NUXT_PUBLIC_SITE_URL) {
    return true
  }
  if (runtimeConfig.site?.url || runtimeConfig.public?.site?.url) {
    return true
  }
  const stack = runtimeConfig['nuxt-site-config']?.stack
  return Array.isArray(stack) && stack.some((entry: { url?: string }) => !!entry?.url)
}

export default defineNitroPlugin(async (nitroApp) => {
  const runtimeConfig = useRuntimeConfig() as unknown as Record<string, any>
  const { source } = resolveApiUrl(runtimeConfig as unknown as ApiUrlRuntimeConfig, true)

  if (source === 'unset') {
    logger.error('No API URL is configured. Set NUXT_CWA_API_URL for the server, and NUXT_PUBLIC_CWA_API_URL_BROWSER for the browser. No API request will succeed until they are set.')
  }
  else if (source === 'public') {
    logger.warn('The server is using NUXT_PUBLIC_CWA_API_URL, which is deprecated because it publishes the API URL in every page. Set NUXT_CWA_API_URL instead.')
  }

  let siteUrlReported = false
  nitroApp.hooks.hook('afterResponse', (event: H3Event) => {
    if (siteUrlReported || !event.context.cwaPageCache || !event.context.cwaSiteConfig) {
      return
    }
    siteUrlReported = true
    if (event.context.cwaSiteConfig.canonicalUrl || hasConfiguredSiteUrl(runtimeConfig, process.env)) {
      return
    }
    logger.warn('No site URL is configured while pages are cached, so each page keeps the host of whichever request rendered it first in its absolute canonical and open graph URLs. Set canonicalUrl in the site settings, or NUXT_SITE_URL.')
  })

  nitroApp.hooks.hook('sitemap:index-resolved', async (ctx: SitemapIndexRenderCtx) => {
    const resolvedConfig = await resolveConfigEventHandler(ctx.event)
    if (!resolvedConfig || !resolvedConfig.sitemapXml || resolvedConfig.sitemapXml === '') {
      return
    }
    ctx.sitemaps.push({
      _sitemapName: 'cwa-custom',
      sitemap: '/__sitemap__/cwa-custom.xml',
    })
  })

  nitroApp.hooks.hook('robots:config', async (ctx: HookRobotsConfigContext) => {
    const resolvedConfig = await resolveConfigEventHandler(ctx.event)
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
