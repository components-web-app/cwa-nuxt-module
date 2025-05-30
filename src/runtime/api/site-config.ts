import type {
  CwaSiteConfigStoreInterface,
  SiteConfigStore,
} from '#cwa/runtime/storage/stores/site-config/site-config-store'
import type CwaFetch from '#cwa/runtime/api/fetcher/cwa-fetch'
import { useCwaSiteConfig } from '#imports'
import type { SiteConfigParams } from '#cwa/module'

export default class SiteConfig {
  private utils: ReturnType<typeof useCwaSiteConfig>

  constructor(
    private readonly cwaFetch: CwaFetch,
    private readonly storeDefinition: SiteConfigStore,
    private readonly userConfig: Partial<SiteConfigParams>,
  ) {
    this.utils = useCwaSiteConfig()
  }

  public async loadConfig() {
    this.store.$patch({
      isLoading: true,
    })
    const response = await this.cwaFetch.fetch('/_/site_config_parameters')
    const serverConfig = this.utils.responseToConfig(response)
    const resolvedConfig = this.utils.mergeConfig(this.userConfig, serverConfig)
    this.store.$patch({
      isLoading: false,
      config: resolvedConfig,
    })
    return resolvedConfig
  }

  public get isLoading() {
    return this.store.isLoading
  }

  public get siteConfig() {
    return this.store.getConfig
  }

  private get store(): CwaSiteConfigStoreInterface {
    return this.storeDefinition.useStore()
  }
}
