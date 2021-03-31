import Vue from 'vue'
import consola from 'consola'
import type { CwaOptions } from '../'
import ApiRequestError from '../inc/api-error'
import AxiosErrorParser from '../utils/AxiosErrorParser'
import { cwaRouteDisabled } from '../utils'
import MissingDataError from '../inc/missing-data-error'
import { Storage } from './storage'
import { Fetcher } from './fetcher'
import { API_EVENTS } from './events'

export default class Cwa {
  public ctx: any
  public options: CwaOptions
  public fetcher: Fetcher
  public $storage: Storage
  public $state
  public $eventBus

  constructor(ctx, options) {
    if (options.allowUnauthorizedTls && ctx.isDev) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    this.$eventBus = new Vue()

    this.ctx = ctx

    this.options = options

    /**
     * init storage
     */
    options.initialState = {}
    const storage = new Storage(ctx, options)
    this.$storage = storage
    this.$state = storage.state

    /**
     * init fetcher
     */
    this.fetcher = new Fetcher(
      {
        $axios: this.ctx.$axios,
        error: this.ctx.error,
        apiUrl: this.ctx.$config.API_URL_BROWSER || this.ctx.$config.API_URL,
        storage
      },
      {
        fetchConcurrency: this.options.fetchConcurrency
      }
    )

    if (process.client) {
      this.initMercure()
    }
  }

  public get isEditMode() {
    return this.isAdmin && this.$storage.getState('editMode')
  }

  public setEditMode(enabled: boolean) {
    this.$storage.setState('editMode', enabled)
  }

  initMercure(force: boolean = false) {
    ;(force || !cwaRouteDisabled(this.ctx.route)) &&
      this.fetcher.initMercure(this.$state.resources.current)
  }

  public fetchRoute(path) {
    return this.fetcher.fetchRoute(path)
  }

  /**
   * Storage
   */
  get resourcesOutdated() {
    return this.$storage.areResourcesOutdated()
  }

  get resources() {
    return this.$state.resources.current
  }

  async findResource(iri) {
    return this.getResourceIri(iri) || (await this.refreshResource(iri))
  }

  getResourceIri(iri) {
    return this.resources[
      this.$storage.getTypeFromIri(iri, this.$storage.getCategoryFromIri(iri))
    ]?.byId?.[iri]
  }

  get layout() {
    return this.$storage.getState('layout')
  }

  get loadingRoute() {
    return this.$state[Fetcher.loadingRouteKey]
  }

  withError(route, err) {
    this.$storage.setState(
      'error',
      `An error occurred while requesting ${route.path}`
    )
    consola.error(err)
  }

  mergeNewResources() {
    this.$storage.mergeNewResources()
  }

  saveResource(resource: any, category?: string, isNew?: boolean) {
    this.$storage.setResource({ category, isNew, resource })
  }

  // isResourceCurrent(resource: object, iri: string) {
  //   const saved = this.$state.resources.current[
  //     this.$storage.getCategoryFromIri(iri)
  //   ][iri]
  //   return JSON.stringify(resource) === JSON.stringify(saved)
  // }

  /**
   * API Requests
   */
  private handleRequestError(error) {
    const axiosError = AxiosErrorParser(error)
    const exception = new ApiRequestError(
      axiosError.message,
      axiosError.statusCode,
      axiosError.endpoint,
      axiosError.violations
    )
    this.$eventBus.$emit(API_EVENTS.error, exception)
    throw exception
  }

  async getApiDocumentation() {
    if (!this.$state.docsUrl) {
      throw new MissingDataError(
        'Cannot fetch API documentation. The docs URL has not been saved'
      )
    }
    const resolved = await Promise.all([
      this.ctx.$axios.$get(
        this.ctx.$config.API_URL_BROWSER || this.ctx.$config.API_URL
      ),
      this.ctx.$axios.$get(this.$state.docsUrl)
    ])
    return {
      entrypoint: resolved[0],
      docs: resolved[1]
    }
  }

  private initNewRequest(
    requestFn: Function,
    { eventName, eventParams }: { eventName: string; eventParams: any }
  ) {
    this.$storage.setApiRequestInProgress(true)
    return async () => {
      try {
        return await requestFn()
      } catch (error) {
        this.handleRequestError(error)
      } finally {
        this.$eventBus.$emit(eventName, eventParams)
      }
    }
  }

  private processResource(resource, category) {
    this.saveResource(resource, category)
    this.initMercure()
    this.$storage.setApiRequestInProgress(false)
    return resource
  }

  private refreshEndpointsArray(refreshEndpoints: string[]) {
    const promises = []
    for (const refreshEndpoint of refreshEndpoints) {
      promises.push(
        this.ctx.$axios.$get(refreshEndpoint).then((refreshResource) => {
          this.saveResource(refreshResource, null)
          this.$eventBus.$emit(API_EVENTS.refreshed, refreshEndpoint)
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
    const doRequest = this.initNewRequest(
      async () => {
        this.fetcher.closeMercure()
        const resource = await this.ctx.$axios.$post(endpoint, data)
        if (refreshEndpoints && refreshEndpoints.length) {
          await this.refreshEndpointsArray(refreshEndpoints)
        }
        return resource
      },
      { eventName: API_EVENTS.created, eventParams: endpoint }
    )
    return this.processResource(await doRequest(), category)
  }

  async refreshResource(endpoint: string, category?: string) {
    const doRequest = this.initNewRequest(
      async () => {
        return await this.ctx.$axios.$get(endpoint)
      },
      { eventName: API_EVENTS.refreshed, eventParams: endpoint }
    )
    return this.processResource(await doRequest(), category)
  }

  async updateResource(endpoint: string, data: any, category?: string) {
    const doRequest = this.initNewRequest(
      async () => {
        this.fetcher.closeMercure()
        return await this.ctx.$axios.$patch(endpoint, data, {
          headers: {
            'Content-Type': 'application/merge-patch+json'
          }
        })
      },
      { eventName: API_EVENTS.updated, eventParams: endpoint }
    )

    // the resource may be different - publishable resources return the new draft resource
    const newResource = await doRequest()
    // we may get a different resource back if it is 'publishable'
    newResource['@id'] = endpoint
    return this.processResource(newResource, category)
  }

  async deleteResource(id: string) {
    const doRequest = this.initNewRequest(
      async () => {
        return await this.ctx.$axios.delete(id)
      },
      { eventName: API_EVENTS.deleted, eventParams: id }
    )
    await doRequest()
    this.$storage.deleteResource(id)
  }

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
}
