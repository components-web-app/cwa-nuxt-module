import { describe, expect, test } from 'vitest'
import {
  getPublishedResourceIri,
  getResourceTypeFromIri,
  CwaResource,
  CwaResourceTypes,
  isCwaResource
} from './resource-utils'

describe('Resource isCwaResource function', () => {
  test('variable provided is not an object', () => {
    expect(isCwaResource('string')).toBeFalsy()
  })
  test('variable provided does not have @id', () => {
    const resource = {
      '@type': 'something',
      _metadata: {}
    }
    expect(isCwaResource(resource)).toBeFalsy()
  })
  test('variable provided does not have @type', () => {
    const resource = {
      '@id': 'id',
      _metadata: {}
    }
    expect(isCwaResource(resource)).toBeFalsy()
  })
  test('variable provided does not have _metadata', () => {
    const resource = {
      '@id': 'id',
      '@type': 'something'
    }
    expect(isCwaResource(resource)).toBeFalsy()
  })
  test('variable provided _metadata is not an object', () => {
    const resource = {
      '@id': 'id',
      '@type': 'something',
      _metadata: 'not-an-object'
    }
    expect(isCwaResource(resource)).toBeFalsy()
  })
  test('variable provided has @id and @type so can be considered a resource', () => {
    const resource = {
      '@id': 'id',
      '@type': 'something',
      _metadata: {}
    }
    expect(isCwaResource(resource)).toBeTruthy()
  })
})

describe('Resource getPublishedResourceIri function', () => {
  const resource: CwaResource = {
    '@id': 'id',
    '@type': 'type',
    _metadata: {
      persisted: true
    }
  }

  test('Not a publishable resource', () => {
    expect(getPublishedResourceIri(resource)).toBe('id')
  })

  test('Is a published resource already', () => {
    resource._metadata = {
      persisted: true,
      publishable: {
        published: true,
        publishedAt: 'any'
      }
    }
    expect(getPublishedResourceIri(resource)).toBe('id')
  })

  test('Is a draft resource without a published version', () => {
    resource._metadata = {
      persisted: true,
      publishable: {
        published: false,
        publishedAt: 'any'
      }
    }
    expect(getPublishedResourceIri(resource)).toBeNull()
  })

  test('Is a draft resource with a published version', () => {
    resource._metadata = {
      persisted: true,
      publishable: {
        published: false,
        publishedAt: 'any'
      }
    }
    resource.publishedResource = 'published-id'
    expect(getPublishedResourceIri(resource)).toBe('published-id')
  })
})

describe('Resource Utilities getResourceTypeFromIri function', () => {
  test('ROUTE type', () => {
    expect(getResourceTypeFromIri('/_/routes/abcdefg')).toBe(CwaResourceTypes.ROUTE)
  })
  test('PAGE type', () => {
    expect(getResourceTypeFromIri('/_/pages/abcdefg')).toBe(CwaResourceTypes.PAGE)
  })
  test('PAGE_DATA type', () => {
    expect(getResourceTypeFromIri('/page_data/abcdefg')).toBe(CwaResourceTypes.PAGE_DATA)
  })
  test('LAYOUT type', () => {
    expect(getResourceTypeFromIri('/_/layouts/abcdefg')).toBe(CwaResourceTypes.LAYOUT)
  })
  test('COMPONENT_GROUP type', () => {
    expect(getResourceTypeFromIri('/_/component_groups/abcdefg')).toBe(CwaResourceTypes.COMPONENT_GROUP)
  })
  test('COMPONENT_POSITION type', () => {
    expect(getResourceTypeFromIri('/_/component_positions/abcdefg')).toBe(CwaResourceTypes.COMPONENT_POSITION)
  })
  test('COMPONENT type', () => {
    expect(getResourceTypeFromIri('/component/abcdefg')).toBe(CwaResourceTypes.COMPONENT)
  })
})
