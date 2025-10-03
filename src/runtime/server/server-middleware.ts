import { defineEventHandler, parseCookies, getRequestURL, createError } from 'h3'
import { jwtDecode } from 'jwt-decode'
import useCwaSiteConfig from '#cwa/composables/useCwaSiteConfig'
import { updateSiteConfig } from '#site-config/server/composables'
import { resolveConfigEventHandler } from '#cwa/server/useFetcher'

export default defineEventHandler(async (e) => {
  const skipMaintenanceChecks = () => {
    if (e.context.skipMaintenanceChecks === true) return true
    const allowedPaths = ['/sitemap.xml', '/sitemap_index.xml', '/robots.txt']
    if (allowedPaths.includes(e.path)) return true
    const allowedRegex = [new RegExp('^/__sitemap__/.+')]
    for (const re of allowedRegex) {
      const match = e.path.match(re)
      if (match) return true
    }
    return false
  }

  const resolvedConfig = await resolveConfigEventHandler(e)
  if (resolvedConfig) {
    const { resolvedConfigToSiteConfig } = useCwaSiteConfig()
    updateSiteConfig(e, resolvedConfigToSiteConfig(resolvedConfig))

    if (skipMaintenanceChecks()) return

    if (resolvedConfig.maintenanceModeEnabled) {
      const isUserAllowedToBypassMaintenance = () => {
        const cookies = parseCookies(e)
        if (cookies.cwa_auth !== '1' || !cookies.api_component) {
          return false
        }
        try {
          const decoded = jwtDecode<{
            roles?: string[]
            exp?: number
          }>(cookies.api_component)
          if (!decoded.roles || !Array.isArray(decoded.roles)) {
            return false
          }
          const includesAny = (arr: string[], values: string[]) => values.some(v => arr.includes(v))
          if (!includesAny(decoded.roles, ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'])) {
            return false
          }
          if (!decoded.exp) {
            return false
          }
          const expiry = new Date(decoded.exp * 1e3)
          const expired = (/* @__PURE__ */ new Date()).getTime() >= expiry.getTime()
          return !expired
        }
        catch (e2) {
          return false
        }
      }
      if (isUserAllowedToBypassMaintenance()) {
        return
      }
      const url = getRequestURL(e)
      const allowedPaths2 = ['/__nuxt_error', '/login']
      if (!allowedPaths2.includes(url.pathname) && !url.pathname.startsWith('/_cwa')) {
        const maintenanceError = createError({
          statusCode: 503,
          statusMessage: 'Website under maintenance',
        })
        maintenanceError.message = 'We will be back up and running as soon as possible'
        throw maintenanceError
      }
    }
  }
})
