// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { consola } from 'consola'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import { fakeFieldModel } from '../../../../../playground/app/kit/fake-field-model'
import Select from './Select.vue'
import Field from '../core/ui/Field.vue'
import { useCwaSelect } from '#cwa/composables/cwa-select'

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

  test('an option with a dot shows it, round, after its name on the trigger (12px) and in the menu (8px), with no words of its own', async () => {
    const typed = [
      { label: 'Static', value: 'static', dot: 'cwa:bg-type-static' },
      { label: 'Dynamic', value: 'template', dot: 'cwa:bg-type-dynamic' },
    ]
    const wrapper = mountSelect({ options: typed, modelValue: 'template' })

    const triggerDot = wrapper.get('[data-testid="select-trigger"] [data-testid="select-dot"]')
    expect(triggerDot.classes()).toEqual(expect.arrayContaining(['cwa:bg-type-dynamic', 'cwa:rounded-full', 'cwa:size-3']))
    expect(triggerDot.attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('[data-testid="select-trigger"]').text()).toBe('Dynamic')

    const menu = await open(wrapper)
    const staticDot = option(menu, 'Static').querySelector('[data-testid="select-dot"]')!
    expect([...staticDot.classList]).toEqual(expect.arrayContaining(['cwa:bg-type-static', 'cwa:rounded-full', 'cwa:size-2']))
    expect(option(menu, 'Dynamic').querySelector('[data-testid="select-dot"]')!.classList).toContain('cwa:bg-type-dynamic')
  })

  test('options without a dot draw none', () => {
    expect(mountSelect().find('[data-testid="select-dot"]').exists()).toBe(false)
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

  test.each([
    ['null', { label: 'Default', value: null }],
    ['missing', { label: 'Default' }],
  ])('under nullable, an option whose value is %s is the None option and keeps saving null', async (_kind, defaultOption) => {
    const wrapper = mountSelect({ nullable: true, modelValue: 'wide', options: [defaultOption, { label: 'Wide', value: 'wide' }] })
    const menu = await open(wrapper)

    const listed = [...menu.querySelectorAll('[role="option"]')].map(item => item.textContent?.trim())
    expect(listed).toEqual(['Default', 'Wide'])
    option(menu, 'Default').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }))
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([[null]])

    await wrapper.setProps({ modelValue: null })
    expect(wrapper.get('[data-testid="select-trigger"]').text()).toBe('Default')
  })

  test('noneLabel names the None option over a null option\'s label', async () => {
    const wrapper = mountSelect({ nullable: true, noneLabel: 'Inherit', modelValue: null, options: [{ label: 'Default', value: null }, { label: 'Wide', value: 'wide' }] })

    expect(wrapper.get('[data-testid="select-trigger"]').text()).toBe('Inherit')
  })

  test('warns in development about option values that are not strings, and a null value without nullable', () => {
    const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
    mountSelect({ options: [{ label: 'Two', value: 2 }] })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('option values must be strings'))
    warn.mockClear()

    mountSelect({ options: [{ label: 'Default', value: null }, { label: 'Wide', value: 'wide' }] })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('needs `nullable`'))
    warn.mockClear()

    mountSelect({ nullable: true, options: [{ label: 'Default', value: null }, { label: 'Wide', value: 'wide' }] })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test('takes the model and options of useCwaSelect, with a null option as None', async () => {
    const source = ref<any>('wide')
    const Host = defineComponent({
      setup() {
        const { model, options: selectOptions } = useCwaSelect(source, [{ label: 'Default', value: null }, { label: 'Wide', value: 'wide' }])
        return () => h(Select, { 'label': 'Layout', 'nullable': true, 'options': selectOptions.value as any, 'modelValue': model.value as string | null, 'onUpdate:modelValue': (value: unknown) => {
          model.value = value as string | null
        } })
      },
    })
    const wrapper = mount(Host, { attachTo: document.body })
    expect(wrapper.get('[data-testid="select-trigger"]').text()).toBe('Wide')

    const menu = await open(wrapper as unknown as ReturnType<typeof mountSelect>)
    option(menu, 'Default').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }))
    await flushPromises()

    expect(source.value).toBeNull()
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

  test('the trigger draws its focus ring when focused from the keyboard', () => {
    expect(drawsFocusRing(mountSelect().get('[data-testid="select-trigger"]').classes())).toBe(true)
  })

  test('disabled with a reason stays focusable, says it is disabled and why, and does not open', async () => {
    const wrapper = mountSelect({ label: 'Field', modelValue: null, disabled: true, disabledReason: 'Choose a data type first.' })
    const trigger = wrapper.get('[data-testid="select-trigger"]')

    expect(trigger.attributes('disabled')).toBeUndefined()
    expect(trigger.attributes('aria-disabled')).toBe('true')
    const described = trigger.attributes('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent).join(' ')
    expect(described).toContain('Choose a data type first.')

    await trigger.trigger('keydown', { key: 'Enter' })
    await trigger.trigger('pointerdown', { button: 0, pointerType: 'mouse' })
    await flushPromises()
    expect(document.querySelector('[data-testid="select-menu"]')).toBeNull()
    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })

  test('disabled without a reason stays natively disabled', () => {
    const trigger = mountSelect({ disabled: true }).get('[data-testid="select-trigger"]')

    expect(trigger.attributes('disabled')).toBeDefined()
    expect(trigger.attributes('aria-disabled')).toBeUndefined()
  })
})

describe('Select in a conflict (#461)', () => {
  test('hands the field a format, so theirs and yours read as the control shows them', () => {
    const wrapper = mount(Select, { props: { label: 'Width', options: [{ label: 'Wide', value: 'wide' }, { label: 'Narrow', value: 'narrow' }], modelValue: 'wide' } })
    const format = wrapper.findComponent(Field).props('format') as (value: unknown) => string
    expect(format('narrow')).toBe('Narrow')
    expect(format('gone')).toBe('gone')
  })
})
