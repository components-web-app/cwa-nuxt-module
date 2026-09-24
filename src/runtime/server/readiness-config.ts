import { useRuntimeConfig } from '#imports'
import { resolveReadinessSettings, readinessUrl } from './readiness'
import type { ReadinessConfig, ReadinessSettings } from './readiness'
import type { ApiUrlRuntimeConfig } from '#cwa/api/api-url'
import { resolveApiUrl } from '#cwa/api/api-url'

export function useReadinessSettings(): ReadinessSettings & { url: string } {
  const runtimeConfig = useRuntimeConfig()
  const { url } = resolveApiUrl(runtimeConfig as ApiUrlRuntimeConfig, true)
  const readiness = (runtimeConfig.cwa as { readiness?: ReadinessConfig } | undefined)?.readiness
  const settings = resolveReadinessSettings({ readiness })
  return { ...settings, url: readinessUrl(url, settings.path) }
}
