import { useRuntimeConfig } from '#imports'
import { resolveReadinessSettings, readinessUrl } from './readiness'
import type { ReadinessConfig, ReadinessSettings } from './readiness'

export function useReadinessSettings(): ReadinessSettings & { url: string } {
  const runtimeConfig = useRuntimeConfig()
  const { apiUrl, apiUrlBrowser } = runtimeConfig.public.cwa
  const readiness = (runtimeConfig.cwa as { readiness?: ReadinessConfig } | undefined)?.readiness
  const settings = resolveReadinessSettings({ readiness })
  return { ...settings, url: readinessUrl(apiUrl || apiUrlBrowser || '', settings.path) }
}
