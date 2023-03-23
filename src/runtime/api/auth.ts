import { CookieRef, useCookie, useRoute } from '#app'
import { FetchError } from 'ofetch'
import { computed, ComputedRef, ref, Ref } from 'vue'
import { AuthStore } from '../storage/stores/auth/auth-store'
import { CwaUserRoles } from '../storage/stores/auth/state'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import CwaFetch from './fetcher/cwa-fetch'
import Mercure from './mercure'
import Fetcher from './fetcher/fetcher'
import { FetcherStore } from '@cwa/nuxt-module/runtime/storage/stores/fetcher/fetcher-store'

interface Credentials {
  username: string
  password: string
}

export enum CwaAuthStatus {
  SIGNED_OUT = 0,
  LOADING = 1,
  SIGNED_IN = 2
}

export default class Auth {
  private cwaFetch: CwaFetch
  private mercure: Mercure
  private fetcher: Fetcher
  private authStoreDefinition: AuthStore
  private resourcesStoreDefinition: ResourcesStore
  private fetcherStoreDefinition: FetcherStore
  private cookie: CookieRef<string | null>
  private loading: Ref<boolean>

  public constructor (
    cwaFetch: CwaFetch,
    mercure: Mercure,
    fetcher: Fetcher,
    authStoreDefinition: AuthStore,
    resourcesStoreDefinition: ResourcesStore,
    fetcherStoreDefinition: FetcherStore
  ) {
    this.cwaFetch = cwaFetch
    this.authStoreDefinition = authStoreDefinition
    this.mercure = mercure
    this.resourcesStoreDefinition = resourcesStoreDefinition
    this.fetcher = fetcher
    this.fetcherStoreDefinition = fetcherStoreDefinition
    this.cookie = useCookie('cwa_auth')
    this.loading = ref(false)
  }

  public async signIn (credentials: Credentials) {
    const result = await this.loginRequest(credentials)
    if (result instanceof FetchError) {
      return result
    }
    this.mercure.init(true)
    return this.refreshUser()
  }

  public async signOut () {
    this.loading.value = true
    try {
      const result = await this.cwaFetch.fetch('/logout')
      await this.clearSession()
      return result
    } catch (error) {
      if (!(error instanceof FetchError)) {
        throw error
      }
      return error
    } finally {
      this.loading.value = false
    }
  }

  public async refreshUser () {
    this.loading.value = true
    try {
      const user = await this.cwaFetch.fetch('/me')
      this.cookie.value = '1'
      this.authStore.data.user = user
      return user
    } catch (error) {
      if (!(error instanceof FetchError)) {
        throw error
      }
      await this.clearSession()
      return error
    } finally {
      this.loading.value = false
    }
  }

  public async init () {
    if (this.status.value === CwaAuthStatus.SIGNED_IN && !this.user) {
      await this.refreshUser()
    }
  }

  public get user () {
    return this.authStore.data.user
  }

  public get roles () {
    if (!this.user) {
      return
    }
    return this.user.roles
  }

  public hasRole (role: CwaUserRoles|string) {
    if (!this.roles) {
      return false
    }
    return this.roles.includes(role)
  }

  private async loginRequest (credentials: Credentials) {
    this.loading.value = true
    try {
      return await this.cwaFetch.fetch('/login', {
        method: 'POST',
        body: credentials
      })
    } catch (error) {
      this.loading.value = false
      if (!(error instanceof FetchError)) {
        throw error
      }
      return error
    }
  }

  public get status (): ComputedRef<CwaAuthStatus> {
    return computed(() => {
      if (this.loading.value) {
        return CwaAuthStatus.LOADING
      }

      return `${this.cookie.value}` === '1' ? CwaAuthStatus.SIGNED_IN : CwaAuthStatus.SIGNED_OUT
    })
  }

  private async clearSession () {
    this.authStore.data.user = undefined
    this.cookie.value = '0'
    this.mercure.init(true)

    this.resourcesStore.clearResources()
    this.fetcherStore.clearFetches()
    const route = useRoute()
    await this.fetcher.fetchRoute(route)
  }

  private get authStore () {
    return this.authStoreDefinition.useStore()
  }

  private get resourcesStore () {
    return this.resourcesStoreDefinition.useStore()
  }

  private get fetcherStore () {
    return this.fetcherStoreDefinition.useStore()
  }
}
