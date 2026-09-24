import { useRuntimeConfig } from '#imports'
import { resolvePageCacheWarmSettings } from './page-cache-warm'
import type { PageCacheWarmConfig, PageCacheWarmSettings } from './page-cache-warm'
import type { ApiUrlRuntimeConfig } from '#cwa/api/api-url'
import { resolveApiUrl } from '#cwa/api/api-url'

export function usePageCacheWarmSettings(): PageCacheWarmSettings {
  const runtimeConfig = useRuntimeConfig()
  const { url } = resolveApiUrl(runtimeConfig as ApiUrlRuntimeConfig, true)
  const pageCacheWarm = (runtimeConfig.cwa as { pageCacheWarm?: PageCacheWarmConfig } | undefined)?.pageCacheWarm
  return resolvePageCacheWarmSettings({ apiUrl: url, pageCacheWarm })
}
