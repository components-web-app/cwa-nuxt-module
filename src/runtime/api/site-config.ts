import { computed, ref } from 'vue'
import type {
  CwaSiteConfigStoreInterface,
  SiteConfigStore,
} from '#cwa/runtime/storage/stores/site-config/site-config-store'
import type CwaFetch from '#cwa/runtime/api/fetcher/cwa-fetch'
import { useCwaSiteConfig, updateSiteConfig } from '#imports'
import type { SiteConfigParams } from '#cwa/module'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'

export default class SiteConfig {
  private utils: ReturnType<typeof useCwaSiteConfig>
  private readonly _apiState = {
    requests: ref<Promise<CwaResource | undefined>[]>([]),
    hasError: ref(false),
  }

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
    const serverConfig = this.utils.responseToConfig(response, true)
    const resolvedConfig = this.utils.mergeConfig(this.userConfig, serverConfig)
    this.store.$patch({
      isLoading: false,
      config: resolvedConfig,
      serverConfig: serverConfig,
    })
    return resolvedConfig
  }

  public saveConfig(newConfig: Partial<SiteConfigParams>) {
    const returnData = {
      totalConfigsChanged: 0,
    }

    // only allow one update at a time
    if (this.totalRequests.value > 0 || !this.savedSiteConfig) {
      return returnData
    }

    this._apiState.hasError.value = false
    this._apiState.requests.value = []

    const changedKeys: (keyof SiteConfigParams)[] = []
    for (const [newKey, newValue] of Object.entries(newConfig) as [keyof SiteConfigParams, any][]) {
      if (this.savedSiteConfig[newKey] === undefined || newValue !== this.savedSiteConfig[newKey]) {
        changedKeys.push(newKey)
      }
    }
    returnData.totalConfigsChanged = changedKeys.length

    const allRequests: Promise<CwaResource | undefined>[] = []
    for (const changedKey of changedKeys) {
      const isCreatingConfigKey = this.savedSiteConfig[changedKey] === undefined
      const method = isCreatingConfigKey ? 'POST' : 'PATCH'
      const path = isCreatingConfigKey ? `/_/site_config_parameters` : `/_/site_config_parameters/${changedKey}`
      const value = typeof newConfig[changedKey] === 'boolean' ? JSON.stringify(newConfig[changedKey]) : newConfig[changedKey]
      const body: {
        key: keyof SiteConfigParams
        value: any
      } = {
        key: changedKey,
        value,
      }

      // @ts-expect-error Better typing for headers in this response from getRequestOptions
      const request = this.cwaFetch.fetch(path, {
        ...this.cwaFetch.getRequestOptions(method),
        body,
      })

      allRequests.push(request)
    }
    this._apiState.requests.value = allRequests

    if (!changedKeys.length) {
      return returnData
    }

    Promise.all(this._apiState.requests.value)
      .then((responses) => {
        if (responses.filter(r => r === undefined).length) {
          this._apiState.hasError.value = true
        }

        const updatedConfig: Partial<SiteConfigParams> = {}
        for (const response of responses) {
          if (response === undefined) {
            continue
          }
          const configKey = response.key as keyof SiteConfigParams
          updatedConfig[configKey] = this.utils.processApiConfigValue(response.value)
        }

        const config = this.utils.mergeConfig(this.config, updatedConfig)

        this.store.$patch({
          isLoading: false,
          config,
          serverConfig: this.utils.mergeConfig(this.savedSiteConfig || {}, updatedConfig),
        })

        this._apiState.requests.value = []
        updateSiteConfig(this.utils.resolvedConfigToSiteConfig(config))
      })
      .catch((err) => {
        console.error(err)
        this._apiState.hasError.value = true
        this.store.$patch({
          isLoading: false,
        })

        this._apiState.requests.value = []
      })

    return returnData
  }

  public get totalRequests() {
    return computed(() => this._apiState.requests.value.length)
  }

  public get apiState() {
    return { ...this._apiState }
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
    return this.storeDefinition.useStore()
  }
}
