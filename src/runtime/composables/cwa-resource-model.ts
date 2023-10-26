import { computed, ref, watch } from 'vue'
import { debounce } from 'lodash-es'
import { useCwa } from '#cwa/runtime/composables/cwa'

export const useCwaResourceModel = <T>(iri: string, property: string) => {
  const $cwa = useCwa()
  const resource = $cwa.resources.getResource(iri)
  const storeValue = computed<T|undefined>(() => resource.value?.[property])
  const localValue = ref<T|undefined>()
  const submitting = ref(false)
  const pendingSubmit = ref(false)
  let debounced

  const isBusy = computed(() => pendingSubmit.value || submitting.value)

  async function updateResource (newLocalValue: any) {
    submitting.value = true
    pendingSubmit.value = false
    await $cwa.resourcesManager.updateResource({
      endpoint: iri,
      data: {
        [property]: newLocalValue
      }
    })
    submitting.value = false
    newLocalValue.value = undefined
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
  })

  return {
    states: {
      pendingSubmit,
      submitting,
      isBusy
    },
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
