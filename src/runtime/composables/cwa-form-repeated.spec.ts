// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { useCwaFormRepeated } from '#cwa/composables/cwa-form-repeated'

const mockUseCwaFormInput = vi.hoisted(() => vi.fn())
const mockGetForm = vi.hoisted(() => vi.fn())

vi.mock('#cwa/composables/cwa-form-input', () => ({
  useCwaFormInput: mockUseCwaFormInput,
}))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    forms: {
      getForm: mockGetForm,
    },
  }),
}))

function makeInputMock(value = '') {
  return {
    vars: ref(undefined),
    value: ref(value),
    errors: ref<string[]>([]),
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

  // Plain object — set before each test; read lazily inside computed via getter
  let mockParentVars: { submitted: boolean, valid: boolean | null }

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
    mockParentVars = { submitted: false, valid: null }
    mockGetForm.mockReturnValue({
      get value() {
        return { 'password_form[password]': { vars: mockParentVars } }
      },
    })
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

    test('first passes through vars, value, displayErrors from underlying input', () => {
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      expect(first.vars).toBe(mockFirst.vars)
      expect(first.value).toBe(mockFirst.value)
      expect(first.displayErrors).toBe(mockFirst.displayErrors)
    })

    test('second passes through vars, value from underlying input', () => {
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      expect(second.vars).toBe(mockSecond.vars)
      expect(second.value).toBe(mockSecond.value)
    })

    test('first.errors and first.valid are derived computeds, not the raw input refs', () => {
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      // They are new computed refs, not the same object
      expect(first.errors).not.toBe(mockFirst.errors)
      expect(first.valid).not.toBe(mockFirst.valid)
      // But initial values reflect the underlying inputs
      expect(first.errors.value).toEqual([])
      expect(first.valid.value).toBeNull()
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

    test('passes undefined extraData when second value is empty', () => {
      vi.useFakeTimers()
      mockSecond.value.value = ''
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onInput()
      vi.advanceTimersByTime(300)
      expect(mockFirst.validate).toHaveBeenCalledWith(undefined)
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

    test('passes undefined extraData when first value is empty', () => {
      vi.useFakeTimers()
      mockFirst.value.value = ''
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onInput()
      vi.advanceTimersByTime(300)
      expect(mockSecond.validate).toHaveBeenCalledWith(undefined)
      vi.useRealTimers()
    })
  })

  describe('first.onBlur cross-validation', () => {
    test('calls first.validate with second value on blur', () => {
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onBlur()
      expect(mockFirst.validate).toHaveBeenCalledWith({ 'password_form[password][second]': 'secondValue' })
    })

    test('passes undefined extraData when second value is empty on blur', () => {
      mockSecond.value.value = ''
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onBlur()
      expect(mockFirst.validate).toHaveBeenCalledWith(undefined)
    })
  })

  describe('second.onBlur cross-validation', () => {
    test('calls second.validate with first value on blur', () => {
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onBlur()
      expect(mockSecond.validate).toHaveBeenCalledWith({ 'password_form[password][first]': 'firstValue' })
    })

    test('passes undefined extraData when first value is empty on blur', () => {
      mockFirst.value.value = ''
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onBlur()
      expect(mockSecond.validate).toHaveBeenCalledWith(undefined)
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

  describe('valid — derived from parent node', () => {
    test('is null when second value is empty, regardless of parent state', () => {
      mockSecond.value.value = ''
      mockParentVars = { submitted: true, valid: true }
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      expect(first.valid.value).toBeNull()
    })

    test('is null when first value is empty, regardless of parent state', () => {
      mockFirst.value.value = ''
      mockParentVars = { submitted: true, valid: true }
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      expect(second.valid.value).toBeNull()
    })

    test('is null when both values present but parent not yet submitted', () => {
      // default mockParentVars: submitted: false
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      expect(first.valid.value).toBeNull()
    })

    test('first.valid is true when both values present and parent valid=true', () => {
      mockParentVars = { submitted: true, valid: true }
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      expect(first.valid.value).toBe(true)
    })

    test('first.valid is false when both values present and parent valid=false', () => {
      mockParentVars = { submitted: true, valid: false }
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      expect(first.valid.value).toBe(false)
    })

    test('second.valid mirrors parent valid when both values present', () => {
      mockParentVars = { submitted: true, valid: true }
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      expect(second.valid.value).toBe(true)
    })

    test('second.valid is false when parent valid=false', () => {
      mockParentVars = { submitted: true, valid: false }
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      expect(second.valid.value).toBe(false)
    })
  })

  describe('error redirection', () => {
    test('first.errors are empty after second.onInput fires', () => {
      vi.useFakeTimers()
      mockFirst.errors.value = ['passwords do not match']
      const { first, second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onInput()
      vi.advanceTimersByTime(300)
      expect(first.errors.value).toEqual([])
      vi.useRealTimers()
    })

    test('second.errors include first.errors after second.onInput fires', () => {
      vi.useFakeTimers()
      mockFirst.errors.value = ['passwords do not match']
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onInput()
      vi.advanceTimersByTime(300)
      expect(second.errors.value).toContain('passwords do not match')
      vi.useRealTimers()
    })

    test('first.errors are shown on first after first.onInput fires', () => {
      vi.useFakeTimers()
      mockFirst.errors.value = ['too short']
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onInput()
      vi.advanceTimersByTime(300)
      expect(first.errors.value).toEqual(['too short'])
      vi.useRealTimers()
    })

    test('first.errors are empty after second.onBlur', () => {
      mockFirst.errors.value = ['passwords do not match']
      const { first, second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onBlur()
      expect(first.errors.value).toEqual([])
    })

    test('second.errors include first.errors after second.onBlur', () => {
      mockFirst.errors.value = ['passwords do not match']
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onBlur()
      expect(second.errors.value).toContain('passwords do not match')
    })

    test('first.errors are not duplicated in second.errors', () => {
      mockFirst.errors.value = ['passwords do not match']
      mockSecond.errors.value = ['passwords do not match']
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onBlur()
      expect(second.errors.value.filter(e => e === 'passwords do not match')).toHaveLength(1)
    })
  })
})
