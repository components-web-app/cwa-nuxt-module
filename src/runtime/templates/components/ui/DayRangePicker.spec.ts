// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { resetLocalTimeZone } from '@internationalized/date'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { drawsOpenState } from '../../../../../test/utils/open-state'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import { fakeFieldModel } from '../../../../../playground/app/kit/fake-field-model'
import DayRangePicker from './DayRangePicker.vue'

enableAutoUnmount(afterEach)

const originalTz = process.env.TZ
const errors: unknown[] = []

function mountPicker(props: Record<string, unknown> = {}) {
  return mount(DayRangePicker, {
    props: { modelValue: null, label: 'Show between', ...props },
    attachTo: document.body,
    global: { config: { errorHandler: error => errors.push(error) } },
  })
}

type Picker = ReturnType<typeof mountPicker>

function trigger(wrapper: Picker) {
  return wrapper.get<HTMLButtonElement>('[data-testid="day-range-trigger"]')
}

async function open(wrapper: Picker) {
  await trigger(wrapper).trigger('click')
  await flushPromises()
}

async function pickDay(date: string) {
  document.body.querySelector<HTMLElement>(`[data-date="${date}"]`)!.click()
  await flushPromises()
}

function emitted(wrapper: Picker) {
  return (wrapper.emitted('update:modelValue') ?? []).map(([value]) => value)
}

describe('CwaUiDayRangePicker (#461)', () => {
  beforeEach(() => {
    errors.length = 0
    process.env.TZ = 'America/Los_Angeles'
    resetLocalTimeZone()
    vi.useFakeTimers({ now: new Date('2026-09-25T12:00:00Z'), toFake: ['Date'] })
  })

  afterEach(() => {
    process.env.TZ = originalTz
    resetLocalTimeZone()
    vi.useRealTimers()
  })

  test('shows the range as the days chosen, whatever the computer\'s time zone, named by its label, or Any dates when empty', () => {
    const wrapper = mountPicker({ modelValue: ['2026-10-01', '2026-10-14'] })
    expect(trigger(wrapper).text()).toBe('1 Oct 2026 – 14 Oct 2026')
    expect(document.getElementById(trigger(wrapper).attributes('aria-labelledby')!)!.textContent).toBe('Show between')

    const empty = mountPicker()
    expect(trigger(empty).text()).toBe('Any dates')
  })

  test('the field shows itself selected while its calendar is open, and not once it closes, with no axe violations open', async () => {
    const wrapper = mountPicker()
    expect(drawsOpenState(trigger(wrapper).element)).toBe(false)

    await open(wrapper)
    expect(drawsOpenState(trigger(wrapper).element)).toBe(true)
    expect(await axe(document.body, { rules: { region: { enabled: false } } })).toHaveNoViolations()

    await trigger(wrapper).trigger('click')
    await flushPromises()
    expect(drawsOpenState(trigger(wrapper).element)).toBe(false)
  })

  test('opens a calendar on the month of the range start with the range selected', async () => {
    const wrapper = mountPicker({ modelValue: ['2026-10-01', '2026-10-03'] })
    await open(wrapper)

    const dialog = document.body.querySelector<HTMLElement>('[data-testid="day-range-popover"]')!
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.getAttribute('aria-label')).toBe('Show between: choose days')
    expect(document.body.querySelector('[data-date="2026-10-02"]')!.hasAttribute('data-selected')).toBe(true)
  })

  test('picking a first and a last day emits them as plain dates and closes', async () => {
    const wrapper = mountPicker()
    await open(wrapper)

    await pickDay('2026-09-10')
    expect(emitted(wrapper)).toEqual([])
    expect(errors).toEqual([])
    await pickDay('2026-09-12')

    expect(emitted(wrapper)).toEqual([['2026-09-10', '2026-09-12']])
    expect(document.body.querySelector('[data-testid="day-range-popover"]')).toBeNull()
  })

  test('days before min cannot be picked', async () => {
    const wrapper = mountPicker({ min: '2026-09-20' })
    await open(wrapper)

    expect(document.body.querySelector('[data-date="2026-09-19"]')!.hasAttribute('data-disabled')).toBe(true)
    expect(document.body.querySelector('[data-date="2026-09-21"]')!.hasAttribute('data-disabled')).toBe(false)
  })

  test('Clear empties a set range and is not offered for an empty one', async () => {
    const wrapper = mountPicker({ modelValue: ['2026-10-01', '2026-10-14'] })
    await wrapper.get('[data-testid="day-range-clear"]').trigger('click')
    expect(emitted(wrapper)).toEqual([null])

    expect(mountPicker().find('[data-testid="day-range-clear"]').exists()).toBe(false)
  })

  test('a model is shown and written', async () => {
    const field = fakeFieldModel<[string, string]>(['2026-10-01', '2026-10-02'])
    const wrapper = mount(DayRangePicker, { props: { model: field, label: 'Show between' }, attachTo: document.body })
    expect(trigger(wrapper).text()).toBe('1 Oct 2026 – 2 Oct 2026')

    await open(wrapper)
    await pickDay('2026-10-05')
    await pickDay('2026-10-07')
    expect(field.model.value).toEqual(['2026-10-05', '2026-10-07'])
  })

  test('the trigger draws the kit focus ring', () => {
    expect(drawsFocusRing(trigger(mountPicker()).classes())).toBe(true)
  })

  test('has no axe violations', async () => {
    const wrapper = mountPicker({ modelValue: ['2026-10-01', '2026-10-14'] })
    expect(await axe(document.body)).toHaveNoViolations()
    await open(wrapper)
    expect(await axe(document.body.querySelector<HTMLElement>('[data-testid="day-range-popover"]')!)).toHaveNoViolations()
  })
})
