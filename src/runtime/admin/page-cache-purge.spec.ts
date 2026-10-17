import { afterEach, describe, expect, test } from 'vitest'
import { pageCachePurgeBody } from './page-cache-purge'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'

const node = (iri: string, children: any[] = []) => ({ iri, children })

describe('pageCachePurgeBody (#484)', () => {
  afterEach(() => {
    ResourceTypeFromIri.setPathPrefix(undefined)
  })

  test('purges the route path and every IRI of the page, with a manifest tag for its page', () => {
    const tree = [
      node('/_/routes//about', [
        node('/_/pages/about', [
          node('/_/layouts/main', [node('/_/component_groups/header', [node('/_/component_positions/nav', [node('/component/navigation_links/main')])])]),
          node('/_/component_groups/primary', [node('/_/component_positions/hero', [node('/component/html_contents/hero')])]),
        ]),
      ]),
    ]

    expect(pageCachePurgeBody(tree)).toEqual({
      paths: ['/about'],
      tags: [
        '/_/routes//about',
        '/_/pages/about',
        '/_/layouts/main',
        '/_/component_groups/header',
        '/_/component_positions/nav',
        '/component/navigation_links/main',
        '/_/component_groups/primary',
        '/_/component_positions/hero',
        '/component/html_contents/hero',
        'manifest:/_/pages/about',
      ],
    })
  })

  test('covers every depth of a nested page with page data, its template page included, listing each IRI once', () => {
    ResourceTypeFromIri.setPathPrefix('/_api')
    const shared = node('/_api/_/layouts/main', [node('/_api/_/component_groups/header')])
    const tree = [
      node('/_api/_/routes//blog', [node('/_api/_/pages/blog', [shared])]),
      node('/_api/_/routes//blog/post', [
        node('/_api/page_data/post', [
          node('/_api/_/pages/article-template', [shared, node('/_api/_/component_groups/body', [node('/_api/_/component_positions/dynamic', [node('/_api/component/html_contents/post-body')])])]),
        ]),
      ]),
    ]

    const { paths, tags } = pageCachePurgeBody(tree)!

    expect(paths).toEqual(['/blog', '/blog/post'])
    expect(tags).toEqual([
      '/_api/_/routes//blog',
      '/_api/_/pages/blog',
      '/_api/_/layouts/main',
      '/_api/_/component_groups/header',
      '/_api/_/routes//blog/post',
      '/_api/page_data/post',
      '/_api/_/pages/article-template',
      '/_api/_/component_groups/body',
      '/_api/_/component_positions/dynamic',
      '/_api/component/html_contents/post-body',
      'manifest:/_api/_/pages/blog',
      'manifest:/_api/page_data/post',
      'manifest:/_api/_/pages/article-template',
    ])
  })

  test('has no body for a page with no manifest, because a request without a body flushes everything', () => {
    expect(pageCachePurgeBody(undefined)).toBeUndefined()
    expect(pageCachePurgeBody([])).toBeUndefined()
  })

  test('leaves out paths when no depth is routed, since the API rejects an empty list', () => {
    expect(pageCachePurgeBody([{ iri: '/page_data/unrouted', children: [{ iri: '/_/pages/template', children: [] }] }])).toEqual({
      tags: ['/page_data/unrouted', '/_/pages/template', 'manifest:/page_data/unrouted', 'manifest:/_/pages/template'],
    })
  })
})
