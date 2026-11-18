import { describe, expect, test } from 'vitest'
import {
  addTargetPlace,
  buildAddComponentList,
  countComponentsInGroup,
  hasMarkup,
  matchRank,
  normaliseQuery,
  groupDisplayName,
  pageDataNoun,
  plainText,
} from './add-component-list'
import type { AddComponentChoice } from './add-component-list'

function choice(name: string, extra: Partial<AddComponentChoice> = {}): AddComponentChoice {
  return { name, label: name, count: 0, allowed: true, ...extra }
}

const choices = [
  choice('RichText', { label: 'Rich text', group: 'Text', description: 'Paragraphs and links' }),
  choice('Image', { group: 'Media', description: 'One image with alt text', count: 3 }),
  choice('Button', { group: 'Text', count: 1 }),
  choice('Gallery', { group: 'Media', description: 'A grid of images' }),
  choice('Spacer'),
  choice('Accordion', { group: 'Text', description: 'Questions that open' }),
  choice('MapLocation', { label: 'Map location', group: 'Media', allowed: false }),
]
const dynamic = choice('ComponentPosition', { label: 'Dynamic', description: 'Changes per article' })

function shape(list: ReturnType<typeof buildAddComponentList>) {
  return list.sections.map(section => [section.label, section.options.map(option => option.name)])
}

describe('the add component list', () => {
  test('the components already in the group are the quick list, most used first, and are not repeated below', () => {
    const list = buildAddComponentList(choices, '', dynamic)

    expect(list.quick.map(option => option.name)).toEqual(['Image', 'Button'])
    expect(list.sections.flatMap(section => section.options.map(option => option.name))).not.toContain('Image')
    expect(list.sections.flatMap(section => section.options.map(option => option.name))).not.toContain('Button')
  })

  test('sections are the configured groups A to Z, then Other, then Dynamic', () => {
    expect(shape(buildAddComponentList(choices, '', dynamic))).toEqual([
      ['Media', ['Gallery']],
      ['Text', ['Accordion', 'RichText']],
      ['Other', ['Spacer']],
      ['Dynamic', ['ComponentPosition']],
    ])
  })

  test('with no group configured anywhere, one A to Z list then Dynamic', () => {
    const plain = [choice('Zed'), choice('Alpha'), choice('Mid', { count: 2 })]

    expect(shape(buildAddComponentList(plain, '', dynamic))).toEqual([
      ['Components', ['Alpha', 'Zed']],
      ['Dynamic', ['ComponentPosition']],
    ])
  })

  test('Dynamic is left out when it is not offered', () => {
    expect(shape(buildAddComponentList(choices, '')).map(([label]) => label)).toEqual(['Media', 'Text', 'Other'])
  })

  test('disallowed components are never listed', () => {
    expect(shape(buildAddComponentList(choices, 'ma', dynamic)).flatMap(([, names]) => names)).not.toContain('MapLocation')
  })

  test('while searching the quick list is hidden and in-group matches are listed with the rest', () => {
    const list = buildAddComponentList(choices, 'i', dynamic)

    expect(list.quick).toEqual([])
    expect(list.sections.flatMap(section => section.options.map(option => option.name))).toContain('Image')
  })

  test('names rank first: the start, then a word start, then anywhere, then the group, then the description', () => {
    const ranked = [
      choice('TextBlock', { label: 'Text block' }),
      choice('RichText', { label: 'Rich text' }),
      choice('Context', { label: 'Context' }),
      choice('Heading', { group: 'Text' }),
      choice('Card', { description: 'A card with text' }),
      choice('Other'),
    ]

    expect(ranked.map(option => matchRank(option, 'text'))).toEqual([1, 2, 3, 4, 5, 0])
  })

  test('the section with the best match comes first, so typing text highlights Rich text before an image', () => {
    const list = buildAddComponentList(choices, 'text', dynamic)

    expect(shape(list)).toEqual([
      ['Text', ['RichText', 'Accordion', 'Button']],
      ['Media', ['Image']],
    ])
  })

  test('within a section rows follow the rank, then A to Z', () => {
    const list = buildAddComponentList([
      choice('Zebra', { group: 'G', description: 'about maps' }),
      choice('Mapper', { group: 'G' }),
      choice('Amap', { group: 'G' }),
      choice('Bmap', { group: 'G' }),
    ], 'map')

    expect(shape(list)).toEqual([['G', ['Mapper', 'Amap', 'Bmap', 'Zebra']]])
  })

  test('the search term is trimmed and its inner spaces collapsed', () => {
    expect(normaliseQuery('  rich   text ')).toBe('rich text')
    expect(matchRank(choices[0]!, '  rich   text ')).toBe(1)
  })

  test('Dynamic is found by its name and its description', () => {
    expect(shape(buildAddComponentList(choices, 'dyn', dynamic))).toEqual([['Dynamic', ['ComponentPosition']]])
    expect(shape(buildAddComponentList(choices, 'changes per', dynamic))).toEqual([['Dynamic', ['ComponentPosition']]])
  })

  test('a search matching only a disallowed component names it', () => {
    const list = buildAddComponentList(choices, 'map', dynamic)

    expect(list.sections).toEqual([])
    expect(list.blocked?.name).toBe('MapLocation')
  })

  test('a search matching nothing names no component', () => {
    const list = buildAddComponentList(choices, 'zzz', dynamic)

    expect(list.sections).toEqual([])
    expect(list.blocked).toBeUndefined()
  })

  test('an empty list without a search names no blocked component', () => {
    expect(buildAddComponentList([choice('Map', { allowed: false })], '').blocked).toBeUndefined()
  })
})

describe('counting the components in a group', () => {
  test('counts each position\'s component by the endpoint its IRI starts with', () => {
    expect(countComponentsInGroup(
      ['/component/images/1', '/component/images/2', '/component/html_contents/3', undefined, null, '/component/unknowns/4'],
      { Image: '/component/images', HtmlContent: '/component/html_contents', Img: '/component/image' },
    )).toEqual({ Image: 2, HtmlContent: 1 })
  })
})

describe('where a component is added', () => {
  test('after or before the selected component', () => {
    expect(addTargetPlace({ targetIsGroup: false, addAfter: true, groupHasPositions: true, anchor: '“Intro text”' })).toBe('after “Intro text”')
    expect(addTargetPlace({ targetIsGroup: false, addAfter: false, groupHasPositions: true, anchor: 'Body Text' })).toBe('before Body Text')
    expect(addTargetPlace({ targetIsGroup: false, addAfter: true, groupHasPositions: true })).toBe('after the selected component')
  })

  test('at the start or end of a selected group, and nowhere in particular in an empty one', () => {
    expect(addTargetPlace({ targetIsGroup: true, addAfter: true, groupHasPositions: true })).toBe('at the end')
    expect(addTargetPlace({ targetIsGroup: true, addAfter: false, groupHasPositions: true })).toBe('at the start')
    expect(addTargetPlace({ targetIsGroup: true, addAfter: true, groupHasPositions: false })).toBeUndefined()
    expect(addTargetPlace({ targetIsGroup: false, addAfter: null, groupHasPositions: true })).toBeUndefined()
  })
})

describe('descriptions are plain text', () => {
  test('tags are removed, entities decoded and spaces collapsed', () => {
    expect(plainText('<p>Use this &amp; that</p><p>Two&nbsp; lines</p>')).toBe('Use this & that Two lines')
  })

  test('markup is detected so a development warning can name the component', () => {
    expect(hasMarkup('<p>Hello</p>')).toBe(true)
    expect(hasMarkup('5 < 6 and 7 > 3')).toBe(false)
  })
})

describe('the page data noun', () => {
  test('comes from the page data class', () => {
    expect(pageDataNoun('BlogArticleData')).toBe('blog article')
    expect(pageDataNoun('Product')).toBe('product')
    expect(pageDataNoun(undefined)).toBe('page')
  })
})

describe('the group name', () => {
  test('is the reference a template gave it, without the location the module appends', () => {
    expect(groupDisplayName('primary_/_api/_/pages/bf0b86fd')).toBe('primary')
    expect(groupDisplayName('top_nav_/_/layouts/1')).toBe('top_nav')
    expect(groupDisplayName('footer_global')).toBe('footer_global')
    expect(groupDisplayName(undefined)).toBe('this group')
  })
})
