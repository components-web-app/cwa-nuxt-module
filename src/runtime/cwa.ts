import { NuxtApp } from '#app/nuxt'
import { CwaModuleOptions } from '../module'
import { Storage } from './storage/storage'
import { Fetcher } from './api/fetcher/fetcher'

export default class Cwa {
  private readonly nuxtApp: NuxtApp
  private readonly options: CwaModuleOptions
  private readonly storage: Storage
  public readonly fetcher: Fetcher

  constructor (nuxtApp: NuxtApp, options: CwaModuleOptions) {
    const apiUrl = options.apiUrlBrowser || options.apiUrl || 'https://api-url-not-set.com'
    this.nuxtApp = nuxtApp
    this.options = options
    this.storage = new Storage(this.options.storeName)
    const currentRoute = nuxtApp._route
    this.fetcher = new Fetcher(apiUrl, this.storage.stores.resources, currentRoute)
  }

  public get stores () {
    return this.storage.stores
  }
}
