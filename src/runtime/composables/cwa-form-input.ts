import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Ref } from 'vue'
import debounce from 'lodash-es/debounce'
import { useCwa } from '#cwa/composables/cwa'

export const useCwaFormInput = (iri: Ref<string | undefined>, fullName: string) => {
  const $cwa = useCwa()

  const vars = computed(() => {
    if (!iri.value) return undefined
    return $cwa.forms.getForm(iri.value).value?.[fullName]?.vars
  })

  const initValue = () => {
    const v = vars.value
    if (v?.block_prefixes?.includes('checkbox')) {
      return v.checked ? (v.value ?? '1') : ''
    }
    return v?.value
  }

  const value = ref<any>(initValue())

  if (iri.value) {
    $cwa.forms.setFieldValue(iri.value, fullName, value.value)
  }

  watch(iri, (newIri, oldIri) => {
    if (oldIri) $cwa.forms.clearFieldValue(oldIri, fullName)
    value.value = initValue()
    if (newIri) $cwa.forms.setFieldValue(newIri, fullName, value.value)
  })

  watch(value, (newValue) => {
    if (iri.value) $cwa.forms.setFieldValue(iri.value, fullName, newValue)
  })

  onBeforeUnmount(() => {
    if (iri.value) $cwa.forms.clearFieldValue(iri.value, fullName)
  })

  const errors = computed(() => vars.value?.errors ?? [])
  const valid = computed<boolean | null>(() => {
    if (!vars.value?.submitted) return null
    return vars.value?.valid ?? null
  })

  const hasBlurred = ref(false)
  const hasPreviouslyBeenValid = ref(false)

  watch(valid, (v) => {
    if (v === true) hasPreviouslyBeenValid.value = true
  })

  const displayErrors = computed(
    () =>
      hasBlurred.value
      || (hasPreviouslyBeenValid.value && valid.value === false)
      || $cwa.forms.isSubmitAttempted(iri.value ?? ''),
  )

  const onBlur = () => {
    hasBlurred.value = true
  }

  const validating = ref(false)

  const result = {
    vars,
    value,
    errors,
    valid,
    validating,
    displayErrors,
    onBlur,
    validate: async (extraData?: Record<string, any>): Promise<void> => {
      if (!iri.value || !vars.value) return
      validating.value = true
      await $cwa.forms.validateField(`${iri.value}/submit`, { [fullName]: value.value, ...extraData })
      validating.value = false
    },
    onInput: null as unknown as () => void,
  }

  result.onInput = debounce(() => result.validate(), 300)

  return result
}
