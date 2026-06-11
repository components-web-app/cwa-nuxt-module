// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { useDynamicPositionSelectOptions } from './useDynamicPositionSelectOptions'

describe('useDynamicPositionSelectOptions', () => {
  describe('getOptions', () => {
    test('always includes a None option first', async () => {
      const mockCwa: any = { getApiDocumentation: vi.fn().mockResolvedValue(undefined) }
      const { getOptions } = useDynamicPositionSelectOptions(mockCwa)
      const options = await getOptions()
      expect(options[0]).toEqual({ label: 'None', value: null })
    })

    test('returns only None when docs is nullish', async () => {
      const mockCwa: any = { getApiDocumentation: vi.fn().mockResolvedValue(null) }
      const { getOptions } = useDynamicPositionSelectOptions(mockCwa)
      const options = await getOptions()
      expect(options).toHaveLength(1)
    })

    test('returns only None when docs has no pageDataMetadata', async () => {
      const mockCwa: any = { getApiDocumentation: vi.fn().mockResolvedValue({}) }
      const { getOptions } = useDynamicPositionSelectOptions(mockCwa)
      const options = await getOptions()
      expect(options).toHaveLength(1)
    })

    test('maps properties from pageDataMetadata members', async () => {
      const docs = {
        pageDataMetadata: {
          member: [
            { properties: [{ property: 'title' }, { property: 'description' }] },
          ],
        },
      }
      const mockCwa: any = { getApiDocumentation: vi.fn().mockResolvedValue(docs) }
      const { getOptions } = useDynamicPositionSelectOptions(mockCwa)
      const options = await getOptions()
      expect(options).toHaveLength(3) // None + title + description
      expect(options[1]).toEqual({ label: 'title', value: 'title' })
      expect(options[2]).toEqual({ label: 'description', value: 'description' })
    })

    test('concatenates properties from multiple member entries', async () => {
      const docs = {
        pageDataMetadata: {
          member: [
            { properties: [{ property: 'alpha' }] },
            { properties: [{ property: 'beta' }, { property: 'gamma' }] },
          ],
        },
      }
      const mockCwa: any = { getApiDocumentation: vi.fn().mockResolvedValue(docs) }
      const { getOptions } = useDynamicPositionSelectOptions(mockCwa)
      const options = await getOptions()
      expect(options).toHaveLength(4) // None + alpha + beta + gamma
    })
  })
})
