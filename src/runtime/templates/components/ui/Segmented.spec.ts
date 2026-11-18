// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { fakeFieldModel } from '../../../../../playground/app/kit/fake-field-model'
import Segmented from './Segmented.vue'

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
})
