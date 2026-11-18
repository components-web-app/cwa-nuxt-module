import { updateSiteConfig } from '#imports'
import type CwaFetch from '#cwa/api/fetcher/cwa-fetch'
import type { CwaSiteConfigStoreInterface } from '#cwa/storage/stores/site-config/site-config-store'
import { useCwaSiteConfig } from '#cwa/composables/useCwaSiteConfig'
import type { CwaResource } from '#cwa/resources/resource-utils'
import type { SiteConfigParams } from '#cwa/types'

export interface SiteConfigSaveFailure {
  key: keyof SiteConfigParams
  error: unknown
}

export async function saveSiteConfig(
  cwaFetch: CwaFetch,
  store: CwaSiteConfigStoreInterface,
  userConfig: Partial<SiteConfigParams>,
  newConfig: Partial<SiteConfigParams>,
): Promise<SiteConfigSaveFailure[]> {
  const { mergeConfig, processApiConfigValue, resolvedConfigToSiteConfig } = useCwaSiteConfig()
  const keys = Object.keys(newConfig) as (keyof SiteConfigParams)[]
  const stored = store.serverConfig
  if (!stored) {
    return keys.map(key => ({ key, error: new Error('The site config has not loaded.') }))
  }
  const changedKeys = keys.filter(key => newConfig[key] !== stored[key])

  const outcomes = await Promise.allSettled(changedKeys.map((key) => {
    const creating = stored[key] === undefined
    const method = creating ? 'POST' : 'PATCH'
    const value = typeof newConfig[key] === 'boolean' ? JSON.stringify(newConfig[key]) : newConfig[key]
    // @ts-expect-error Better typing for headers in this response from getRequestOptions
    return cwaFetch.fetch<CwaResource>(creating ? '/_/site_config_parameters' : `/_/site_config_parameters/${key}`, {
      ...cwaFetch.getRequestOptions(method),
      body: { key, value },
    })
  }))

  const failures: SiteConfigSaveFailure[] = []
  const saved: Partial<SiteConfigParams> = {}
  outcomes.forEach((outcome, index) => {
    const key = changedKeys[index]!
    if (outcome.status === 'rejected' || outcome.value === undefined) {
      failures.push({ key, error: outcome.status === 'rejected' ? outcome.reason : undefined })
      return
    }
    const savedKey = (outcome.value.key ?? key) as keyof SiteConfigParams
    // @ts-expect-error a value of any config key
    saved[savedKey] = processApiConfigValue(outcome.value.value)
  })

  if (Object.keys(saved).length) {
    const serverConfig = { ...store.serverConfig, ...saved }
    const config = mergeConfig(userConfig, serverConfig)
    store.$patch({ serverConfig, config })
    updateSiteConfig(resolvedConfigToSiteConfig(config))
  }
  return failures
}
