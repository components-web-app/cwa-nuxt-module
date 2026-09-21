import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { useCwa } from '#cwa/composables/cwa'

export const useCwaForm = (iri: Ref<string | undefined>) => {
  const $cwa = useCwa()

  const submitting = ref(false)
  const success = ref(false)

  const rootFormVars = computed(() => {
    if (!iri.value) return undefined
    const form = $cwa.forms.getForm(iri.value).value
    if (!form) return undefined
    const rootKey = Object.keys(form).find(k => !k.includes('[')) ?? ''
    return form[rootKey]?.vars
  })

  const formErrors = computed(() => rootFormVars.value?.errors ?? [])

  const unregisteredFieldErrors = computed(() => {
    if (!iri.value) return []
    const form = $cwa.forms.getForm(iri.value).value
    if (!form) return []
    const registered = new Set(Object.keys($cwa.forms.getFieldValues(iri.value)))
    const rootKey = Object.keys(form).find(k => !k.includes('[')) ?? ''
    const errors: string[] = []
    for (const [key, view] of Object.entries(form)) {
      if (key === rootKey || registered.has(key)) continue
      if (view.vars?.errors?.length) errors.push(...view.vars.errors)
    }
    return errors
  })

  const submit = async () => {
    if (!iri.value || !rootFormVars.value) return

    const action = rootFormVars.value.action ?? ''
    const method = rootFormVars.value.method?.toUpperCase() === 'PATCH' ? 'PATCH' : 'POST'
    const body = $cwa.forms.getFieldValues(iri.value)

    submitting.value = true
    const result = await $cwa.forms.submitForm(action, body, method)
    submitting.value = false

    if (result.success) {
      success.value = true
      $cwa.forms.setSubmitAttempted(iri.value, false)
    }
    else {
      $cwa.forms.setSubmitAttempted(iri.value, true)
    }
  }

  return {
    submit,
    submitting,
    success,
    formErrors,
    unregisteredFieldErrors,
  }
}
