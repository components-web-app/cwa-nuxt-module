import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useCookie } from '#app/composables/cookie.js'
import type { NuxtApp } from '#app/nuxt'
import type { CwaModuleOptions, CwaResourcesMeta } from '../module'
import { Storage } from './storage/storage'
import type { FetchResourceEvent } from './api/fetcher/fetcher'
import Fetcher from './api/fetcher/fetcher'
import Mercure from './api/mercure'
import ApiDocumentation from './api/api-documentation'
import type { CwaApiDocumentationDataInterface } from './storage/stores/api-documentation/state'
import CwaFetch from './api/fetcher/cwa-fetch'
import FetchStatusManager from './api/fetcher/fetch-status-manager'
import { ResourcesManager } from './resources/resources-manager'
import { Resources } from './resources/resources'
import Auth from './api/auth'
import Forms from './api/forms'
import { useProcess } from './composables/process'
import Admin from './admin/admin'
import NavigationGuard from './admin/navigation-guard'

export default class Cwa {
  private readonly apiUrl: string
  private readonly options: CwaModuleOptions
  private readonly storage: Storage
  private readonly apiDocumentation: ApiDocumentation
  private readonly mercure: Mercure
  private readonly fetcher: Fetcher
  private readonly fetchStatusManager: FetchStatusManager
  private readonly cwaFetch: CwaFetch

  // public resources repository and utility getters
  public readonly resources: Resources

  // public service for managing resources - CRUD functions etc.
  public readonly resourcesManager: ResourcesManager

  // public service for authentication
  public readonly auth: Auth

  public readonly forms: Forms

  public readonly admin: Admin
  private readonly adminNavGuard: NavigationGuard

  constructor (nuxtApp: Pick<NuxtApp, '_route'|'_middleware'|'$router'|'cwaResources'>, options: CwaModuleOptions) {
    const { isClient } = useProcess()
    const defaultApiUrl = 'https://api-url-not-set.com'
    if (isClient) {
      this.apiUrl = options.apiUrlBrowser || options.apiUrl || defaultApiUrl
    } else {
      this.apiUrl = options.apiUrl || options.apiUrlBrowser || defaultApiUrl
    }

    this.cwaFetch = new CwaFetch(this.apiUrl)
    this.options = options
    this.storage = new Storage(this.options.storeName)
    this.admin = new Admin(this.storage.stores.admin, this.storage.stores.resources)
    this.apiDocumentation = new ApiDocumentation(this.cwaFetch, this.storage.stores.apiDocumentation)
    this.mercure = new Mercure(this.storage.stores.mercure, this.storage.stores.resources, this.storage.stores.fetcher)
    this.fetchStatusManager = new FetchStatusManager(this.storage.stores.fetcher, this.mercure, this.apiDocumentation, this.storage.stores.resources)
    this.fetcher = new Fetcher(this.cwaFetch, this.fetchStatusManager, nuxtApp._route, this.storage.stores.resources)
    this.resources = new Resources(this.storage.stores.resources, this.storage.stores.fetcher)
    this.resourcesManager = new ResourcesManager(this.cwaFetch, this.storage.stores.resources, this.fetchStatusManager)
    this.auth = new Auth(
      this.cwaFetch,
      this.mercure,
      this.fetcher,
      this.admin,
      this.storage.stores.auth,
      this.storage.stores.resources,
      this.storage.stores.fetcher,
      useCookie('cwa_auth')
    )
    this.forms = new Forms(this.storage.stores.resources)
    this.mercure.setFetcher(this.fetcher)
    this.adminNavGuard = new NavigationGuard(nuxtApp.$router, this.storage.stores.admin)
  }

  public get adminNavigationGuardFn () {
    return this.adminNavGuard.adminNavigationGuardFn
  }

  public get navigationDisabled () {
    return this.adminNavGuard.navigationDisabled
  }

  // API Documentation service is private, exposing only function required by applications
  public async getApiDocumentation (refresh = false): Promise<CwaApiDocumentationDataInterface|undefined> {
    return await this.apiDocumentation.getApiDocumentation(refresh)
  }

  // fetcher is private, exposing the only function required by applications
  public fetchResource (event: FetchResourceEvent) {
    return this.fetcher.fetchResource(event)
  }

  public fetchRoute (route: RouteLocationNormalizedLoaded) {
    return this.fetcher.fetchRoute(route)
  }

  public clearPrimaryFetch () {
    this.fetchStatusManager.clearPrimaryFetch()
  }

  // Added as utility to bridge primary functionality of initialising 2 CWA services - this is not required by an application though, perhaps could be moved
  public async initClientSide () {
    await this.auth.init()
    this.mercure.init()
  }

  public get resourcesConfig (): CwaResourcesMeta {
    return this.options.resources || {}
  }

  // @internal
  public setResourceMeta (meta: CwaResourcesMeta) {
    this.options.resources = meta
  }
}
