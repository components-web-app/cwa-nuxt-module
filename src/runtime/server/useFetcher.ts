import type { H3Event } from 'h3'
import { $fetch } from 'ofetch'
import { consola } from 'consola'
import { useRuntimeConfig } from '#imports'
// @ts-expect-error this is a file built in the module
import { options } from '#cwa/server-options.ts'
import useCwaSiteConfig from '#cwa/composables/useCwaSiteConfig'
import type { CwaResource } from '#cwa/resources/resource-utils'

export const useFetcher = () => {
  const { public: { cwa: { apiUrl, apiUrlBrowser } } } = useRuntimeConfig()
  const resolvedUrl = apiUrl || apiUrlBrowser || ''
  const fetcher = $fetch.create({
    baseURL: resolvedUrl,
    headers: {
      accept: 'application/ld+json,application/json',
    },
    credentials: 'include',
  })
  return {
    fetcher,
    options,
  }
}

export const resolveConfigEventHandler = async (e?: H3Event) => {
  if (e?.context.cwaSiteConfig) {
    return e.context.cwaSiteConfig
  }
  const { mergeConfig, responseToConfig } = useCwaSiteConfig()
  const { fetcher, options } = useFetcher()
  try {
    const data = await fetcher<CwaResource>('/_/site_config_parameters', {
      credentials: 'omit',
    })

    const config = mergeConfig(options.siteConfig, responseToConfig(data, true))

    if (e)
      e.context.cwaSiteConfig = config

    return config
  }
  catch (e) {
    consola.error(e)
    return
  }
}

export default useFetcher
