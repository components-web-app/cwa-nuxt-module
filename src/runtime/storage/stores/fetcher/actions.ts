import { ResourcesStore } from '../resources/resources-store'
import { CwaFetcherStateInterface } from './state'
import { CwaFetcherGettersInterface } from '@cwa/nuxt-module/runtime/storage/stores/fetcher/getters'

export interface CwaFetcherActionsInterface {
}

export default function (fetcherState: CwaFetcherStateInterface, fetcherGetters: CwaFetcherGettersInterface, resourcesStore: ResourcesStore): CwaFetcherActionsInterface {
  return {
  }
}
