import { defineStore } from 'pinia'
import { reactive } from '#imports'

export interface CwaStore {
  resources: {
    new: any
    current: any
    categories: any
  }
}

export class Storage {
  private readonly storeName: string
  public readonly store: CwaStore

  constructor (storeName: string) {
    this.storeName = storeName
    const storeDefinition = defineStore(this.storeName, (): CwaStore => {
      const resources = reactive({
        new: {},
        current: {},
        categories: {}
      })
      return { resources }
    })
    this.store = storeDefinition()
  }
}
