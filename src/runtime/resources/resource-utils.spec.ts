import { describe, expect, test } from 'vitest'
import { getPublishedResourceIri, getResourceTypeFromIri, CwaResource, CwaResourceTypes } from './resource-utils'

describe('Resource Utilities Test Context', () => {
  test('getPublishedResourceIri function', () => {
    const resource: CwaResource = {
      '@id': 'id',
      '@type': 'type'
    }
    expect(getPublishedResourceIri(resource)).toBe('id')

    resource._metadata = { persisted: true }
    expect(getPublishedResourceIri(resource)).toBe('id')

    resource._metadata.publishable = {
      published: true,
      publishedAt: 'any'
    }
    expect(getPublishedResourceIri(resource)).toBe('id')

    resource._metadata.publishable.published = false
    expect(getPublishedResourceIri(resource)).toBeNull()

    resource.publishedResource = 'published-id'
    expect(getPublishedResourceIri(resource)).toBe('published-id')
  })

  test('getResourceTypeFromIri function', () => {
    expect(getResourceTypeFromIri('/_/routes/abcdefg')).toBe(CwaResourceTypes.ROUTE)
    expect(getResourceTypeFromIri('/_/pages/abcdefg')).toBe(CwaResourceTypes.PAGE)
    expect(getResourceTypeFromIri('/page_data/abcdefg')).toBe(CwaResourceTypes.PAGE_DATA)
    expect(getResourceTypeFromIri('/_/layouts/abcdefg')).toBe(CwaResourceTypes.LAYOUT)
    expect(getResourceTypeFromIri('/_/component_groups/abcdefg')).toBe(CwaResourceTypes.COMPONENT_GROUP)
    expect(getResourceTypeFromIri('/_/component_positions/abcdefg')).toBe(CwaResourceTypes.COMPONENT_POSITION)
    expect(getResourceTypeFromIri('/component/abcdefg')).toBe(CwaResourceTypes.COMPONENT)
  })
})
