import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { debounce, get } from 'lodash-es'
import { useCwa } from '#cwa/runtime/composables/cwa'

interface ResourceModelOps {
  longWaitThreshold?: number,
  debounceTime?: number
}

export const useCwaResourceModel = <T>(iri: Ref<string>, property: string, ops?: ResourceModelOps) => {
  const $cwa = useCwa()
  const resource = $cwa.resources.getResource(iri.value)
  // todo: this may need to change if we are updating a published / draft and need to force with a querystring
  const endpoint = iri.value
  const storeValue = computed<T|undefined>(() => (resource.value?.data ? get(resource.value.data, property) : undefined))
  const localValue = ref<T|undefined>()
  const submitting = ref(false)
  const pendingSubmit = ref(false)
  const isLongWait = ref(false)
  const longWaitThreshold = ops?.longWaitThreshold || 5000
  const debounceTime = ops?.debounceTime || 250
  let debounced

  const isBusy = computed(() => pendingSubmit.value || submitting.value)

  function isEqual (value1: any, value2: any) {
    function requiresNormalizing (value: any) {
      const type = typeof value
      return value !== undefined && value !== null && (type === 'object' || Array.isArray(value))
    }

    function getNormalizedValue (value: any): string|null|undefined {
      return requiresNormalizing(value) ? JSON.stringify(value) : value
    }

    return getNormalizedValue(value1) === getNormalizedValue(value2)
  }

  async function updateResource (newLocalValue: any) {
    if (!submitting.value && isEqual(storeValue.value, newLocalValue)) {
      pendingSubmit.value = false
      reset()
      return
    }
    submitting.value = true
    pendingSubmit.value = false
    await $cwa.resourcesManager.updateResource({
      endpoint,
      data: {
        [property]: newLocalValue
      }
    })
    submitting.value = false
    isEqual(localValue.value, newLocalValue) && reset()
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
    debounced = debounce(() => updateResource(newLocalValue), debounceTime)
    debounced()
  })

  let longWaitTimeoutFn

  watch(isBusy, (newBusy) => {
    if (!newBusy) {
      isLongWait.value = false
      if (longWaitTimeoutFn) {
        clearTimeout(longWaitTimeoutFn)
      }
      return
    }

    longWaitTimeoutFn = setTimeout(() => {
      isLongWait.value = true
    }, longWaitThreshold)
  })

  return {
    states: {
      pendingSubmit,
      submitting,
      isBusy,
      isLongWait
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
