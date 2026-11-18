// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ConflictNotice from './ConflictNotice.vue'

describe('ConflictNotice (#461)', () => {
  test('shows theirs and yours through the field\'s format, never the raw value', () => {
    const change = { name: 'Mia', value: '2026-11-20T09:00:00.000Z', accept: vi.fn(), keep: vi.fn() }
    const wrapper = mount(ConflictNotice, {
      props: { change: change as never, mine: '2026-11-21T10:30:00.000Z', id: 'c', format: (value: unknown) => `at ${String(value).slice(0, 10)}` },
    })
    const values = wrapper.findAll('dd').map(item => item.text())
    expect(values).toEqual(['at 2026-11-20', 'at 2026-11-21'])
    expect(wrapper.text()).not.toContain('T09:00:00.000Z')
  })
})
