import { CookieRef, useCookie } from '#app'
import { FetchError } from 'ofetch'
import { computed, ComputedRef, ref, Ref } from 'vue'
import CwaFetch from './fetcher/cwa-fetch'

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
  private cookie: CookieRef<string | null>
  private loading: Ref<boolean>

  public constructor (cwaFetch: CwaFetch) {
    this.cwaFetch = cwaFetch
    this.cookie = useCookie('cwa_auth')
    this.loading = ref(false)
  }

  public async signIn (credentials: Credentials) {
    const result = await this.loginRequest(credentials)
    if (result instanceof FetchError) {
      return result
    }
    return this.getUser()
  }

  public async signOut () {
    this.loading.value = true
    try {
      const result = await this.cwaFetch.fetch('/logout')
      this.cookie.value = '0'
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

  // todo: when we sign out we should re-fetch all components that are current and clear all components that are not current or are in pending.
  // todo: if on re-fetch we have an error, we should clear the data... or... we could just reload the page. Or we could clear all the data and re-call the primary fetch..

  public async getUser () {
    this.loading.value = true
    try {
      const user = await this.cwaFetch.fetch('/me')
      this.cookie.value = '1'
      return user
    } catch (error) {
      if (!(error instanceof FetchError)) {
        throw error
      }
      this.cookie.value = '0'
      return error
    } finally {
      this.loading.value = false
    }
  }

  private async loginRequest (credentials: Credentials) {
    this.loading.value = true
    try {
      return await this.cwaFetch.fetch('/login', {
        method: 'POST',
        body: credentials
      })
    } catch (error) {
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
}
