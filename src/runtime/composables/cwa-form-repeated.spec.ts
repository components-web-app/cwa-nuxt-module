// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { Ref } from 'vue'
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
  let capturedBlurTrigger: Ref<boolean> | undefined

  function setupMock() {
    capturedBlurTrigger = undefined
    let callCount = 0
    mockUseCwaFormInput.mockImplementation((_iri: any, _name: any, opts?: { blurTrigger?: Ref<boolean> }) => {
      if (opts?.blurTrigger) capturedBlurTrigger = opts.blurTrigger
      return callCount++ === 0 ? mockFirst : mockSecond
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    iri.value = '/_/form_components/123'
    mockFirst = makeInputMock('firstValue')
    mockSecond = makeInputMock('secondValue')
    setupMock()
  })

  describe('shape', () => {
    test('returns first and second objects', () => {
      const { first, second } = useCwaFormRepeated(iri, 'password_form[password]')
      expect(first).toBeDefined()
      expect(second).toBeDefined()
    })

    test('first uses fullName + "[first]" with blurTrigger option', () => {
      useCwaFormRepeated(iri, 'password_form[password]')
      expect(mockUseCwaFormInput).toHaveBeenCalledWith(
        iri,
        'password_form[password][first]',
        expect.objectContaining({ blurTrigger: expect.any(Object) }),
      )
    })

    test('second uses fullName + "[second]" with blurTrigger option', () => {
      useCwaFormRepeated(iri, 'password_form[password]')
      expect(mockUseCwaFormInput).toHaveBeenCalledWith(
        iri,
        'password_form[password][second]',
        expect.objectContaining({ blurTrigger: expect.any(Object) }),
      )
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
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onInput()
      vi.advanceTimersByTime(300)
      expect(mockSecond.validate).toHaveBeenCalledWith({ 'password_form[password][first]': '__FAKE__' })
      vi.useRealTimers()
    })
  })

  describe('first.onBlur cross-validation', () => {
    test('calls first.validate with second value on blur', () => {
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onBlur()
      expect(mockFirst.validate).toHaveBeenCalledWith({ 'password_form[password][second]': 'secondValue' })
    })

    test('uses __FAKE__ when second value is empty on blur', () => {
      mockSecond.value.value = ''
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onBlur()
      expect(mockFirst.validate).toHaveBeenCalledWith({ 'password_form[password][second]': '__FAKE__' })
    })
  })

  describe('second.onBlur cross-validation', () => {
    test('calls second.validate with first value on blur', () => {
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onBlur()
      expect(mockSecond.validate).toHaveBeenCalledWith({ 'password_form[password][first]': 'firstValue' })
    })

    test('uses __FAKE__ when first value is empty on blur', () => {
      mockFirst.value.value = ''
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onBlur()
      expect(mockSecond.validate).toHaveBeenCalledWith({ 'password_form[password][first]': '__FAKE__' })
    })
  })

  describe('both-blurred gate', () => {
    test('passes the same blurTrigger ref to both sub-inputs', () => {
      useCwaFormRepeated(iri, 'password_form[password]')
      const calls = mockUseCwaFormInput.mock.calls
      expect(calls[0][2]?.blurTrigger).toBeDefined()
      expect(calls[0][2]?.blurTrigger).toBe(calls[1][2]?.blurTrigger)
    })

    test('blurTrigger starts as false', () => {
      useCwaFormRepeated(iri, 'password_form[password]')
      expect(capturedBlurTrigger!.value).toBe(false)
    })

    test('blurTrigger stays false after only first onBlur', () => {
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onBlur()
      expect(capturedBlurTrigger!.value).toBe(false)
    })

    test('blurTrigger stays false after only second onBlur', () => {
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onBlur()
      expect(capturedBlurTrigger!.value).toBe(false)
    })

    test('blurTrigger becomes true after both onBlur (first then second)', () => {
      const { first, second } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onBlur()
      second.onBlur()
      expect(capturedBlurTrigger!.value).toBe(true)
    })

    test('blurTrigger becomes true after both onBlur (second then first)', () => {
      const { first, second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onBlur()
      first.onBlur()
      expect(capturedBlurTrigger!.value).toBe(true)
    })
  })
})
