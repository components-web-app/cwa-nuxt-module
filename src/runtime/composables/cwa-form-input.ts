import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import debounce from 'lodash-es/debounce'
import { useCwa } from '#cwa/composables/cwa'

export const useCwaFormInput = (iri: Ref<string | undefined>, fullName: string) => {
  const $cwa = useCwa()

  const vars = computed(() => {
    if (!iri.value) return undefined
    return $cwa.forms.getForm(iri.value).value?.[fullName]?.vars
  })

  const value = ref<any>(vars.value?.value)

  watch(iri, () => {
    value.value = vars.value?.value
  })

  const errors = computed(() => vars.value?.errors ?? [])
  const valid = computed<boolean | null>(() => vars.value?.valid ?? null)

  const hasBlurred = ref(false)
  const hasPreviouslyBeenValid = ref(false)

  watch(valid, (v) => {
    if (v === true) hasPreviouslyBeenValid.value = true
  })

  const displayErrors = computed(
    () => hasBlurred.value || (hasPreviouslyBeenValid.value && valid.value === false),
  )

  const onBlur = () => {
    hasBlurred.value = true
  }

  const result = {
    vars,
    value,
    errors,
    valid,
    displayErrors,
    onBlur,
    validate: (_extraData?: Record<string, any>): void => {
      // HTTP validation implemented in useCwaForm step
    },
    onInput: null as unknown as () => void,
  }

  result.onInput = debounce(() => result.validate(), 300)

  return result
}
