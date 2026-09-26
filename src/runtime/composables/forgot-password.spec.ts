// @vitest-environment nuxt
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { createFetchError } from 'ofetch'
import { consola as logger } from 'consola'
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
    mockAuth.forgotPassword.mockResolvedValue(makeFetchError(502, undefined, 'Bad Gateway'))
    const { doSubmit, credentials, error } = useForgotPassword()
    credentials.username = 'user@example.com'
    await doSubmit()
    expect(error.value).toBe('Bad Gateway')
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

  test('Back to Login after a success only navigates, sending no second reset request (#355)', async () => {
    mockAuth.forgotPassword.mockResolvedValue({})
    const { doSubmit, credentials, success } = useForgotPassword()
    credentials.username = 'user@example.com'
    await doSubmit()

    await doSubmit()

    expect(mockAuth.forgotPassword).toHaveBeenCalledTimes(1)
    expect(success.value).toBe(true)
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

  test('a throttled request says a reset email was already sent recently (#353)', async () => {
    mockAuth.forgotPassword.mockResolvedValue(createFetchError({
      options: {},
      response: Object.assign(new Response(null, { status: 429, headers: { 'Retry-After': '86400' } }), { _data: {} }),
    } as any))
    const { doSubmit, credentials, error, success } = useForgotPassword()
    credentials.username = 'user@example.com'

    await doSubmit()

    expect(error.value).toBe('A reset email was already sent recently. Please check your inbox and spam folder.')
    expect(success.value).toBe(false)
  })

  test('a failed send says so, rather than implying an email is on its way (#353)', async () => {
    mockAuth.forgotPassword.mockResolvedValue(makeFetchError(503, 'Symfony mailer transport error'))
    const { doSubmit, credentials, error, success } = useForgotPassword()
    credentials.username = 'user@example.com'

    await doSubmit()

    expect(error.value).toBe('The email couldn\'t be sent. Please try again.')
    expect(success.value).toBe(false)
  })

  test('a 400 with no body asks the visitor to contact the administrator and warns once (#356)', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    mockAuth.forgotPassword.mockResolvedValue(makeFetchError(400, undefined, 'Bad Request'))
    const { doSubmit, credentials, error, success } = useForgotPassword()
    credentials.username = 'user@example.com'

    await doSubmit()

    expect(error.value).toBe('The email couldn\'t be sent. Please contact the site administrator.')
    expect(success.value).toBe(false)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]!.join(' ')).toContain('user.email_links.allowed_origins')
    expect(warn.mock.calls[0]!.join(' ')).toContain('default_origin')
    warn.mockRestore()
  })
})
