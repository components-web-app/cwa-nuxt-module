import type {
  CwaSiteConfigStoreInterface,
  SiteConfigStore,
} from '#cwa/runtime/storage/stores/site-config/site-config-store'
import type CwaFetch from '#cwa/runtime/api/fetcher/cwa-fetch'

export default class SiteConfig {
  constructor(
    private readonly cwaFetch: CwaFetch,
    private readonly storeDefinition: SiteConfigStore) {}

  public async loadConfig() {
    this.store.$patch({
      isLoading: true,
    })
    const response = await this.cwaFetch.fetch('/_/site_config_parameters')
    console.log('load config', response)
    /*
    const { _data: data } = await response
    if (data) {
      if (data['hydra:member'] && Array.isArray(data['hydra:member'])) {
        const loadedConfig: Partial<SiteConfigParams> = {}
        for (const configParam of data['hydra:member']) {
          loadedConfig[configParam.key as keyof SiteConfigParams] = processApiValue(configParam.value)
        }
        loadedSettings.value = { ...loadedConfig }
        allSettings.value = Object.assign({}, defaultSettings, loadedConfig)
      }
    }
     */
    this.store.$patch({
      isLoading: false,
    })
  }

  public get siteConfig() {
    return this.store.getConfig
  }

  private get store(): CwaSiteConfigStoreInterface {
    return this.storeDefinition.useStore()
  }
}
