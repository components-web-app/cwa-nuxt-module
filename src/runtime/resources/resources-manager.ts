import { computed, type ComputedRef, nextTick, reactive, type Ref, ref, watch } from 'vue'
import type { FetchError } from 'ofetch'
import { set, unset } from 'lodash-es'
import _mergeWith from 'lodash/mergeWith.js'
import _isArray from 'lodash/isArray.js'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import { DateTime } from 'luxon'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import CwaFetch from '../api/fetcher/cwa-fetch'
import FetchStatusManager from '../api/fetcher/fetch-status-manager'
import type { DeleteResourceEvent, SaveNewResourceEvent, SaveResourceEvent } from '../storage/stores/resources/actions'
import type { ErrorStore } from '../storage/stores/error/error-store'
import type { CwaErrorEvent } from '../storage/stores/error/state'
import {
  type CwaResource,
  CwaResourceTypes,
  getPublishedResourceIri,
  getPublishedResourceState,
  getResourceTypeFromIri
} from './resource-utils'
import { NEW_RESOURCE_IRI } from '#cwa/runtime/storage/stores/resources/state'
import type Fetcher from '#cwa/runtime/api/fetcher/fetcher'
import ConfirmDialog from '#cwa/runtime/templates/components/core/ConfirmDialog.vue'
import type { AddResourceEvent, ResourceStackItem } from '#cwa/runtime/admin/resource-stack-manager'
import Admin from '#cwa/runtime/admin/admin'
import type { Resources } from '#cwa/runtime/resources/resources'

interface DeleteApiResourceEvent {
  endpoint: string
  requestCompleteFn?: (resource?: CwaResource) => void|Promise<void>
  saveCompleteFn?: (resource?: CwaResource) => void|Promise<void>
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
  private _requestCount?: ComputedRef<number>

  constructor (
    cwaFetch: CwaFetch,
    resourcesStoreDefinition: ResourcesStore,
    fetchStatusManager: FetchStatusManager,
    errorStoreDefinition: ErrorStore,
    private readonly fetcher: Fetcher,
    private readonly admin: Admin,
    private readonly resources: Resources
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
    if (this._requestCount) {
      return this._requestCount
    }
    this._requestCount = computed(() => Object.values(this.requestsInProgress).reduce((count, reqs) => count + Object.values(reqs).length, 0))
    return this._requestCount
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

  private async confirmDelete () {
    const alertData = {
      title: 'Delete this resource?',
      content: '<p>Are you sure you want to permanently delete this resource?</p>'
    }
    // @ts-ignore-next-line
    const dialog = createConfirmDialog(ConfirmDialog)
    const { isCanceled } = await dialog.reveal(alertData)

    return !isCanceled
  }

  private getEndpointForIri (iri: string) {
    const resource = this.resourcesStore.getResource(iri)?.data
    if (!resource) {
      return iri
    }
    const isDraft = getPublishedResourceState({ data: resource }) === false
    const postfix = isDraft ? '?published=false' : '?published=true'
    return `${iri}${postfix}`
  }

  public async deleteResource (event: ApiResourceEvent) {
    if (!await this.confirmDelete()) {
      return false
    }
    const args: [string, RequestOptions] = [
      this.getEndpointForIri(event.endpoint),
      { ...this.requestOptions('DELETE') }
    ]
    return this.doResourceRequest(event, args)
  }

  public removeResource (event: DeleteResourceEvent) {
    return this.resourcesStore.deleteResource(event)
  }

  public async updateResource (event: DataApiResourceEvent) {
    const iri = event.endpoint.split('?')[0]
    const currentResource = this.resourcesStore.getResource(iri)?.data

    const args: [string, RequestOptions] = [
      event.endpoint,
      { ...this.requestOptions('PATCH'), body: event.data }
    ]

    // if the resource is not persisted to the api but a request is updated, we just save it locally in the store
    // it'll update anything visually until client-side refresh
    if (currentResource?._metadata.persisted === false) {
      const newResource = _mergeWith(currentResource, event.data, (a, b) => {
        if (_isArray(a)) {
          return b.concat(a)
        }
      })
      this.saveResource({
        resource: newResource
      })
      return
    }

    const currentIsDraft = getPublishedResourceState({ data: currentResource }) === false
    let isPublishing = false
    let existingLiveIri: string|null = null

    // if we are publishing, then we are adding positions to refresh as well. Could possibly bypass this and adjust locally manually.
    if (currentIsDraft) {
      isPublishing = event.data.publishedAt <= DateTime.local().toUTC().toISO()
      if (isPublishing) {
        existingLiveIri = currentResource ? getPublishedResourceIri(currentResource) : null
        const currentLiveResource = existingLiveIri ? this.resourcesStore.getResource(existingLiveIri)?.data : undefined
        // if we are publishing a resource, we can refresh all the components positions as well
        if (currentLiveResource) {
          // publishing a new resource here
          const updatingResourcePositions = currentLiveResource.componentPositions
          if (updatingResourcePositions) {
            const existingRefreshEndpoints = event.refreshEndpoints || []
            event.refreshEndpoints = [...existingRefreshEndpoints, ...updatingResourcePositions]
          }
        }
      }
    }

    const isPublishingAndOverwritingPreviousLiveResource = isPublishing && currentResource && existingLiveIri && existingLiveIri !== iri

    const postRequestFn = () => {
      // if we have just published a resource, remove the old draft and turn off edit mode
      if (isPublishingAndOverwritingPreviousLiveResource) {
        this.admin.emptyStack()
      }
    }

    const postSaveFn = () => {
      // if we have just published a resource, remove the old draft and turn off edit mode
      if (isPublishingAndOverwritingPreviousLiveResource) {
        this.removeResource({ resource: event.endpoint })
      }
    }

    const resource = await this.doResourceRequest(event, args, postRequestFn, postSaveFn)

    // if we have just done an update that creates a new draft, we need to select the draft
    const responseId = resource?.['@id']
    if (responseId && responseId !== iri) {
      // show a draft if draft is created - also unset if we have just published so we are not trying to view a draft
      this.admin.resourceStackManager.forcePublishedVersion.value = isPublishing ? undefined : false
    }

    return resource
  }

  private async doResourceRequest (event: ApiResourceEvent, args: [string, RequestOptions], postRequestFn?: (resource?: CwaResource) => void|Promise<void>, postSaveFn?: (resource?: CwaResource) => void|Promise<void>) {
    const source = 'source' in event ? event.source || 'unknown' : 'delete'
    const id = ++this.reqCount.value
    const iri = event.endpoint.split('?')[0]

    set(this.requestsInProgress, [source, id], { event, args })

    this.errorStore.removeByEndpoint(args[0])

    try {
      // not a fetch - is a post patch or delete so do not use fetcher
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
        const fetchBathEvent: { paths: string[], shallowFetch: 'noexist' } = {
          paths: refreshEndpoints,
          shallowFetch: 'noexist'
        }
        try {
          await this.fetcher.fetchBatch(fetchBathEvent)
        } catch (err) {
          // issues refreshing endpoints which are no longer found can be common
          const fetchError = err as FetchError<any>
          if (fetchError?.statusCode !== 404) {
            throw err
          }
        }
      }
      if (postRequestFn) {
        await postRequestFn(resource as CwaResource|undefined)
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
          resource: iri
        })
      }
      // required if we need to update the store further before we process mercure requests again, but need the new resource to be up to date in data as well.
      // implemented to ensure we remove old drafts when a new live has been overwritten
      if (postSaveFn) {
        await postSaveFn(resource as CwaResource|undefined)
      }
      if (event.saveCompleteFn) {
        await event.saveCompleteFn(resource as CwaResource|undefined)
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

  public async initAddResource (targetIri: string, addAfter: null|boolean, resourceStack: ResourceStackItem[], pageDataProperty?: string) {
    type BaseEvent = {
      targetIri: string
      addAfter: null|boolean
    }
    const initEvent: BaseEvent = {
      targetIri,
      addAfter
    }

    const findClosestResourceByType = (type: CwaResourceTypes): string|undefined => {
      for (const stackItem of resourceStack) {
        if (getResourceTypeFromIri(stackItem.iri) === type) {
          return stackItem.iri
        }
      }
      // group not in a stack on dynamic data page and not needed if adding into a position
      // throw new Error(`Could not find a resource with type '${type}' in the stack`)
    }

    const findClosestPositionFromGroupEvent = (event: BaseEvent): string|undefined => {
      const resource = this.resourcesStore.current.byId?.[event.targetIri]
      const positions = resource?.data?.componentPositions
      if (!positions || !positions.length) {
        return
      }
      if (event.addAfter === true) {
        return positions[positions.length - 1]
      } else if (event.addAfter === false) {
        return positions[0]
      }
    }

    const findClosestPosition = (event: BaseEvent): string|undefined => {
      if (getResourceTypeFromIri(event.targetIri) !== CwaResourceTypes.COMPONENT_GROUP) {
        return findClosestResourceByType(CwaResourceTypes.COMPONENT_POSITION)
      }
      return findClosestPositionFromGroupEvent(event)
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
      },
      pageDataProperty
    }
  }

  public async setAddResourceEventResource (resourceType: string, endpoint: string, isPublishable: boolean, instantAdd: boolean, defaultData?: { [key: string]: any }) {
    if (!this._addResourceEvent.value) {
      return
    }
    this.resourcesStore.initNewResource(this._addResourceEvent.value, resourceType, endpoint, isPublishable, instantAdd, defaultData)

    await nextTick(() => {
      !instantAdd && this.admin.eventBus.emit('selectResource', NEW_RESOURCE_IRI)
    })
  }

  public clearAddResourceEventResource () {
    this.resourcesStore.resetNewResource()
  }

  public clearAddResource () {
    this._addResourceEvent.value = undefined
    this.clearAddResourceEventResource()
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

  async addResourceAction (publish?: boolean) {
    const addEvent = this._addResourceEvent.value
    if (!addEvent || !this.resourcesStore.adding?.resource) {
      throw new Error('Cannot add resource. No addResource event is present')
    }

    const resource = this.resourcesStore.getResource(this.resourcesStore.adding.resource)?.data
    if (!resource) {
      throw new Error('Cannot add resource. No new resource exists in the store with data')
    }
    const addingMeta = resource._metadata.adding
    if (!addingMeta) {
      throw new Error('Cannot add resource. There was no adding metadata on the new resource in the store.')
    }

    const refreshEndpoints = []

    if (addEvent.addAfter !== null) {
      const positionIri = this.resourcesStore.adding.position
      if (!positionIri) {
        throw new Error('Position resource is not adding, but we are adding before/after another position so it should be')
      }

      const positionData = this.resourcesStore.getResource(positionIri)?.data
      if (!positionData) {
        throw new Error('Position resource being added not found')
      }

      addEvent.closest.group && refreshEndpoints.push(addEvent.closest.group)

      const getPositionSortValue = () => {
        let targetPosition: string|undefined
        if (getResourceTypeFromIri(addEvent.targetIri) === CwaResourceTypes.COMPONENT_GROUP) {
          const groupResource = this.resourcesStore.getResource(addEvent.targetIri)?.data
          if (!groupResource?.componentPositions || groupResource?.componentPositions.length === 0) {
            return 0
          }
          targetPosition = addEvent.addAfter ? groupResource.componentPositions[groupResource.componentPositions.length - 1] : groupResource.componentPositions[0]
        } else {
          targetPosition = addEvent.closest.position
        }
        if (!targetPosition) {
          return 0
        }
        const sortValue = this.resourcesStore.getResource(targetPosition)?.data?.sortValue
        return sortValue !== undefined ? (addEvent.addAfter ? sortValue + 1 : sortValue) : 0
      }

      const positionPostData: Omit<CwaResource, '@id'|'@type'> = {
        ...this.resourcesStore.getResource(positionIri)?.data,
        '@id': undefined,
        '@type': undefined,
        sortValue: getPositionSortValue()
      }
      resource.componentPositions = [
        positionPostData
      ]

      refreshEndpoints.push(...this.getRefreshPositions(positionIri))
    } else if (!addEvent.pageDataProperty) {
      // adding the resource to a position resource, adding a fallback component on a dynamic page/template
      const addingToIri = addEvent.targetIri
      if (getResourceTypeFromIri(addingToIri) !== CwaResourceTypes.COMPONENT_POSITION) {
        throw new Error('Cannot add to arbitrary IRIs. Only to component positions.')
      }
      resource.componentPositions = [addingToIri]
    }

    if (publish !== undefined) {
      resource.publishedAt = publish ? DateTime.local().toUTC().toISO() : null
    }

    const postData: Omit<CwaResource, '@id'|'@type'> = { ...resource, '@id': undefined, '@type': undefined }

    const requestCompleteFn = () => {
      this.clearAddResource()
    }

    const newResource = await this.createResource({
      endpoint: addingMeta.endpoint,
      data: postData,
      refreshEndpoints,
      requestCompleteFn: () => {
        this.clearAddResource()
      }
    })

    if (newResource && addEvent.pageDataProperty) {
      await this.updateResource({
        endpoint: this.resources.pageDataIri.value,
        data: { [addEvent.pageDataProperty]: newResource['@id'] },
        refreshEndpoints: [addEvent.targetIri],
        requestCompleteFn
      })
    }

    return newResource
  }

  private getRefreshPositions (positionIri?: string): string[] {
    const refreshPositions: string[] = []
    if (!positionIri) {
      return refreshPositions
    }
    const groupPositions = this.groupResourcePositions
    if (groupPositions) {
      const currentPositions: string[] | undefined = groupPositions
      if (currentPositions) {
        const index = currentPositions.indexOf(positionIri)
        if (index !== -1) {
          const positionsAfterInsert = groupPositions.slice(index)
          if (positionsAfterInsert && positionsAfterInsert.length) {
            refreshPositions.push(...positionsAfterInsert)
          }
        }
      }
    }
    return refreshPositions
  }

  private createNewComponentPosition (positionIri?: string) {
    const addEvent = this._addResourceEvent.value
    if (!addEvent || !addEvent.closest.group) {
      throw new Error('Cannot create a new component position. There is no adding event or no group assigned')
    }
    const positionResource = positionIri ? this.resourcesStore.getResource(positionIri) : undefined
    const componentPosition: { componentGroup: string, sortValue: number } = {
      componentGroup: addEvent.closest.group,
      sortValue: 0
    }
    if (positionResource) {
      const currentSortValue = positionResource.data?.sortDisplayNumber
      if (currentSortValue !== undefined) {
        componentPosition.sortValue = addEvent.addAfter ? currentSortValue + 1 : currentSortValue
      }
    }
    return componentPosition
  }

  private get groupResource () {
    if (!this._addResourceEvent.value || !this._addResourceEvent.value.closest.group) {
      return
    }
    return this.resourcesStore.getResource(this._addResourceEvent.value.closest.group)
  }

  private get groupResourcePositions () {
    if (!this.groupResource) {
      return
    }
    return this.groupResource.data?.componentPositions
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }

  private get errorStore () {
    return this.errorStoreDefinition.useStore()
  }
}
