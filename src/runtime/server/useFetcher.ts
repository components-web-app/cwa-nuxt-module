import { $fetch } from 'ofetch'
import { useRuntimeConfig } from '#imports'
// @ts-expect-error this is a file built in the module
import { options } from '#cwa/server-options.ts'

export const useFetcher = () => {
  const { public: { cwa: { apiUrl, apiUrlBrowser } } } = useRuntimeConfig()
  const resolvedUrl = apiUrl || apiUrlBrowser || options.apiUrl || options.apiUrlBrowser || ''
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

export default useFetcher
