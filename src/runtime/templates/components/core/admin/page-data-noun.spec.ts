import { describe, expect, test } from 'vitest'
import { pageDataNoun } from './page-data-noun'

describe('pageDataNoun (#461)', () => {
  test.each([
    ['BlogArticleData', 'blog article'],
    ['App\\Entity\\BlogArticleData', 'blog article'],
    ['Event', 'event'],
    ['Data', 'data'],
    ['', 'page data'],
    [undefined, 'page data'],
  ])('%s is a "%s"', (className, noun) => {
    expect(pageDataNoun(className)).toBe(noun)
  })
})
