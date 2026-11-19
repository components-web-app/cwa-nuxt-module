import { describe, expect, it } from 'vitest'
import { collectionSourceOptions } from './collection-sources'

const docs = {
  entrypoint: {
    '@context': '/_api/contexts/Entrypoint',
    '@id': '/_api',
    '@type': 'Entrypoint',
    'blogArticleData': '/_api/page_data/blog_article_datas',
    'collection': '/_api/component/collections',
    'nestedPageData': '/_api/page_data/nested_page_datas',
    'page': '/_api/_/pages',
  },
  pageDataMetadata: {
    member: [
      { '@id': '/_api/_/page_data_metadatas/App%5CEntity%5CBlogArticleData', '@type': 'PageDataMetadata', 'resourceClass': 'App\\Entity\\BlogArticleData', 'properties': [] },
      { '@id': '/_api/_/page_data_metadatas/App%5CEntity%5CNestedPageData', '@type': 'PageDataMetadata', 'resourceClass': 'App\\Entity\\NestedPageData', 'properties': [] },
      { '@id': '/_api/_/page_data_metadatas/Silverback%5CApiComponentsBundle%5CEntity%5CCore%5CAbstractPageData', '@type': 'PageDataMetadata', 'resourceClass': 'Silverback\\ApiComponentsBundle\\Entity\\Core\\AbstractPageData', 'properties': [] },
    ],
  },
}

describe('collectionSourceOptions', () => {
  it('offers each page data collection by the IRI the API stores in a Collection\'s resourceIri, path prefix included', () => {
    const options = collectionSourceOptions(docs as never, { BlogArticleData: { name: 'Blog Articles' } })
    expect(options).toEqual([
      { label: 'Blog Articles', value: '/_api/page_data/blog_article_datas' },
      { label: 'NestedPageData', value: '/_api/page_data/nested_page_datas' },
    ])
  })

  it('offers the bare collection path on an API without a path prefix', () => {
    const bare = {
      entrypoint: { blogArticleData: '/page_data/blog_article_datas' },
      pageDataMetadata: { member: [docs.pageDataMetadata.member[0]] },
    }
    expect(collectionSourceOptions(bare as never, {})).toEqual([
      { label: 'BlogArticleData', value: '/page_data/blog_article_datas' },
    ])
  })

  it('offers nothing before the API documentation has loaded', () => {
    expect(collectionSourceOptions(undefined, {})).toEqual([])
  })
})
