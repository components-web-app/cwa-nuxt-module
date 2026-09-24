import { defineEventHandler, parseCookies, getRequestURL, getRequestHeader, createError } from 'h3'
import { jwtDecode } from 'jwt-decode'
import useCwaSiteConfig from '#cwa/composables/useCwaSiteConfig'
import { updateSiteConfig } from '#site-config/server/composables'
import { resolveConfigEventHandler } from '#cwa/server/useFetcher'
import { ADMIN_ROLES, isAdmin } from '#cwa/server/is-admin'

const ADMIN_CHECK_TIMEOUT = 3000

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
      const claimsLiveAdminToken = () => {
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
          if (!decoded.roles.some(role => ADMIN_ROLES.includes(role))) {
            return false
          }
          if (!decoded.exp) {
            return false
          }
          return Date.now() < decoded.exp * 1e3
        }
        catch {
          return false
        }
      }
      if (claimsLiveAdminToken() && await isAdmin(getRequestHeader(e, 'cookie'), ADMIN_CHECK_TIMEOUT)) {
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
