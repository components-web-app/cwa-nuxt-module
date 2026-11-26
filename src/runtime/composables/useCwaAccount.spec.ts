// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import * as cwaComposable from '#cwa/composables/cwa'
import { useCwaAccount } from '#cwa/composables/useCwaAccount'

function mockCwa(fetch: ReturnType<typeof vi.fn>) {
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue({ cwaFetch: { fetch } })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useCwaAccount', () => {
  test('it reads the signed-in user from /me', async () => {
    const me = { '@id': '/_/users/me-uuid', 'username': 'me', 'emailAddress': 'me@example.com' }
    const fetch = vi.fn(async () => me)
    mockCwa(fetch)
    const { account, loading, loadFailed } = useCwaAccount()
    expect(loading.value).toBe(true)
    await flushPromises()
    expect(fetch).toHaveBeenCalledWith('/me')
    expect(account.value).toStrictEqual(me)
    expect(loading.value).toBe(false)
    expect(loadFailed.value).toBe(false)
  })

  test('a failure sets loadFailed, and reload tries again', async () => {
    const me = { '@id': '/_/users/me-uuid' }
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(me)
    mockCwa(fetch)
    const { account, loading, loadFailed, reload } = useCwaAccount()
    await flushPromises()
    expect(loadFailed.value).toBe(true)
    expect(loading.value).toBe(false)
    expect(account.value).toBeUndefined()
    await reload()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenLastCalledWith('/me')
    expect(loadFailed.value).toBe(false)
    expect(account.value).toStrictEqual(me)
  })
})
