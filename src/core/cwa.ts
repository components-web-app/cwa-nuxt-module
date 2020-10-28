import consola from 'consola'
import type { CwaOptions } from '../'
import ApiRequestError from '../inc/api-error'
import AxiosErrorParser from '../utils/AxiosErrorParser'
import { cwaRouteDisabled } from '../utils'
import MissingDataError from '../inc/missing-data-error'
import { Storage } from './storage'
import { Fetcher } from './fetcher'

export default class Cwa {
  public ctx: any
  public options: CwaOptions
  public fetcher: Fetcher;
  public $storage: Storage
  public $state

  constructor (ctx, options) {
    if (options.allowUnauthorizedTls && ctx.isDev) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

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

  initMercure () {
    !cwaRouteDisabled(this.ctx.route) && this.fetcher.initMercure(this.$state.resources.current)
  }

  public fetchRoute (path) {
    return this.fetcher.fetchRoute(path)
  }

  /**
   * Storage
   */
  get resourcesOutdated () {
    return this.$storage.areResourcesOutdated()
  }

  get resources () {
    return this.$state.resources.current
  }

  get layout () {
    return this.$storage.getState('layout')
  }

  get loadingRoute () {
    return this.$state[Fetcher.loadingRouteKey]
  }

  setLayout (layout) {
    this.$storage.setState('layout', layout)
  }

  withError (route, err) {
    this.$storage.setState('error', `An error occurred while requesting ${route.path}`)
    consola.error(err)
  }

  mergeNewResources () {
    this.$storage.mergeNewResources()
  }

  saveResource (resource: any, category?: string, isNew?: boolean) {
    this.$storage.setResource({ category, isNew, resource })
  }

  /**
   * API Requests
   */
  private static handleRequestError (error) {
    const axiosError = AxiosErrorParser(error)
    consola.error(axiosError)
    throw new ApiRequestError(axiosError.message, axiosError.statusCode, axiosError.endpoint)
  }

  async getApiDocumentation () {
    if (!this.$state.docsUrl) {
      throw new MissingDataError('Cannot fetch API documentation. The docs URL has not been saved')
    }
    const resolved = await Promise.all([
      this.ctx.$axios.$get(this.ctx.$config.API_URL_BROWSER || this.ctx.$config.API_URL),
      this.ctx.$axios.$get(this.$state.docsUrl)
    ])
    return {
      entrypoint: resolved[0],
      docs: resolved[1]
    }
  }

  async createResource (endpoint: string, data: any, category?: string) {
    const doRequest = async () => {
      try {
        return await this.ctx.$axios.$post(endpoint, data)
      } catch (error) {
        Cwa.handleRequestError(error)
      }
    }

    const newResource = await doRequest()
    this.saveResource(newResource, category)
    this.initMercure()
    return newResource
  }

  async refreshResource (endpoint: string, category?: string) {
    const doRequest = async () => {
      try {
        return await this.ctx.$axios.$get(endpoint)
      } catch (error) {
        Cwa.handleRequestError(error)
      }
    }

    const newResource = await doRequest()
    this.saveResource(newResource, category)
    this.initMercure()
    return newResource
  }

  async updateResource (endpoint: string, data: any, category?: string) {
    const doRequest = async () => {
      try {
        return await this.ctx.$axios.$patch(endpoint, data, {
          headers: {
            'Content-Type': 'application/merge-patch+json'
          }
        })
      } catch (error) {
        Cwa.handleRequestError(error)
      }
    }

    // the resource may be different - publishable resources return the new draft resource
    const newResource = await doRequest()
    // we may get a different resource back if it is 'publishable'
    newResource['@id'] = endpoint
    this.saveResource(newResource, category)
    this.initMercure()
    return newResource
  }

  async deleteResource (id: string) {
    const doRequest = async () => {
      try {
        return await this.ctx.$axios.delete(id)
      } catch (error) {
        Cwa.handleRequestError(error)
      }
    }

    await doRequest()
    this.$storage.deleteResource(id)
  }

  /**
   * User / security
   */

  get isAdmin () {
    return this.userHasRole('ROLE_ADMIN')
  }

  get isUser () {
    return this.ctx.$auth.user
  }

  userHasRole (role) {
    return this.isUser ? this.ctx.$auth.user.roles.includes(role) : false
  }
}
