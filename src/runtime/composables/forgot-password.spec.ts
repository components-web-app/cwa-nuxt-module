// @vitest-environment nuxt
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { createFetchError } from 'ofetch'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import * as cwaComposable from '#cwa/composables/cwa'
import { useForgotPassword } from '#cwa/composables/forgot-password'

// `vi.mock('#imports')` does NOT intercept — see #265. Use mockNuxtImport.
const mockNavigateTo = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => mockNavigateTo)

function makeFetchError(status: number, message?: string, statusMessage?: string) {
  return createFetchError({
    options: { method: 'POST' },
    response: {
      status,
      statusText: statusMessage ?? '',
      _data: message ? { message } : {},
    },
  })
}

describe('useForgotPassword', () => {
  const mockAuth = { forgotPassword: vi.fn() }
  const mockCwa = { auth: mockAuth }

  beforeEach(() => {
    vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(mockCwa)
    mockNavigateTo.mockReset()
    mockAuth.forgotPassword.mockReset()
  })

  test('initial state', () => {
    const { credentials, error, submitting, success } = useForgotPassword()
    expect(credentials.username).toBe('')
    expect(error.value).toBeUndefined()
    expect(submitting.value).toBe(false)
    expect(success.value).toBe(false)
  })

  test('doSubmit with empty username sets validation error without calling API', async () => {
    const { doSubmit, error } = useForgotPassword()
    await doSubmit()
    expect(error.value).toBe('Please enter a username')
    expect(mockAuth.forgotPassword).not.toHaveBeenCalled()
  })

  test('doSubmit success sets success to true', async () => {
    mockAuth.forgotPassword.mockResolvedValue({})
    const { doSubmit, credentials, success } = useForgotPassword()
    credentials.username = 'user@example.com'
    await doSubmit()
    expect(success.value).toBe(true)
  })

  test('doSubmit clears error before each submission', async () => {
    mockAuth.forgotPassword.mockResolvedValueOnce(makeFetchError(500, 'Server error'))
    mockAuth.forgotPassword.mockResolvedValueOnce({})
    const { doSubmit, credentials, error } = useForgotPassword()
    credentials.username = 'user@example.com'
    await doSubmit()
    expect(error.value).toBe('Server error')
    await doSubmit()
    expect(error.value).toBeUndefined()
  })

  test('doSubmit FetchError 404 sets username not found message', async () => {
    mockAuth.forgotPassword.mockResolvedValue(makeFetchError(404))
    const { doSubmit, credentials, error } = useForgotPassword()
    credentials.username = 'ghost@example.com'
    await doSubmit()
    expect(error.value).toBe('Username not found')
  })

  test('doSubmit FetchError with data.message uses that message', async () => {
    mockAuth.forgotPassword.mockResolvedValue(makeFetchError(500, 'Custom API error'))
    const { doSubmit, credentials, error } = useForgotPassword()
    credentials.username = 'user@example.com'
    await doSubmit()
    expect(error.value).toBe('Custom API error')
  })

  test('doSubmit FetchError with statusMessage falls back to it', async () => {
    mockAuth.forgotPassword.mockResolvedValue(makeFetchError(503, undefined, 'Service Unavailable'))
    const { doSubmit, credentials, error } = useForgotPassword()
    credentials.username = 'user@example.com'
    await doSubmit()
    expect(error.value).toBe('Service Unavailable')
  })

  test('doSubmit FetchError with no message uses fallback', async () => {
    mockAuth.forgotPassword.mockResolvedValue(createFetchError({ options: {}, response: { _data: {} } }))
    const { doSubmit, credentials, error } = useForgotPassword()
    credentials.username = 'user@example.com'
    await doSubmit()
    expect(error.value).toBe('Unexpected error')
  })

  test('doSubmit calls navigateTo("/login") when already successful', async () => {
    mockAuth.forgotPassword.mockResolvedValue({})
    const { doSubmit, credentials, success } = useForgotPassword()
    credentials.username = 'user@example.com'
    await doSubmit()
    expect(success.value).toBe(true)

    mockNavigateTo.mockClear()
    await doSubmit()
    expect(mockNavigateTo).toHaveBeenCalledWith('/login')
  })

  test('submitting is true during API call and false after', async () => {
    let capturedSubmitting: boolean | undefined
    mockAuth.forgotPassword.mockImplementation(async () => {
      capturedSubmitting = true
      return {}
    })
    const { doSubmit, credentials, submitting } = useForgotPassword()
    credentials.username = 'user@example.com'
    await doSubmit()
    expect(capturedSubmitting).toBe(true)
    expect(submitting.value).toBe(false)
  })
})
