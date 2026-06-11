// @vitest-environment happy-dom

import { describe, expect, test, vi } from 'vitest'
import { $fetch } from 'ofetch'
import CwaFetch from './cwa-fetch'

vi.mock('ofetch')
vi.mock('#imports', () => ({ useRequestHeaders: vi.fn(() => ({})) }))

describe('Create a fetch instances with defaults', () => {
  test('Correct defaults are set on fetch', () => {
    // @ts-expect-error
    vi.spyOn($fetch, 'create').mockImplementation(() => {
      return 'mockedFetchCreateInstance'
    })
    const cwaFetch = new CwaFetch('https://my-api')
    expect($fetch.create).toBeCalledWith(
      expect.objectContaining({
        baseURL: 'https://my-api',
        headers: {
          accept: 'application/ld+json,application/json',
        },
        credentials: 'include',
      }))
    expect(cwaFetch.fetch).toBe('mockedFetchCreateInstance')
  })
})

describe('CwaFetch -> getRequestOptions', () => {
  // @ts-expect-error mocked
  vi.spyOn($fetch, 'create').mockReturnValue(vi.fn())

  test.each([
    { method: 'POST' as const, expectedContentType: 'application/ld+json' },
    { method: 'DELETE' as const, expectedContentType: 'application/ld+json' },
    { method: 'PATCH' as const, expectedContentType: 'application/merge-patch+json' },
  ])('$method returns correct headers', ({ method, expectedContentType }) => {
    const cwaFetch = new CwaFetch('https://my-api')
    const opts = cwaFetch.getRequestOptions(method)
    expect(opts.method).toBe(method)
    expect(opts.headers['accept']).toBe('application/ld+json,application/json')
    expect(opts.headers['content-type']).toBe(expectedContentType)
  })
})
