import { useRuntimeConfig } from '#imports'
import { resolvePageCacheWarmSettings } from './page-cache-warm'
import type { PageCacheWarmConfig, PageCacheWarmSettings } from './page-cache-warm'

export function usePageCacheWarmSettings(): PageCacheWarmSettings {
  const runtimeConfig = useRuntimeConfig()
  const { apiUrl, apiUrlBrowser } = runtimeConfig.public.cwa
  const pageCacheWarm = (runtimeConfig.cwa as { pageCacheWarm?: PageCacheWarmConfig } | undefined)?.pageCacheWarm
  return resolvePageCacheWarmSettings({ apiUrl, apiUrlBrowser, pageCacheWarm })
}
