// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { resolveStyleClasses, selectStyleKeys, selectedStyleKeys } from '#cwa/composables/cwa-styles'

const styleClasses = {
  CwaComponentHero: {
    'black-bg': 'bg-black text-white',
    'wide': 'w-full',
  },
  CwaComponentCard: {
    'black-bg': 'bg-neutral-900',
  },
}

describe('resolveStyleClasses', () => {
  test('style:<key> resolves to that style\'s classes', () => {
    expect(resolveStyleClasses(styleClasses, 'CwaComponentHero', ['style:black-bg'])).toEqual(['bg-black text-white'])
    expect(resolveStyleClasses(styleClasses, 'CwaComponentHero', ['style:wide', 'style:black-bg'])).toEqual(['w-full', 'bg-black text-white'])
  })

  test('the same key on two component types gives each its own classes', () => {
    expect(resolveStyleClasses(styleClasses, 'CwaComponentHero', ['style:black-bg'])).toEqual(['bg-black text-white'])
    expect(resolveStyleClasses(styleClasses, 'CwaComponentCard', ['style:black-bg'])).toEqual(['bg-neutral-900'])
    expect(resolveStyleClasses(styleClasses, 'CwaComponentCard', ['style:wide'])).toEqual([])
  })

  test('an unknown key, or an entry without the style: prefix, resolves to nothing', () => {
    expect(resolveStyleClasses(styleClasses, 'CwaComponentHero', ['style:nope'])).toEqual([])
    expect(resolveStyleClasses(styleClasses, 'CwaComponentHero', ['black-bg', 'bg-black text-white'])).toEqual([])
    expect(resolveStyleClasses(styleClasses, 'CwaComponentHero', ['style:constructor'])).toEqual([])
    expect(resolveStyleClasses(styleClasses, 'CwaComponentUnknown', ['style:black-bg'])).toEqual([])
    expect(resolveStyleClasses(styleClasses, undefined, ['style:black-bg'])).toEqual([])
    expect(resolveStyleClasses(styleClasses, 'CwaComponentHero', undefined)).toEqual([])
    expect(resolveStyleClasses(styleClasses, 'CwaComponentHero', null)).toEqual([])
  })
})

describe('selectedStyleKeys', () => {
  const styles = {
    'black-bg': { label: 'Black Background', classes: 'bg-black text-white' },
    'wide': { label: 'Wide', classes: 'w-full' },
  }

  test('the selected styles are worked out from the keys, in declaration order', () => {
    expect(selectedStyleKeys(['style:wide', 'style:black-bg'], styles)).toEqual(['black-bg', 'wide'])
    expect(selectedStyleKeys(['style:wide'], styles)).toEqual(['wide'])
  })

  test('keys the styles do not know, and entries without the prefix, select nothing', () => {
    expect(selectedStyleKeys(['style:nope', 'wide', 'w-full'], styles)).toEqual([])
    expect(selectedStyleKeys(undefined, styles)).toEqual([])
    expect(selectedStyleKeys(null, styles)).toEqual([])
    expect(selectedStyleKeys(['style:wide'], undefined)).toEqual([])
  })
})

describe('selectStyleKeys', () => {
  const styles = {
    'black-bg': { label: 'Black Background', classes: 'bg-black text-white' },
    'wide': { label: 'Wide', classes: 'w-full' },
  }

  test('stores each chosen key as style:<key>', () => {
    expect(selectStyleKeys(null, styles, ['black-bg', 'wide'])).toEqual(['style:black-bg', 'style:wide'])
  })

  test('choosing a style keeps entries the styles do not know', () => {
    expect(selectStyleKeys(['style:tall', 'style:wide'], styles, ['black-bg'])).toEqual(['style:tall', 'style:black-bg'])
  })

  test('choosing nothing with nothing else stored gives null', () => {
    expect(selectStyleKeys(['style:wide'], styles, [])).toBeNull()
  })
})
