import { defineEventHandler } from 'h3'
import useCwaSiteConfig from '#cwa/runtime/composables/useCwaSiteConfig'
import { updateSiteConfig } from '#site-config/server/composables'
import { resolveConfigEventHandler } from '#cwa/runtime/server/useFetcher'

export default defineEventHandler(async (e) => {
  const resolvedConfig = await resolveConfigEventHandler(e)
  if (resolvedConfig) {
    const { resolvedConfigToSiteConfig } = useCwaSiteConfig()
    updateSiteConfig(e, resolvedConfigToSiteConfig(resolvedConfig))
  }
})
