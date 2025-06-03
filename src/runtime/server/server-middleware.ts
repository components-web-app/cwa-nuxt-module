import { defineEventHandler } from 'h3'
import useCwaSiteConfig from '#cwa/runtime/composables/useCwaSiteConfig'
import { updateSiteConfig } from '#site-config/server/composables'
import { resolveConfigEventHandler } from '#cwa/runtime/server/useFetcher'
import { getRequestURL, createError } from '#imports'

export default defineEventHandler(async (e) => {
  const resolvedConfig = await resolveConfigEventHandler()
  if (resolvedConfig) {
    const { resolvedConfigToSiteConfig } = useCwaSiteConfig()
    updateSiteConfig(e, resolvedConfigToSiteConfig(resolvedConfig))

    if (resolvedConfig.maintenanceModeEnabled) {
      const url = getRequestURL(e)
      const allowedPaths = ['/__nuxt_error', '/login']
      if (!allowedPaths.includes(url.pathname) && !url.pathname.startsWith('/_cwa') && !url.pathname.startsWith('/_/')) {
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
