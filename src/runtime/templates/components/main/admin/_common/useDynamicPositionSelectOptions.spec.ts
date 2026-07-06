// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as ResourceUtils from '#cwa/resources/resource-utils'
import { useDynamicPositionSelectOptions } from './useDynamicPositionSelectOptions'

function makeCwa(opts: {
  docs?: any
  componentMetadata?: Record<string, { endpoint: string, isPublishable: boolean, explicitAllowOnly?: boolean }>
  pageDataConfig?: Record<string, any>
} = {}) {
  return {
    getApiDocumentation: vi.fn().mockResolvedValue(opts.docs ?? null),
    getComponentMetadata: vi.fn().mockResolvedValue(opts.componentMetadata ?? {}),
    pageDataConfig: opts.pageDataConfig ?? {},
  } as any
}

const eventDataMember = {
  resourceClass: 'App\\Entity\\EventData',
  properties: [
    { property: 'heroImage', componentShortName: 'Image' },
    { property: 'ticketLink', componentShortName: 'Link' },
  ],
}

afterEach(() => {
  ResourceUtils.ResourceTypeFromIri.setPathPrefix(undefined)
})

describe('useDynamicPositionSelectOptions', () => {
  describe('getTypeOptions', () => {
    test('returns empty array when docs has no pageDataMetadata', async () => {
      const { getTypeOptions } = useDynamicPositionSelectOptions(makeCwa({ docs: {} }))
      expect(await getTypeOptions()).toEqual([])
    })

    test('excludes entry where resourceClass ends with \\AbstractPageData', async () => {
      const docs = {
        pageDataMetadata: {
          member: [
            { resourceClass: 'Cwa\\AbstractPageData', properties: [] },
            { resourceClass: 'App\\Entity\\EventData', properties: [] },
          ],
        },
      }
      const { getTypeOptions } = useDynamicPositionSelectOptions(makeCwa({ docs }))
      const options = await getTypeOptions()
      expect(options).toHaveLength(1)
      expect(options[0].value).toBe('App\\Entity\\EventData')
    })

    test('uses short class name split to words as default label', async () => {
      const docs = { pageDataMetadata: { member: [{ resourceClass: 'App\\Entity\\EventData', properties: [] }] } }
      const { getTypeOptions } = useDynamicPositionSelectOptions(makeCwa({ docs }))
      const [option] = await getTypeOptions()
      expect(option.label).toBe('Event Data')
    })

    test('uses options.pageData[shortName].name as label when configured', async () => {
      const docs = { pageDataMetadata: { member: [{ resourceClass: 'App\\Entity\\EventData', properties: [] }] } }
      const cwa = makeCwa({ docs, pageDataConfig: { EventData: { name: 'Event' } } })
      const { getTypeOptions } = useDynamicPositionSelectOptions(cwa)
      const [option] = await getTypeOptions()
      expect(option.label).toBe('Event')
    })
  })

  describe('getPropertyOptions', () => {
    test('returns empty array when resourceClass not found in pageDataMetadata', async () => {
      const docs = { pageDataMetadata: { member: [eventDataMember] } }
      const { getPropertyOptions } = useDynamicPositionSelectOptions(makeCwa({ docs }))
      expect(await getPropertyOptions('App\\Entity\\ConferenceData', null)).toEqual([])
    })

    test('returns all properties when allowedComponents is null', async () => {
      const docs = { pageDataMetadata: { member: [eventDataMember] } }
      const { getPropertyOptions } = useDynamicPositionSelectOptions(makeCwa({ docs }))
      const options = await getPropertyOptions('App\\Entity\\EventData', null)
      expect(options).toHaveLength(2)
    })

    test('uses camelCase property name split to words as default label', async () => {
      const docs = { pageDataMetadata: { member: [eventDataMember] } }
      const { getPropertyOptions } = useDynamicPositionSelectOptions(makeCwa({ docs }))
      const [option] = await getPropertyOptions('App\\Entity\\EventData', null)
      expect(option.label).toBe('Hero Image')
      expect(option.value).toBe('heroImage')
    })

    test('uses options.pageData[shortName].properties[prop] as label when configured', async () => {
      const docs = { pageDataMetadata: { member: [eventDataMember] } }
      const cwa = makeCwa({
        docs,
        pageDataConfig: { EventData: { properties: { heroImage: 'Hero Banner Image' } } },
      })
      const { getPropertyOptions } = useDynamicPositionSelectOptions(cwa)
      const [option] = await getPropertyOptions('App\\Entity\\EventData', null)
      expect(option.label).toBe('Hero Banner Image')
    })

    test('filters out property whose componentShortName endpoint is not in allowedComponents', async () => {
      ResourceUtils.ResourceTypeFromIri.setPathPrefix('/_api')
      const docs = { pageDataMetadata: { member: [eventDataMember] } }
      const cwa = makeCwa({
        docs,
        componentMetadata: {
          Image: { endpoint: '/component/images', isPublishable: false },
          Link: { endpoint: '/component/links', isPublishable: false },
        },
      })
      const { getPropertyOptions } = useDynamicPositionSelectOptions(cwa)
      const options = await getPropertyOptions('App\\Entity\\EventData', ['/_api/component/images'])
      expect(options).toHaveLength(1)
      expect(options[0].value).toBe('heroImage')
    })

    test('includes property when endpoint matches allowedComponents after stripping API path prefix', async () => {
      ResourceUtils.ResourceTypeFromIri.setPathPrefix('/_api')
      const docs = { pageDataMetadata: { member: [eventDataMember] } }
      const cwa = makeCwa({
        docs,
        componentMetadata: { Image: { endpoint: '/component/images', isPublishable: false } },
      })
      const { getPropertyOptions } = useDynamicPositionSelectOptions(cwa)
      const options = await getPropertyOptions('App\\Entity\\EventData', ['/_api/component/images'])
      expect(options).toHaveLength(1)
    })

    test('excludes a property whose component is explicitAllowOnly when the group is unrestricted (#249)', async () => {
      const docs = { pageDataMetadata: { member: [eventDataMember] } }
      const cwa = makeCwa({
        docs,
        componentMetadata: {
          Image: { endpoint: '/component/images', isPublishable: false, explicitAllowOnly: true },
          Link: { endpoint: '/component/links', isPublishable: false, explicitAllowOnly: false },
        },
      })
      const { getPropertyOptions } = useDynamicPositionSelectOptions(cwa)
      const options = await getPropertyOptions('App\\Entity\\EventData', null)
      expect(options).toHaveLength(1)
      expect(options[0].value).toBe('ticketLink')
    })

    test('includes an explicitAllowOnly component property when the group explicitly lists it', async () => {
      const docs = { pageDataMetadata: { member: [eventDataMember] } }
      const cwa = makeCwa({
        docs,
        componentMetadata: {
          Image: { endpoint: '/component/images', isPublishable: false, explicitAllowOnly: true },
          Link: { endpoint: '/component/links', isPublishable: false, explicitAllowOnly: false },
        },
      })
      const { getPropertyOptions } = useDynamicPositionSelectOptions(cwa)
      const options = await getPropertyOptions('App\\Entity\\EventData', ['/component/images'])
      expect(options).toHaveLength(1)
      expect(options[0].value).toBe('heroImage')
    })
  })
})
