import { afterEach, describe, expect, test } from 'vitest'
import type {
  CwaResource } from './resource-utils'
import {
  getPublishedResourceIri,
  getPublishedResourceState,
  getResourceTypeFromIri,
  CwaResourceTypes,
  isCwaResource, isCwaResourceSame,
  resourceTypeToAssociatedResourceProperties,
  ResourceTypeFromIri,
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
    {
      resource1: { '@id': 'id', '@type': 'type', '_metadata': { persisted: true }, '@context': '/api/contexts/Page' },
      resource2: { '@id': 'id', '@type': 'type', '_metadata': { persisted: true }, '@context': { '@vocab': 'https://example.com/' } },
      result: true,
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

describe('Resource getPublishedResourceState function', () => {
  test('returns undefined when resource data has no _metadata (e.g. Mercure delete message shape)', () => {
    const result = getPublishedResourceState({ data: { '@id': '/test', '@type': 'Page' } as any })
    expect(result).toBeUndefined()
  })

  test('returns undefined when resource data is undefined', () => {
    const result = getPublishedResourceState({ data: undefined })
    expect(result).toBeUndefined()
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

  test('handles Mercure delete message shape (no _metadata) without throwing', () => {
    expect(() => getPublishedResourceIri({ '@id': 'iri' } as any)).not.toThrow()
    expect(getPublishedResourceIri({ '@id': 'iri' } as any)).toBe('iri')
  })

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

describe('Resource Utilities getResourceTypeFromIri path prefix handling', () => {
  afterEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
  })

  const typeIriSuffixes: [CwaResourceTypes, string][] = [
    [CwaResourceTypes.ROUTE, '/_/routes/abcdefg'],
    [CwaResourceTypes.PAGE, '/_/pages/abcdefg'],
    [CwaResourceTypes.PAGE_DATA, '/page_data/abcdefg'],
    [CwaResourceTypes.LAYOUT, '/_/layouts/abcdefg'],
    [CwaResourceTypes.COMPONENT_GROUP, '/_/component_groups/abcdefg'],
    [CwaResourceTypes.COMPONENT_POSITION, '/_/component_positions/abcdefg'],
    [CwaResourceTypes.COMPONENT, '/component/abcdefg'],
  ]

  describe('prefix is unset', () => {
    test.each(typeIriSuffixes)('%s is resolved from a prefix-free IRI', (type, iri) => {
      ResourceTypeFromIri.setPathPrefix(undefined)
      expect(getResourceTypeFromIri(iri)).toBe(type)
    })
  })

  describe('API deployed under a path prefix (`https://localhost/_api` → pathname `/_api`)', () => {
    test.each(typeIriSuffixes)('%s is resolved once the `/_api` prefix is stripped', (type, iri) => {
      ResourceTypeFromIri.setPathPrefix('/_api')
      expect(getResourceTypeFromIri(`/_api${iri}`)).toBe(type)
    })
  })

  describe('API deployed at a bare host (`https://api.example.com` → pathname `/`)', () => {
    test.each(typeIriSuffixes)('%s is still resolved when the API URL has no path prefix', (type, iri) => {
      ResourceTypeFromIri.setPathPrefix('/')
      expect(getResourceTypeFromIri(iri)).toBe(type)
    })

    test('a nested route IRI is still resolved', () => {
      ResourceTypeFromIri.setPathPrefix('/')
      expect(getResourceTypeFromIri('/_/routes//conference')).toBe(CwaResourceTypes.ROUTE)
    })

    test('a collection IRI is still resolved', () => {
      ResourceTypeFromIri.setPathPrefix('/')
      expect(getResourceTypeFromIri('/component')).toBe(CwaResourceTypes.COMPONENT)
    })

    test('getPathPrefix() returns undefined — a root pathname means "no prefix"', () => {
      ResourceTypeFromIri.setPathPrefix('/')
      expect(ResourceTypeFromIri.getPathPrefix()).toBeUndefined()
    })
  })

  describe('API URL configured with a trailing slash (`https://localhost/_api/` → pathname `/_api/`)', () => {
    test.each(typeIriSuffixes)('%s is still resolved', (type, iri) => {
      ResourceTypeFromIri.setPathPrefix('/_api/')
      expect(getResourceTypeFromIri(`/_api${iri}`)).toBe(type)
    })

    test('getPathPrefix() returns the prefix without its trailing slash', () => {
      ResourceTypeFromIri.setPathPrefix('/_api/')
      expect(ResourceTypeFromIri.getPathPrefix()).toBe('/_api')
    })

    test('a bare host written with a trailing slash is still "no prefix"', () => {
      ResourceTypeFromIri.setPathPrefix('//')
      expect(ResourceTypeFromIri.getPathPrefix()).toBeUndefined()
      expect(getResourceTypeFromIri('/_/routes//conference')).toBe(CwaResourceTypes.ROUTE)
    })
  })

  test('getPathPrefix() returns a real prefix unchanged', () => {
    ResourceTypeFromIri.setPathPrefix('/_api')
    expect(ResourceTypeFromIri.getPathPrefix()).toBe('/_api')
  })

  describe('the prefix is stripped from the start only, not the first occurrence anywhere', () => {
    test('an IRI merely containing the prefix is not rewritten into a false collection-IRI match', () => {
      ResourceTypeFromIri.setPathPrefix('/_api')
      expect(getResourceTypeFromIri('/compon/_apient')).toBeUndefined()
    })

    test('a genuinely prefixed IRI is still stripped', () => {
      ResourceTypeFromIri.setPathPrefix('/_api')
      expect(getResourceTypeFromIri('/_api/component')).toBe(CwaResourceTypes.COMPONENT)
    })
  })
})

describe('resourceTypeToAssociatedResourceProperties', () => {
  test('PAGE entry includes parentPage and parentPageData', () => {
    const props = resourceTypeToAssociatedResourceProperties[CwaResourceTypes.PAGE]
    expect(props).toContain('parentPage')
    expect(props).toContain('parentPageData')
  })

  test('PAGE_DATA entry includes parentPage and parentPageData', () => {
    const props = resourceTypeToAssociatedResourceProperties[CwaResourceTypes.PAGE_DATA]
    expect(props).toContain('parentPage')
    expect(props).toContain('parentPageData')
  })
})
