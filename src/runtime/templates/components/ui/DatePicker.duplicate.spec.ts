// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { consola } from 'consola'
import DatePicker from './DatePicker.vue'

const sameCopy = vi.hoisted(() => ({ value: false }))

vi.mock('reka-ui/date', async (importOriginal) => {
  const actual = await importOriginal<typeof import('reka-ui/date')>()
  return {
    ...actual,
    isZonedDateTime: (value: unknown) => sameCopy.value && actual.isZonedDateTime(value as never),
  }
})

describe('CwaUiDatePicker with two copies of @internationalized/date', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('says so instead of silently losing its time segments', () => {
    sameCopy.value = false
    const warn = vi.spyOn(consola, 'warn').mockImplementation(() => undefined)

    mount(DatePicker, { props: { modelValue: '2026-10-01T08:00:00.000Z' } })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('pnpm dedupe')
  })

  test('says nothing when reka-ui and the module share one copy', () => {
    sameCopy.value = true
    const warn = vi.spyOn(consola, 'warn').mockImplementation(() => undefined)

    mount(DatePicker, { props: { modelValue: '2026-10-01T08:00:00.000Z' } })

    expect(warn).not.toHaveBeenCalled()
  })
})
