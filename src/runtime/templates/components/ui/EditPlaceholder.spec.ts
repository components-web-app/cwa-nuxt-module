// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { h } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import EditPlaceholder from './EditPlaceholder.vue'

enableAutoUnmount(afterEach)

describe('CwaUiEditPlaceholder (#461)', () => {
  test('says what is missing in muted text inside a dashed line-dash box on the admin surface, so it reads on any site', () => {
    const wrapper = mount(EditPlaceholder, { props: { label: 'Add an image' } })

    expect(wrapper.text()).toBe('Add an image')
    expect(wrapper.attributes('data-testid')).toBe('edit-placeholder')
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['cwa:border-dashed', 'cwa:border-line-dash', 'cwa:bg-surface', 'cwa:text-fg-muted']))
    expect(wrapper.classes().join(' ')).not.toMatch(/rounded/)
  })

  test('holds what the caller adds below the text', () => {
    const wrapper = mount(EditPlaceholder, { props: { label: 'Empty group' }, slots: { default: () => h('button', { type: 'button' }, 'Add') } })

    expect(wrapper.find('button').text()).toBe('Add')
    expect(wrapper.text()).toBe('Empty groupAdd')
  })

  test('has no axe violations', async () => {
    mount(EditPlaceholder, { props: { label: 'Add an image' }, attachTo: document.body })

    expect(await axe(document.body)).toHaveNoViolations()
  })
})
