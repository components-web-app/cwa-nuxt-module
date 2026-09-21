// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { useParentPageDataLoader } from './useParentPageDataLoader'
import * as cwaComposable from '#cwa/composables/cwa'

const mockTypes = [
  { '@id': '/_/page_data_metadatas/1', '@type': 'PageDataMetadata', 'resourceClass': 'App\\Entity\\ConferenceData', 'properties': [] },
  { '@id': '/_/page_data_metadatas/2', '@type': 'PageDataMetadata', 'resourceClass': 'App\\Entity\\AbstractPageData', 'properties': [] },
]

const mockInstances = [
  { '@id': '/_/conference_datas/1', 'title': 'Spring Conference', '@type': 'ConferenceData' },
]

function mockCwa({ getApiDocumentation = vi.fn(), fetch = vi.fn() } = {}) {
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    getApiDocumentation,
    fetch,
  } as any))
}

describe('useParentPageDataLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadDataTypes', () => {
    test('fetches API docs and filters out AbstractPageData', async () => {
      const getApiDocumentation = vi.fn().mockResolvedValue({
        pageDataMetadata: { member: mockTypes },
      })
      mockCwa({ getApiDocumentation })
      const { loadDataTypes, dataTypes } = useParentPageDataLoader()
      await loadDataTypes()
      expect(dataTypes.value).toEqual([mockTypes[0]])
    })

    test('sets dataTypes to empty array when pageDataMetadata is absent', async () => {
      const getApiDocumentation = vi.fn().mockResolvedValue({})
      mockCwa({ getApiDocumentation })
      const { loadDataTypes, dataTypes } = useParentPageDataLoader()
      await loadDataTypes()
      expect(dataTypes.value).toEqual([])
    })

    test('stale request is ignored — last call wins', async () => {
      let resolveFirst!: (v: any) => void
      const firstResponse = new Promise(r => (resolveFirst = r))
      const getApiDocumentation = vi.fn()
        .mockReturnValueOnce(firstResponse)
        .mockResolvedValueOnce({ pageDataMetadata: { member: [mockTypes[0]] } })
      mockCwa({ getApiDocumentation })
      const { loadDataTypes, dataTypes } = useParentPageDataLoader()
      const p1 = loadDataTypes()
      const p2 = loadDataTypes()
      resolveFirst({ pageDataMetadata: { member: [mockTypes[1]] } })
      await Promise.all([p1, p2])
      expect(dataTypes.value).toEqual([mockTypes[0]])
    })
  })

  describe('loadDataInstances', () => {
    test('fetches instances for the given entrypoint key', async () => {
      const getApiDocumentation = vi.fn().mockResolvedValue({
        entrypoint: { conferenceData: '/_/conference_datas' },
      })
      const fetch = vi.fn().mockReturnValue({
        response: Promise.resolve({ _data: { member: mockInstances } }),
      })
      mockCwa({ getApiDocumentation, fetch })
      const { loadDataInstances, dataInstances } = useParentPageDataLoader()
      await loadDataInstances('conferenceData')
      expect(fetch).toHaveBeenCalledWith({ path: '/_/conference_datas', noQuery: true })
      expect(dataInstances.value).toEqual(mockInstances)
    })

    test('sets dataInstances to empty array when entrypoint key is not found in docs', async () => {
      const getApiDocumentation = vi.fn().mockResolvedValue({ entrypoint: {} })
      mockCwa({ getApiDocumentation })
      const { loadDataInstances, dataInstances } = useParentPageDataLoader()
      await loadDataInstances('conferenceData')
      expect(dataInstances.value).toEqual([])
    })

    test('stale instance request is ignored — last call wins', async () => {
      let resolveFirst!: (v: any) => void
      const firstFetchResponse = new Promise(r => (resolveFirst = r))
      const getApiDocumentation = vi.fn().mockResolvedValue({
        entrypoint: { conferenceData: '/_/conference_datas', speakerData: '/_/speaker_datas' },
      })
      const fetch = vi.fn()
        .mockReturnValueOnce({ response: firstFetchResponse })
        .mockReturnValueOnce({ response: Promise.resolve({ _data: { member: [mockInstances[0]] } }) })
      mockCwa({ getApiDocumentation, fetch })
      const { loadDataInstances, dataInstances } = useParentPageDataLoader()
      const p1 = loadDataInstances('conferenceData')
      const p2 = loadDataInstances('speakerData')
      resolveFirst({ _data: { member: [] } })
      await Promise.all([p1, p2])
      expect(dataInstances.value).toEqual([mockInstances[0]])
    })
  })

  describe('fqcnToEntrypointKey', () => {
    test('converts a fully-qualified class name to a camelCase entrypoint key', () => {
      const { fqcnToEntrypointKey } = useParentPageDataLoader()
      expect(fqcnToEntrypointKey('App\\Entity\\ConferenceData')).toBe('conferenceData')
    })

    test('converts a bare class name (no backslashes)', () => {
      const { fqcnToEntrypointKey } = useParentPageDataLoader()
      expect(fqcnToEntrypointKey('ConferenceData')).toBe('conferenceData')
    })

    test('returns undefined for an empty string', () => {
      const { fqcnToEntrypointKey } = useParentPageDataLoader()
      expect(fqcnToEntrypointKey('')).toBeUndefined()
    })
  })
})
