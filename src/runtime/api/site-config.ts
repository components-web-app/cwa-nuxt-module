import type {
  CwaSiteConfigStoreInterface,
  SiteConfigStore,
} from '#cwa/storage/stores/site-config/site-config-store'
import type CwaFetch from '#cwa/api/fetcher/cwa-fetch'
import { useCwaSiteConfig } from '#cwa/composables/useCwaSiteConfig'
import type { SiteConfigParams } from '#cwa/types'
import type { CwaResource } from '#cwa/resources/resource-utils'
import type { SiteConfigSaveFailure } from '#cwa/api/site-config-save'
import type { PageCacheWarmProgress, PageCacheWarmSummary } from '#cwa/api/page-cache-warm'

export default class SiteConfig {
  private utils: ReturnType<typeof useCwaSiteConfig>
  private readonly _store: CwaSiteConfigStoreInterface

  constructor(
    private readonly cwaFetch: CwaFetch,
    private readonly storeDefinition: SiteConfigStore,
    private readonly userConfig: Partial<SiteConfigParams>,
  ) {
    this.utils = useCwaSiteConfig()
    this._store = this.storeDefinition.useStore()
  }

  public async loadConfig(eventContext?: Record<string, any>) {
    const preloadedConfig = eventContext?.cwaSiteConfig as SiteConfigParams | undefined
    if (preloadedConfig) {
      this.store.$patch({
        isLoading: false,
        config: preloadedConfig,
        serverConfig: (eventContext?.cwaSiteConfigServerValues ?? preloadedConfig) as Partial<SiteConfigParams>,
      })
      return preloadedConfig
    }
    this.store.$patch({
      isLoading: true,
    })
    let response: CwaResource
    try {
      response = await this.cwaFetch.fetch('/_/site_config_parameters', {
        credentials: 'omit',
      })
    }
    catch (error) {
      this.store.$patch({
        isLoading: false,
      })
      throw error
    }
    const serverConfig = this.utils.responseToConfig(response, true)
    const resolvedConfig = this.utils.mergeConfig(this.userConfig, serverConfig)
    this.store.$patch({
      isLoading: false,
      config: resolvedConfig,
      serverConfig: serverConfig,
    })
    return resolvedConfig
  }

  public async saveConfig(newConfig: Partial<SiteConfigParams>): Promise<SiteConfigSaveFailure[]> {
    const { saveSiteConfig } = await import('#cwa/api/site-config-save')
    return saveSiteConfig(this.cwaFetch, this.store, this.userConfig, newConfig)
  }

  public async purgePageCache(): Promise<void> {
    const { method, headers } = this.cwaFetch.getRequestOptions('POST')
    await this.cwaFetch.fetch('/_/rendered_html/purge', {
      method,
      headers: headers as Record<string, string>,
    })
  }

  public async purgeHttpCache(body?: { paths?: string[], tags?: string[] }): Promise<void> {
    const { method, headers } = this.cwaFetch.getRequestOptions('POST')
    await this.cwaFetch.fetch('/_/http_cache/purge', {
      method,
      headers: headers as Record<string, string>,
      body,
    })
  }

  public async warmPageCache(onProgress: (progress: PageCacheWarmProgress) => void): Promise<PageCacheWarmSummary> {
    const stream = await $fetch<ReadableStream<Uint8Array>>('/_cwa/page-cache/warm', {
      method: 'POST',
      responseType: 'stream',
    })
    const { readWarmStream } = await import('#cwa/api/page-cache-warm')
    return readWarmStream(stream, onProgress)
  }

  public get isLoading() {
    return this.store.isLoading
  }

  public get savedSiteConfig() {
    return this.store.serverConfig
  }

  public get config() {
    return this.store.getConfig
  }

  private get store(): CwaSiteConfigStoreInterface {
    return this._store
  }
}
