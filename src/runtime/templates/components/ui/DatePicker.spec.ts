// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { resetLocalTimeZone } from '@internationalized/date'
import DatePicker from './DatePicker.vue'

const originalTz = process.env.TZ

function mountPicker(props: { modelValue?: string | null, min?: string, label?: string } = {}) {
  return mount(DatePicker, {
    props: { modelValue: null, ...props },
    attachTo: document.body,
  })
}

type Picker = ReturnType<typeof mountPicker>

async function openCalendar(wrapper: Picker) {
  await wrapper.find('[data-date-picker-trigger]').trigger('click')
  await flushPromises()
}

function inBody<T extends Element = HTMLElement>(selector: string) {
  return document.body.querySelector<T>(selector)
}

async function pickDay(date: string) {
  inBody(`[data-date="${date}"]`)!.click()
  await flushPromises()
}

function segment(wrapper: Picker, part: string) {
  return wrapper.find(`[data-segment="${part}"]`)
}

function emitted(wrapper: Picker) {
  return (wrapper.emitted('update:modelValue') ?? []).map(([value]) => value)
}

describe('CwaUiDatePicker', () => {
  beforeEach(() => {
    process.env.TZ = 'Europe/London'
    resetLocalTimeZone()
    vi.useFakeTimers({ now: new Date('2026-09-25T12:00:00Z'), toFake: ['Date'] })
  })

  afterEach(() => {
    process.env.TZ = originalTz
    resetLocalTimeZone()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  describe('the field', () => {
    test('shows the value on the editor own clock', () => {
      const wrapper = mountPicker({ modelValue: '2026-10-01T08:00:00.000Z' })

      expect(['day', 'month', 'year', 'hour', 'minute'].map(part => segment(wrapper, part).text()))
        .toEqual(['01', '10', '2026', '09', '00'])
    })

    test('its label names the field for assistive technology', () => {
      const wrapper = mountPicker({ modelValue: '2026-10-01T08:00:00.000Z', label: 'Goes live' })
      const label = wrapper.find('[data-date-picker-label]')

      expect(label.text()).toBe('Goes live')
      expect(wrapper.find('[role="group"]').attributes('aria-labelledby')).toBe(label.attributes('id'))
    })

    test('keeps the time zone out of the field, naming it with the offset at the chosen date on the calendar button', () => {
      const winter = mountPicker({ modelValue: '2026-12-01T09:00:00.000Z' })
      const summer = mountPicker({ modelValue: '2026-10-01T08:00:00.000Z' })

      expect(winter.find('[role="group"]').text()).not.toContain('UTC')
      expect(winter.find('[data-date-picker-trigger]').attributes('title')).toBe('Times are in Europe/London, UTC+00:00')
      expect(summer.find('[data-date-picker-trigger]').attributes('title')).toBe('Times are in Europe/London, UTC+01:00')
    })

    test('changing the hour emits that moment in UTC', async () => {
      const wrapper = mountPicker({ modelValue: '2026-10-01T08:00:00.000Z' })

      await segment(wrapper, 'hour').trigger('keydown', { key: 'ArrowUp' })

      expect(emitted(wrapper)).toEqual(['2026-10-01T09:00:00.000Z'])
    })

    test('minutes step by five', async () => {
      const wrapper = mountPicker({ modelValue: '2026-10-01T08:00:00.000Z' })

      await segment(wrapper, 'minute').trigger('keydown', { key: 'ArrowUp' })

      expect(emitted(wrapper)).toEqual(['2026-10-01T08:05:00.000Z'])
    })

    test('never emits a time before min, even when the field is changed to one', async () => {
      const wrapper = mountPicker({ modelValue: '2026-09-25T12:05:00.000Z', min: '2026-09-25T12:02:00.000Z' })

      await segment(wrapper, 'hour').trigger('keydown', { key: 'ArrowDown' })

      expect(emitted(wrapper)).toEqual([])
    })
  })

  describe('the calendar', () => {
    test('opens on the month of the value with that day selected', async () => {
      const wrapper = mountPicker({ modelValue: '2026-10-01T08:00:00.000Z' })
      await openCalendar(wrapper)

      expect(inBody('[data-month-label]')!.textContent).toContain('October 2026')
      expect(inBody('[data-date="2026-10-01"]')!.hasAttribute('data-selected')).toBe(true)
    })

    test('opens on the current month, with today marked, when there is no value', async () => {
      const wrapper = mountPicker()
      await openCalendar(wrapper)

      expect(inBody('[data-month-label]')!.textContent).toContain('September 2026')
      expect(inBody('[data-date="2026-09-25"]')!.hasAttribute('data-today')).toBe(true)
    })

    test('picking a day keeps the chosen time, saved as that moment in UTC, and closes', async () => {
      const wrapper = mountPicker({ modelValue: '2026-10-01T16:30:00.000Z' })
      await openCalendar(wrapper)

      await pickDay('2026-10-02')

      expect(emitted(wrapper)).toEqual(['2026-10-02T16:30:00.000Z'])
      expect(inBody('[data-month-label]')).toBeNull()
    })

    test('keeps the local time across the clocks going back', async () => {
      const wrapper = mountPicker({ modelValue: '2026-10-24T08:00:00.000Z' })
      await openCalendar(wrapper)

      await pickDay('2026-10-26')

      expect(emitted(wrapper)).toEqual(['2026-10-26T09:00:00.000Z'])
    })

    test('picking a day with no value yet uses 09:00', async () => {
      const wrapper = mountPicker()
      await openCalendar(wrapper)

      await pickDay('2026-09-30')

      expect(emitted(wrapper)).toEqual(['2026-09-30T08:00:00.000Z'])
    })

    test('days before min cannot be picked', async () => {
      const wrapper = mountPicker({ min: '2026-09-25T12:02:00.000Z' })
      await openCalendar(wrapper)

      expect(inBody('[data-date="2026-09-24"]')!.hasAttribute('data-disabled')).toBe(true)
      expect(inBody('[data-date="2026-09-25"]')!.hasAttribute('data-disabled')).toBe(false)

      await pickDay('2026-09-24')
      expect(emitted(wrapper)).toEqual([])
    })

    test('picking the day of min at an earlier time lands on the earliest allowed time', async () => {
      const wrapper = mountPicker({ modelValue: '2026-09-28T08:00:00.000Z', min: '2026-09-25T12:02:00.000Z' })
      await openCalendar(wrapper)

      await pickDay('2026-09-25')

      expect(emitted(wrapper)).toEqual(['2026-09-25T12:05:00.000Z'])
    })

    test('Escape closes it without changing the value', async () => {
      const wrapper = mountPicker({ modelValue: '2026-10-15T08:00:00.000Z' })
      await openCalendar(wrapper)

      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await flushPromises()

      expect(inBody('[data-month-label]')).toBeNull()
      expect(emitted(wrapper)).toEqual([])
    })
  })
})
