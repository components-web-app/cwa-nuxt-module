import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { debounce, get } from 'lodash-es'
import { useCwa } from '#cwa/runtime/composables/cwa'

export const useCwaResourceModel = <T>(iri: Ref<string>, property: string) => {
  const $cwa = useCwa()
  const resource = $cwa.resources.getResource(iri.value)
  // todo: this may need to change if we are updating a published / draft and need to force with a querystring
  const endpoint = iri.value
  const storeValue = computed<T|undefined>(() => (resource.value?.data ? get(resource.value.data, property) : undefined))
  const localValue = ref<T|undefined>()
  const submitting = ref(false)
  const pendingSubmit = ref(false)
  let debounced

  const isBusy = computed(() => pendingSubmit.value || submitting.value)

  async function updateResource (newLocalValue: any) {
    submitting.value = true
    pendingSubmit.value = false
    await $cwa.resourcesManager.updateResource({
      endpoint,
      data: {
        [property]: newLocalValue
      }
    })
    submitting.value = false
    localValue.value === newLocalValue && reset()
  }

  function reset () {
    localValue.value = undefined
  }

  watch(localValue, (newLocalValue) => {
    if (newLocalValue === undefined) {
      return
    }
    if (debounced) {
      debounced.cancel()
    }
    pendingSubmit.value = true
    const waitMs = 250
    debounced = debounce(() => updateResource(newLocalValue), waitMs)
    debounced()
  })

  return {
    states: {
      pendingSubmit,
      submitting,
      isBusy
    },
    reset,
    model: computed<T|undefined>({
      get () {
        return localValue.value || storeValue.value
      },
      set (value) {
        localValue.value = value
      }
    })
  }
}
