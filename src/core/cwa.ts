import Vue from 'vue'
import consola from 'consola'
import { CancelTokenSource } from 'axios'
import type { CwaOptions } from '../'
import ApiError from '../inc/api-error'
import AxiosErrorParser from '../utils/AxiosErrorParser'
import { cwaRouteDisabled } from '../utils'
import { Storage } from './storage'
import { Fetcher } from './fetcher'
import {
  API_EVENTS,
  PublishableToggledEvent,
  COMPONENT_MANAGER_EVENTS
} from './events'
import Forms from './forms'
import ApiDocumentation from './api-documentation'
import type { ApiDocsInterface } from './api-documentation'

interface PatchRequest {
  endpoint: string
  tokenSource: CancelTokenSource
}

/**
 * CWA Module is the main entrypoint and API for a user using the CWA Module
 * It provides easy to use proxy functions to other classes and to provide API and functionality to manage resources
 */
export default class Cwa {
  public ctx: any
  public options: CwaOptions
  public fetcher: Fetcher
  public forms: Forms
  public $storage: Storage
  public $state
  public $eventBus
  private patchRequests: Array<PatchRequest> = []
  private apiDocumentation: ApiDocumentation
  private beforeWindowUnloadInitialised: boolean = false

  constructor(ctx, options) {
    if (options.allowUnauthorizedTls && ctx.isDev) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    this.$eventBus = new Vue()

    this.ctx = ctx
    this.options = options
    const apiUrl = this.ctx.$config.API_URL_BROWSER || this.ctx.$config.API_URL

    this.initRouterCloneNavigationGuard()
    this.initStorage()
    this.initFetcher(apiUrl)
    this.initForms()
    this.initApiDocumentation(apiUrl)
    if (process.client) {
      this.initMercure()
      this.initWindowCloneNavigationGuard()
    }
  }

  get isServerLoad() {
    return this.$storage.getState(Fetcher.isSSRKey)
  }

  /**
   * Initialisers
   */
  private initRouterCloneNavigationGuard() {
    let programmatic = false

    ;['push', 'replace', 'go', 'back', 'forward'].forEach((methodName) => {
      const method = this.ctx.app.router[methodName]
      this.ctx.app.router[methodName] = (...args) => {
        programmatic = true
        method.apply(this.ctx.app.router, args)
      }
    })

    this.ctx.app.router.beforeEach((toRoute, __, next) => {
      if (toRoute.meta.cwaConfirmedNavigation) {
        delete toRoute.meta.cwaConfirmedNavigation
        next()
        return
      }

      // we should not be in edit mode anymore if user uses back/forward button
      if (!programmatic) {
        this.setEditMode(false)
      }

      try {
        let cwaForce = toRoute.params?.cwa_force
        cwaForce = cwaForce === 'true' ? true : !!cwaForce
        if (!cwaForce) {
          cwaForce = toRoute.query?.cwa_force === 'true'
          if (cwaForce) {
            delete toRoute.query.cwa_force
          }
        }

        const cwaConfirmedNavigation =
          programmatic === false ||
          this.$storage.get('CLONE_ALLOW_NAVIGATE') === true ||
          !this.isEditMode ||
          cwaForce

        if (!cwaConfirmedNavigation) {
          return false
        }

        toRoute.meta.cwaConfirmedNavigation = true

        next({
          path: toRoute.path,
          query: toRoute.query
        })
      } finally {
        programmatic = false
      }
    })
  }

  private initWindowCloneNavigationGuard() {
    if (this.beforeWindowUnloadInitialised) {
      return
    }
    this.beforeWindowUnloadInitialised = true
    window.addEventListener('beforeunload', (e) => {
      if (this.$state.clone.component) {
        // Cancel the event
        e.preventDefault() // If you prevent default behavior in Mozilla Firefox prompt will always be shown
        // Chrome requires returnValue to be set
        e.returnValue = ''
      }
    })
  }

  private initStorage() {
    const storage = new Storage(this.ctx, this.options)
    this.$storage = storage
    this.$state = storage.state
  }

  private initFetcher(apiUrl: string) {
    this.fetcher = new Fetcher(
      {
        $axios: this.ctx.$axios,
        error: this.ctx.error,
        apiUrl,
        storage: this.$storage,
        router: this.ctx.app.router,
        redirect: this.ctx.redirect
      },
      {
        fetchConcurrency: this.options.fetchConcurrency
      }
    )
  }

  private initForms() {
    this.forms = new Forms({
      $axios: this.ctx.$axios,
      store: this.ctx.store,
      vuexNamespace: this.options.vuex.namespace
    })
  }

  private initApiDocumentation(apiUrl: string) {
    this.apiDocumentation = new ApiDocumentation({
      $axios: this.ctx.$axios,
      $storage: this.$storage,
      $state: this.$state,
      apiUrl
    })
  }

  public initMercure(force: boolean = false) {
    ;(force || !cwaRouteDisabled(this.ctx.route)) &&
      this.fetcher.initMercure(this.$state.resources.current)
  }

  /**
   * Fetcher Proxy
   */
  get loadedPage() {
    return this.fetcher.loadedPage
  }

  public fetchRoute(path) {
    return this.fetcher.fetchRoute(path)
  }

  /**
   * Storage Proxy
   */
  public setEditMode(enabled: boolean) {
    this.$storage.setState('editMode', enabled)
  }

  /**
   * Storage Proxy
   */
  public setLayoutEditing(enabled: boolean) {
    this.$storage.setState('isLayoutEditing', enabled)
  }

  get layout() {
    return this.$storage.getState('layout')
  }

  get loadingRoute() {
    return this.$state[Fetcher.loadingEndpoint]
  }

  get resources() {
    return this.$state.resources.current
  }

  get resourcesOutdated() {
    return this.$storage.areResourcesOutdated()
  }

  get currentRoute() {
    return this.$storage.currentRoute
  }

  findDraftIri(iri: string) {
    return this.$storage.findDraftIri(iri)
  }

  findPublishedIri(iri: string) {
    return this.$storage.findPublishedIri(iri)
  }

  getResource(iri: string) {
    return this.$storage.getResource(iri)
  }

  isResourceSame(resource1, resource2): boolean {
    return this.$storage.isResourceSame(resource1, resource2)
  }

  mergeNewResources() {
    this.$storage.mergeNewResources()
  }

  saveResource(resource: any, category?: string, isNew?: boolean) {
    this.$storage.setResource({ category, isNew, resource })
  }

  increaseMercurePendingProcessCount(requestCount: number = 1) {
    this.$storage.increaseMercurePendingProcessCount(requestCount)
  }

  decreaseMercurePendingProcessCount(requestCount: number = 1) {
    this.$storage.decreaseMercurePendingProcessCount(requestCount)
  }

  clearDraftResources() {
    const draftIris = Object.values(this.$state.resources.draftMapping)
    for (const iri of draftIris) {
      this.$storage.deleteResource(iri)
    }
  }

  /**
   * API Documentation Proxy
   */
  getApiDocumentation(refresh = false): Promise<ApiDocsInterface> {
    return this.apiDocumentation.getApiDocumentation(refresh)
  }

  /**
   * Storage
   */
  get layoutUiComponent() {
    return this.resources.Layout?.byId[this.layout].uiComponent || 'None'
  }

  public get isEditMode() {
    return this.isAdmin && this.$storage.getState('editMode')
  }

  public get isLayoutEditing() {
    if (!this.isEditMode) {
      return null
    }
    return this.$storage.getState('isLayoutEditing')
  }

  // find a resource from local storage or fetch from API
  async findResource(iri) {
    return this.getResource(iri) || (await this.refreshResource(iri))
  }

  getPublishableIri(iri: string) {
    // is it draft and mapped to show published?
    if (
      (iri && !this.isEditMode) ||
      this.$storage.isIriMappedToPublished(iri)
    ) {
      return this.$storage.findPublishedIri(iri) || iri
    }
    return iri
  }

  getPublishedResource(resource: { publishedResource?: string }) {
    const publishedIri = resource?.publishedResource
    if (!publishedIri) {
      return null
    }
    return this.$storage.getResource(publishedIri)
  }

  getDraftResource(resource: { draftResource?: string }) {
    const draftIri = resource?.draftResource
    if (!draftIri) {
      return null
    }
    return this.$storage.getResource(draftIri)
  }

  setFetchError(route, err) {
    this.$storage.setState(
      'error',
      `An error occurred while requesting ${route.path}`
    )
    consola.error(err)
  }

  async logout() {
    await this.ctx.$auth.logout('local')
    this.clearDraftResources()
  }

  togglePublishable(draftIri: string, showPublished: boolean) {
    this.$storage.togglePublishable(draftIri, showPublished)
    const publishableIri = this.getPublishableIri(draftIri)
    this.$eventBus.$emit(COMPONENT_MANAGER_EVENTS.publishableToggled, {
      draftIri,
      publishableIri,
      showPublished,
      publishedIri: this.$storage.findPublishedIri(draftIri)
    } as PublishableToggledEvent)
    return publishableIri
  }

  // isResourceSaved(resource: object, iri: string) {
  //   const saved = this.$state.resources.current[
  //     this.$storage.getCategoryFromIri(iri)
  //   ][iri]
  //   return JSON.stringify(resource) === JSON.stringify(saved)
  // }

  /**
   * User / security
   */
  get isAdmin() {
    return this.userHasRole('ROLE_ADMIN')
  }

  get user() {
    return this.ctx.$auth.user
  }

  userHasRole(role) {
    return this.user ? this.user.roles.includes(role) : false
  }

  /**
   * Resource Management
   */
  private handleRequestError(error) {
    if (error instanceof ApiError) {
      throw error
    }
    const axiosError = AxiosErrorParser(error)
    const exception = new ApiError(
      axiosError.message,
      axiosError.statusCode,
      axiosError.endpoint,
      axiosError.violations,
      this.ctx.$axios.isCancel(error)
    )
    this.$eventBus.$emit(API_EVENTS.error, exception)
    throw exception
  }

  private async initNewRequest(
    requestFn: Function,
    { eventName, eventParams }: { eventName: string; eventParams: any },
    category: string,
    postUpdate?: Function
  ) {
    this.increaseMercurePendingProcessCount()
    try {
      let resource = await requestFn()
      // if not a successful delete request
      if (resource?.status !== 204 && resource?.['@id']) {
        this.saveResource(resource, category)
      }
      if (postUpdate) {
        const newResource = await postUpdate(resource)
        if (newResource) {
          resource = newResource
        }
      }
      return resource
    } catch (error) {
      this.handleRequestError(error)
    } finally {
      this.$eventBus.$emit(eventName, eventParams)
      this.decreaseMercurePendingProcessCount()
    }
  }

  private async refreshEndpointsArray(
    refreshEndpoints: string[],
    afterPromise: Promise<any> = null
  ) {
    this.increaseMercurePendingProcessCount(refreshEndpoints.length)
    if (afterPromise) {
      await afterPromise
    }
    const promises = []
    for (const refreshEndpoint of refreshEndpoints) {
      promises.push(
        this.refreshResource(refreshEndpoint).then((refreshResource) => {
          this.decreaseMercurePendingProcessCount()
          this.$eventBus.$emit(API_EVENTS.refreshed, refreshEndpoint)
          consola.debug('Resource refreshed', refreshResource)
        })
      )
    }
    return Promise.all(promises)
  }

  async createResource(
    endpoint: string,
    data: any,
    category?: string,
    refreshEndpoints?: string[]
  ) {
    return await this.initNewRequest(
      async () => {
        const refreshEndpointsSize = refreshEndpoints
          ? refreshEndpoints.length
          : 0
        const postResource = await this.ctx.$axios.$post(endpoint, data, {
          headers: {
            path: this.fetcher.currentRoutePath
          }
        })
        if (refreshEndpointsSize) {
          await this.refreshEndpointsArray(refreshEndpoints, postResource)
        }
        this.saveResource(postResource)
        return postResource
      },
      { eventName: API_EVENTS.created, eventParams: endpoint },
      category
    )
  }

  async refreshResources(endpoints: string[]) {
    const promises = []
    endpoints.forEach((endpoint) => {
      promises.push(this.refreshResource(endpoint))
    })
    return await Promise.all(promises)
  }

  async refreshResource(
    endpoint: string,
    category?: string,
    cancelTokenSource?: CancelTokenSource
  ) {
    return await this.initNewRequest(
      async () => {
        const resource = await this.fetcher.fetchResource({
          path: endpoint,
          cancelTokenSource
        })
        this.saveResource(resource)
        return resource
      },
      { eventName: API_EVENTS.refreshed, eventParams: endpoint },
      category
    )
  }

  async refreshPositionsForComponent(iri) {
    const allPositions: { [key: string]: { component: string } } =
      this.$state.resources.current?.ComponentPosition?.byId
    const promises = []
    for (const [positionIri, position] of Object.entries(allPositions)) {
      if (position.component === iri) {
        promises.push(
          new Promise((resolve) => {
            // refresh the position from server
            this.refreshResource(positionIri).then(
              (refreshedPositionResource) => {
                // find the component resource if we do not already have it
                this.findResource(refreshedPositionResource.component).then(
                  () => {
                    resolve(true)
                  }
                )
              }
            )
          })
        )
        await Promise.all(promises)
      }
    }
  }

  cancelPendingPatchRequest(
    endpoint: string,
    requestComplete: boolean = false
  ) {
    this.patchRequests = this.patchRequests.filter((pr) => {
      if (pr.endpoint !== endpoint) {
        return true
      }
      if (!requestComplete) {
        pr.tokenSource.cancel('Cancelled due to another pending patch request')
      }
      return false
    })
  }

  async updateResource(
    endpoint: string,
    data: any,
    category?: string,
    refreshEndpoints?: string[],
    updateFn?: Function
  ) {
    // New resources are being updated locally - nothing in the API
    if (endpoint.endsWith('/new')) {
      this.$storage.setResource({
        resource: Object.assign(
          { '@id': endpoint },
          this.$storage.getResource(endpoint),
          data
        )
      })
      return
    }

    const draftIri = this.findDraftIri(endpoint)
    const forcedPublishedUpdate = draftIri
      ? this.getPublishableIri(draftIri) !== draftIri
      : this.$storage.isIriMappedToPublished(endpoint)

    const requestFn = this.createUpdateRequestFunction(
      forcedPublishedUpdate,
      endpoint,
      data,
      updateFn
    )

    const postUpdateHandler = this.createPostUpdateHandler(
      forcedPublishedUpdate,
      endpoint,
      refreshEndpoints
    )

    return await this.initNewRequest(
      requestFn,
      { eventName: API_EVENTS.updated, eventParams: endpoint },
      category,
      postUpdateHandler
    )
  }

  async deleteResource(id: string) {
    await this.initNewRequest(
      async () => {
        return await this.ctx.$axios.delete(id)
      },
      { eventName: API_EVENTS.deleted, eventParams: id },
      null,
      null
    )
    this.$storage.deleteResource(id)
  }

  private createUpdateRequestFunction(
    forcedPublishedUpdate: boolean,
    endpoint: string,
    data: any,
    updateFn?: Function
  ) {
    return async () => {
      const tokenSource = this.ctx.$axios.CancelToken.source()
      const endpointQuery = forcedPublishedUpdate ? '?published=true' : ''
      const patchEndpoint = endpoint + endpointQuery
      if (updateFn) {
        return await updateFn(patchEndpoint, endpointQuery)
      }

      this.cancelPendingPatchRequest(patchEndpoint, false)
      this.patchRequests.push({
        endpoint: patchEndpoint,
        tokenSource
      })
      const patchPromise = this.ctx.$axios.$patch(patchEndpoint, data, {
        headers: {
          'Content-Type': 'application/merge-patch+json',
          path: this.fetcher.currentRoutePath
        },
        cancelToken: tokenSource.token
      })
      const result = await patchPromise
      this.cancelPendingPatchRequest(patchEndpoint, true)
      return result
    }
  }

  private createPostUpdateHandler(
    forcedPublishedUpdate: boolean,
    endpoint: string,
    refreshEndpoints?: string[]
  ) {
    return async (newResource) => {
      // we need to do this after the new entity is saved
      // otherwise a new position may reference a resource/component
      // that has not been saved locally yet. So we do it here instead
      // of in the request function
      if (refreshEndpoints && refreshEndpoints.length) {
        await this.refreshEndpointsArray(refreshEndpoints)
      }

      if (forcedPublishedUpdate) {
        return
      }

      if (!newResource._metadata?.publishable) {
        return
      }
      // Handle draft mapping
      if (newResource._metadata?.publishable?.published) {
        const draftIri = this.$storage.findDraftIri(newResource['@id'])
        if (draftIri) {
          const iriObj = {
            publishedIri: newResource['@id'],
            draftIri: null
          }
          this.$storage.mapDraftResource(iriObj)
          this.$eventBus.$emit(API_EVENTS.newDraft, iriObj)
          Vue.nextTick(() => {
            this.$storage.deleteResource(draftIri)
          })
        }
      } else if (newResource['@id'] !== endpoint) {
        // returned a draft that is not the same as the endpoint we posted to
        // a new draft to relate to the published resource
        const publishedIri = endpoint
        const draftIri = newResource['@id']
        const iriObj = {
          publishedIri,
          draftIri
        }
        this.$storage.mapDraftResource(iriObj)
        this.$eventBus.$emit(API_EVENTS.newDraft, iriObj)
      }
    }
  }
}
