import * as bluebird from 'bluebird'
import type { CwaOptions } from '../'
import Storage from './storage'

const getObject = data => data[0]

export default class Cwa {
  public ctx: any
  public options: CwaOptions

  private fetcher
  public $storage: Storage
  public $state

  constructor (ctx, options) {
    // this class is accessible throughout the application via this.$cwa or $cwa in the context

    // For auth - we are using a nuxt module https://dev.auth.nuxtjs.org/
    // ctx.$auth

    // For axios we use a nuxt module https://axios.nuxtjs.org/ so it is
    // the same in all the contexts
    // ctx.$axios
    this.ctx = ctx

    /**
     * @TODO remove isCollection / getObject once we use the real api, these are workarounds for the json-server
     */
    this.fetcher = async ({ path, isCollection }) => {
      const url = `${ctx.env.API_URL}${path}`
      console.log('Fetching %s', url)
      const { data } = await ctx.$axios.get(url)
      return isCollection ? data : getObject(data)
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

  private getRouteName (path) {
    return path.split('/').reduce((acc, urlPart, i, urlParts) => i === urlParts.length - 1 ? acc + '' : acc + urlPart.replace('_', ''), '')
  }

  async fetchItem (path) {
    const resource = await this.fetcher({ path })
    // Use the URL parts to build a resource name (could be implicit)
    this.$storage.setResource({ id: resource['@id'], name: this.getRouteName(path), isNew: false, resource })
    return resource
  }

  async fetchCollection (paths, callback) {
    return bluebird.map(paths, (path) => {
      return this.fetcher({ path })
        .then(resource => ({ resource, path }))
    }, { concurrency: this.options.concurrency || null })
      .each(({ resource, path }) => {
        this.$storage.setResource({ id: resource['@id'], name: this.getRouteName(path), isNew: false, resource })
        return callback(resource)
      })
  }

  public async fetchRoute (path) {
    const routeData = await this.fetchItem(`/routes/${path}`)
    const pageData = await this.fetchItem(routeData.page)
    const layoutData = await this.fetchItem(pageData.layout)

    return this.fetchCollection([...pageData.componentCollections, ...layoutData.componentCollections], (componentCollection) => {
      return this.fetchCollection(componentCollection.componentPositions, (componentPosition) => {
        return this.fetchItem(componentPosition.component)
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
