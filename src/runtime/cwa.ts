import { NuxtApp } from '#app/nuxt'
import { Storage } from './storage/storage'
import { CwaModuleOptions } from '@cwa/nuxt-module/module'
import { Fetcher } from '@cwa/nuxt-module/runtime/api/fetcher'

export default class Cwa {
  private readonly nuxtApp: NuxtApp
  private readonly options: CwaModuleOptions
  private readonly fetcher: Fetcher
  private readonly storage: Storage

  constructor (nuxtApp: NuxtApp, options: CwaModuleOptions) {
    this.nuxtApp = nuxtApp
    this.options = options
    this.fetcher = new Fetcher()
    this.storage = new Storage(this.options.storeName)
  }

  public get store() {
    return this.storage.store
  }
}
