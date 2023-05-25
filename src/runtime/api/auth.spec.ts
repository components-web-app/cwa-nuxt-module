// @vitest-environment nuxt
import { describe, expect, test, vi } from 'vitest'
import { FetchError } from 'ofetch'
import { useRoute } from '#app'
import Auth from './auth'
import { ref } from '#imports'
import { CwaUserRoles } from '#cwa/runtime/storage/stores/auth/state'

function createAuth () {
  const mockUserData = {
    data: {
      user: {}
    }
  }
  const mockResources = {
    clearResources: vi.fn()
  }
  const mockFetcherData = {
    clearFetches: vi.fn()
  }
  const mockFetch = {
    fetch: vi.fn()
  }
  const mockAuthStore = {
    useStore () {
      return mockUserData
    }
  }
  const mockResourcesStore = {
    useStore () {
      return mockResources
    }
  }
  const mockFetcherStore = {
    useStore () {
      return mockFetcherData
    }
  }
  const mockMercure = {
    init: vi.fn()
  }
  const mockFetcher = {
    fetchRoute: vi.fn()
  }
  const mockCookie = ref('0')
  const auth = new Auth(
    // @ts-ignore
    mockFetch,
    mockMercure,
    mockFetcher,
    mockAuthStore,
    mockResourcesStore,
    mockFetcherStore,
    mockCookie
  )

  return {
    auth,
    cwaFetch: mockFetch,
    mercure: mockMercure,
    authStore: mockAuthStore,
    fetcherStore: mockFetcherStore,
    resourcesStore: mockResourcesStore,
    fetcher: mockFetcher,
    cookie: mockCookie
  }
}

describe('Auth', () => {
  describe('sign in', () => {
    const credentials = { username: 'mock-user', password: 'sEcrEt' }

    test('should return error IF login request fails', async () => {
      const { auth, cwaFetch, mercure } = createAuth()
      const mockError = new FetchError('oops')
      const refreshSpy = vi.spyOn(auth, 'refreshUser')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      const result = await auth.signIn(credentials)

      expect(cwaFetch.fetch).toHaveBeenCalledWith('/login', { method: 'POST', body: credentials })
      expect(result).toEqual(mockError)
      expect(refreshSpy).not.toHaveBeenCalled()
      expect(mercure.init).not.toHaveBeenCalled()
    })

    test('should init mercure AND refresh user', async () => {
      const { auth, cwaFetch, mercure } = createAuth()
      const mockRefreshResult = { name: 'Mock' }
      const refreshSpy = vi.spyOn(auth, 'refreshUser').mockResolvedValue(mockRefreshResult)

      cwaFetch.fetch = vi.fn().mockResolvedValue({ success: true })

      await auth.signIn(credentials)

      expect(cwaFetch.fetch).toHaveBeenCalledWith('/login', { method: 'POST', body: credentials })
      expect(mercure.init).toHaveBeenCalledWith(true)
      expect(refreshSpy).toHaveBeenCalled()
    })
  })

  describe('forgot password', () => {
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

  describe('reset password', () => {
    const mockPayload = {
      username: 'mock-user',
      token: 'abcd1234',
      passwords: {
        first: 'new_pass',
        second: 'new_pass'
      }
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
            plainPassword: mockPayload.passwords
          }
        }
      })
    })

    test('should throw error IF request fails AND error is not instance of FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new Error('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      await expect(auth.resetPassword(mockPayload)).rejects.toThrow(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/component/forms/password_reset/submit', {
        method: 'PATCH',
        body: {
          password_update: {
            username: mockPayload.username,
            plainNewPasswordConfirmationToken: mockPayload.token,
            plainPassword: mockPayload.passwords
          }
        }
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
            plainPassword: mockPayload.passwords
          }
        }
      })
    })
  })

  describe('sign out', () => {
    test('should return error IF request fails', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new FetchError('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      const result = await auth.signOut()

      expect(result).toEqual(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/logout')
    })

    test('should throw error IF request fails AND error is not instance of FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new Error('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      await expect(auth.signOut()).rejects.toThrow(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/logout')
    })

    test('should return result IF request succeeds AND do cleanup', async () => {
      const {
        auth,
        cwaFetch,
        authStore,
        mercure,
        fetcherStore,
        resourcesStore,
        fetcher
      } = createAuth()
      const mockResult = { success: true }

      cwaFetch.fetch = vi.fn().mockResolvedValue(mockResult)

      const result = await auth.signOut()

      expect(result).toEqual(mockResult)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/logout')
      expect(authStore.useStore().data.user).toEqual(undefined)
      expect(mercure.init).toHaveBeenCalledWith(true)
      expect(fetcherStore.useStore().clearFetches).toHaveBeenCalled()
      expect(resourcesStore.useStore().clearResources).toHaveBeenCalled()
      expect(fetcher.fetchRoute).toHaveBeenCalledWith(useRoute())
    })
  })

  describe('refresh user', () => {
    test('should return error AND clear session IF request fails', async () => {
      const {
        auth,
        cwaFetch,
        mercure,
        resourcesStore,
        fetcherStore,
        fetcher
      } = createAuth()
      const mockError = new FetchError('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      const result = await auth.refreshUser()

      expect(result).toEqual(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/me')
      expect(mercure.init).toHaveBeenCalledWith(true)
      expect(fetcherStore.useStore().clearFetches).toHaveBeenCalled()
      expect(resourcesStore.useStore().clearResources).toHaveBeenCalled()
      expect(fetcher.fetchRoute).toHaveBeenCalledWith(useRoute())
    })

    test('should throw error IF request fails AND error is not instance of FetchError', async () => {
      const { auth, cwaFetch } = createAuth()
      const mockError = new Error('oops')

      cwaFetch.fetch = vi.fn().mockRejectedValue(mockError)

      await expect(auth.refreshUser()).rejects.toThrow(mockError)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/me')
    })

    test('should return result AND assign it to user store IF request succeeds', async () => {
      const {
        auth,
        cwaFetch,
        authStore
      } = createAuth()
      const mockResult = { name: 'test', age: 23 }

      cwaFetch.fetch = vi.fn().mockResolvedValue(mockResult)

      const result = await auth.refreshUser()

      expect(result).toEqual(mockResult)
      expect(cwaFetch.fetch).toHaveBeenCalledWith('/me')
      expect(authStore.useStore().data.user).toEqual(mockResult)
    })
  })

  describe('init', () => {
    test('should NOT refresh user IF status is NOT signed in', async () => {
      const { auth, cookie } = createAuth()

      cookie.value = '0'

      const refreshSpy = vi.spyOn(auth, 'refreshUser')

      await auth.init()

      expect(refreshSpy).not.toHaveBeenCalled()
    })

    test('should NOT refresh user IF user is defined', async () => {
      const { auth, cookie, authStore } = createAuth()

      cookie.value = '1'

      const refreshSpy = vi.spyOn(auth, 'refreshUser')

      authStore.useStore().data.user = { name: 'test' }

      await auth.init()

      expect(refreshSpy).not.toHaveBeenCalled()
    })

    test('should refresh user IF user is NOT defined AND auth status EQUALS to signed in', async () => {
      const { auth, cookie, authStore } = createAuth()

      cookie.value = '1'

      const refreshSpy = vi.spyOn(auth, 'refreshUser').mockResolvedValue({})

      // @ts-ignore
      authStore.useStore().data.user = undefined

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

      // @ts-ignore
      authStore.useStore().data.user = undefined

      expect(auth.roles).toBeUndefined()
    })

    test('should return roles BASED on user roles IF user is defined', () => {
      const { auth, authStore } = createAuth()
      const mockRoles = [CwaUserRoles.ADMIN, CwaUserRoles.SUPER_ADMIN]
      authStore.useStore().data.user = {
        roles: mockRoles
      }

      expect(auth.roles).toEqual(mockRoles)
    })
  })

  describe('has role', () => {
    test('should return false IF user has no roles', () => {
      const { auth, authStore } = createAuth()

      authStore.useStore().data.user = {
        roles: null
      }

      expect(auth.hasRole(CwaUserRoles.ADMIN)).toEqual(false)
    })

    test('should return false IF user does not have passed role', () => {
      const { auth, authStore } = createAuth()

      authStore.useStore().data.user = {
        roles: [CwaUserRoles.USER]
      }

      expect(auth.hasRole(CwaUserRoles.ADMIN)).toEqual(false)
    })

    test('should return false IF user has passed role', () => {
      const { auth, authStore } = createAuth()

      authStore.useStore().data.user = {
        roles: [CwaUserRoles.ADMIN]
      }

      expect(auth.hasRole(CwaUserRoles.ADMIN)).toEqual(true)
    })
  })
})
