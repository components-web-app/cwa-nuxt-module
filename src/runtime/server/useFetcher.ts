import { $fetch } from 'ofetch'
import { consola } from 'consola'
import { useRuntimeConfig } from '#imports'
// @ts-expect-error this is a file built in the module
import { options } from '#cwa/server-options.ts'
import useCwaSiteConfig from '#cwa/runtime/composables/useCwaSiteConfig'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'

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

export const resolveConfigEventHandler = async () => {
  const { mergeConfig, responseToConfig } = useCwaSiteConfig()
  const { fetcher, options } = useFetcher()
  try {
    const data = await fetcher<CwaResource>('/_/site_config_parameters')
    return mergeConfig(options.siteConfig, responseToConfig(data, true))
  }
  catch (e) {
    consola.error(e)
    return
  }
}

export default useFetcher
