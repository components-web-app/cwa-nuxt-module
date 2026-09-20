import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'
import debounce from 'lodash-es/debounce'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaFormInput } from '#cwa/composables/cwa-form-input'

export const useCwaFormRepeated = (iri: Ref<string | undefined>, fullName: string) => {
  const $cwa = useCwa()

  const firstFullName = `${fullName}[first]`
  const secondFullName = `${fullName}[second]`

  const bothBlurred = ref(false)
  let firstHasBlurred = false
  let secondHasBlurred = false

  const lastTriggeredBy = ref<'first' | 'second' | null>(null)

  const first = useCwaFormInput(iri, firstFullName, { blurTrigger: bothBlurred })
  const second = useCwaFormInput(iri, secondFullName, { blurTrigger: bothBlurred })

  const parentVars = computed(() => {
    if (!iri.value) return undefined
    return $cwa.forms.getForm(iri.value).value?.[fullName]?.vars
  })

  const parentValid = computed<boolean | null>(() => {
    if (!parentVars.value?.submitted) return null
    return parentVars.value?.valid ?? null
  })

  const firstValid = computed<boolean | null>(() => {
    if (!first.value.value || !second.value.value) return null
    return parentValid.value
  })

  const secondValid = computed<boolean | null>(() => {
    if (!first.value.value || !second.value.value) return null
    return parentValid.value
  })

  const firstErrors = computed<string[]>(() => {
    if (lastTriggeredBy.value === 'second') return []
    return first.errors.value
  })

  const secondErrors = computed<string[]>(() => {
    const base = second.errors.value
    if (lastTriggeredBy.value === 'second' && first.errors.value.length) {
      const extra = first.errors.value.filter(e => !base.includes(e))
      return [...base, ...extra]
    }
    return base
  })

  const firstOnInput = debounce(() => {
    lastTriggeredBy.value = 'first'
    const extra = second.value.value ? { [secondFullName]: second.value.value } : undefined
    first.validate(extra)
  }, 300)

  const secondOnInput = debounce(() => {
    lastTriggeredBy.value = 'second'
    const extra = first.value.value ? { [firstFullName]: first.value.value } : undefined
    second.validate(extra)
  }, 300)

  const firstOnBlur = () => {
    firstHasBlurred = true
    if (secondHasBlurred) bothBlurred.value = true
    lastTriggeredBy.value = 'first'
    const extra = second.value.value ? { [secondFullName]: second.value.value } : undefined
    first.validate(extra)
  }

  const secondOnBlur = () => {
    secondHasBlurred = true
    if (firstHasBlurred) bothBlurred.value = true
    lastTriggeredBy.value = 'second'
    const extra = first.value.value ? { [firstFullName]: first.value.value } : undefined
    second.validate(extra)
  }

  return {
    first: {
      ...first,
      errors: firstErrors as ComputedRef<string[]>,
      valid: firstValid as ComputedRef<boolean | null>,
      onInput: firstOnInput,
      onBlur: firstOnBlur,
    },
    second: {
      ...second,
      errors: secondErrors as ComputedRef<string[]>,
      valid: secondValid as ComputedRef<boolean | null>,
      onInput: secondOnInput,
      onBlur: secondOnBlur,
    },
  }
}
