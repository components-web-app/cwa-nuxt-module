// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { createFetchError } from 'ofetch'
import * as cwaComposable from '#cwa/composables/cwa'
import { useResendVerifyEmail } from '#cwa/composables/useResendVerifyEmail'

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

describe('useResendVerifyEmail', () => {
  const mockAuth = {
    resendVerifyEmail: vi.fn(),
    resendVerifyNewEmail: vi.fn(),
  }
  const mockCwa = { auth: mockAuth }

  beforeEach(() => {
    vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(mockCwa)
    mockAuth.resendVerifyEmail.mockReset()
    mockAuth.resendVerifyNewEmail.mockReset()
  })

  test('initial state', () => {
    const { error, submitting, success } = useResendVerifyEmail()
    expect(error.value).toBeUndefined()
    expect(submitting.value).toBe(false)
    expect(success.value).toBe(false)
  })

  test('resendVerifyEmail with empty username sets error without calling API', async () => {
    const { resendVerifyEmail, error } = useResendVerifyEmail()
    await resendVerifyEmail('', 'current')
    expect(error.value).toBe('Please enter a username')
    expect(mockAuth.resendVerifyEmail).not.toHaveBeenCalled()
  })

  test('calls auth.resendVerifyEmail when type is "current"', async () => {
    mockAuth.resendVerifyEmail.mockResolvedValue({})
    const { resendVerifyEmail } = useResendVerifyEmail()
    await resendVerifyEmail('user@example.com', 'current')
    expect(mockAuth.resendVerifyEmail).toHaveBeenCalledWith('user@example.com')
    expect(mockAuth.resendVerifyNewEmail).not.toHaveBeenCalled()
  })

  test('calls auth.resendVerifyNewEmail when type is "new"', async () => {
    mockAuth.resendVerifyNewEmail.mockResolvedValue({})
    const { resendVerifyEmail } = useResendVerifyEmail()
    await resendVerifyEmail('user@example.com', 'new')
    expect(mockAuth.resendVerifyNewEmail).toHaveBeenCalledWith('user@example.com')
    expect(mockAuth.resendVerifyEmail).not.toHaveBeenCalled()
  })

  test('success is true on successful response', async () => {
    mockAuth.resendVerifyEmail.mockResolvedValue({})
    const { resendVerifyEmail, success } = useResendVerifyEmail()
    await resendVerifyEmail('user@example.com', 'current')
    expect(success.value).toBe(true)
  })

  test('FetchError 404 sets username not found message', async () => {
    mockAuth.resendVerifyEmail.mockResolvedValue(makeFetchError(404))
    const { resendVerifyEmail, error } = useResendVerifyEmail()
    await resendVerifyEmail('ghost@example.com', 'current')
    expect(error.value).toBe('Username not found')
  })

  test('FetchError uses data.message when available', async () => {
    mockAuth.resendVerifyEmail.mockResolvedValue(makeFetchError(500, 'Custom error message'))
    const { resendVerifyEmail, error } = useResendVerifyEmail()
    await resendVerifyEmail('user@example.com', 'current')
    expect(error.value).toBe('Custom error message')
  })

  test('FetchError falls back to statusMessage', async () => {
    mockAuth.resendVerifyEmail.mockResolvedValue(makeFetchError(503, undefined, 'Service Unavailable'))
    const { resendVerifyEmail, error } = useResendVerifyEmail()
    await resendVerifyEmail('user@example.com', 'current')
    expect(error.value).toBe('Service Unavailable')
  })

  test('FetchError falls back to generic message', async () => {
    mockAuth.resendVerifyEmail.mockResolvedValue(createFetchError({ options: {}, response: { _data: {} } }))
    const { resendVerifyEmail, error } = useResendVerifyEmail()
    await resendVerifyEmail('user@example.com', 'current')
    expect(error.value).toBe('Unexpected error')
  })

  test('submitting is true during API call and false after', async () => {
    let capturedSubmitting: boolean | undefined
    mockAuth.resendVerifyEmail.mockImplementation(async () => {
      capturedSubmitting = true
      return {}
    })
    const { resendVerifyEmail, submitting } = useResendVerifyEmail()
    await resendVerifyEmail('user@example.com', 'current')
    expect(capturedSubmitting).toBe(true)
    expect(submitting.value).toBe(false)
  })
})
