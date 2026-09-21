// @vitest-environment nuxt
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { FetchError } from 'ofetch'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useVerifyEmail } from '#cwa/composables/useVerifyEmail'

// vi.hoisted runs before imports — plain object, no reactive needed for params
const mockParams = vi.hoisted(() => ({} as Record<string, string | string[]>))

mockNuxtImport('useRoute', () => () => ({ params: mockParams }))

const mockAuth = vi.hoisted(() => ({
  verifyEmail: vi.fn(),
  confirmEmail: vi.fn(),
}))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({ auth: mockAuth }),
}))

function makeFetchError(status: number, data: any = {}): FetchError {
  const err = new FetchError('error')
  err.status = status
  err.data = data
  return err
}

describe('useVerifyEmail', () => {
  beforeEach(() => {
    Object.keys(mockParams).forEach(k => delete mockParams[k])
    vi.clearAllMocks()
  })

  describe('getStringFromParam', () => {
    test('returns the string param value', () => {
      mockParams.username = 'alice'
      const { getStringFromParam } = useVerifyEmail()
      expect(getStringFromParam('username')).toBe('alice')
    })

    test('returns first element when param is an array', () => {
      mockParams.token = ['abc', 'def']
      const { getStringFromParam } = useVerifyEmail()
      expect(getStringFromParam('token')).toBe('abc')
    })

    test('returns empty string when param is missing', () => {
      const { getStringFromParam } = useVerifyEmail()
      expect(getStringFromParam('username')).toBe('')
    })
  })

  describe('verifyEmail', () => {
    test('sets error when username is missing', async () => {
      const { verifyEmail, error } = useVerifyEmail()
      await verifyEmail()
      expect(error.value).toBe('No username specified')
    })

    test('sets error when token is missing', async () => {
      mockParams.username = 'alice'
      const { verifyEmail, error } = useVerifyEmail()
      await verifyEmail()
      expect(error.value).toBe('No token specified')
    })

    test('sets success on resolved response', async () => {
      mockParams.username = 'alice'
      mockParams.token = 'tok123'
      mockAuth.verifyEmail.mockResolvedValue({ '@id': '/users/alice' })
      const { verifyEmail, success, submitting } = useVerifyEmail()
      await verifyEmail()
      expect(success.value).toBe(true)
      expect(submitting.value).toBe(false)
    })

    test('sets error for 404 FetchError', async () => {
      mockParams.username = 'alice'
      mockParams.token = 'tok123'
      mockAuth.verifyEmail.mockResolvedValue(makeFetchError(404))
      const { verifyEmail, error } = useVerifyEmail()
      await verifyEmail()
      expect(error.value).toBe('Request expired or has already been used.')
    })

    test('sets error message from data for non-404 FetchError', async () => {
      mockParams.username = 'alice'
      mockParams.token = 'tok123'
      mockAuth.verifyEmail.mockResolvedValue(makeFetchError(500, { message: 'Server down' }))
      const { verifyEmail, error } = useVerifyEmail()
      await verifyEmail()
      expect(error.value).toBe('Server down')
    })

    test('calls auth.verifyEmail with username and token', async () => {
      mockParams.username = 'alice'
      mockParams.token = 'abc'
      mockAuth.verifyEmail.mockResolvedValue({})
      const { verifyEmail } = useVerifyEmail()
      await verifyEmail()
      expect(mockAuth.verifyEmail).toHaveBeenCalledWith({ username: 'alice', token: 'abc' })
    })
  })

  describe('confirmEmail', () => {
    test('sets error when username is missing', async () => {
      const { confirmEmail, error } = useVerifyEmail()
      await confirmEmail()
      expect(error.value).toBe('No username specified')
    })

    test('sets error when token is missing', async () => {
      mockParams.username = 'alice'
      const { confirmEmail, error } = useVerifyEmail()
      await confirmEmail()
      expect(error.value).toBe('No token specified')
    })

    test('sets error when newEmail is missing', async () => {
      mockParams.username = 'alice'
      mockParams.token = 'tok'
      const { confirmEmail, error } = useVerifyEmail()
      await confirmEmail()
      expect(error.value).toBe('No new email specified')
    })

    test('sets success on resolved response', async () => {
      mockParams.username = 'alice'
      mockParams.token = 'tok'
      mockParams.newEmail = 'new@example.com'
      mockAuth.confirmEmail.mockResolvedValue({})
      const { confirmEmail, success } = useVerifyEmail()
      await confirmEmail()
      expect(success.value).toBe(true)
    })

    test('calls auth.confirmEmail with all params', async () => {
      mockParams.username = 'alice'
      mockParams.token = 'tok'
      mockParams.newEmail = 'new@example.com'
      mockAuth.confirmEmail.mockResolvedValue({})
      const { confirmEmail } = useVerifyEmail()
      await confirmEmail()
      expect(mockAuth.confirmEmail).toHaveBeenCalledWith({
        username: 'alice',
        token: 'tok',
        newEmail: 'new@example.com',
      })
    })
  })
})
