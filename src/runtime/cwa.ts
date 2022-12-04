import { NuxtApp } from '#app/nuxt'
import { CwaModuleOptions } from '../module'
import { Storage } from './storage/storage'
import { Fetcher } from './api/fetcher/fetcher'
import Mercure from './api/mercure'
import ApiDocumentation from './api/api-documentation'
import { CwaApiDocumentationDataInterface } from './storage/stores/api-documentation/state'

export default class Cwa {
  private readonly nuxtApp: NuxtApp
  private readonly options: CwaModuleOptions
  private readonly storage: Storage
  public readonly mercure: Mercure
  public readonly apiDocumentation: ApiDocumentation
  public readonly fetcher: Fetcher

  constructor (nuxtApp: NuxtApp, options: CwaModuleOptions) {
    const apiUrl = options.apiUrlBrowser || options.apiUrl || 'https://api-url-not-set.com'

    this.nuxtApp = nuxtApp
    this.options = options
    this.storage = new Storage(this.options.storeName)
    const currentRoute = nuxtApp._route
    this.mercure = new Mercure(this.storage.stores.mercure, this.storage.stores.resources, this.storage.stores.fetcher)
    this.apiDocumentation = new ApiDocumentation(apiUrl, this.storage.stores.apiDocumentation)
    this.fetcher = new Fetcher(apiUrl, this.storage.stores.fetcher, this.storage.stores.resources, currentRoute, this.mercure, this.apiDocumentation)
  }

  public get stores () {
    return this.storage.stores
  }

  public async getApiDocumentation (refresh = false): Promise<CwaApiDocumentationDataInterface|undefined> {
    return await this.apiDocumentation.getApiDocumentation()
  }
}
