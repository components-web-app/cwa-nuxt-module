import { computed, reactive, ref, watch } from 'vue'
import type { FetchError } from 'ofetch'
import { set, unset } from 'lodash-es'
import { storeToRefs } from 'pinia'
import _mergeWith from 'lodash/mergeWith'
import _isArray from 'lodash/isArray'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import CwaFetch from '../api/fetcher/cwa-fetch'
import FetchStatusManager from '../api/fetcher/fetch-status-manager'
import type {
  DeleteResourceEvent,
  SaveNewResourceEvent,
  SaveResourceEvent
} from '../storage/stores/resources/actions'
import type { ErrorStore } from '../storage/stores/error/error-store'
import type { CwaErrorEvent } from '../storage/stores/error/state'
import type { CwaResource } from './resource-utils'
import { NEW_RESOURCE_IRI } from '#cwa/runtime/storage/stores/resources/state'
import type Fetcher from '#cwa/runtime/api/fetcher/fetcher'

interface DeleteApiResourceEvent {
  endpoint: string
  requestCompleteFn?: (resource?: CwaResource) => void|Promise<void>
  refreshEndpoints?: string[]
}

interface DataApiResourceEvent extends DeleteApiResourceEvent {
  data: any
  source?: string
}

export type ApiResourceEvent = DataApiResourceEvent|DeleteApiResourceEvent

interface RequestHeaders extends Record<string, string> { }

interface RequestOptions {
  headers: RequestHeaders
  method: 'POST' | 'PATCH' | 'DELETE'
}

export class ResourcesManager {
  private cwaFetch: CwaFetch
  private resourcesStoreDefinition: ResourcesStore
  private fetchStatusManager: FetchStatusManager
  private errorStoreDefinition: ErrorStore
  private requestsInProgress = reactive<{ [id: string]: { event: ApiResourceEvent, args: [string, {}] } }>({})
  private reqCount = ref(0)

  constructor (
    cwaFetch: CwaFetch,
    resourcesStoreDefinition: ResourcesStore,
    fetchStatusManager: FetchStatusManager,
    errorStoreDefinition: ErrorStore,
    private fetcher: Fetcher
  ) {
    this.cwaFetch = cwaFetch
    this.resourcesStoreDefinition = resourcesStoreDefinition
    this.fetchStatusManager = fetchStatusManager
    this.errorStoreDefinition = errorStoreDefinition
    watch(this.reqCount, (newValue) => {
      if (newValue >= 10000) {
        this.reqCount.value = 0
      }
    })
  }

  public mergeNewResources () {
    return this.resourcesStore.mergeNewResources()
  }

  public get requestCount () {
    return computed(() => Object.values(this.requestsInProgress).reduce((count, reqs) => count + Object.values(reqs).length, 0))
  }

  public getWaitForRequestPromise (endpoint: string, property: string, source?: string) {
    const hasRequestConflict = () => {
      if (!this.requestsInProgress.value) {
        return false
      }
      for (const req of Object.values(this.requestsInProgress)) {
        if (req.event.endpoint === endpoint) {
          if ('data' in req.event) {
            return req.event.data?.[property] && (!source || req.event.source !== source)
          }
          return true
        }
      }
      return false
    }
    return new Promise<void>((resolve) => {
      if (!hasRequestConflict()) {
        resolve()
        return
      }
      const unwatch = watch(this.requestsInProgress, () => {
        // look for current events processing which are not from the same source, but are for the same resource and property
        if (hasRequestConflict()) {
          return
        }
        unwatch()
        resolve()
      })
    })
  }

  public createResource (event: DataApiResourceEvent) {
    const args: [string, {}] = [
      event.endpoint,
      { ...this.requestOptions('POST'), body: event.data }
    ]
    return this.doResourceRequest(event, args)
  }

  public deleteResource (event: ApiResourceEvent) {
    const args: [string, {}] = [
      event.endpoint,
      { ...this.requestOptions('DELETE') }
    ]
    return this.doResourceRequest(event, args)
  }

  public removeResource (event: DeleteResourceEvent) {
    return this.resourcesStore.deleteResource(event)
  }

  public updateResource (event: DataApiResourceEvent) {
    const args: [string, {}] = [
      event.endpoint,
      { ...this.requestOptions('PATCH'), body: event.data }
    ]

    if (event.endpoint === NEW_RESOURCE_IRI) {
      const { adding } = storeToRefs(this.resourcesStore)
      if (!adding.value) {
        return
      }
      adding.value = _mergeWith(adding.value, event.data, (a, b) => {
        if (_isArray(a)) {
          return b.concat(a)
        }
      })
      return
    }

    return this.doResourceRequest(event, args)
  }

  private async doResourceRequest (event: ApiResourceEvent, args: [string, {}]) {
    const source = 'source' in event ? event.source || 'unknown' : 'delete'
    const id = ++this.reqCount.value

    set(this.requestsInProgress, [source, id], { event, args })

    this.errorStore.removeByEndpoint(args[0])

    try {
      const resource = await this.cwaFetch.fetch<CwaResource>(...args)
      if (event.refreshEndpoints) {
        const fetchBathEvent = {
          paths: event.refreshEndpoints,
          shallowFetch: true
        }
        await this.fetcher.fetchBatch(fetchBathEvent)
      }
      if (event.requestCompleteFn) {
        await event.requestCompleteFn(resource)
      }
      if ('data' in event) {
        this.saveResource({
          resource
        })
      } else {
        this.removeResource({
          resource: event.endpoint
        })
      }
      return resource
    } catch (err) {
      console.log(err)
      this.errorStore.error(event, err as FetchError<any>)
    } finally {
      unset(this.requestsInProgress, [source, id])
    }
  }

  public get errors (): CwaErrorEvent[] {
    return this.errorStore.getErrors
  }

  public get hasErrors (): boolean {
    return this.errorStore.hasErrors
  }

  public removeError (id: number) {
    this.errorStore.removeById(id)
  }

  // @internal - just used in reset-password.ts - should be private and refactored for that use case
  public saveResource (event: SaveResourceEvent | SaveNewResourceEvent) {
    return this.resourcesStore.saveResource(event)
  }

  private requestOptions (method: 'POST' | 'PATCH' | 'DELETE'): RequestOptions {
    const headers: {
      accept: string
      path?: string
      'content-type'?: string
    } = {
      accept: 'application/ld+json,application/json'
    }
    if (this.fetchStatusManager.primaryFetchPath) {
      headers.path = this.fetchStatusManager.primaryFetchPath
    }
    headers['content-type'] = method === 'PATCH' ? 'application/merge-patch+json' : 'application/ld+json'
    return {
      method,
      headers
    }
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }

  private get errorStore () {
    return this.errorStoreDefinition.useStore()
  }
}
