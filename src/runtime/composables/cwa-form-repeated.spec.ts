// @vitest-environment happy-dom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import type { Ref } from 'vue'
import { computed, nextTick, reactive, ref } from 'vue'
import { useCwaFormRepeated } from '#cwa/composables/cwa-form-repeated'

const mockUseCwaFormInput = vi.hoisted(() => vi.fn())
const mockGetForm = vi.hoisted(() => vi.fn())
const mockValidateField = vi.hoisted(() => vi.fn())

vi.mock('#cwa/composables/cwa-form-input', () => ({
  useCwaFormInput: mockUseCwaFormInput,
}))

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    forms: {
      getForm: mockGetForm,
      validateField: mockValidateField,
      isSubmitAttempted: () => false,
      setFieldValue: () => {},
      clearFieldValue: () => {},
      getFieldValues: () => ({}),
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

  let mockParentVars: { submitted: boolean, valid: boolean | null }
  let mockRootVars: { realtime_validate_disabled?: boolean }

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
    mockRootVars = {}
    mockGetForm.mockReturnValue({
      get value() {
        return {
          'password_form': { vars: mockRootVars },
          'password_form[password]': { vars: mockParentVars },
        }
      },
    })
    setupMock()
  })

  afterEach(() => {
    vi.useRealTimers()
    mockValidateField.mockReset()
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
      expect(first.errors).not.toBe(mockFirst.errors)
      expect(first.valid).not.toBe(mockFirst.valid)
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

  describe('realtime_validate_disabled', () => {
    test('password update pair: typing in first does not validate when realtime_validate_disabled is true', () => {
      vi.useFakeTimers()
      mockRootVars.realtime_validate_disabled = true
      const { first } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onInput()
      vi.advanceTimersByTime(300)
      expect(mockFirst.validate).not.toHaveBeenCalled()
      expect(mockSecond.validate).not.toHaveBeenCalled()
    })

    test('password update pair: typing in second does not validate when realtime_validate_disabled is true', () => {
      vi.useFakeTimers()
      mockRootVars.realtime_validate_disabled = true
      const { second } = useCwaFormRepeated(iri, 'password_form[password]')
      second.onInput()
      vi.advanceTimersByTime(300)
      expect(mockFirst.validate).not.toHaveBeenCalled()
      expect(mockSecond.validate).not.toHaveBeenCalled()
    })

    test('reads the flag when the debounce fires, so a late-arriving form is respected', () => {
      vi.useFakeTimers()
      const { first, second } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onInput()
      second.onInput()
      mockRootVars.realtime_validate_disabled = true
      vi.advanceTimersByTime(300)
      expect(mockFirst.validate).not.toHaveBeenCalled()
      expect(mockSecond.validate).not.toHaveBeenCalled()
    })

    test('typing validates both fields when realtime_validate_disabled is false', () => {
      vi.useFakeTimers()
      mockRootVars.realtime_validate_disabled = false
      const { first, second } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onInput()
      vi.advanceTimersByTime(300)
      second.onInput()
      vi.advanceTimersByTime(300)
      expect(mockFirst.validate).toHaveBeenCalledWith({ 'password_form[password][second]': 'secondValue' })
      expect(mockSecond.validate).toHaveBeenCalledWith({ 'password_form[password][first]': 'firstValue' })
    })

    test('typing validates both fields when the flag is absent', () => {
      vi.useFakeTimers()
      const { first, second } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onInput()
      vi.advanceTimersByTime(300)
      second.onInput()
      vi.advanceTimersByTime(300)
      expect(mockFirst.validate).toHaveBeenCalledTimes(1)
      expect(mockSecond.validate).toHaveBeenCalledTimes(1)
    })

    test('blur does not validate either field when realtime_validate_disabled is true', () => {
      mockRootVars.realtime_validate_disabled = true
      const { first, second } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onBlur()
      second.onBlur()
      expect(mockFirst.validate).not.toHaveBeenCalled()
      expect(mockSecond.validate).not.toHaveBeenCalled()
    })

    test('blur still marks both fields blurred when realtime_validate_disabled is true', () => {
      mockRootVars.realtime_validate_disabled = true
      const { first, second } = useCwaFormRepeated(iri, 'password_form[password]')
      first.onBlur()
      second.onBlur()
      expect(capturedBlurTrigger!.value).toBe(true)
    })

    test('an explicit validate call still fires when realtime_validate_disabled is true', () => {
      mockRootVars.realtime_validate_disabled = true
      const { first, second } = useCwaFormRepeated(iri, 'password_form[password]')
      first.validate()
      second.validate()
      expect(mockFirst.validate).toHaveBeenCalledTimes(1)
      expect(mockSecond.validate).toHaveBeenCalledTimes(1)
    })
  })

  describe('#310 with the real useCwaFormInput', () => {
    test('#310: a mismatch after an earlier full-form response marked the first half valid shows no error until both halves are blurred', async () => {
      const actual = await vi.importActual<typeof import('#cwa/composables/cwa-form-input')>('#cwa/composables/cwa-form-input')
      mockUseCwaFormInput.mockImplementation(actual.useCwaFormInput)
      const formData = reactive({
        'password_form': { vars: {} as Record<string, any> },
        'password_form[password]': { vars: { submitted: true, valid: true } as Record<string, any> },
        'password_form[password][first]': { vars: { value: '', submitted: true, valid: true, errors: [] as string[] } as Record<string, any> },
        'password_form[password][second]': { vars: { value: '', submitted: true, valid: null, errors: [] as string[] } as Record<string, any> },
      })
      mockGetForm.mockReturnValue(computed(() => formData))

      let resolveValidate!: () => void
      mockValidateField.mockReturnValueOnce(new Promise<void>((r) => {
        resolveValidate = r
      }))
      mockValidateField.mockResolvedValue(undefined)

      vi.useFakeTimers()
      const { first, second } = useCwaFormRepeated(iri, 'password_form[password]')
      first.value.value = 'secret1'
      first.onInput()
      vi.advanceTimersByTime(300)
      expect(mockValidateField).toHaveBeenCalledTimes(1)
      await nextTick()

      formData['password_form[password][first]'].vars.valid = false
      formData['password_form[password][first]'].vars.errors = ['The password fields must match.']
      resolveValidate()
      await Promise.resolve()
      await nextTick()

      expect(first.errors.value).toEqual(['The password fields must match.'])
      expect(first.displayErrors.value).toBe(false)

      first.onBlur()
      second.onBlur()
      await Promise.resolve()
      await nextTick()
      expect(first.displayErrors.value).toBe(true)
    })
  })
})
