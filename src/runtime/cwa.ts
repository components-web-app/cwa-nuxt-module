import { NuxtApp } from '#app/nuxt'
import { CwaModuleOptions } from '../module'
import { Storage } from './storage/storage'
import Fetcher from './api/fetcher/fetcher'
import Mercure from './api/mercure'
import ApiDocumentation from './api/api-documentation'
import { CwaApiDocumentationDataInterface } from './storage/stores/api-documentation/state'
import CwaFetch from './api/fetcher/cwa-fetch'

export default class Cwa {
  public readonly apiUrl: string
  private readonly options: CwaModuleOptions
  private readonly storage: Storage
  private readonly apiDocumentation: ApiDocumentation
  public readonly mercure: Mercure
  public readonly fetcher: Fetcher
  private readonly cwaFetch: CwaFetch

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
    this.mercure = new Mercure(this.storage.stores.mercure, this.storage.stores.resources, this.storage.stores.fetcher)
    this.fetcher = new Fetcher(this.cwaFetch, this.storage.stores.fetcher, this.storage.stores.resources, nuxtApp._route, this.mercure, this.apiDocumentation)
  }

  public get stores () {
    return this.storage.stores
  }

  public async getApiDocumentation (refresh = false): Promise<CwaApiDocumentationDataInterface|undefined> {
    return await this.apiDocumentation.getApiDocumentation(refresh)
  }
}
