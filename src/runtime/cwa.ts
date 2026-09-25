import { ref } from 'vue'
import { useCookie, useNuxtApp, useRuntimeConfig } from '#imports'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import type { CwaModuleOptions, CwaResourcesMeta } from '#cwa/types'
import { Storage } from './storage/storage'
import type { FetchEvent, FetchResourceEvent } from './api/fetcher/fetcher'
import Fetcher from './api/fetcher/fetcher'
import Mercure from './api/mercure'
import ApiDocumentation from './api/api-documentation'
import type { ApiDocumentationComponentMetadataCollection } from './api/api-documentation'
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
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'
import SiteConfig from '#cwa/api/site-config'
import OrphanedResources from '#cwa/api/orphaned-resources'
import type { ApiUrlRuntimeConfig } from '#cwa/api/api-url'
import { resolveApiUrl } from '#cwa/api/api-url'

export default class Cwa {
  private readonly apiUrl: string
  private readonly options: CwaModuleOptions
  private readonly storage: Storage
  private readonly apiDocumentation: ApiDocumentation
  private readonly mercure: Mercure
  private readonly fetcher: Fetcher
  private readonly fetchStatusManager: FetchStatusManager
  private readonly cwaFetch: CwaFetch

  public readonly siteConfig: SiteConfig

  public readonly prerendered = ref<boolean>(false)

  // public resources repository and utility getters
  public readonly resources: Resources

  // public service for managing resources - CRUD functions etc.
  public readonly resourcesManager: ResourcesManager

  // public service for authentication
  public readonly auth: Auth

  public readonly forms: Forms

  public readonly orphanedResources: OrphanedResources

  public readonly admin: Admin
  private readonly adminNavGuard: NavigationGuard

  public readonly currentModulePackageInfo: { version: string, name: string }

  constructor($router: Router, options: CwaModuleOptions, currentModulePackageInfo: { version: string, name: string }) {
    this.currentModulePackageInfo = currentModulePackageInfo
    const { isServer } = useProcess()
    this.apiUrl = resolveApiUrl(useRuntimeConfig() as ApiUrlRuntimeConfig, isServer).url
    if (this.apiUrl) {
      ResourceTypeFromIri.setPathPrefix((new URL(this.apiUrl)).pathname)
    }

    this.cwaFetch = new CwaFetch(this.apiUrl)
    this.options = options
    this.storage = new Storage(this.options.storeName)
    this.siteConfig = new SiteConfig(this.cwaFetch, this.storage.stores.siteConfig, this.options.siteConfig)
    this.apiDocumentation = new ApiDocumentation(this.cwaFetch, this.storage.stores.apiDocumentation)
    this.mercure = new Mercure(this.storage.stores.mercure, this.storage.stores.resources, this.storage.stores.fetcher)
    this.fetchStatusManager = new FetchStatusManager(this.storage.stores.fetcher, this.mercure, this.apiDocumentation, this.storage.stores.resources, this.options.routeCacheLimit, useNuxtApp())
    this.fetchStatusManager.onPrimaryFetchError(() => this.cwaFetch.markUnstorable())

    this.fetcher = new Fetcher(this.cwaFetch, this.fetchStatusManager, $router, this.storage.stores.resources)

    this.resources = new Resources(this.storage.stores.resources, this.storage.stores.fetcher)
    this.admin = new Admin(this.storage.stores.admin, this.storage.stores.resources, this.resources)
    this.resourcesManager = new ResourcesManager(this.cwaFetch, this.storage.stores.resources, this.fetchStatusManager, this.storage.stores.error, this.fetcher, this.admin, this.resources)
    this.auth = new Auth(
      this.cwaFetch,
      this.mercure,
      this.fetcher,
      this.admin,
      this.apiDocumentation,
      this.storage.stores.auth,
      this.storage.stores.resources,
      this.storage.stores.fetcher,
      useCookie('cwa_auth', { sameSite: 'strict' }),
    )
    this.forms = new Forms(this.storage.stores.resources, this.cwaFetch)
    this.orphanedResources = new OrphanedResources(this.cwaFetch)
    this.mercure.setFetcher(this.fetcher)
    this.mercure.setRequestCount(this.resourcesManager.requestCount)
    this.adminNavGuard = new NavigationGuard($router, this.storage.stores.admin)
  }

  public get apiHttpCacheState() {
    return this.cwaFetch.httpCacheState
  }

  public get adminNavigationGuardFn() {
    return this.adminNavGuard.adminNavigationGuardFn
  }

  public get navigationDisabled() {
    return this.adminNavGuard.navigationDisabled
  }

  // API Documentation service is private, exposing only function required by applications
  public async getApiDocumentation(refresh = false): Promise<CwaApiDocumentationDataInterface | undefined> {
    return await this.apiDocumentation.getApiDocumentation(refresh)
  }

  public async getComponentMetadata(refresh = false, includePosition = false): Promise<undefined | ApiDocumentationComponentMetadataCollection> {
    return await this.apiDocumentation.getComponentMetadata(refresh, includePosition)
  }

  // fetcher is private, exposing the only function required by applications
  public fetchResource(event: FetchResourceEvent) {
    return this.fetcher.fetchResource(event)
  }

  public fetchRoute(route: RouteLocationNormalizedLoaded) {
    return this.fetcher.fetchRoute(route)
  }

  public fetch(event: FetchEvent) {
    return this.fetcher.fetch(event)
  }

  public clearPrimaryFetch() {
    this.fetchStatusManager.clearPrimaryFetch()
  }

  // Added as utility to bridge primary functionality of initialising 2 CWA services - this is not required by an application though, perhaps could be moved
  public async initClientSide() {
    await this.auth.init()
    this.mercure.init()
  }

  public get isStaticRender(): boolean {
    return this.prerendered.value || !!this.options.staticRender
  }

  public get resourcesConfig(): CwaResourcesMeta {
    return this.options.resources || {}
  }

  // @internal
  public setResourceMeta(meta: CwaResourcesMeta) {
    this.options.resources = meta
  }

  public get layoutsConfig() {
    return this.options.layouts
  }

  public get pagesConfig() {
    return this.options.pages
  }

  public get pageDataConfig() {
    return this.options.pageData
  }

  public get uploadConfig() {
    return this.options.upload
  }

  public get config() {
    return this.siteConfig.config
  }

  public get apiUrlBase(): string {
    return this.apiUrl
  }

  public addUniquePromise(scope: string, key: string, fn: () => Promise<void>) {
    return this.storage.addUniquePromise(scope, key, fn)
  }
}
