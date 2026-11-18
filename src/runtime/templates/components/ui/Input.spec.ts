// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { h } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import Input from './Input.vue'

enableAutoUnmount(afterEach)

describe('CwaUiInput (#459)', () => {
  test('is a text field named by its label that reports what is typed', async () => {
    const wrapper = mount(Input, { props: { label: 'Title', modelValue: 'Old' } })
    const input = wrapper.get('input')

    expect(wrapper.get(`label[for="${input.attributes('id')}"]`).text()).toBe('Title')
    expect(input.element.value).toBe('Old')
    await input.setValue('New')
    expect(wrapper.emitted('update:modelValue')).toEqual([['New']])
  })

  test('a nullable field reports an emptied value as null, others as an empty string', async () => {
    const nullable = mount(Input, { props: { label: 'Subtitle', modelValue: 'x', nullable: true } })
    await nullable.get('input').setValue('')
    expect(nullable.emitted('update:modelValue')).toEqual([[null]])

    const plain = mount(Input, { props: { label: 'Subtitle', modelValue: 'x' } })
    await plain.get('input').setValue('')
    expect(plain.emitted('update:modelValue')).toEqual([['']])
  })

  test('a hidden label still names the field, and prefix and suffix sit in the box', () => {
    const wrapper = mount(Input, {
      props: { label: 'Search', labelHidden: true, modelValue: '' },
      slots: { prefix: () => h('span', { 'data-testid': 'prefix' }, '#'), suffix: () => h('span', { 'data-testid': 'suffix' }, 'px') },
    })

    expect(wrapper.get('label').classes()).toContain('cwa:sr-only')
    const box = wrapper.get('input').element.parentElement!
    expect(box.querySelector('[data-testid="prefix"]')).not.toBeNull()
    expect(box.querySelector('[data-testid="suffix"]')).not.toBeNull()
  })

  test('has no axe violations', async () => {
    const wrapper = mount(Input, { props: { label: 'Title', description: 'Shown as the heading.', modelValue: 'x' }, attachTo: document.body })

    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })
})
