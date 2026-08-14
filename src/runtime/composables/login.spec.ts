// @vitest-environment nuxt
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { FetchError } from 'ofetch'
import { createFetchError } from 'ofetch'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import * as cwaComposable from '#cwa/composables/cwa'
import { useLogin } from '#cwa/composables/login'

// `vi.mock('#imports')` does NOT intercept — see #265. Use mockNuxtImport.
const mockNavigateTo = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => mockNavigateTo)

const mockRoute = vi.hoisted(() => ({ query: {} as Record<string, unknown> }))
mockNuxtImport('useRoute', () => () => mockRoute)

function makeFetchError(opts: { status?: number, message?: string, statusMessage?: string } = {}): FetchError {
  return createFetchError({
    options: { method: 'POST' },
    response: {
      status: opts.status ?? 401,
      statusText: opts.statusMessage ?? '',
      _data: opts.message ? { message: opts.message } : {},
    },
  })
}

describe('useLogin', () => {
  const mockAuth = {
    signIn: vi.fn(),
  }
  const mockCwa = { auth: mockAuth }

  beforeEach(() => {
    vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(mockCwa)
    mockNavigateTo.mockReset()
    mockAuth.signIn.mockReset()
    mockRoute.query = {}
  })

  test('initial state', () => {
    const { credentials, error, submitting } = useLogin()
    expect(credentials.username).toBe('')
    expect(credentials.password).toBe('')
    expect(error.value).toBeUndefined()
    expect(submitting.value).toBe(false)
  })

  test('signIn sets submitting during call and clears after', async () => {
    let capturedSubmitting: boolean | undefined
    mockAuth.signIn.mockImplementation(async () => {
      capturedSubmitting = true
      return { '@id': '/users/1' }
    })

    const { signIn, submitting } = useLogin()
    await signIn()

    expect(capturedSubmitting).toBe(true)
    expect(submitting.value).toBe(false)
  })

  test('signIn success calls navigateTo("/")', async () => {
    mockAuth.signIn.mockResolvedValue({ '@id': '/user/1' })
    const { signIn } = useLogin()
    await signIn()
    expect(mockNavigateTo).toHaveBeenCalledWith('/')
  })

  test('signIn FetchError with data.message sets error from message', async () => {
    mockAuth.signIn.mockResolvedValue(makeFetchError({ message: 'Invalid credentials' }))
    const { signIn, error } = useLogin()
    await signIn()
    expect(error.value).toBe('Invalid credentials')
  })

  test('signIn FetchError without data.message falls back to statusMessage', async () => {
    mockAuth.signIn.mockResolvedValue(makeFetchError({ statusMessage: 'Unauthorized' }))
    const { signIn, error } = useLogin()
    await signIn()
    expect(error.value).toBe('Unauthorized')
  })

  test('signIn FetchError without data.message or statusMessage uses default', async () => {
    mockAuth.signIn.mockResolvedValue(createFetchError({ options: {}, response: { _data: {} } }))
    const { signIn, error } = useLogin()
    await signIn()
    expect(error.value).toBe('Unknown/Network Error')
  })

  describe('redirect target (#271)', () => {
    beforeEach(() => {
      mockAuth.signIn.mockResolvedValue({ '@id': '/user/1' })
    })

    test('follows the `redirect` query parameter when there is one', async () => {
      mockRoute.query = { redirect: '/conference/programme' }
      const { signIn } = useLogin()
      await signIn()
      expect(mockNavigateTo).toHaveBeenCalledWith('/conference/programme')
    })

    test('an explicit redirect option beats the query parameter', async () => {
      mockRoute.query = { redirect: '/from-query' }
      const { signIn } = useLogin({ redirect: '/from-option' })
      await signIn()
      expect(mockNavigateTo).toHaveBeenCalledWith('/from-option')
    })

    test('the redirect option can be a getter, resolved at sign-in time', async () => {
      let target = '/first'
      const { signIn } = useLogin({ redirect: () => target })
      target = '/second'
      await signIn()
      expect(mockNavigateTo).toHaveBeenCalledWith('/second')
    })

    test('the redirect option can be a ref, resolved at sign-in time', async () => {
      const target = ref('/first')
      const { signIn } = useLogin({ redirect: target })
      target.value = '/second'
      await signIn()
      expect(mockNavigateTo).toHaveBeenCalledWith('/second')
    })

    test('an undefined redirect option falls back to the query parameter', async () => {
      mockRoute.query = { redirect: '/from-query' }
      const { signIn } = useLogin({ redirect: undefined })
      await signIn()
      expect(mockNavigateTo).toHaveBeenCalledWith('/from-query')
    })

    test.each([
      ['an absolute external url', 'https://evil.example.com/steal'],
      ['a protocol-relative url', '//evil.example.com/steal'],
      ['a backslash-escaped url', '/\\evil.example.com'],
      ['a relative path', 'dashboard'],
      ['an empty string', ''],
    ])('ignores %s and falls back to "/"', async (_label, target) => {
      mockRoute.query = { redirect: target }
      const { signIn } = useLogin()
      await signIn()
      expect(mockNavigateTo).toHaveBeenCalledWith('/')
    })

    test('ignores a repeated query parameter (array) and falls back to "/"', async () => {
      mockRoute.query = { redirect: ['/one', '/two'] }
      const { signIn } = useLogin()
      await signIn()
      expect(mockNavigateTo).toHaveBeenCalledWith('/')
    })

    test('does not redirect at all when sign-in fails', async () => {
      mockRoute.query = { redirect: '/conference' }
      mockAuth.signIn.mockResolvedValue(makeFetchError({ message: 'Invalid credentials' }))
      const { signIn } = useLogin()
      await signIn()
      expect(mockNavigateTo).not.toHaveBeenCalled()
    })
  })

  test('signIn clears previous error before each attempt', async () => {
    mockAuth.signIn.mockResolvedValueOnce(makeFetchError({ message: 'First error' }))
    mockAuth.signIn.mockResolvedValueOnce({ '@id': '/users/1' })
    const { signIn, error } = useLogin()
    await signIn()
    expect(error.value).toBe('First error')
    await signIn()
    expect(error.value).toBeUndefined()
  })
})
