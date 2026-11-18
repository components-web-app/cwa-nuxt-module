// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { fakeFieldModel } from '../../../../../playground/app/kit/fake-field-model'
import MultiSelect from './MultiSelect.vue'
import { announceKey } from '../core/ui/field-keys'

enableAutoUnmount(afterEach)

const options = [
  { label: 'Dark background', value: 'dark' },
  { label: 'Extra padding', value: 'padding' },
  { label: 'Wide', value: 'wide' },
  { label: 'Full bleed', value: 'bleed', disabled: true, disabledReason: 'Unavailable inside a narrow column' },
]

function mountMulti(props: Record<string, unknown> = {}, announce = (_: string) => {}) {
  return mount(MultiSelect, {
    props: { label: 'Style', options, modelValue: ['padding', 'dark'], ...props },
    global: { provide: { [announceKey as symbol]: announce } },
    attachTo: document.body,
  })
}

async function open(wrapper: ReturnType<typeof mountMulti>) {
  await wrapper.get('[data-testid="multi-input"]').trigger('click')
  await flushPromises()
  return document.querySelector<HTMLElement>('[data-testid="multi-menu"]')!
}

function labels(menu: HTMLElement) {
  return [...menu.querySelectorAll('[role="option"]')].map(option => option.textContent!.trim())
}

describe('CwaUiMultiSelect (#460)', () => {
  test('closed in the bar it shows the first choice as a chip, then +N', () => {
    const wrapper = mountMulti()

    expect(wrapper.get('[data-testid="multi-chip"]').text()).toBe('Extra padding')
    expect(wrapper.get('[data-testid="multi-chip"] button').attributes('aria-label')).toBe('Remove Extra padding')
    expect(wrapper.get('[data-testid="multi-more"]').text()).toBe('+1')
  })

  test('opening lists every option, chosen ones first and checked, with a disabled one saying why', async () => {
    const menu = await open(mountMulti())

    expect(labels(menu).slice(0, 2)).toEqual(['Extra padding', 'Dark background'])
    expect(menu.querySelectorAll('[aria-selected="true"]')).toHaveLength(2)
    expect(labels(menu).at(-1)).toContain('Unavailable inside a narrow column')
  })

  test('typing filters the options', async () => {
    const wrapper = mountMulti()
    const menu = await open(wrapper)
    await wrapper.get('[data-testid="multi-input"]').setValue('wid')
    await flushPromises()

    expect(labels(menu)).toEqual(['Wide'])
  })

  test('picking an option adds it to the value', async () => {
    const wrapper = mountMulti()
    const menu = await open(wrapper)
    const wide = [...menu.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent!.includes('Wide'))!
    wide.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    wide.click()
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual([['padding', 'dark', 'wide']])
  })

  test('the chip’s × removes it and says so', async () => {
    const said: string[] = []
    const wrapper = mountMulti({}, message => said.push(message))
    await wrapper.get('[data-testid="multi-chip"] button').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[['dark']]])
    expect(said).toEqual(['Removed Extra padding'])
  })

  test('Backspace in an empty search marks the last choice, and a second Backspace removes it', async () => {
    const wrapper = mountMulti()
    const input = wrapper.get('[data-testid="multi-input"]')

    await input.trigger('keydown', { key: 'Backspace' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await input.trigger('keydown', { key: 'Backspace' })
    expect(wrapper.emitted('update:modelValue')).toEqual([[['padding']]])
  })

  test('open, the chips give way to the search after an "N selected" count, which describes the input; closing brings the chips back (#461)', async () => {
    const wrapper = mountMulti()
    const input = wrapper.get('[data-testid="multi-input"]')
    const described = () => (input.attributes('aria-describedby') ?? '').split(' ').filter(Boolean).map(ref => document.getElementById(ref)?.textContent?.trim())
    expect(described()).toContain('2 selected')

    await open(wrapper)
    const count = wrapper.get('[data-testid="multi-count"]')
    expect(count.text()).toBe('2 selected')
    expect(count.classes()).not.toContain('cwa:sr-only')
    expect(count.element.nextElementSibling).toBe(input.element)
    expect(wrapper.find('[data-testid="multi-chip"]').exists()).toBe(false)
    expect(described()).toContain('2 selected')
    await input.setValue('wid')
    expect(count.text()).toBe('2 selected')

    await input.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(wrapper.get('[data-testid="multi-chip"]').text()).toBe('Extra padding')
    expect(wrapper.get('[data-testid="multi-count"]').classes()).toContain('cwa:sr-only')
  })

  test('with nothing chosen there is no count, open or closed, only the placeholder (#461)', async () => {
    const wrapper = mountMulti({ modelValue: [] })
    await open(wrapper)

    expect(wrapper.find('[data-testid="multi-count"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="multi-input"]').attributes('placeholder')).toBe('Search')
    expect(wrapper.get('[data-testid="multi-input"]').attributes('aria-describedby') ?? '').not.toContain('count')
  })

  test('while a search filters the list, chosen matches still come first, ticked (#461)', async () => {
    const wrapper = mountMulti({ modelValue: ['wide'] })
    const menu = await open(wrapper)
    await wrapper.get('[data-testid="multi-input"]').setValue('i')
    await flushPromises()

    expect(labels(menu)).toEqual(['Wide', 'Extra padding'])
    expect([...menu.querySelectorAll('[role="option"]')].map(option => option.getAttribute('aria-selected'))).toEqual(['true', 'false'])
  })

  test('a choice that changes the count announces it (#461)', async () => {
    const said: string[] = []
    const wrapper = mountMulti({ modelValue: ['padding'], 'onUpdate:modelValue': (value: string[]) => wrapper.setProps({ modelValue: value }) }, message => said.push(message))
    const menu = await open(wrapper)
    const pick = async (label: string) => {
      const option = [...menu.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent!.includes(label))!
      option.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      option.click()
      await flushPromises()
    }

    await pick('Wide')
    expect(said).toEqual(['2 selected'])
    expect(wrapper.get('[data-testid="multi-count"]').text()).toBe('2 selected')
    await pick('Wide')
    await pick('Extra padding')
    expect(said).toEqual(['2 selected', '1 selected', 'None selected'])
  })

  test('a model shows its save state on the edge line', () => {
    const wrapper = mount(MultiSelect, { props: { label: 'Style', options, model: fakeFieldModel(['dark'], 'saving') } })

    expect(wrapper.get('[data-testid="field-status-line"]').attributes('data-line')).toBe('saving')
  })

  test('has no axe violations closed or open', async () => {
    const wrapper = mountMulti()
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()

    const menu = await open(wrapper)
    expect(await axe(menu)).toHaveNoViolations()
  })
})
