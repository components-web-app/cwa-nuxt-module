import { describe, expect, test } from 'vitest'
import { componentUiAllowance, isUiAllowed, refusedStyles } from './component-ui-allowance'

const images = '/component/images'

describe('componentUiAllowance', () => {
  test('reads the rule a group stores for the component\'s collection, with or without the API prefix', () => {
    expect(componentUiAllowance([{ allowedComponentUi: { '/_api/component/images': { ui: [null, 'CwaComponentImageUiHero'], styles: ['style:large'] } } }], images, '/_api'))
      .toEqual({ ui: [null, 'CwaComponentImageUiHero'], styles: ['style:large'] })
    expect(componentUiAllowance([{ allowedComponentUi: { [images]: { styles: ['style:large'] } } }], images))
      .toEqual({ styles: ['style:large'] })
  })

  test('allows anything when no group restricts the component', () => {
    expect(componentUiAllowance([undefined, { allowedComponentUi: null }, { allowedComponentUi: { '/component/texts': { ui: [null] } } }], images)).toEqual({})
  })

  test('allows only what every group allows, for a component shared between groups', () => {
    expect(componentUiAllowance([
      { allowedComponentUi: { [images]: { ui: [null, 'CwaComponentImageUiHero', 'CwaComponentImageUiWide'] } } },
      { allowedComponentUi: { [images]: { ui: ['CwaComponentImageUiWide', 'CwaComponentImageUiHero'], styles: ['style:large'] } } },
      { allowedComponentUi: {} },
    ], images)).toEqual({ ui: ['CwaComponentImageUiHero', 'CwaComponentImageUiWide'], styles: ['style:large'] })
  })
})

describe('isUiAllowed', () => {
  test('allows any UI when the list is left out, and otherwise only those listed, the primary as null', () => {
    expect(isUiAllowed({}, 'CwaComponentImageUiHero')).toBe(true)
    expect(isUiAllowed({ ui: ['CwaComponentImageUiHero'] }, 'CwaComponentImageUiHero')).toBe(true)
    expect(isUiAllowed({ ui: ['CwaComponentImageUiHero'] }, null)).toBe(false)
    expect(isUiAllowed({ ui: ['CwaComponentImageUiHero'] }, undefined)).toBe(false)
    expect(isUiAllowed({ ui: [null] }, undefined)).toBe(true)
  })
})

describe('refusedStyles', () => {
  test('lists the chosen styles a group does not allow', () => {
    expect(refusedStyles({}, ['style:small'])).toEqual([])
    expect(refusedStyles({ styles: ['style:large'] }, ['style:large', 'style:small'])).toEqual(['style:small'])
    expect(refusedStyles({ styles: ['style:large'] }, null)).toEqual([])
  })
})
