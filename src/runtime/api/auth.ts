import { FetchError } from 'ofetch'
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useRoute } from '#app'
import type { CookieRef } from '#app'
import { AuthStore } from '../storage/stores/auth/auth-store'
import { CwaUserRoles } from '../storage/stores/auth/state'
import { ResourcesStore } from '../storage/stores/resources/resources-store'
import { FetcherStore } from '../storage/stores/fetcher/fetcher-store'
import CwaFetch from './fetcher/cwa-fetch'
import Mercure from './mercure'
import Fetcher from './fetcher/fetcher'
import Admin from '#cwa/runtime/admin/admin'

interface Credentials {
  username: string
  password: string
}

export enum CwaAuthStatus {
  SIGNED_OUT = 0,
  LOADING = 1,
  SIGNED_IN = 2
}

interface ResetPasswordEvent {
  username: string
  token: string
  passwords: {
    first: string
    second: string
  }
}

export default class Auth {
  private loading: Ref<boolean>
  private hasCheckedMeEndpointForInit = false

  public constructor (
    private readonly cwaFetch: CwaFetch,
    private readonly mercure: Mercure,
    private readonly fetcher: Fetcher,
    private readonly admin: Admin,
    private readonly authStoreDefinition: AuthStore,
    private readonly resourcesStoreDefinition: ResourcesStore,
    private readonly fetcherStoreDefinition: FetcherStore,
    private readonly authCookie: CookieRef<string | null>
  ) {
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

  public async forgotPassword (username: string) {
    try {
      return await this.cwaFetch.fetch(`/password/reset/request/${encodeURIComponent(
        username
      )}`)
    } catch (error) {
      if (!(error instanceof FetchError)) {
        throw error
      }
      return error
    }
  }

  public async resetPassword (event: ResetPasswordEvent) {
    try {
      return await this.cwaFetch.fetch('/component/forms/password_reset/submit', {
        method: 'PATCH',
        body: {
          password_update: {
            username: event.username,
            plainNewPasswordConfirmationToken: event.token,
            plainPassword: event.passwords
          }
        }
      })
    } catch (error) {
      if (!(error instanceof FetchError)) {
        throw error
      }
      return error
    }
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
      this.authCookie.value = '1'
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
    if (!this.hasCheckedMeEndpointForInit || (this.signedIn.value && !this.user)) {
      this.hasCheckedMeEndpointForInit = true
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

  public get signedIn () {
    return computed(() => this.status.value === CwaAuthStatus.SIGNED_IN)
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

      return `${this.authCookie.value}` === '1' ? CwaAuthStatus.SIGNED_IN : CwaAuthStatus.SIGNED_OUT
    })
  }

  private async clearSession () {
    this.authStore.data.user = undefined
    this.authCookie.value = '0'
    this.admin.toggleEdit(false)
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
