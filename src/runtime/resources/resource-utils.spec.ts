import { describe, expect, test } from 'vitest'
import type {
  CwaResource } from './resource-utils'
import {
  getPublishedResourceIri,
  getResourceTypeFromIri,
  CwaResourceTypes,
  isCwaResource, isCwaResourceSame,
} from './resource-utils'

describe('Resource isCwaResourceSame function', () => {
  test.each([
    {
      resource1: { '@id': 'id', '@type': 'type', '_metadata': { persisted: true } },
      resource2: { '@id': 'id', '@type': 'type', '_metadata': { persisted: true } },
      result: true,
    },
    {
      resource1: { '@id': 'id', '@type': 'type', '_metadata': { persisted: true } },
      resource2: { '@id': 'id', '@type': 'type', 'publishedResource': 'aha', 'draftResource': 'aha', 'modifiedAt': 'aha', 'something': null, '_metadata': { persisted: false } },
      result: true,
    },
    {
      resource1: { '@id': 'id', '@type': 'type', 'something': 'was-something', '_metadata': { persisted: true } },
      resource2: { '@id': 'id', '@type': 'type', 'publishedResource': 'aha', 'draftResource': 'aha', 'modifiedAt': 'aha', 'something': null, '_metadata': { persisted: false } },
      result: false,
    },
    {
      resource1: { '@id': 'id1', '@type': 'type', '_metadata': { persisted: true } },
      resource2: { '@id': 'id2', '@type': 'type', '_metadata': { persisted: true } },
      result: false,
    },
  ])('If resource 1 is $resource1 and resource 2 is $resource2 then the result should be $result', ({ resource1, resource2, result }) => {
    expect(isCwaResourceSame(resource1, resource2)).toBe(result)
  })
})

describe('Resource isCwaResource function', () => {
  test('variable provided is not an object', () => {
    expect(isCwaResource('string')).toBe(false)
  })
  test('variable provided does not have @id', () => {
    const resource = {
      '@type': 'something',
      '_metadata': {},
    }
    expect(isCwaResource(resource)).toBe(false)
  })
  test('variable provided does not have @type', () => {
    const resource = {
      '@id': 'id',
      '_metadata': {},
    }
    expect(isCwaResource(resource)).toBe(false)
  })
  test('variable provided does not have _metadata', () => {
    const resource = {
      '@id': 'id',
      '@type': 'something',
    }
    expect(isCwaResource(resource)).toBe(false)
  })
  test('variable provided _metadata is not an object', () => {
    const resource = {
      '@id': 'id',
      '@type': 'something',
      '_metadata': 'not-an-object',
    }
    expect(isCwaResource(resource)).toBe(false)
  })
  test('variable provided has @id and @type so can be considered a resource', () => {
    const resource = {
      '@id': 'id',
      '@type': 'something',
      '_metadata': {},
    }
    expect(isCwaResource(resource)).toBe(true)
  })
})

describe('Resource getPublishedResourceIri function', () => {
  const resource: CwaResource = {
    '@id': 'id',
    '@type': 'type',
    '_metadata': {
      persisted: true,
    },
  }

  test('Not a publishable resource', () => {
    expect(getPublishedResourceIri(resource)).toBe('id')
  })

  test('Is a published resource already', () => {
    resource._metadata = {
      persisted: true,
      publishable: {
        published: true,
        publishedAt: 'any',
      },
    }
    expect(getPublishedResourceIri(resource)).toBe('id')
  })

  test('Is a draft resource without a published version', () => {
    resource._metadata = {
      persisted: true,
      publishable: {
        published: false,
        publishedAt: 'any',
      },
    }
    expect(getPublishedResourceIri(resource)).toBeNull()
  })

  test('Is a draft resource with a published version', () => {
    resource._metadata = {
      persisted: true,
      publishable: {
        published: false,
        publishedAt: 'any',
      },
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
