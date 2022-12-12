import { describe, expect, test, vi } from 'vitest'
import { $fetch } from 'ohmyfetch'
import CwaFetch from './cwa-fetch'

vi.mock('ohmyfetch')

describe('Create a fetch instances with defaults', () => {
  test('Correct defaults are set on fetch', () => {
    // @ts-ignore
    vi.spyOn($fetch, 'create').mockImplementation(() => {
      return 'mockedFetchCreateInstance'
    })
    const cwaFetch = new CwaFetch('https://my-api')
    expect($fetch.create).toBeCalledWith({
      baseURL: 'https://my-api',
      headers: {
        accept: 'application/ld+json,application/json'
      }
    })
    expect(cwaFetch.fetch).toBe('mockedFetchCreateInstance')
  })
})
