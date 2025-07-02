import { defineEventHandler } from 'h3'
import { jwtDecode } from 'jwt-decode'
import useCwaSiteConfig from '#cwa/runtime/composables/useCwaSiteConfig'
import { updateSiteConfig } from '#site-config/server/composables'
import { resolveConfigEventHandler } from '#cwa/runtime/server/useFetcher'
import { getRequestURL, createError, parseCookies } from '#imports'

export default defineEventHandler(async (e) => {
  const resolvedConfig = await resolveConfigEventHandler()
  if (resolvedConfig) {
    const { resolvedConfigToSiteConfig } = useCwaSiteConfig()
    if (!resolvedConfig.indexable) {
      console.error('Indexable was not true. Debugging how this can happen.In `resolvedConfig`')
      console.trace()
      console.log(resolvedConfig)
    }
    updateSiteConfig(e, resolvedConfigToSiteConfig(resolvedConfig))
    if (resolvedConfig.maintenanceModeEnabled) {
      const isUserAllowedToBypassMaintenance = () => {
        const cookies = parseCookies(e)
        if (cookies.cwa_auth !== '1' || !cookies.api_component) {
          return false
        }
        try {
          const decoded = jwtDecode<{ roles?: string[], exp?: number }>(cookies.api_component)
          if (!decoded.roles || !Array.isArray(decoded.roles)) {
            return false
          }
          const includesAny = (arr: string[], values: string[]) => values.some(v => arr.includes(v))
          if (!includesAny(decoded.roles, ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'])) {
            return false
          }
          // ROLE_ADMIN
          if (!decoded.exp) {
            return false
          }
          const expiry = new Date(decoded.exp * 1000)
          const expired = (new Date()).getTime() >= expiry.getTime()
          if (expired) {
            return false
          }

          return true
        }
        catch (e) {
          // failed to decode, show the error page, invalid, ta
          return false
        }
      }
      if (isUserAllowedToBypassMaintenance()) {
        return
      }

      const url = getRequestURL(e)
      const allowedPaths = ['/__nuxt_error', '/login']
      if (!allowedPaths.includes(url.pathname) && !url.pathname.startsWith('/_cwa')) {
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
