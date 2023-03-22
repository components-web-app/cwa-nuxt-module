import { CookieRef, useCookie } from '#app'
import { FetchError } from 'ofetch'
import { computed, ComputedRef, ref, Ref } from 'vue'
import { AuthStore } from '../storage/stores/auth/auth-store'
import { CwaUserRoles } from '../storage/stores/auth/state'
import CwaFetch from './fetcher/cwa-fetch'
import Mercure from './mercure'

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
  private authStoreDefinition: AuthStore
  private cookie: CookieRef<string | null>
  private loading: Ref<boolean>
  private mercure: Mercure

  public constructor (cwaFetch: CwaFetch, authStoreDefinition: AuthStore, mercure: Mercure) {
    this.cwaFetch = cwaFetch
    this.authStoreDefinition = authStoreDefinition
    this.cookie = useCookie('cwa_auth')
    this.loading = ref(false)
    this.mercure = mercure
  }

  public async signIn (credentials: Credentials) {
    const result = await this.loginRequest(credentials)
    if (result instanceof FetchError) {
      return result
    }
    this.mercure.init()
    return this.refreshUser()
  }

  public async signOut () {
    this.loading.value = true
    try {
      const result = await this.cwaFetch.fetch('/logout')
      this.clearSession()
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
      this.clearSession()
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

  private clearSession () {
    this.authStore.data.user = undefined
    this.cookie.value = '0'
    this.mercure.init()

    // todo: when we sign out we should re-fetch all components that are current and clear all components that are not current or are in pending.
    // todo: if on re-fetch we have an error, we should clear the data... or... we could just reload the page. Or we could clear all the data and re-call the primary fetch..
  }

  private get authStore () {
    return this.authStoreDefinition.useStore()
  }
}
