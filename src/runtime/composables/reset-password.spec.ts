// @vitest-environment nuxt
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { FetchError } from 'ofetch'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useResetPassword } from '#cwa/composables/reset-password'

// vi.hoisted runs before imports — plain object, no reactive needed
const mockParams = vi.hoisted(() => ({} as Record<string, string | string[]>))
const mockNavigateTo = vi.hoisted(() => vi.fn())

mockNuxtImport('useRoute', () => () => ({ params: mockParams }))
mockNuxtImport('navigateTo', () => mockNavigateTo)

const mockResourcesManager = vi.hoisted(() => ({
  storeResource: vi.fn(),
  removeResource: vi.fn(),
}))
const mockAuth = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}))
const mockForms = vi.hoisted(() => ({
  getFormViewErrors: vi.fn().mockReturnValue({ value: undefined }),
}))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    auth: mockAuth,
    forms: mockForms,
    resourcesManager: mockResourcesManager,
  }),
}))

function makeFetchError(status: number, data: any = {}): FetchError {
  const err = new FetchError('error')
  err.status = status
  err.statusMessage = 'error'
  err.data = data
  return err
}

describe('useResetPassword', () => {
  beforeEach(() => {
    Object.keys(mockParams).forEach(k => delete mockParams[k])
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    test('error is null', () => {
      const { error } = useResetPassword()
      expect(error.value).toBeNull()
    })

    test('submitting is false', () => {
      const { submitting } = useResetPassword()
      expect(submitting.value).toBe(false)
    })

    test('success is false', () => {
      const { success } = useResetPassword()
      expect(success.value).toBe(false)
    })
  })

  describe('resetPassword', () => {
    test('navigates to /login when already successful', async () => {
      const { resetPassword, success } = useResetPassword()
      success.value = true
      await resetPassword()
      expect(mockNavigateTo).toHaveBeenCalledWith('/login')
    })

    test('calls auth.resetPassword with username, token, and passwords', async () => {
      mockParams.username = 'alice'
      mockParams.token = 'tok123'
      mockAuth.resetPassword.mockResolvedValue({})
      const { resetPassword, passwords } = useResetPassword()
      passwords.first = 'pass1'
      passwords.second = 'pass2'
      await resetPassword()
      expect(mockAuth.resetPassword).toHaveBeenCalledWith({
        username: 'alice',
        token: 'tok123',
        passwords: { first: 'pass1', second: 'pass2' },
      })
    })

    test('sets success true on resolved response', async () => {
      mockParams.username = 'alice'
      mockParams.token = 'tok'
      mockAuth.resetPassword.mockResolvedValue({ '@id': '/user' })
      const { resetPassword, success, submitting } = useResetPassword()
      await resetPassword()
      expect(success.value).toBe(true)
      expect(submitting.value).toBe(false)
    })

    test('sets error for 404 FetchError', async () => {
      mockParams.username = 'alice'
      mockParams.token = 'tok'
      mockAuth.resetPassword.mockResolvedValue(makeFetchError(404))
      const { resetPassword, error } = useResetPassword()
      await resetPassword()
      expect(error.value).toContain('invalid or has expired')
    })

    test('saves resource and sets form IRI for 422 FetchError', async () => {
      mockParams.username = 'alice'
      mockParams.token = 'tok'
      const fetchError = makeFetchError(422, { '@id': '/forms/reset/1', 'violations': [] })
      mockAuth.resetPassword.mockResolvedValue(fetchError)
      const { resetPassword } = useResetPassword()
      await resetPassword()
      expect(mockResourcesManager.storeResource).toHaveBeenCalledWith({ resource: fetchError.data })
    })

    test('sets generic error message for unexpected FetchError', async () => {
      mockParams.username = 'alice'
      mockParams.token = 'tok'
      mockAuth.resetPassword.mockResolvedValue(makeFetchError(500, { message: 'Server error' }))
      const { resetPassword, error } = useResetPassword()
      await resetPassword()
      expect(error.value).toBe('Server error')
    })

    test('removes previous form resource before new submission', async () => {
      mockParams.username = 'alice'
      mockParams.token = 'tok'
      mockAuth.resetPassword.mockResolvedValue(makeFetchError(422, { '@id': '/forms/1' }))
      const { resetPassword } = useResetPassword()
      // first call sets submittedFormIri
      await resetPassword()
      expect(mockResourcesManager.storeResource).toHaveBeenCalledTimes(1)
      // second call should remove the previous resource
      mockAuth.resetPassword.mockResolvedValue({})
      await resetPassword()
      expect(mockResourcesManager.removeResource).toHaveBeenCalledWith({ resource: '/forms/1' })
    })
  })

  describe('inputErrors', () => {
    test('returns undefined when no form IRI submitted', () => {
      const { inputErrors } = useResetPassword()
      expect(inputErrors.value).toBeUndefined()
    })
  })
})
