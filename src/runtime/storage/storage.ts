import { defineStore } from 'pinia'
import {
  ResourcesStore
} from '@cwa/nuxt-module/runtime/storage/stores/resources/resources-store'

export interface CwaStores {
  resources: ResourcesStore
}

export class Storage {
  private readonly storeName: string
  public readonly stores: CwaStores

  constructor (storeName: string) {
    this.storeName = storeName

    this.stores = {
      resources: new ResourcesStore(storeName)
    }
  }
}
