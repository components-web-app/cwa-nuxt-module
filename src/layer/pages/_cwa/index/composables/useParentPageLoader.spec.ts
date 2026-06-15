// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useParentPageLoader } from './useParentPageLoader'
import * as cwaComposable from '#cwa/composables/cwa'

const mockPages = [
  { '@id': '/_/pages/uuid-1', 'reference': 'Home', 'isTemplate': false },
  { '@id': '/_/pages/uuid-2', 'reference': 'Conference', 'isTemplate': false },
]

function mockFetch(pages = mockPages) {
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    fetch: vi.fn().mockReturnValue({
      response: Promise.resolve({ _data: { member: pages } }),
    }),
  }))
}

describe('useParentPageLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('fetches from /_/pages with noQuery: true', async () => {
    const fetchMock = vi.fn().mockReturnValue({ response: Promise.resolve({ _data: { member: [] } }) })
    // @ts-expect-error
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({ fetch: fetchMock }))
    const { loadParentPageOptions } = useParentPageLoader()
    await loadParentPageOptions()
    expect(fetchMock).toHaveBeenCalledWith({ path: '/_/pages', noQuery: true })
  })

  test('populates parentPages from the API response', async () => {
    mockFetch()
    const { parentPages, loadParentPageOptions } = useParentPageLoader()
    await loadParentPageOptions()
    expect(parentPages.value).toEqual(mockPages)
  })

  test('subsequent load cancels a stale in-flight request', async () => {
    let resolveFirst!: (v: any) => void
    const firstResponse = new Promise(r => (resolveFirst = r))
    const fetchMock = vi.fn()
      .mockReturnValueOnce({ response: firstResponse })
      .mockReturnValueOnce({ response: Promise.resolve({ _data: { member: [mockPages[1]] } }) })
    // @ts-expect-error
    vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({ fetch: fetchMock }))

    const { parentPages, loadParentPageOptions } = useParentPageLoader()
    const p1 = loadParentPageOptions()
    const p2 = loadParentPageOptions()
    resolveFirst({ _data: { member: [mockPages[0]] } })
    await Promise.all([p1, p2])
    expect(parentPages.value).toEqual([mockPages[1]])
  })
})
