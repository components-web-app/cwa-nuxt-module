import * as bluebird from 'bluebird'
import type { CwaOptions } from '../'
import Storage from './storage'

export default class Cwa {
  public ctx: any
  public options: CwaOptions

  // Holds the EventSource connection with mercure
  private eventSource
  private fetcher
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
      const url = `${ctx.env.API_URL}${path}`
      console.log('Fetching %s', url)

      const requestHeaders = preload ? {'Preload': preload.join(',')} : {}
      const { data, headers } = await ctx.$axios.get(url, {headers: requestHeaders})
      this.initMercure(headers)
      return data
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

  async fetchItem ({path, name, preload}: {path: string, name: string, preload?: string[]}) {
    const resource = await this.fetcher({ path, preload })
    // Use the URL parts to build a resource name (could be implicit)
    this.$storage.setResource({ id: resource['@id'], name, isNew: false, resource })
    return resource
  }

  async fetchCollection ({paths, name}, callback) {
    return bluebird.map(paths, (path) => {
      return this.fetcher({ path, name })
        .then(resource => ({ resource, path, name }))
    }, { concurrency: this.options.fetchConcurrency || null })
      .each(({ resource, path, name }) => {
        this.$storage.setResource({ id: resource['@id'], name, isNew: false, resource })
        return callback(resource)
      })
  }

  public async fetchRoute (path) {
    const routeData = await this.fetchItem({path: `/_/routes/${path}`, name: 'routes', preload: ['/page/layout/componentCollections/*/componentPositions/*/component', '/page/componentCollections/*/componentPositions/*/component']})
    const pageData = await this.fetchItem({path: routeData.page, name: 'pages'})
    const layoutData = await this.fetchItem({path: pageData.layout, name: 'layout'})

    return this.fetchCollection({paths: [...pageData.componentCollections, ...layoutData.componentCollections], name: 'componentCollections'}, (componentCollection) => {
      return this.fetchCollection({paths: componentCollection.componentPositions, name: 'componentPositions'}, (componentPosition) => {
        return this.fetchItem({path: componentPosition.component, name: 'component'})
      })
    })
  }

  async initMercure(headers) {
    if (this.eventSource) return
    const link = headers.link
    if (!link) {
      console.warn('No Link header found.')
      return
    }

    const match = link.match(/<(.*)>.*rel="mercure".*/);
    if (!match || !match[1]) {
      console.log('No mercure rel in link header.')
      return
    }

    const hub = new URL(match[1])
    hub.searchParams.append('topic', '/_/routes/{id}')
    hub.searchParams.append('topic', '/_/pages/{id}')
    hub.searchParams.append('topic', '/_/layout/{id}')
    hub.searchParams.append('topic', '/_/component_collections/{id}')
    hub.searchParams.append('topic', '/component/html_contents/{id}')
    // TODO handle last event id
    // hub.searchParams.append('Last-Event-ID')

    this.eventSource = new EventSource(hub.toString())
    this.eventSource.on('message', (e) => {
      this.$storage.setResource({
        isNew: true,
        // TODO find another way of doing this, maybe add this information from the API directly
        name: e['@id'].split('/').reduce((acc, urlPart, i, urlParts) => i === urlParts.length - 1 ? acc + '' : acc + urlPart.replace('_', ''), ''),
        id: e['@id'],
        resource: e
      })
    })
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
