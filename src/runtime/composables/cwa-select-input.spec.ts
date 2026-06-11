// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { computed } from 'vue'
import { useCwaSelectInput } from '#cwa/composables/cwa-select-input'
import type { SelectInputProps } from '#cwa/composables/cwa-select-input'

const mockTrigger = { mock: 'trigger' }
const mockContainer = { mock: 'container' }

vi.mock('#cwa/composables/popper', () => ({
  usePopper: vi.fn(() => [mockTrigger, mockContainer]),
}))

function makeProps(overrides: Partial<SelectInputProps> = {}) {
  return computed<SelectInputProps>(() => ({
    options: [
      { label: 'First', value: 'a' },
      { label: 'Second', value: 'b' },
    ],
    modelValue: 'a',
    ...overrides,
  }))
}

describe('useCwaSelectInput', () => {
  describe('value computed', () => {
    test('getter returns modelValue', () => {
      const emit = vi.fn()
      const { value } = useCwaSelectInput(makeProps(), emit)
      expect(value.value).toBe('a')
    })

    test('setter calls emit with update:modelValue', () => {
      const emit = vi.fn()
      const { value } = useCwaSelectInput(makeProps(), emit)
      value.value = 'b'
      expect(emit).toHaveBeenCalledWith('update:modelValue', 'b')
    })
  })

  describe('selectedOption', () => {
    test('returns option matching modelValue', () => {
      const emit = vi.fn()
      const { selectedOption } = useCwaSelectInput(makeProps({ modelValue: 'b' }), emit)
      expect(selectedOption.value).toEqual({ label: 'Second', value: 'b' })
    })

    test('returns first option when no match', () => {
      const emit = vi.fn()
      const { selectedOption } = useCwaSelectInput(makeProps({ modelValue: 'z' }), emit)
      expect(selectedOption.value).toEqual({ label: 'First', value: 'a' })
    })

    test('returns null when options is empty and no match', () => {
      const emit = vi.fn()
      const { selectedOption } = useCwaSelectInput(makeProps({ options: [], modelValue: 'x' }), emit)
      expect(selectedOption.value).toBeNull()
    })

    test('uses deep equality for object values', () => {
      const emit = vi.fn()
      const objVal = { id: 1 }
      const props = computed<SelectInputProps>(() => ({
        options: [{ label: 'Object', value: { id: 1 } }],
        modelValue: objVal,
      }))
      const { selectedOption } = useCwaSelectInput(props, emit)
      expect(selectedOption.value).toEqual({ label: 'Object', value: { id: 1 } })
    })
  })

  describe('compareOptions', () => {
    test('returns true for equal values', () => {
      const { compareOptions } = useCwaSelectInput(makeProps(), vi.fn())
      expect(compareOptions('a', 'a')).toBe(true)
    })

    test('returns false for different values', () => {
      const { compareOptions } = useCwaSelectInput(makeProps(), vi.fn())
      expect(compareOptions('a', 'b')).toBe(false)
    })

    test('treats undefined and null as equal', () => {
      const { compareOptions } = useCwaSelectInput(makeProps(), vi.fn())
      expect(compareOptions(undefined, null)).toBe(true)
    })

    test('uses deep equality for objects', () => {
      const { compareOptions } = useCwaSelectInput(makeProps(), vi.fn())
      expect(compareOptions({ x: 1 }, { x: 1 })).toBe(true)
      expect(compareOptions({ x: 1 }, { x: 2 })).toBe(false)
    })
  })

  describe('popper refs', () => {
    test('returns trigger and container from usePopper', () => {
      const emit = vi.fn()
      const { trigger, container } = useCwaSelectInput(makeProps(), emit)
      expect(trigger).toBe(mockTrigger)
      expect(container).toBe(mockContainer)
    })
  })
})
