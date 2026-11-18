// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { fakeFieldModel } from '../../../../../playground/app/kit/fake-field-model'
import Select from './Select.vue'

enableAutoUnmount(afterEach)

const options = [
  { label: 'Split image', value: 'CwaComponentSplit' },
  { group: 'More', items: [
    { label: 'Wide', value: 'wide', description: 'Full width' },
    { label: 'Full bleed', value: 'bleed', disabled: true, disabledReason: 'Unavailable inside a narrow column' },
  ] },
]

function mountSelect(props: Record<string, unknown> = {}) {
  return mount(Select, { props: { label: 'UI', options, modelValue: 'CwaComponentSplit', ...props }, attachTo: document.body })
}

async function open(wrapper: ReturnType<typeof mountSelect>) {
  await wrapper.get('[data-testid="select-trigger"]').trigger('keydown', { key: 'Enter' })
  await flushPromises()
  return document.querySelector<HTMLElement>('[data-testid="select-menu"]')!
}

function option(menu: HTMLElement, label: string) {
  return [...menu.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent?.includes(label))!
}

describe('CwaUiSelect (#460)', () => {
  test('is a select-only combobox named by its label, showing the chosen option', () => {
    const wrapper = mountSelect()
    const trigger = wrapper.get('[data-testid="select-trigger"]')

    expect(trigger.attributes('role')).toBe('combobox')
    expect(wrapper.get(`label[for="${trigger.attributes('id')}"]`).text()).toBe('UI')
    expect(trigger.text()).toBe('Split image')
  })

  test('opens a listbox with group headings and a disabled option that says why, and choosing emits its value', async () => {
    const wrapper = mountSelect()
    const menu = await open(wrapper)

    expect(menu.textContent).toContain('More')
    const bleed = option(menu, 'Full bleed')
    expect(bleed.getAttribute('aria-disabled')).toBe('true')
    expect(bleed.textContent).toContain('Unavailable inside a narrow column')
    expect(option(menu, 'Split image').getAttribute('aria-selected')).toBe('true')

    option(menu, 'Wide').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }))
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([['wide']])
  })

  test('a nullable select lists None first, shows it for no value, and choosing it emits null', async () => {
    const wrapper = mountSelect({ nullable: true, noneLabel: 'Default', modelValue: 'wide' })
    const menu = await open(wrapper)

    expect(menu.querySelector('[role="option"]')!.textContent).toContain('Default')
    option(menu, 'Default').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }))
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([[null]])

    await wrapper.setProps({ modelValue: null })
    expect(wrapper.get('[data-testid="select-trigger"]').text()).toBe('Default')
  })

  test('a placeholder shows when nothing is chosen and the select is not nullable', () => {
    const wrapper = mountSelect({ modelValue: null, placeholder: 'Pick a layout' })

    expect(wrapper.get('[data-testid="select-trigger"]').text()).toBe('Pick a layout')
  })

  test('a model writes its value and its error marks the trigger invalid with the edge line', async () => {
    const model = fakeFieldModel<string>('CwaComponentSplit', 'error')
    const wrapper = mount(Select, { props: { label: 'UI', options, model }, attachTo: document.body })
    const trigger = wrapper.get('[data-testid="select-trigger"]')

    expect(trigger.attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('[data-testid="field-status-line"]').attributes('data-line')).toBe('error')

    const menu = await open(wrapper)
    option(menu, 'Wide').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }))
    await flushPromises()
    await nextTick()
    expect(model.model.value).toBe('wide')
  })

  test('has no axe violations closed or open', async () => {
    const wrapper = mountSelect({ info: 'Which layout the component uses.' })
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()

    const menu = await open(wrapper)
    expect(await axe(menu)).toHaveNoViolations()
  })
})
