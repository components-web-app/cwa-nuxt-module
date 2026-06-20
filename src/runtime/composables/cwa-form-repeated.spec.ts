// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useCwaFormRepeated } from '#cwa/composables/cwa-form-repeated'

const mockUseCwaFormInput = vi.hoisted(() => vi.fn())

vi.mock('#cwa/composables/cwa-form-input', () => ({
  useCwaFormInput: mockUseCwaFormInput,
}))

function makeInputMock(value = '') {
  return {
    vars: ref(undefined),
    value: ref(value),
    errors: ref([]),
    valid: ref<boolean | null>(null),
    displayErrors: ref(false),
    onBlur: vi.fn(),
    validate: vi.fn().mockResolvedValue(undefined),
    onInput: vi.fn(),
  }
}

describe('useCwaFormRepeated', () => {
  const iri = ref<string | undefined>('/_/form_components/123')
  let mockFirst: ReturnType<typeof makeInputMock>
  let mockSecond: ReturnType<typeof makeInputMock>

  beforeEach(() => {
    vi.clearAllMocks()
    iri.value = '/_/form_components/123'
    mockFirst = makeInputMock('firstValue')
    mockSecond = makeInputMock('secondValue')
    mockUseCwaFormInput
      .mockReturnValueOnce(mockFirst)
      .mockReturnValueOnce(mockSecond)
  })

  describe('shape', () => {
    test('returns first and second objects', () => {
      const { first, second } = useCwaFormRepeated(iri, 'password_form[password]')
      expect(first).toBeDefined()
      expect(second).toBeDefined()
    })

    test('first uses fullName + "[first]"', () => {
      useCwaFormRepeated(iri, 'password_form[password]')
      expect(mockUseCwaFormInput).toHaveBeenCalledWith(iri, 'password_form[password][first]')
    })

    test('second uses fullName + "[second]"', () => {
      useCwaFormRepeated(iri, 'password_form[password]')
      expect(mockUseCwaFormInput).toHaveBeenCalledWith(iri, 'password_form[password][second]')
    })

    test('first exposes vars, value, errors, valid, displayErrors from underlying input', () => {
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      expect(first.vars).toBe(mockFirst.vars)
      expect(first.value).toBe(mockFirst.value)
      expect(first.errors).toBe(mockFirst.errors)
      expect(first.valid).toBe(mockFirst.valid)
      expect(first.displayErrors).toBe(mockFirst.displayErrors)
    })

    test('second exposes vars, value, errors, valid, displayErrors from underlying input', () => {
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      expect(second.vars).toBe(mockSecond.vars)
      expect(second.value).toBe(mockSecond.value)
    })
  })

  describe('first.onInput cross-validation', () => {
    test('calls first.validate with second value as extraData after debounce', () => {
      vi.useFakeTimers()
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onInput()
      vi.advanceTimersByTime(300)
      expect(mockFirst.validate).toHaveBeenCalledWith({ 'password_form[password][second]': 'secondValue' })
      vi.useRealTimers()
    })

    test('uses __FAKE__ when second value is empty', () => {
      vi.useFakeTimers()
      mockSecond.value.value = ''
      mockUseCwaFormInput.mockReset()
      mockUseCwaFormInput.mockReturnValueOnce(mockFirst).mockReturnValueOnce(mockSecond)
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onInput()
      vi.advanceTimersByTime(300)
      expect(mockFirst.validate).toHaveBeenCalledWith({ 'password_form[password][second]': '__FAKE__' })
      vi.useRealTimers()
    })

    test('is debounced — multiple rapid calls fire validate once', () => {
      vi.useFakeTimers()
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onInput()
      vi.advanceTimersByTime(100)
      first.onInput()
      vi.advanceTimersByTime(100)
      first.onInput()
      vi.advanceTimersByTime(300)
      expect(mockFirst.validate).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })
  })

  describe('second.onInput cross-validation', () => {
    test('calls second.validate with first value as extraData after debounce', () => {
      vi.useFakeTimers()
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onInput()
      vi.advanceTimersByTime(300)
      expect(mockSecond.validate).toHaveBeenCalledWith({ 'password_form[password][first]': 'firstValue' })
      vi.useRealTimers()
    })

    test('uses __FAKE__ when first value is empty', () => {
      vi.useFakeTimers()
      mockFirst.value.value = ''
      mockUseCwaFormInput.mockReset()
      mockUseCwaFormInput.mockReturnValueOnce(mockFirst).mockReturnValueOnce(mockSecond)
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onInput()
      vi.advanceTimersByTime(300)
      expect(mockSecond.validate).toHaveBeenCalledWith({ 'password_form[password][first]': '__FAKE__' })
      vi.useRealTimers()
    })
  })

  describe('first.onBlur cross-validation', () => {
    test('calls original onBlur and then validate with second value', () => {
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onBlur()
      expect(mockFirst.onBlur).toHaveBeenCalled()
      expect(mockFirst.validate).toHaveBeenCalledWith({ 'password_form[password][second]': 'secondValue' })
    })

    test('uses __FAKE__ when second value is empty on blur', () => {
      mockSecond.value.value = ''
      mockUseCwaFormInput.mockReset()
      mockUseCwaFormInput.mockReturnValueOnce(mockFirst).mockReturnValueOnce(mockSecond)
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onBlur()
      expect(mockFirst.validate).toHaveBeenCalledWith({ 'password_form[password][second]': '__FAKE__' })
    })
  })

  describe('second.onBlur cross-validation', () => {
    test('calls original onBlur and then validate with first value', () => {
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onBlur()
      expect(mockSecond.onBlur).toHaveBeenCalled()
      expect(mockSecond.validate).toHaveBeenCalledWith({ 'password_form[password][first]': 'firstValue' })
    })

    test('uses __FAKE__ when first value is empty on blur', () => {
      mockFirst.value.value = ''
      mockUseCwaFormInput.mockReset()
      mockUseCwaFormInput.mockReturnValueOnce(mockFirst).mockReturnValueOnce(mockSecond)
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onBlur()
      expect(mockSecond.validate).toHaveBeenCalledWith({ 'password_form[password][first]': '__FAKE__' })
    })
  })
})
