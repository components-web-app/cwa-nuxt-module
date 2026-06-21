import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Ref } from 'vue'
import debounce from 'lodash-es/debounce'
import { useCwa } from '#cwa/composables/cwa'

export const useCwaFormInput = (iri: Ref<string | undefined>, fullName: string, opts?: { blurTrigger?: Ref<boolean> }) => {
  const $cwa = useCwa()

  const vars = computed(() => {
    if (!iri.value) return undefined
    return $cwa.forms.getForm(iri.value).value?.[fullName]?.vars
  })

  const initValue = () => {
    const v = vars.value
    if (v?.block_prefixes?.includes('checkbox')) {
      return v.checked ? (v.value ?? '1') : null
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

  const hasBlurred = ref(false)
  const hasInteracted = ref(false)
  const hasPreviouslyBeenValid = ref(false)
  const validating = ref(false)

  const valid = computed<boolean | null>(() => {
    if (!vars.value?.submitted) return null
    if (!hasBlurred.value && !hasInteracted.value && !$cwa.forms.isSubmitAttempted(iri.value ?? '')) return null
    return vars.value?.valid ?? null
  })

  watch(valid, (v) => {
    if (v === true) hasPreviouslyBeenValid.value = true
  })

  const displayErrors = computed(
    () =>
      !validating.value && (
        (opts?.blurTrigger !== undefined ? opts.blurTrigger.value : hasBlurred.value)
        || (hasPreviouslyBeenValid.value && valid.value === false)
        || $cwa.forms.isSubmitAttempted(iri.value ?? '')
      ),
  )

  const onBlur = () => {
    hasBlurred.value = true
  }

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
      hasInteracted.value = true
      validating.value = true
      // Include all registered field values so the API sees the full form context and
      // returns validation state for all fields — prevents one field's response from
      // clearing the validation state of other collection entries in the store.
      await $cwa.forms.validateField(`${iri.value}/submit`, {
        ...$cwa.forms.getFieldValues(iri.value),
        [fullName]: value.value,
        ...extraData,
      })
      validating.value = false
    },
    onInput: null as unknown as () => void,
  }

  result.onInput = debounce(() => result.validate(), 300)

  return result
}
