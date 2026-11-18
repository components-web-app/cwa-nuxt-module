// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { axe } from '../../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'
import SearchField from './SearchField.vue'

enableAutoUnmount(afterEach)

function mountField(modelValue = '') {
  const wrapper = mount(SearchField, {
    props: { 'label': 'Search pages', modelValue, 'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }) },
    attachTo: document.body,
  })
  return wrapper
}

describe('SearchField (#461)', () => {
  test('is a search box named by its label, which shows as its placeholder', () => {
    const input = mountField().get('input')

    expect(input.attributes('type')).toBe('search')
    expect(input.attributes('aria-label')).toBe('Search pages')
    expect(input.attributes('placeholder')).toBe('Search pages')
  })

  test('typing reports the text', async () => {
    const wrapper = mountField()

    await wrapper.get('input').setValue('kitchens')

    expect(wrapper.emitted('update:modelValue')).toEqual([['kitchens']])
  })

  test('the clear button shows only with text, empties it and puts focus back in the field', async () => {
    const wrapper = mountField()
    expect(wrapper.find('[data-testid="search-field-clear"]').exists()).toBe(false)

    await wrapper.get('input').setValue('kitchens')
    const clear = wrapper.get('[data-testid="search-field-clear"]')
    expect(clear.attributes('aria-label')).toBe('Clear search')
    await clear.trigger('click')

    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([''])
    expect(document.activeElement).toBe(wrapper.get('input').element)
  })

  test('Escape clears text without reaching a dialog behind it, and does nothing to an empty field', async () => {
    const wrapper = mountField('kitchens')
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    let reachedParent = false
    document.body.addEventListener('keydown', () => {
      reachedParent = true
    }, { once: true })

    wrapper.get('input').element.dispatchEvent(escape)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
    expect(reachedParent).toBe(false)
  })

  test('the field draws the focus ring around its whole box, and the clear button its own', async () => {
    const wrapper = mountField('kitchens')

    expect(wrapper.get('[data-testid="search-field"]').classes()).toContain('cwa:focus-within:outline-2')
    expect(drawsFocusRing(wrapper.get('[data-testid="search-field-clear"]').classes())).toBe(true)
  })

  test.each(['', 'kitchens'])('with "%s" typed it has no axe violations', async (value) => {
    mountField(value)

    expect(await axe(document.body)).toHaveNoViolations()
  })
})
