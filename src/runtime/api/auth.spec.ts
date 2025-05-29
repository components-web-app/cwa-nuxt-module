// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { FetchError } from 'ofetch'
import { CwaUserRoles } from '../storage/stores/auth/state'
import Auth, { CwaAuthStatus } from './auth'
import { useRoute } from '#app'
import { ref } from '#imports'

function createAuth() {
  const mockUserData = {
    data: {
      user: {},
    },
  }
  const mockResources = {
    clearResources: vi.fn(),
  }
  const mockFetcherData = {
    clearFetches: vi.fn(),
  }
  const mockFetch = {
    fetch: vi.fn(),
  }
  mockFetch.fetch.raw = vi.fn()
  const mockAuthStore = {
    useStore() {
      return mockUserData
    },
  }
  const mockResourcesStore = {
    useStore() {
      return mockResources
    },
  }
  const mockFetcherStore = {
    useStore() {
      return mockFetcherData
    },
  }
  const mockMercure = {
    init: vi.fn(),
    setMercureHubFromLinkHeader: vi.fn(),
  }
  const mockFetcher = {
    fetchRoute: vi.fn(),
  }
  const mockAdmin = {
    toggleEdit: vi.fn(),
  }
  const mockApiDocumentation = {
    setDocsPathFromLinkHeader: vi.fn(),
  }
  const mockCookie = ref('0')
  const auth = new Auth(
    // @ts-expect-error
    mockFetch,
    mockMercure,
    mockFetcher,
    mockAdmin,
    mockApiDocumentation,
    mockAuthStore,
    mockResourcesStore,
    mockFetcherStore,
    mockCookie,
  )

  return {
    auth,
    cwaFetch: mockFetch,
    mercure: mockMercure,
    authStore: mockAuthStore,
    fetcherStore: mockFetcherStore,
    resourcesStore: mockResourcesStore,
    fetcher: mockFetcher,
    cookie: mockCookie,
    admin: mockAdmin,
    apiDocumentation: mockApiDocumentation,
  }
}

describe('Auth', () => {
  describe('signIn', () => {
    const credentials = { username: 'mock-user', password: 'sEcrEt' }

    test('should return error IF login request fails', async () => {
      const { auth, mercure } = createAuth()
      const mockError = new FetchError('oops')
      const loginRequestSpy = vi.spyOn(auth, 'loginRequest').mockImplementationOnce(() => {
        return new Promise(resolve => resolve(mockError))
      })
      const refreshSpy = vi.spyOn(auth, 'refreshUser')

      const result = await auth.signIn(credentials)
      expect(loginRequestSpy).toHaveBeenCalledWith(credentials)
      expect(mercure.init).not.toHaveBeenCalled()
      expect(refreshSpy).not.toHaveBeenCalled()
      expect(result).toEqual(mockError)
    })

    test('should init mercure AND refresh user', async () => {
      const { auth, mercure } = createAuth()
      const mockRefreshResult = { name: 'Mock' }
      const loginRequestSpy = vi.spyOn(auth, 'loginRequest').mockImplementationOnce(() => {})
      const refreshSpy = vi.spyOn(auth, 'refreshUser').mockResolvedValue(Promise.resolve(mockRefreshResult))

      const result = await auth.signIn(credentials)
      expect(loginRequestSpy).toHaveBeenCalledWith(credentials)
      expect(mercure.init).toHaveBeenCalledWith(true)
      expect(refreshSpy).toHaveBeenCalled()
      expect(result).toEqual(await refreshSpy.mock.results[0].value)
    })
  })

  describe('forgotPassword', () => {
    const mockUserName = 'george'

    test('should return error IF request fails', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new FetchError('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      const result = await auth.forgotPassword(mockUserName)

      expect(result).toEqual(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`/password/reset/request/${mockUserName}`)
    })

    test('should throw error IF request fails AND error is not instance of FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new Error('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)
      cwaFetch.fetch.raw = vi.fn()

      await expect(auth.forgotPassword(mockUserName)).rejects.toThrow(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`/password/reset/request/${mockUserName}`)
    })

    test('should return result IF request succeeds', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockResult = { success: true }

      cwaFetch.fetch = vi.fn().mockResolvedValue(mockResult)

      const result = await auth.forgotPassword(mockUserName)

      expect(result).toEqual(mockResult)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`/password/reset/request/${mockUserName}`)
    })
  })

  describe('resetPassword', () => {
    const mockPayload = {
      username: 'mock-user',
      token: 'abcd1234',
      passwords: {
        first: 'new_pass',
        second: 'new_pass',
      },
    }

    test('should return error IF request fails', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new FetchError('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      const result = await auth.resetPassword(mockPayload)

      expect(result).toEqual(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/component/forms/password_reset/submit', {
        method: 'PATCH',
        body: {
          password_update: {
            username: mockPayload.username,
            plainNewPasswordConfirmationToken: mockPayload.token,
            plainPassword: mockPayload.passwords,
          },
        },
      })
    })

    test('should throw error IF request fails AND error is not instance of FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new Error('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)
      cwaFetch.fetch.raw = vi.fn()

      await expect(auth.resetPassword(mockPayload)).rejects.toThrow(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/component/forms/password_reset/submit', {
        method: 'PATCH',
        body: {
          password_update: {
            username: mockPayload.username,
            plainNewPasswordConfirmationToken: mockPayload.token,
            plainPassword: mockPayload.passwords,
          },
        },
      })
    })

    test('should return result IF request succeeds', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockResult = { success: true }

      cwaFetch.fetch = vi.fn().mockResolvedValue(mockResult)

      const result = await auth.resetPassword(mockPayload)

      expect(result).toEqual(mockResult)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/component/forms/password_reset/submit', {
        method: 'PATCH',
        body: {
          password_update: {
            username: mockPayload.username,
            plainNewPasswordConfirmationToken: mockPayload.token,
            plainPassword: mockPayload.passwords,
          },
        },
      })
    })
  })

  describe('signOut', () => {
    test('should return error IF request fails', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new FetchError('oops')
      const clearSessionSpy = vi.spyOn(auth, 'clearSession')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      const result = await auth.signOut()

      expect(cwaFetch.fetch).toHaveBeenCalledWith('/logout')
      expect(clearSessionSpy).not.toHaveBeenCalled()
      expect(result).toEqual(mockError)
    })

    test('should throw error IF request fails AND error is not instance of FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new Error('oops')
      const clearSessionSpy = vi.spyOn(auth, 'clearSession')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)
      cwaFetch.fetch.raw = vi.fn()

      await expect(auth.signOut()).rejects.toThrow(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/logout')
      expect(clearSessionSpy).not.toHaveBeenCalled()
    })

    test('should return result IF request succeeds AND do cleanup', async () => {
      const {
        auth,
        cwaFetch,
      } = createAuth()
      const mockResult = { success: true }
      const clearSessionSpy = vi.spyOn(auth, 'clearSession')

      cwaFetch.fetch = vi.fn().mockResolvedValue(mockResult)

      const result = await auth.signOut()
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/logout')
      expect(clearSessionSpy).toHaveBeenCalled()
      expect(result).toEqual(mockResult)
    })
  })

  describe('refreshUser', () => {
    test('should return error AND clear session IF request fails', async () => {
      const {
        auth,
        cwaFetch,
        mercure,
        resourcesStore,
        fetcherStore,
        fetcher,
      } = createAuth()
      const mockError = new FetchError('oops')

      cwaFetch.fetch.raw = vi.fn().mockRejectedValue(mockError)

      const result = await auth.refreshUser()

      expect(result).toEqual(mockError)
      expect(cwaFetch.fetch.raw).toHaveBeenCalledWith('/me')
      expect(mercure.init).toHaveBeenCalledWith(true)
      expect(fetcherStore.useStore().clearFetches).toHaveBeenCalled()
      expect(resourcesStore.useStore().clearResources).toHaveBeenCalled()
      expect(fetcher.fetchRoute).toHaveBeenCalledWith(useRoute())
    })

    test('should throw error IF request fails AND error is not instance of FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new Error('oops')

      // cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)
      cwaFetch.fetch.raw = vi.fn().mockRejectedValue(mockError)

      await expect(auth.refreshUser()).rejects.toThrow(mockError)
      expect(cwaFetch.fetch.raw).toHaveBeenCalledWith('/me')
    })

    test('should return result AND assign it to user store IF request succeeds', async () => {
      const {
        auth,
        cwaFetch,
        authStore,
        apiDocumentation,
        mercure,
      } = createAuth()
      const mockResult = { _data: { name: 'test', age: 23 }, headers: { get: vi.fn(() => 'link_header') } }

      cwaFetch.fetch = { raw: vi.fn().mockResolvedValue(mockResult) }

      const result = await auth.refreshUser()

      expect(result).toEqual(mockResult._data)
      expect(cwaFetch.fetch.raw).toHaveBeenCalledWith('/me')
      expect(mockResult.headers.get).toHaveBeenCalledWith('link')
      expect(mercure.setMercureHubFromLinkHeader).toHaveBeenCalledWith('link_header')
      expect(apiDocumentation.setDocsPathFromLinkHeader).toHaveBeenCalledWith('link_header')
      expect(authStore.useStore().data.user).toEqual(mockResult._data)
    })
  })

  describe('init', () => {
    test('should NOT refresh user IF status is NOT signed in', async () => {
      const { auth, cookie } = createAuth()

      cookie.value = '0'

      const refreshSpy = vi.spyOn(auth, 'refreshUser')
      auth.hasCheckedMeEndpointForInit = true

      await auth.init()

      expect(refreshSpy).not.toHaveBeenCalled()
    })

    test('should NOT refresh user IF user is defined', async () => {
      const { auth, cookie, authStore } = createAuth()

      cookie.value = '1'

      const refreshSpy = vi.spyOn(auth, 'refreshUser')

      authStore.useStore().data.user = { name: 'test' }
      auth.hasCheckedMeEndpointForInit = true

      await auth.init()

      expect(refreshSpy).not.toHaveBeenCalled()
    })

    test('should refresh user IF user is NOT defined AND auth status EQUALS to signed in', async () => {
      const { auth, cookie, authStore } = createAuth()

      cookie.value = '1'

      const refreshSpy = vi.spyOn(auth, 'refreshUser').mockResolvedValue({})

      // @ts-expect-error
      authStore.useStore().data.user = undefined
      auth.hasCheckedMeEndpointForInit = true

      await auth.init()

      expect(refreshSpy).toHaveBeenCalled()
    })
  })

  describe('user getter', () => {
    test('should return user data from store', () => {
      const { auth, authStore } = createAuth()
      const mockUser = { name: 'test' }

      authStore.useStore().data.user = mockUser

      expect(auth.user).toEqual(mockUser)
    })
  })

  describe('roles getter', () => {
    test('should return nothing IF user is NOT defined', () => {
      const { auth, authStore } = createAuth()

      // @ts-expect-error
      authStore.useStore().data.user = undefined

      expect(auth.roles).toBeUndefined()
    })

    test('should return roles BASED on user roles IF user is defined', () => {
      const { auth, authStore } = createAuth()
      const mockRoles = [CwaUserRoles.ADMIN, CwaUserRoles.SUPER_ADMIN]
      authStore.useStore().data.user = {
        roles: mockRoles,
      }

      expect(auth.roles).toEqual(mockRoles)
    })
  })

  describe('signedIn getter', () => {
    test('should return true IF status is signed in', () => {
      const { auth, cookie } = createAuth()

      cookie.value = '1'

      expect(auth.signedIn.value).toEqual(true)
    })

    test('should return true IF status is signed out', () => {
      const { auth, cookie } = createAuth()

      cookie.value = '0'

      expect(auth.signedIn.value).toEqual(false)
    })
  })

  describe('hasRole', () => {
    test('should return false IF user has no roles', () => {
      const { auth, authStore } = createAuth()

      authStore.useStore().data.user = {
        roles: null,
      }

      expect(auth.hasRole(CwaUserRoles.ADMIN)).toEqual(false)
    })

    test('should return false IF user does not have passed role', () => {
      const { auth, authStore } = createAuth()

      authStore.useStore().data.user = {
        roles: [CwaUserRoles.USER],
      }

      expect(auth.hasRole(CwaUserRoles.ADMIN)).toEqual(false)
    })

    test('should return false IF user has passed role', () => {
      const { auth, authStore } = createAuth()

      authStore.useStore().data.user = {
        roles: [CwaUserRoles.ADMIN],
      }

      expect(auth.hasRole(CwaUserRoles.ADMIN)).toEqual(true)
    })
  })

  describe('loginRequest', () => {
    const credentials = { username: 'mock-user', password: 'sEcrEt' }

    test('If login successful return the result and keep loading value as true', async () => {
      const { auth, cwaFetch } = createAuth()
      const fetchResult = { success: true }
      cwaFetch.fetch = vi.fn().mockResolvedValue(fetchResult)
      const result = await auth.loginRequest(credentials)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/login', { method: 'POST', body: credentials })
      expect(auth.loading.value).toBe(true)
      expect(result).toEqual(fetchResult)
    })

    test('If fetch throws a fetch error - reset loading and return the error', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new FetchError('oops')
      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)
      const result = await auth.loginRequest(credentials)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/login', { method: 'POST', body: credentials })
      expect(auth.loading.value).toBe(false)
      expect(result).toEqual(mockError)
    })

    test('If fetch throws any other error - reset loading and throw error', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new Error('oops')
      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)
      await expect(auth.loginRequest(credentials)).rejects.toThrow(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/login', { method: 'POST', body: credentials })
      expect(auth.loading.value).toBe(false)
    })
  })

  describe('status getter', () => {
    test.each([
      { loading: true, authCookieValue: undefined, result: CwaAuthStatus.LOADING },
      { loading: false, authCookieValue: '1', result: CwaAuthStatus.SIGNED_IN },
      { loading: false, authCookieValue: undefined, result: CwaAuthStatus.SIGNED_OUT },
    ])('If loading is %loading', ({ loading, authCookieValue, result }) => {
      const { auth } = createAuth()
      auth.loading.value = loading
      auth.authCookie.value = authCookieValue
      expect(auth.status.value).toBe(result)
    })
  })

  describe('clearSession', () => {
    test('Clear session requirements are met', async () => {
      const {
        auth,
        authStore,
        mercure,
        fetcherStore,
        resourcesStore,
        fetcher,
        admin,
      } = createAuth()

      await auth.clearSession()

      expect(authStore.useStore().data.user).toEqual(undefined)
      expect(admin.toggleEdit).toHaveBeenCalledWith(false)
      expect(mercure.init).toHaveBeenCalledWith(true)
      expect(fetcherStore.useStore().clearFetches).toHaveBeenCalled()
      expect(resourcesStore.useStore().clearResources).toHaveBeenCalled()
      expect(fetcher.fetchRoute).toHaveBeenCalledWith(useRoute())
    })
  })

  describe.todo('authStore getter', () => {})
  describe.todo('resourcesStore getter', () => {})
  describe.todo('fetcherStore getter', () => {})
})
