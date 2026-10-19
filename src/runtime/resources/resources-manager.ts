import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { App, ComputedRef, Ref } from 'vue'
import type { FetchError } from 'ofetch'
import set from 'lodash-es/set'
import unset from 'lodash-es/unset'
import mergeWith from 'lodash-es/mergeWith'
import isArray from 'lodash-es/isArray'
import type { CwaResourcesStoreInterface, ResourcesStore } from '../storage/stores/resources/resources-store'
import type CwaFetch from '../api/fetcher/cwa-fetch'
import type FetchStatusManager from '../api/fetcher/fetch-status-manager'
import type { DeleteResourceEvent, SaveNewResourceEvent, SaveResourceEvent } from '../storage/stores/resources/actions'
import type { CwaErrorStoreInterface, ErrorStore } from '../storage/stores/error/error-store'
import type { CwaErrorEvent } from '../storage/stores/error/state'
import {
  CwaResourceTypes,
  getPublishedResourceIri,
  getPublishedResourceState,
  getResourceTypeFromIri,
} from './resource-utils'
import type { CwaResource } from './resource-utils'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import type Fetcher from '#cwa/api/fetcher/fetcher'
import type { AddResourceEvent, ResourceStackItem } from '#cwa/admin/resource-stack-manager'
import type Admin from '#cwa/admin/admin'
import type { Resources } from '#cwa/resources/resources'

interface DeleteApiResourceEvent {
  iri?: string
  endpoint: string
  requestCompleteFn?: (resource?: CwaResource) => void | Promise<void>
  saveCompleteFn?: (resource?: CwaResource) => void | Promise<void>
  refreshEndpoints?: string[]
}

interface DataApiResourceEvent extends DeleteApiResourceEvent {
  data: any
  source?: string
  headers?: Record<string, string>
}

export type ApiResourceEvent = DataApiResourceEvent | DeleteApiResourceEvent

type RequestHeaders = Record<string, string>

interface ComponentGroupOrder {
  componentGroup: string
  sortValues: Record<string, number>
}

interface RequestOptions {
  headers: RequestHeaders
  method: 'POST' | 'PATCH' | 'DELETE' | 'GET'
  body?: any
}

export class ResourcesManager {
  private readonly cwaFetch: CwaFetch
  private readonly fetchStatusManager: FetchStatusManager
  private readonly pendingUpdates = new Map<string, Set<() => unknown>>()
  private readonly groupWrites = new Map<string, Promise<void>>()
  private requestsInProgress = reactive<{ [source: string]: { [id: string]: { event: ApiResourceEvent, args: [string, RequestOptions] } } }>({})
  private readonly reqCount = ref(0)
  private readonly _addResourceEvent: Ref<undefined | AddResourceEvent> = ref()
  private _requestCount?: ComputedRef<number>
  private readonly _resourcesStore: CwaResourcesStoreInterface
  private readonly _errorStore: CwaErrorStoreInterface

  constructor(
    cwaFetch: CwaFetch,
    resourcesStoreDefinition: ResourcesStore,
    fetchStatusManager: FetchStatusManager,
    errorStoreDefinition: ErrorStore,
    private readonly fetcher: Fetcher,
    private readonly admin: Admin,
    private readonly resources: Resources,
    private readonly vueApp: App,
  ) {
    this.cwaFetch = cwaFetch
    this._resourcesStore = resourcesStoreDefinition.useStore()
    this.fetchStatusManager = fetchStatusManager
    this._errorStore = errorStoreDefinition.useStore()
    watch(this.reqCount, (newValue) => {
      if (newValue >= 10000) {
        this.reqCount.value = 0
      }
    })
  }

  public mergeNewResources() {
    this.resourcesStore.mergeNewResources()
    this.admin.emitRedraw()
  }

  public get requestCount() {
    if (this._requestCount) {
      return this._requestCount
    }
    this._requestCount = computed(() => Object.values(this.requestsInProgress).reduce((count, reqs) => count + Object.values(reqs).length, 0))
    return this._requestCount
  }

  public getWaitForRequestPromise(endpoint: string, property: string, source?: string) {
    const hasRequestConflict = () => {
      for (const sourceReqs of Object.values(this.requestsInProgress)) {
        for (const req of Object.values(sourceReqs)) {
          if (req.event.endpoint === endpoint) {
            if ('data' in req.event) {
              return req.event.data?.[property] && (!source || req.event.source !== source)
            }
            return true
          }
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

  // @internal
  public registerPendingUpdate(iri: string, flush: () => unknown) {
    const flushes = this.pendingUpdates.get(iri) ?? new Set()
    flushes.add(flush)
    this.pendingUpdates.set(iri, flushes)
    return () => {
      flushes.delete(flush)
      if (!flushes.size && this.pendingUpdates.get(iri) === flushes) {
        this.pendingUpdates.delete(iri)
      }
    }
  }

  private async settleUpdates(iri: string) {
    await Promise.all([...(this.pendingUpdates.get(iri) ?? [])].map(flush => flush()))
    const hasRequestInProgress = () => Object.values(this.requestsInProgress).some(sourceReqs =>
      Object.values(sourceReqs).some(req => (req.event.iri || req.event.endpoint).split('?')[0] === iri),
    )
    if (!hasRequestInProgress()) {
      return
    }
    await new Promise<void>((resolve) => {
      const unwatch = watch(this.requestsInProgress, () => {
        if (hasRequestInProgress()) {
          return
        }
        unwatch()
        resolve()
      }, { deep: true })
    })
  }

  public createResource(event: DataApiResourceEvent) {
    const args: [string, RequestOptions] = [
      event.endpoint,
      { ...this.requestOptions('POST'), body: event.data },
    ]
    return this.doResourceRequest(event, args)
  }

  private async confirmDelete() {
    const alertData = {
      title: 'Delete this resource?',
      content: '<p>Are you sure you want to permanently delete this resource?</p>',
    }
    const { default: ConfirmDialog } = await import('#cwa/templates/components/core/ConfirmDialog.vue')
    const { createConfirmDialog } = await import('../admin/confirm-dialog')
    const dialog = await createConfirmDialog(this.vueApp, ConfirmDialog)
    const { isCanceled } = await dialog.reveal(alertData)

    return !isCanceled
  }

  private getEndpointForIri(iri: string) {
    const resource = this.resourcesStore.getResource(iri)?.data
    if (!resource) {
      return iri
    }
    const publishedState = getPublishedResourceState({ data: resource })
    if (publishedState === undefined) {
      return iri
    }
    return `${iri}?published=${publishedState}`
  }

  public async deleteResource(event: ApiResourceEvent, force = false) {
    if (!force && !await this.confirmDelete()) {
      return false
    }
    const args: [string, RequestOptions] = [
      this.getEndpointForIri(event.endpoint),
      { ...this.requestOptions('DELETE') },
    ]
    return this.doResourceRequest(event, args)
  }

  public removeResource(event: DeleteResourceEvent) {
    return this.resourcesStore.deleteResource(event)
  }

  public async updateResource(event: DataApiResourceEvent) {
    // we can add an iri in the event optionally - this is because for files we could be adding
    // more postfixes for upload/download, so instead of endless complicated normalization, if the endpoint is getting complete we just provide the IRI so we can do comparisons on returned IRI and other features
    const iri = (event.iri || event.endpoint).split('?')[0] as string

    if (!(event.data instanceof FormData) && event.data && 'publishedAt' in event.data) {
      await this.settleUpdates(iri)
    }

    const currentResource = this.resourcesStore.getResource(iri)?.data

    const reqOps = {
      ...this.requestOptions(event.data instanceof FormData ? 'POST' : 'PATCH'),
      body: event.data,
    }
    if (event.headers) {
      reqOps.headers = event.headers
    }
    const args: [string, RequestOptions] = [
      event.endpoint,
      reqOps,
    ]

    // if the resource is not persisted to the api but a request is updated, we just save it locally in the store
    // it'll update anything visually until client-side refresh
    if (currentResource?._metadata?.persisted === false) {
      const newResource = mergeWith(currentResource, event.data, (_a, b) => {
        if (isArray(b) || b === null) {
          return b
        }
      })
      this.storeResource({
        resource: newResource,
      })
      return
    }

    const currentIsDraft = getPublishedResourceState({ data: currentResource }) === false
    const existingLiveIri = currentIsDraft && currentResource ? getPublishedResourceIri(currentResource) : null

    const publishedOverLiveResource = (response?: CwaResource) => {
      return !!response
        && response['@id'] === existingLiveIri
        && getPublishedResourceState({ data: response }) === true
    }

    const postRequestFn = async (response?: CwaResource) => {
      if (!publishedOverLiveResource(response)) {
        return
      }
      const positions = [
        ...(this.resourcesStore.getResource(existingLiveIri!)?.data?.componentPositions ?? []),
        ...(currentResource?.componentPositions ?? []),
      ]
      if (positions.length) {
        await this.refreshEndpoints([...new Set(positions)])
      }
      this.admin.emptyStack()
    }

    const postSaveFn = (response?: CwaResource) => {
      if (publishedOverLiveResource(response)) {
        this.removeResource({ resource: event.endpoint, noCascade: true })
      }
    }

    const resource = await this.doResourceRequest(event, args, postRequestFn, postSaveFn)

    const responseId = resource?.['@id']
    if (responseId && responseId !== iri) {
      this.admin.resourceStackManager.forcePublishedVersion.value = publishedOverLiveResource(resource) ? undefined : false
    }

    return resource
  }

  /** @internal */
  public async refreshEndpoints(paths: string[]) {
    try {
      await this.fetcher.fetchBatch({ paths, shallowFetch: 'noexist' })
    }
    catch (err) {
      // issues refreshing endpoints which are no longer found can be common
      const fetchError = err as FetchError<any>
      if (fetchError?.statusCode !== 404) {
        throw err
      }
    }
  }

  private async doResourceRequest(event: ApiResourceEvent, args: [string, RequestOptions], postRequestFn?: (resource?: CwaResource) => void | Promise<void>, postSaveFn?: (resource?: CwaResource) => void | Promise<void>) {
    const source = 'source' in event ? event.source || 'unknown' : 'delete'
    const id = ++this.reqCount.value
    const eventIriOrEndpoint: string = (event.iri || event.endpoint)
    const iri = eventIriOrEndpoint.split('?')[0] as string

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
        await this.refreshEndpoints(refreshEndpoints)
      }
      if (postRequestFn) {
        await postRequestFn(resource as CwaResource | undefined)
      }
      if (event.requestCompleteFn) {
        await event.requestCompleteFn(resource as CwaResource | undefined)
      }
      if ('data' in event) {
        this.storeResource({
          resource,
        })
      }
      else {
        this.removeResource({
          resource: iri,
        })
      }
      // required if we need to update the store further before we process mercure requests again, but need the new resource to be up to date in data as well.
      // implemented to ensure we remove old drafts when a new live has been overwritten
      if (postSaveFn) {
        await postSaveFn(resource as CwaResource | undefined)
      }
      if (event.saveCompleteFn) {
        await event.saveCompleteFn(resource as CwaResource | undefined)
      }
      return resource
    }
    catch (err) {
      this.errorStore.error(event, err as FetchError<any>)
    }
    finally {
      unset(this.requestsInProgress, [source, id])
    }
  }

  public addError(error: CwaErrorEvent) {
    this.errorStore.manual(error)
  }

  public get errors(): CwaErrorEvent[] {
    return this.errorStore.getErrors
  }

  public get hasErrors(): boolean {
    return this.errorStore.hasErrors
  }

  public removeError(id: number) {
    this.errorStore.removeById(id)
  }

  // @internal
  public storeResource(event: SaveResourceEvent | SaveNewResourceEvent) {
    return this.resourcesStore.saveResource(event)
  }

  private requestOptions(method: 'POST' | 'PATCH' | 'DELETE' | 'GET'): RequestOptions {
    const headers: {
      'accept': string
      'path'?: string
      'content-type'?: string
    } = {
      accept: 'application/ld+json,application/json',
    }
    if (this.fetchStatusManager.primaryFetchPath) {
      headers.path = this.fetchStatusManager.primaryFetchPath
    }
    if (method !== 'GET') {
      headers['content-type'] = method === 'PATCH' ? 'application/merge-patch+json' : 'application/ld+json'
    }
    return {
      method,
      headers,
    }
  }

  public async initAddResource(targetIri: string, addAfter: null | boolean, resourceStack: ResourceStackItem[], pageDataProperty?: string) {
    type BaseEvent = {
      targetIri: string
      addAfter: null | boolean
    }
    const initEvent: BaseEvent = {
      targetIri,
      addAfter,
    }

    const findClosestResourceByType = (type: CwaResourceTypes): string | undefined => {
      for (const stackItem of resourceStack) {
        if (getResourceTypeFromIri(stackItem.iri) === type) {
          return stackItem.iri
        }
      }
      // group not in a stack on dynamic data page and not needed if adding into a position
      // throw new Error(`Could not find a resource with type '${type}' in the stack`)
    }

    const findClosestPositionFromGroupEvent = (event: BaseEvent): string | undefined => {
      const resource = this.resourcesStore.current.byId?.[event.targetIri]
      const positions = resource?.data?.componentPositions
      if (!positions || !positions.length) {
        return
      }
      if (event.addAfter === true) {
        return positions[positions.length - 1]
      }
      else if (event.addAfter === false) {
        return positions[0]
      }
    }

    const findClosestPosition = (event: BaseEvent): string | undefined => {
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
        group: closestGroup,
      },
      pageDataProperty,
    }
  }

  public async setAddResourceEventResource(resourceType: string, endpoint: string, isPublishable: boolean, instantAdd: boolean, defaultData?: { [key: string]: any }) {
    if (!this._addResourceEvent.value) {
      return
    }
    this.resourcesStore.initNewResource(this._addResourceEvent.value, resourceType, endpoint, isPublishable, instantAdd, defaultData)

    await nextTick(() => {
      !instantAdd && this.admin.eventBus.emit('selectResource', NEW_RESOURCE_IRI)
    })
  }

  public clearAddResourceEventResource() {
    this.resourcesStore.resetNewResource()
  }

  public clearAddResource() {
    this._addResourceEvent.value = undefined
    this.clearAddResourceEventResource()
  }

  public get addResourceEvent() {
    return this._addResourceEvent
  }

  public async confirmDiscardAddingResource() {
    if (!this._addResourceEvent.value) {
      return true
    }
    const alertData = {
      title: 'Discard new resource?',
      content: '<p>Are you sure you want to discard your new resource. It will NOT be saved.</p>',
    }
    const { default: ConfirmDialog } = await import('#cwa/templates/components/core/ConfirmDialog.vue')
    const { createConfirmDialog } = await import('../admin/confirm-dialog')
    const dialog = await createConfirmDialog(this.vueApp, ConfirmDialog)
    const { isCanceled } = await dialog.reveal(alertData)

    if (isCanceled) {
      return false
    }
    this.clearAddResource()
    return true
  }

  async addResourceAction(publish?: boolean) {
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

    const refreshEndpoints: string[] = []
    const groupIri = getResourceTypeFromIri(addEvent.targetIri) === CwaResourceTypes.COMPONENT_GROUP
      ? addEvent.targetIri
      : addEvent.closest.group

    if (addEvent.addAfter !== null) {
      addEvent.closest.group && refreshEndpoints.push(addEvent.closest.group)
      const anchor = this.findInsertAnchor(addEvent)

      const positionIri = this.resourcesStore.adding.position
      if (!positionIri) {
        Object.assign(resource, anchor)
      }
      else {
        const positionData = this.resourcesStore.getResource(positionIri)?.data
        if (!positionData) {
          throw new Error('Position resource being added not found')
        }

        const { sortValue: _sortValue, ...positionWithoutSortValue } = positionData
        const positionPostData: Omit<CwaResource, '@id' | '@type'> = {
          ...positionWithoutSortValue,
          '@id': undefined,
          '@type': undefined,
          'component': undefined,
          ...anchor,
        }

        resource.componentPositions = [
          positionPostData,
        ]
      }
    }
    else if (!addEvent.pageDataProperty) {
      // adding the resource to a position resource, adding a fallback component on a dynamic page/template
      const addingToIri = addEvent.targetIri
      if (getResourceTypeFromIri(addingToIri) !== CwaResourceTypes.COMPONENT_POSITION) {
        throw new Error('Cannot add to arbitrary IRIs. Only to component positions.')
      }
      resource.componentPositions = [addingToIri]
    }

    if (publish !== undefined) {
      resource.publishedAt = publish ? 'now' : null
    }

    const postData: Omit<CwaResource, '@id' | '@type'> = { ...resource, '@id': undefined, '@type': undefined }
    const requestCompleteFn = () => {
      this.clearAddResource()
    }
    const createResourceEvent = {
      endpoint: addingMeta.endpoint,
      data: postData,
      refreshEndpoints,
      requestCompleteFn,
    }

    const newResource = groupIri && addEvent.addAfter !== null
      ? await this.queueComponentGroupWrite(groupIri, async () => {
          const created = await this.createResource(createResourceEvent)
          if (!created) {
            await this.refreshEndpoints([groupIri])
          }
          await this.refreshComponentGroupOrder(groupIri)
          return created
        })
      : await this.createResource(createResourceEvent)

    const pageDataIri = addEvent.pageDataProperty ? this.resources.pageDataIriOf(addEvent.targetIri).value : undefined
    if (newResource && addEvent.pageDataProperty && pageDataIri) {
      await this.updateResource({
        endpoint: pageDataIri,
        data: { [addEvent.pageDataProperty]: newResource['@id'] },
        refreshEndpoints: [addEvent.targetIri],
        requestCompleteFn,
      })
    }

    return newResource
  }

  private findInsertAnchor(addEvent: AddResourceEvent): { after?: string, before?: string } {
    if (getResourceTypeFromIri(addEvent.targetIri) === CwaResourceTypes.COMPONENT_GROUP) {
      if (addEvent.addAfter) {
        return {}
      }
      const firstPosition = this.resourcesStore.getOrderedPositionsForGroup(addEvent.targetIri, false)?.[0]
      return firstPosition ? { before: firstPosition } : {}
    }
    if (!addEvent.closest.position) {
      return {}
    }
    return addEvent.addAfter ? { after: addEvent.closest.position } : { before: addEvent.closest.position }
  }

  public queueComponentGroupWrite<T>(groupIri: string, write: () => Promise<T>): Promise<T> {
    const next = (this.groupWrites.get(groupIri) ?? Promise.resolve()).then(write)
    const settled = next.then(() => undefined, () => undefined)
    this.groupWrites.set(groupIri, settled)
    settled.then(() => {
      if (this.groupWrites.get(groupIri) === settled) {
        this.groupWrites.delete(groupIri)
      }
    })
    return next
  }

  /** @internal */
  public async send<T>(endpoint: string, method: 'POST' | 'PATCH', body: unknown): Promise<T | undefined> {
    const event = { endpoint }
    const id = ++this.reqCount.value
    const args: [string, RequestOptions] = [endpoint, { ...this.requestOptions(method), body }]
    set(this.requestsInProgress, [endpoint, id], { event, args })
    this.errorStore.removeByEndpoint(endpoint)
    try {
      return await this.cwaFetch.fetch<T>(...args)
    }
    catch (err) {
      this.errorStore.error(event, err as FetchError<any>)
    }
    finally {
      unset(this.requestsInProgress, [endpoint, id])
    }
  }

  public async orderComponentGroup(groupIri: string, positionIris: string[]): Promise<boolean> {
    const response = await this.send<ComponentGroupOrder>(`${groupIri}/order`, 'PATCH', { componentPositions: positionIris })
    await (response ? this.reconcileOrder(groupIri, response) : this.refreshComponentGroupOrder(groupIri))
    return !!response
  }

  public async refreshComponentGroupOrder(groupIri: string): Promise<void> {
    const response = await this.cwaFetch.fetch<ComponentGroupOrder>(`${groupIri}/order`, this.requestOptions('GET')).catch(() => undefined)
    await this.reconcileOrder(groupIri, response)
  }

  private async reconcileOrder(groupIri: string, order: ComponentGroupOrder | undefined) {
    if (!order?.sortValues) {
      return
    }
    const returned = Object.keys(order.sortValues)
    for (const [positionIri, sortValue] of Object.entries(order.sortValues)) {
      const position = this.resourcesStore.getResource(positionIri)?.data
      if (position) {
        this.storeResource({ resource: { ...position, sortValue } })
      }
    }
    const held: string[] = (this.resourcesStore.getResource(groupIri)?.data?.componentPositions ?? [])
      .filter((iri: string) => !iri.endsWith(NEW_RESOURCE_IRI))
    const added = returned.filter(iri => !held.includes(iri))
    const removed = held.filter(iri => !returned.includes(iri))
    if (added.length || removed.length) {
      await this.refreshEndpoints([groupIri, ...added]).catch(() => undefined)
    }
  }

  private get resourcesStore(): CwaResourcesStoreInterface {
    return this._resourcesStore
  }

  private get errorStore(): CwaErrorStoreInterface {
    return this._errorStore
  }
}
