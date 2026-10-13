import { describe, test, expect, vi } from 'vitest'
import { fetchAllMembers } from './fetchAllMembers'

function mockCwa(responses: any[]) {
  const fetch = vi.fn()
  for (const data of responses) {
    fetch.mockReturnValueOnce({ response: Promise.resolve({ _data: data }) })
  }
  return { fetch }
}

describe('fetchAllMembers', () => {
  test('follows the collection\'s next page until there is none, so a select lists more than the API\'s first 30', async () => {
    const $cwa = mockCwa([
      { member: [{ '@id': '/_/pages/1' }], view: { next: '/_api/_/pages?perPage=100&page=2' } },
      { member: [{ '@id': '/_/pages/2' }], view: {} },
    ])
    const members = await fetchAllMembers($cwa, '/_/pages')
    expect(members).toEqual([{ '@id': '/_/pages/1' }, { '@id': '/_/pages/2' }])
    expect($cwa.fetch).toHaveBeenCalledTimes(2)
    expect($cwa.fetch).toHaveBeenNthCalledWith(1, { path: '/_/pages?perPage=100', noQuery: true })
    expect($cwa.fetch).toHaveBeenNthCalledWith(2, { path: '/_api/_/pages?perPage=100&page=2', noQuery: true })
  })

  test('keeps the path\'s own query', async () => {
    const $cwa = mockCwa([{ member: [] }])
    await fetchAllMembers($cwa, '/_/pages?isTemplate=true')
    expect($cwa.fetch).toHaveBeenCalledWith({ path: '/_/pages?isTemplate=true&perPage=100', noQuery: true })
  })

  test('a response without members gives an empty list', async () => {
    const $cwa = mockCwa([undefined])
    expect(await fetchAllMembers($cwa, '/_/layouts')).toEqual([])
  })
})
