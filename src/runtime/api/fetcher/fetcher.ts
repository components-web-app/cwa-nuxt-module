import { RouteLocationNormalizedLoaded } from 'vue-router'
import Mercure from '../mercure'
import ApiDocumentation from '../api-documentation'
import CwaFetch from './cwa-fetch'

export default class Fetcher {
  private readonly cwaFetch: CwaFetch
  private readonly currentRoute: RouteLocationNormalizedLoaded
  private readonly mercure: Mercure
  private readonly apiDocumentation: ApiDocumentation

  constructor (
    cwaFetch: CwaFetch,
    currentRoute: RouteLocationNormalizedLoaded,
    mercure: Mercure,
    apiDocumentation: ApiDocumentation
  ) {
    this.cwaFetch = cwaFetch
    this.currentRoute = currentRoute
    this.mercure = mercure
    this.apiDocumentation = apiDocumentation
  }

  public fetchRoute () {

  }
}
