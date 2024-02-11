import { computed, reactive, type Ref, ref, watch } from 'vue'
import type { FetchError } from 'ofetch'
import { set, unset } from 'lodash-es'
import { storeToRefs } from 'pinia'
import _mergeWith from 'lodash/mergeWith'
import _isArray from 'lodash/isArray'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
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
import { CwaResourceTypes, getResourceTypeFromIri } from './resource-utils'
import { NEW_RESOURCE_IRI } from '#cwa/runtime/storage/stores/resources/state'
import type Fetcher from '#cwa/runtime/api/fetcher/fetcher'
import ConfirmDialog from '#cwa/runtime/templates/components/core/ConfirmDialog.vue'
import type { AddResourceEvent, ResourceStackItem } from '#cwa/runtime/admin/resource-stack-manager'

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
  body?: any
}

export class ResourcesManager {
  private readonly cwaFetch: CwaFetch
  private readonly resourcesStoreDefinition: ResourcesStore
  private readonly fetchStatusManager: FetchStatusManager
  private readonly errorStoreDefinition: ErrorStore
  private requestsInProgress = reactive<{ [id: string]: { event: ApiResourceEvent, args: [string, {}] } }>({})
  private readonly reqCount = ref(0)
  private readonly _addResourceEvent: Ref<undefined|AddResourceEvent> = ref()

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
    const args: [string, RequestOptions] = [
      event.endpoint,
      { ...this.requestOptions('POST'), body: event.data }
    ]
    return this.doResourceRequest(event, args)
  }

  public deleteResource (event: ApiResourceEvent) {
    const args: [string, RequestOptions] = [
      event.endpoint,
      { ...this.requestOptions('DELETE') }
    ]
    return this.doResourceRequest(event, args)
  }

  public removeResource (event: DeleteResourceEvent) {
    return this.resourcesStore.deleteResource(event)
  }

  public updateResource (event: DataApiResourceEvent) {
    const args: [string, RequestOptions] = [
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

  private async doResourceRequest (event: ApiResourceEvent, args: [string, RequestOptions]) {
    const source = 'source' in event ? event.source || 'unknown' : 'delete'
    const id = ++this.reqCount.value

    set(this.requestsInProgress, [source, id], { event, args })

    this.errorStore.removeByEndpoint(args[0])

    try {
      const resource = await this.cwaFetch.fetch<CwaResource>(...args)
      const refreshEndpoints = event.refreshEndpoints || []
      if (args[1].method === 'POST') {
        // if we create a resource and have also created component position(s), we need to fetch those now
        if (resource.componentPositions) {
          refreshEndpoints.push(...resource.componentPositions)
        }
        // component groups should be added by the calling api
      }
      if (refreshEndpoints.length) {
        const fetchBathEvent = {
          paths: refreshEndpoints,
          shallowFetch: true
        }
        await this.fetcher.fetchBatch(fetchBathEvent)
      }
      if (event.requestCompleteFn) {
        await event.requestCompleteFn(resource as CwaResource|undefined)
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

  public async initAddResource (targetIri: string, addAfter: boolean, resourceStack: ResourceStackItem[]) {
    type BaseEvent = {
      targetIri: string
      addAfter: boolean
    }
    const initEvent: BaseEvent = {
      targetIri,
      addAfter
    }

    const findClosestResourceByType = (type: CwaResourceTypes): string => {
      for (const stackItem of resourceStack) {
        if (getResourceTypeFromIri(stackItem.iri) === type) {
          return stackItem.iri
        }
      }
      throw new Error(`Could not find a resource with type '${type}' in the stack`)
    }

    const findClosestPosition = (event: BaseEvent): string|undefined => {
      if (getResourceTypeFromIri(event.targetIri) !== CwaResourceTypes.COMPONENT_GROUP) {
        return findClosestResourceByType(CwaResourceTypes.COMPONENT_POSITION)
      }
      return findPositionFromGroupEvent(event)
    }

    const findPositionFromGroupEvent = (event: BaseEvent): string|undefined => {
      const resource = this.resourcesStore.current.byId?.[event.targetIri]
      const positions = resource?.data?.componentPositions
      if (!positions || !positions.length) {
        return
      }
      if (event.addAfter) {
        return positions[positions.length - 1]
      } else {
        return positions[0]
      }
    }

    const closestPosition = findClosestPosition(initEvent)
    const closestGroup = findClosestResourceByType(CwaResourceTypes.COMPONENT_GROUP)

    if (!await this.confirmDiscardAddingResource()) {
      return
    }

    this._addResourceEvent.value = {
      targetIri,
      addAfter,
      closest: {
        position: closestPosition,
        group: closestGroup
      }
    }
  }

  public setAddResourceEventResource (resourceType: string, endpoint: string, isPublishable: boolean, instantAdd: boolean) {
    if (!this._addResourceEvent.value) {
      return
    }
    this.resourcesStore.initNewResource(resourceType, endpoint, isPublishable, instantAdd)
  }

  public clearAddResource () {
    this._addResourceEvent.value = undefined
    const { adding } = storeToRefs(this.resourcesStore)
    adding.value = undefined
  }

  public get addResourceEvent () {
    return this._addResourceEvent
  }

  public async confirmDiscardAddingResource () {
    if (!this._addResourceEvent.value) {
      return true
    }
    const alertData = {
      title: 'Discard new resource?',
      content: '<p>Are you sure you want to discard your new resource. It will NOT be saved.</p>'
    }
    // @ts-ignore-next-line
    const dialog = createConfirmDialog(ConfirmDialog)
    const { isCanceled } = await dialog.reveal(alertData)

    if (isCanceled) {
      return false
    }
    this.clearAddResource()
    return true
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }

  private get errorStore () {
    return this.errorStoreDefinition.useStore()
  }
}
