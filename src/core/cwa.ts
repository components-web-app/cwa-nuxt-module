import type { CwaOptions } from '../'
import Storage from './storage'

export default class Cwa {
  public ctx: any
  public options: CwaOptions

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

  async init () {

  }

  async initAxiosInterceptor()
  {
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
