import { NuxtApp } from '#app/nuxt'
import { CwaModuleOptions } from '../module'
import { Storage } from './storage/storage'
import Fetcher from './api/fetcher/fetcher'
import Mercure from './api/mercure'
import ApiDocumentation from './api/api-documentation'
import { CwaApiDocumentationDataInterface } from './storage/stores/api-documentation/state'
import CwaFetch from './api/fetcher/cwa-fetch'
import FetchStatusManager from './api/fetcher/fetch-status-manager'
import { ResourcesManager } from './resources/resources-manager'

export default class Cwa {
  private readonly apiUrl: string
  private readonly options: CwaModuleOptions
  private readonly storage: Storage
  private readonly apiDocumentation: ApiDocumentation
  private readonly mercure: Mercure
  private readonly fetcher: Fetcher
  private readonly cwaFetch: CwaFetch
  public readonly resourcesManager: ResourcesManager

  constructor (nuxtApp: NuxtApp, options: CwaModuleOptions) {
    const defaultApiUrl = 'https://api-url-not-set.com'
    if (process.client) {
      this.apiUrl = options.apiUrlBrowser || options.apiUrl || defaultApiUrl
    } else {
      this.apiUrl = options.apiUrl || options.apiUrlBrowser || defaultApiUrl
    }

    this.cwaFetch = new CwaFetch(this.apiUrl)
    this.options = options
    this.storage = new Storage(this.options.storeName)
    this.apiDocumentation = new ApiDocumentation(this.cwaFetch, this.storage.stores.apiDocumentation)
    this.mercure = new Mercure(this.storage.stores.mercure, this.storage.stores.resources)
    const fetchStatusManager = new FetchStatusManager(this.storage.stores.fetcher, this.mercure, this.apiDocumentation, this.storage.stores.resources)
    this.fetcher = new Fetcher(this.cwaFetch, fetchStatusManager, nuxtApp._route)
    this.resourcesManager = new ResourcesManager(this.storage.stores.resources)

    this.mercure.setFetcher(this.fetcher)
  }

  public async getApiDocumentation (refresh = false): Promise<CwaApiDocumentationDataInterface|undefined> {
    return await this.apiDocumentation.getApiDocumentation(refresh)
  }
}
