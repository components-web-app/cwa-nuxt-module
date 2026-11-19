// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import { fakeFieldModel } from '../../../../../playground/app/kit/fake-field-model'
import Segmented from './Segmented.vue'
import { formSurfaceKey } from '../core/ui/field-keys'

enableAutoUnmount(afterEach)

const options = [{ value: 'page', label: 'Page' }, { value: 'url', label: 'URL' }]

describe('CwaUiSegmented (#460)', () => {
  test('is a group named by its label whose segments are pressed buttons, each its own tab stop', () => {
    const wrapper = mount(Segmented, { props: { label: 'Link', options, modelValue: 'page' }, attachTo: document.body })
    const group = wrapper.get('[data-testid="segmented"]')
    const [page, url] = group.findAll('button')

    expect(group.attributes('role')).toBe('group')
    expect(document.getElementById(group.attributes('aria-labelledby')!)!.textContent).toBe('Link')
    expect(page!.attributes('aria-pressed')).toBe('true')
    expect(url!.attributes('aria-pressed')).toBe('false')
    expect(page!.attributes('tabindex')).not.toBe('-1')
    expect(url!.attributes('tabindex')).not.toBe('-1')
  })

  test('pressing another segment emits it, and pressing the pressed one emits nothing', async () => {
    const wrapper = mount(Segmented, { props: { label: 'Link', options, modelValue: 'page' } })
    const [page, url] = wrapper.findAll('button')

    await page!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await url!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['url']])
  })

  test('a model in error shows the edge line under the segments', () => {
    const wrapper = mount(Segmented, { props: { label: 'Align', options, model: fakeFieldModel('page', 'error') } })

    expect(wrapper.get('[data-testid="field-status-line"]').attributes('data-line')).toBe('error')
  })

  test('has no axe violations', async () => {
    const wrapper = mount(Segmented, { props: { label: 'Link', info: 'Where it goes.', options, modelValue: 'url' }, attachTo: document.body })

    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('each segment draws its focus ring when focused from the keyboard', () => {
    const wrapper = mount(Segmented, { props: { label: 'Link', options, modelValue: 'page' } })

    expect(wrapper.findAll('button').map(button => drawsFocusRing(button.classes()))).toEqual([true, true])
  })

  test.each([
    ['in the bar', {}],
    ['in a dialog\'s field column', { [formSurfaceKey as symbol]: { unsaved: () => false, register: () => () => {} } }],
  ])('%s it is only as wide as its options, never stretched across the column, and scrolls rather than overflow when narrow (#461)', (_, provide) => {
    const wrapper = mount(Segmented, { props: { label: 'Parent type', options, modelValue: 'page' }, global: { provide } })
    const group = wrapper.get('[data-testid="segmented"]')

    expect(group.classes()).toEqual(expect.arrayContaining(['cwa:inline-flex', 'cwa:max-w-full', 'cwa:overflow-x-auto']))
    expect(group.classes()).not.toContain('cwa:flex')
    expect(group.element.parentElement!.classList).toContain('cwa:w-fit')
    expect(group.element.parentElement!.classList).toContain('cwa:max-w-full')
    expect(drawsFocusRing(group.findAll('button')[0]!.classes())).toBe(true)
    expect(group.findAll('button')[0]!.classes()).toContain('cwa:focus-visible:-outline-offset-2')
  })

  test('the pressed segment is shown by its fill and colour alone, so no segment and not the control changes size when the choice changes (#461)', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../../assets/cwa.css'), 'utf8')
    const wrapper = mount(Segmented, { props: { label: 'Link', options, modelValue: 'page' } })
    const [pressed, other] = wrapper.findAll('button')
    const sizing = /(?:^|\s)(?:font-weight|font-size|letter-spacing|padding[\w-]*|border[\w-]*width|border|width|min-width|line-height|--tw-font-weight):/

    expect(pressed!.classes()).toEqual(other!.classes())
    const stateRules = pressed!.classes().filter(name => name.includes('data-[state=')).map((name) => {
      const selector = `.${name.replace(/[:[\]=/().!]/g, match => `\\${match}`)}`
      const start = css.indexOf(`${selector}`)
      expect(start, name).toBeGreaterThan(-1)
      return { name, body: css.slice(css.indexOf('{', start), css.indexOf('}', start)) }
    })
    expect(stateRules.length).toBeGreaterThan(0)
    expect(stateRules.filter(rule => sizing.test(rule.body)).map(rule => rule.name)).toEqual([])
  })
})
