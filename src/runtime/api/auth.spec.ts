// @vitest-environment nuxt

import { afterEach, describe, expect, test, vi } from 'vitest'
import { FetchError } from 'ofetch'
import { CwaUserRoles } from '../storage/stores/auth/state'
import * as processComposables from '../composables/process'
import Auth, { CwaAuthStatus } from './auth'
import { useRoute } from '#app'
import { ref } from '#imports'

const nuxtMockState = vi.hoisted(() => ({
  enabled: false,
  nuxtApp: { _processingMiddleware: false } as any,
  nuxtAppThrows: false,
  route: { meta: {} } as any,
  routerReplace: vi.fn(),
  contextApp: undefined as any,
  calls: [] as { name: string, inContext: boolean }[],
}))

function recordCall(name: string) {
  nuxtMockState.calls.push({ name, inContext: nuxtMockState.contextApp !== undefined })
}

vi.mock('#app/nuxt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#app/nuxt')>()
  return {
    ...actual,
    useNuxtApp: (...args: any[]) => {
      if (!nuxtMockState.enabled) {
        return (actual.useNuxtApp as any)(...args)
      }
      recordCall('useNuxtApp')
      if (nuxtMockState.nuxtAppThrows) {
        throw new Error('useNuxtApp unavailable')
      }
      return nuxtMockState.contextApp ?? nuxtMockState.nuxtApp
    },
  }
})

vi.mock('#app/composables/router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#app/composables/router')>()
  return {
    ...actual,
    useRoute: (...args: any[]) => {
      if (!nuxtMockState.enabled) {
        return (actual.useRoute as any)(...args)
      }
      recordCall('useRoute')
      return nuxtMockState.route
    },
    useRouter: (...args: any[]) => {
      if (!nuxtMockState.enabled) {
        return (actual.useRouter as any)(...args)
      }
      recordCall('useRouter')
      return { replace: nuxtMockState.routerReplace }
    },
  }
})

afterEach(() => {
  nuxtMockState.enabled = false
  nuxtMockState.nuxtApp = { _processingMiddleware: false }
  nuxtMockState.nuxtAppThrows = false
  nuxtMockState.route = { meta: {} }
  nuxtMockState.routerReplace = vi.fn()
  nuxtMockState.contextApp = undefined
  nuxtMockState.calls = []
  vi.restoreAllMocks()
})

function createCapturedApp(processingMiddleware: boolean) {
  const app: any = { _processingMiddleware: processingMiddleware }
  app.runWithContext = vi.fn((fn: () => unknown) => {
    const previous = nuxtMockState.contextApp
    nuxtMockState.contextApp = app
    try {
      return fn()
    }
    finally {
      nuxtMockState.contextApp = previous
    }
  })
  return app
}

function createAuthWithCapturedApp(capturedApp: any, otherApp: any) {
  nuxtMockState.enabled = true
  nuxtMockState.nuxtApp = capturedApp
  const created = createAuth()
  nuxtMockState.nuxtApp = otherApp
  return created
}

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
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`/password/reset/request/${mockUserName}`, {
        retry: 0,
      })
    })

    test('should throw error IF request fails AND error is not instance of FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new Error('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)
      cwaFetch.fetch.raw = vi.fn()

      await expect(auth.forgotPassword(mockUserName)).rejects.toThrow(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`/password/reset/request/${mockUserName}`, {
        retry: 0,
      })
    })

    test('should return result IF request succeeds', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockResult = { success: true }

      cwaFetch.fetch = vi.fn().mockResolvedValue(mockResult)

      const result = await auth.forgotPassword(mockUserName)

      expect(result).toEqual(mockResult)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`/password/reset/request/${mockUserName}`, {
        retry: 0,
      })
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
        method: 'POST',
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
        method: 'POST',
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
        method: 'POST',
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

  describe('resendVerifyEmail', () => {
    const mockUserName = 'george'

    test('should return result IF request succeeds', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockResult = { success: true }

      cwaFetch.fetch = vi.fn().mockResolvedValue(mockResult)

      const result = await auth.resendVerifyEmail(mockUserName)

      expect(result).toEqual(mockResult)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`/resend-verify-email/${mockUserName}`, {
        retry: 0,
      })
    })

    test('should return error IF request fails with a FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new FetchError('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      const result = await auth.resendVerifyEmail(mockUserName)

      expect(result).toEqual(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`/resend-verify-email/${mockUserName}`, {
        retry: 0,
      })
    })

    test('should throw error IF request fails AND error is not instance of FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new Error('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      await expect(auth.resendVerifyEmail(mockUserName)).rejects.toThrow(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`/resend-verify-email/${mockUserName}`, {
        retry: 0,
      })
    })
  })

  describe('resendVerifyNewEmail', () => {
    const mockUserName = 'george'

    test('should return result IF request succeeds', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockResult = { success: true }

      cwaFetch.fetch = vi.fn().mockResolvedValue(mockResult)

      const result = await auth.resendVerifyNewEmail(mockUserName)

      expect(result).toEqual(mockResult)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`/resend-verify-new-email/${mockUserName}`, {
        retry: 0,
      })
    })

    test('should return error IF request fails with a FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new FetchError('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      const result = await auth.resendVerifyNewEmail(mockUserName)

      expect(result).toEqual(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`/resend-verify-new-email/${mockUserName}`, {
        retry: 0,
      })
    })

    test('should throw error IF request fails AND error is not instance of FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new Error('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      await expect(auth.resendVerifyNewEmail(mockUserName)).rejects.toThrow(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(`/resend-verify-new-email/${mockUserName}`, {
        retry: 0,
      })
    })
  })

  describe('confirmEmail', () => {
    const mockEvent = {
      username: 'george',
      newEmail: 'new@example.com',
      token: 'tok123',
    }
    const expectedPath = `/confirm-email/${encodeURIComponent(mockEvent.username)}/${encodeURIComponent(mockEvent.newEmail)}/${encodeURIComponent(mockEvent.token)}`

    test('should return result IF request succeeds', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockResult = { success: true }

      cwaFetch.fetch = vi.fn().mockResolvedValue(mockResult)

      const result = await auth.confirmEmail(mockEvent)

      expect(result).toEqual(mockResult)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(expectedPath, {
        retry: 0,
      })
    })

    test('should return error IF request fails with a FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new FetchError('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      const result = await auth.confirmEmail(mockEvent)

      expect(result).toEqual(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(expectedPath, {
        retry: 0,
      })
    })

    test('should throw error IF request fails AND error is not instance of FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new Error('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      await expect(auth.confirmEmail(mockEvent)).rejects.toThrow(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(expectedPath, {
        retry: 0,
      })
    })
  })

  describe('verifyEmail', () => {
    const mockEvent = {
      username: 'george',
      token: 'tok123',
    }
    const expectedPath = `/verify-email/${encodeURIComponent(mockEvent.username)}/${encodeURIComponent(mockEvent.token)}`

    test('should return result IF request succeeds', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockResult = { success: true }

      cwaFetch.fetch = vi.fn().mockResolvedValue(mockResult)

      const result = await auth.verifyEmail(mockEvent)

      expect(result).toEqual(mockResult)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(expectedPath, {
        retry: 0,
      })
    })

    test('should return error IF request fails with a FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new FetchError('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      const result = await auth.verifyEmail(mockEvent)

      expect(result).toEqual(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(expectedPath, {
        retry: 0,
      })
    })

    test('should throw error IF request fails AND error is not instance of FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new Error('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      await expect(auth.verifyEmail(mockEvent)).rejects.toThrow(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith(expectedPath, {
        retry: 0,
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

      expect(cwaFetch.fetch).toHaveBeenCalledWith('/logout', {
        method: 'POST',
      })
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
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/logout', {
        method: 'POST',
      })
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
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/logout', {
        method: 'POST',
      })
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

  describe('isAdmin getter', () => {
    test('should return true IF user has the admin role', () => {
      const { auth, authStore } = createAuth()

      authStore.useStore().data.user = {
        roles: [CwaUserRoles.ADMIN],
      }

      expect(auth.isAdmin.value).toBe(true)
    })

    test('should return false IF user does NOT have the admin role', () => {
      const { auth, authStore } = createAuth()

      authStore.useStore().data.user = {
        roles: [CwaUserRoles.USER],
      }

      expect(auth.isAdmin.value).toBe(false)
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

    test('should return early WITHOUT clearing resources IF processing middleware', async () => {
      const {
        auth,
        authStore,
        mercure,
        fetcherStore,
        resourcesStore,
        fetcher,
        admin,
        cookie,
      } = createAuth()

      nuxtMockState.enabled = true
      nuxtMockState.nuxtApp = { _processingMiddleware: true }

      await auth.clearSession()

      expect(authStore.useStore().data.user).toEqual(undefined)
      expect(cookie.value).toBe('0')
      expect(admin.toggleEdit).toHaveBeenCalledWith(false)

      expect(mercure.init).not.toHaveBeenCalled()
      expect(fetcherStore.useStore().clearFetches).not.toHaveBeenCalled()
      expect(resourcesStore.useStore().clearResources).not.toHaveBeenCalled()
      expect(fetcher.fetchRoute).not.toHaveBeenCalled()
    })

    test('should treat throwing useNuxtApp as processing middleware AND return early', async () => {
      const {
        auth,
        mercure,
        fetcherStore,
        resourcesStore,
        fetcher,
      } = createAuth()

      nuxtMockState.enabled = true
      nuxtMockState.nuxtAppThrows = true

      await auth.clearSession()

      expect(mercure.init).not.toHaveBeenCalled()
      expect(fetcherStore.useStore().clearFetches).not.toHaveBeenCalled()
      expect(resourcesStore.useStore().clearResources).not.toHaveBeenCalled()
      expect(fetcher.fetchRoute).not.toHaveBeenCalled()
    })

    test('should redirect to root WITHOUT fetching route IF current route is an admin route', async () => {
      const {
        auth,
        mercure,
        fetcherStore,
        resourcesStore,
        fetcher,
      } = createAuth()

      nuxtMockState.enabled = true
      nuxtMockState.nuxtApp = { _processingMiddleware: false }
      nuxtMockState.route = { meta: { cwa: { admin: true } } }
      const replaceSpy = nuxtMockState.routerReplace

      await auth.clearSession()

      expect(mercure.init).toHaveBeenCalledWith(true)
      expect(fetcherStore.useStore().clearFetches).toHaveBeenCalled()
      expect(resourcesStore.useStore().clearResources).toHaveBeenCalled()
      expect(replaceSpy).toHaveBeenCalledWith('/')
      expect(fetcher.fetchRoute).not.toHaveBeenCalled()
    })

    test('resolves useNuxtApp, useRoute and useRouter through the captured app', async () => {
      const capturedApp = createCapturedApp(false)
      const { auth, fetcher } = createAuthWithCapturedApp(capturedApp, { _processingMiddleware: false })
      nuxtMockState.route = { meta: { cwa: { admin: true } } }
      nuxtMockState.calls = []

      await auth.clearSession()

      expect(capturedApp.runWithContext).toHaveBeenCalled()
      expect(nuxtMockState.calls.map(call => call.name)).toEqual(['useNuxtApp', 'useRoute', 'useRouter'])
      expect(nuxtMockState.calls.every(call => call.inContext)).toBe(true)
      expect(nuxtMockState.routerReplace).toHaveBeenCalledWith('/')
      expect(fetcher.fetchRoute).not.toHaveBeenCalled()
    })

    test('resolves the route to re-fetch through the captured app', async () => {
      const capturedApp = createCapturedApp(false)
      const { auth, fetcher } = createAuthWithCapturedApp(capturedApp, { _processingMiddleware: false })
      nuxtMockState.calls = []

      await auth.clearSession()

      expect(capturedApp.runWithContext).toHaveBeenCalled()
      expect(nuxtMockState.calls.map(call => call.name)).toEqual(['useNuxtApp', 'useRoute'])
      expect(nuxtMockState.calls.every(call => call.inContext)).toBe(true)
      expect(fetcher.fetchRoute).toHaveBeenCalledWith(nuxtMockState.route)
    })

    test('returns early when the captured app is processing middleware and another app is not', async () => {
      const capturedApp = createCapturedApp(true)
      const { auth, mercure, fetcher } = createAuthWithCapturedApp(capturedApp, { _processingMiddleware: false })

      await auth.clearSession()

      expect(mercure.init).not.toHaveBeenCalled()
      expect(fetcher.fetchRoute).not.toHaveBeenCalled()
      expect(capturedApp.runWithContext).toHaveBeenCalled()
    })

    test('carries on when another app is processing middleware and the captured app is not', async () => {
      const capturedApp = createCapturedApp(false)
      const { auth, mercure, fetcher } = createAuthWithCapturedApp(capturedApp, { _processingMiddleware: true })

      await auth.clearSession()

      expect(mercure.init).toHaveBeenCalledWith(true)
      expect(fetcher.fetchRoute).toHaveBeenCalledWith(nuxtMockState.route)
      expect(capturedApp.runWithContext).toHaveBeenCalled()
    })
  })

  describe.todo('authStore getter', () => {})
  describe.todo('resourcesStore getter', () => {})
  describe.todo('fetcherStore getter', () => {})
})

describe('Auth session end handler', () => {
  function createAuthWithHandler(handler: () => unknown = vi.fn()) {
    const created = createAuth()
    const onUnauthorised = vi.fn()
    Object.assign(created.cwaFetch, { onUnauthorised })
    created.auth.onSessionEnd(handler)
    return { ...created, handler, onUnauthorised }
  }

  test('signing out while signed in calls the handler', async () => {
    const { auth, cwaFetch, cookie, handler } = createAuthWithHandler()
    cookie.value = '1'
    cwaFetch.fetch = vi.fn().mockResolvedValue({ success: true })

    await auth.signOut()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(cookie.value).toBe('0')
  })

  test('a /me 401 while the cookie is 1 calls the handler', async () => {
    const { auth, cwaFetch, cookie, handler } = createAuthWithHandler()
    cookie.value = '1'
    cwaFetch.fetch.raw = vi.fn().mockRejectedValue(new FetchError('401'))

    await auth.refreshUser()

    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('an anonymous /me 401 does not call the handler', async () => {
    const { auth, cwaFetch, cookie, handler } = createAuthWithHandler()
    cookie.value = '0'
    cwaFetch.fetch.raw = vi.fn().mockRejectedValue(new FetchError('401'))

    await auth.refreshUser()

    expect(handler).not.toHaveBeenCalled()
  })

  test('the handler is called while middleware is processing, before the early return', async () => {
    const { auth, cookie, handler, mercure } = createAuthWithHandler()
    cookie.value = '1'
    nuxtMockState.enabled = true
    nuxtMockState.nuxtApp = { _processingMiddleware: true }

    await auth.clearSession()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(mercure.init).not.toHaveBeenCalled()
  })

  test('a handler that throws never fails sign-out', async () => {
    const { auth, cwaFetch, cookie } = createAuthWithHandler(() => {
      throw new Error('boom')
    })
    cookie.value = '1'
    const mockResult = { success: true }
    cwaFetch.fetch = vi.fn().mockResolvedValue(mockResult)

    await expect(auth.signOut()).resolves.toEqual(mockResult)
    expect(cookie.value).toBe('0')
  })

  test('a handler that rejects or never settles does not block sign-out', async () => {
    const rejecting = createAuthWithHandler(() => Promise.reject(new Error('boom')))
    rejecting.cookie.value = '1'
    rejecting.cwaFetch.fetch = vi.fn().mockResolvedValue({ success: true })
    await expect(rejecting.auth.signOut()).resolves.toEqual({ success: true })

    const pending = createAuthWithHandler(() => new Promise(() => undefined))
    pending.cookie.value = '1'
    pending.cwaFetch.fetch = vi.fn().mockResolvedValue({ success: true })
    await expect(pending.auth.signOut()).resolves.toEqual({ success: true })
    expect(pending.cookie.value).toBe('0')
  })

  test('a browser 401 calls the handler only while signed in, without signing out', async () => {
    const { auth, cookie, handler, onUnauthorised } = createAuthWithHandler()
    const clearSessionSpy = vi.spyOn(auth, 'clearSession')
    expect(onUnauthorised).toHaveBeenCalledTimes(1)
    const unauthorised = onUnauthorised.mock.calls[0][0]

    cookie.value = '0'
    unauthorised()
    expect(handler).not.toHaveBeenCalled()

    cookie.value = '1'
    unauthorised()
    expect(handler).toHaveBeenCalledTimes(1)
    expect(clearSessionSpy).not.toHaveBeenCalled()
    expect(cookie.value).toBe('1')
  })

  test('a signed-in session ending during the server render records sessionEnded', async () => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: false, isServer: true })
    const { auth, cwaFetch, cookie, authStore } = createAuth()
    cookie.value = '1'
    nuxtMockState.enabled = true
    nuxtMockState.nuxtApp = { _processingMiddleware: true }
    cwaFetch.fetch.raw = vi.fn().mockRejectedValue(new FetchError('401'))

    await auth.refreshUser()

    expect(authStore.useStore().data.sessionEnded).toBe(true)
  })

  test('an anonymous server render does not record sessionEnded', async () => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: false, isServer: true })
    const { auth, cwaFetch, cookie, authStore } = createAuth()
    cookie.value = '0'
    nuxtMockState.enabled = true
    nuxtMockState.nuxtApp = { _processingMiddleware: true }
    cwaFetch.fetch.raw = vi.fn().mockRejectedValue(new FetchError('401'))

    await auth.refreshUser()

    expect(authStore.useStore().data.sessionEnded).not.toBe(true)
  })

  test('a session ending in the browser does not record sessionEnded', async () => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isClient: true, isServer: false })
    const { auth, cookie, authStore, handler } = createAuthWithHandler()
    cookie.value = '1'
    nuxtMockState.enabled = true
    nuxtMockState.nuxtApp = { _processingMiddleware: true }

    await auth.clearSession()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(authStore.useStore().data.sessionEnded).not.toBe(true)
  })

  test('registering a handler after the server recorded sessionEnded calls it once and resets the flag', () => {
    const created = createAuth()
    Object.assign(created.cwaFetch, { onUnauthorised: vi.fn() })
    const data = created.authStore.useStore().data as { sessionEnded?: boolean }
    data.sessionEnded = true
    const handler = vi.fn()

    created.auth.onSessionEnd(handler)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(data.sessionEnded).toBe(false)

    created.auth.onSessionEnd(handler)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('registering a handler without a server-recorded session end calls nothing', () => {
    const created = createAuth()
    Object.assign(created.cwaFetch, { onUnauthorised: vi.fn() })
    const data = created.authStore.useStore().data as { sessionEnded?: boolean }
    data.sessionEnded = false
    const handler = vi.fn()

    created.auth.onSessionEnd(handler)

    expect(handler).not.toHaveBeenCalled()
  })
})
