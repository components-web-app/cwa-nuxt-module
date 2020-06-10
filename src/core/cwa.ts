import * as bluebird from 'bluebird'
import consola from 'consola'
import type { CwaOptions } from '../'
import Storage from './storage'

export default class Cwa {
  public ctx: any
  public options: CwaOptions

  // Holds the EventSource connection with mercure
  private eventSource
  private fetcher
  private lastEventId
  public $storage: Storage
  public $state

  constructor (ctx, options) {
    if (process.server) {
      // WARNING DISABLE THIS IN PRODUCITON
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    // this class is accessible throughout the application via this.$cwa or $cwa in the context

    // For auth - we are using a nuxt module https://dev.auth.nuxtjs.org/
    // ctx.$auth

    // For axios we use a nuxt module https://axios.nuxtjs.org/ so it is
    // the same in all the contexts
    // ctx.$axios
    this.ctx = ctx

    this.fetcher = async ({ path, preload }) => {
      const url = `${process.env.baseUrl}${path}`
      consola.debug('Fetching %s', url)

      const requestHeaders = preload ? { Preload: preload.join(',') } : {}
      if (process.server) {
        let referer = ctx.req.headers.referer
        if (!referer) {
          referer = ctx.req.socket.encrypted ? 'https' : 'http' +
            '://' +
            ctx.req.host +
            ctx.route.fullPath
        }
        Object.assign(requestHeaders, { referer })
      }

      // While https://github.com/nuxt-community/auth-module/pull/726 is pending, disable the header
      // no worky as a fix
      // ctx.$axios.setHeader('Authorization', false)

      try {
        const { data, headers } = await ctx.$axios.get(url, { headers: requestHeaders })
        this.getMercureHub(headers)
        return data
      } catch (error) {
        if (error.response && error.response.status && typeof error.response.data === 'object') {
          ctx.error({
            statusCode: error.response.status,
            message: error.response.data['hydra:description'],
            endpoint: url
          })
        } else if(error.message) {
          ctx.error({
            statusCode: 500,
            message: error.message,
            endpoint: url
          })
        }
      }
    }

    // These are options passed from the /src/module/index.ts -> /templates/plugin.js
    // So they can be set and configured in the nuxt.config.js
    // Defaults should be set i /src/module/defaults.ts
    this.options = options

    // Storage & State
    // This is a class to initialise namespaced vuex storage and left in local storage if needed. Just boilerplate, can adjust as required.
    options.initialState = { }
    const storage = new Storage(ctx, options)
    this.$storage = storage
    this.$state = storage.state
  }

  async fetchItem ({ path, preload }: {path: string, preload?: string[]}) {
    const resource = await this.fetcher({ path, preload })
    resource && this.$storage.setResource({ id: resource['@id'], name: resource['@type'], isNew: false, resource })
    return resource
  }

  async fetchCollection ({ paths }, callback) {
    return bluebird.map(paths, (path) => {
      return this.fetcher({ path })
        .then(resource => ({ resource, path }))
    }, { concurrency: this.options.fetchConcurrency || null })
      .each(({ resource }) => {
        resource && this.$storage.setResource({ id: resource['@id'], name: resource['@type'], isNew: false, resource })
        return callback(resource)
      })
  }

  public async fetchRoute (path) {
    const routeResponse = await this.fetchItem({ path: `/_/routes/${path}`, preload: ['/page/layout/componentCollections/*/componentPositions/*/component', '/page/componentCollections/*/componentPositions/*/component'] })
    const pageResponse = await this.fetchItem({ path: routeResponse.page })
    const layoutResponse = await this.fetchItem({ path: pageResponse.layout })

    return this.fetchCollection({ paths: [...pageResponse.componentCollections, ...layoutResponse.componentCollections] }, (componentCollection) => {
      return this.fetchCollection({ paths: componentCollection.componentPositions }, (componentPosition) => {
        return this.fetchItem({ path: componentPosition.component })
      })
    })
  }

  getMercureHub (headers) {
    if (this.$state.mercureHub) { return }

    const link = headers.link
    if (!link) {
      consola.warn('No Link header found.')
      return
    }

    const match = link.match(/<([^>]+)>;\s+rel="mercure".*/)
    if (!match || !match[1]) {
      consola.log('No mercure rel in link header.')
      return
    }

    this.$storage.setState('mercureHub', match[1])
  }

  getMercureHubURL () {
    const hub = new URL(this.$state.mercureHub)

    for (const resourceType in this.$state.current) {
      this.$state.current[resourceType].allIds.forEach((id) => {
        hub.searchParams.append('topic', id)
      })
    }

    // TODO: discuss if URI templates aren't better
    // hub.searchParams.append('topic', '/_/routes/{id}')
    // hub.searchParams.append('topic', '/_/pages/{id}')
    // hub.searchParams.append('topic', '/_/layout/{id}')
    // hub.searchParams.append('topic', '/_/component_collections/{id}')
    // hub.searchParams.append('topic', '/component/html_contents/{id}')

    if (this.lastEventId) {
      hub.searchParams.append('Last-Event-ID', this.lastEventId)
    }

    return hub.toString()
  }

  async initMercure () {
    if (this.eventSource || !process.client) { return }

    this.eventSource = new EventSource(this.getMercureHubURL())
    this.eventSource.onmessage = (e) => {
      this.lastEventId = e.id
      this.$storage.setResource({
        isNew: true,
        // TODO find another way of doing this, maybe add this information from the API directly
        name: e['@type'],
        id: e['@id'],
        resource: e
      })
    }
  }

  withError (route, err) {
    this.$storage.setState('error', `An error occured while requesting ${route.path}`)
    consola.error(err)
  }

  async init () {
  }

  async initAxiosInterceptor () {
    // environment: API_URL
    // e.g. https://api.website.com/

    // Must use environment: VERCEL_GITLAB_COMMIT_REF with the API url
    // to determine which API endpoint we should be using.
    // Where VERCEL_GITLAB_COMMIT_REF is 'dev' the endpoint would be (notice '-review')
    // Perhaps this should be configurable in the module options
    // https://dev-review.api.website.com/

    // I do not know if this interceptor should be adding jwt auth http headers or if instead we should rely on cookies.

    // You probably do not want this but basically we want the baseUrl to be the API unless
    // specifically over-ridden in the axios request options.
    /*
    this.ctx.$axios.interceptors.request.use(async config => {
      const urlRegEx = new RegExp('^https?://')
      const isFullURL = urlRegEx.test(config.url)
      if (isFullURL) {
        config.baseURL = null
      }
      const noBaseUrl = config.baseURL === null || config.baseURL === ''
      let isApiRequest = false
      if (!noBaseUrl) {
        const API_URL =
          (process.server
            ? process.env.API_URL
            : this.$storage.getState('apiUrl')) ||
          // eslint-disable-next-line no-console
          console.warn(
            'Could not find an API_URL variable for the $axios interceptor'
          )
        isApiRequest = API_URL ? API_URL.startsWith(config.baseURL) : false
      }
      if (!isApiRequest) {
        return config
      }
    }
     */
  }
}
