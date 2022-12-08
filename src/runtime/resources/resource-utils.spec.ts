import { describe, expect, test } from 'vitest'
import { getPublishedResourceIri } from './resource-utils'
import { CwaResource } from './resource-types'

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
})
