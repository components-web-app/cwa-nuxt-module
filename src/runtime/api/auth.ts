import { CookieRef, useCookie } from '#app'
import { FetchError } from 'ofetch'
import CwaFetch from './fetcher/cwa-fetch'

interface Credentials {
  username: string
  password: string
}

export default class Auth {
  private cwaFetch: CwaFetch
  private cookie: CookieRef<string | null>

  public constructor (cwaFetch: CwaFetch) {
    this.cwaFetch = cwaFetch
    this.cookie = useCookie('cwa-auth')
    if (this.cookie.value === undefined) {
      this.cookie.value = '0'
    }
  }

  public async signIn (credentials: Credentials) {
    const result = await this.loginRequest(credentials)
    if (result instanceof FetchError) {
      return result
    }
    return this.getUser()
  }

  private async loginRequest (credentials: Credentials) {
    try {
      return await this.cwaFetch.fetch('/login', {
        method: 'POST',
        body: credentials,
        credentials: 'include'
      })
    } catch (error) {
      if (!(error instanceof FetchError)) {
        throw error
      }
      return error
    }
  }

  public signOut () {

  }

  public async getUser () {
    try {
      const user = await this.cwaFetch.fetch('/me', {
        credentials: 'include'
      })
      this.cookie.value = '1'
      return user
    } catch (error) {
      if (!(error instanceof FetchError)) {
        throw error
      }
      this.cookie.value = '0'
      return error
    }
  }
}
