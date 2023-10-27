import { computed, getCurrentInstance, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { debounce, get, isObject, set } from 'lodash-es'
import { useCwa } from '#cwa/runtime/composables/cwa'

interface ResourceModelOps {
  longWaitThreshold?: number,
  debounceTime?: number
}

export const useCwaResourceModel = <T>(iri: Ref<string>, property: string|array, ops?: ResourceModelOps) => {
  const proxy = getCurrentInstance()?.proxy
  const source = `input_${proxy?.$?.uid}`
  const $cwa = useCwa()
  const resource = $cwa.resources.getResource(iri.value)
  const postfix = $cwa.admin.componentManager.forcePublishedVersion === undefined ? '' : ($cwa.admin.componentManager.forcePublishedVersion ? '?published=true' : '?published=false')
  const endpoint = `${iri.value}${postfix}`

  const storeValue = computed<T|undefined>(() => (resource.value?.data ? get(resource.value.data, property) : undefined))
  const rootProperty = computed(() => {
    if (Array.isArray(property)) {
      return property[0]
    }
    return property.split('.')[0].split('[')[0]
  })
  const rootStoreValue = computed(() => (resource.value?.data ? get(resource.value.data, rootProperty.value) : undefined))

  const localValue = ref<T|undefined>()
  const submitting = computed(() => submittingValue.value !== undefined)
  const pendingSubmit = ref(false)
  const isLongWait = ref(false)
  const submittingValue = ref<T|undefined>()

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
    // consider: another field is updating the same object and the request is not complete, we could overwrite that change with the new change as we are merging objects from the root property
    // consider: it doesn't matter if THIS field is updated and there is a pending request, we can continue and override that change
    // consider: it doesn't matter if another request is in progress for a DIFFERENT property, it'll update the store value and this request will not interfere
    // consider: it is all about the external sync status of a nested object property that we should need to wait for
    const isNewValueObject = isObject(newLocalValue)

    isNewValueObject && await $cwa.resourcesManager.getWaitForRequestPromise(source, endpoint, rootProperty.value)

    if (!submitting.value && isEqual(storeValue.value, newLocalValue)) {
      pendingSubmit.value = false
      reset()
      return
    }
    // if updating a nested property within an object, we need to submit the object from the root, merging in the new value
    if (isNewValueObject) {
      const newObject = set({ [rootProperty.value]: { ...rootStoreValue.value } }, property, submitValue)
      submittingValue.value = newObject[rootProperty.value]
    } else {
      submittingValue.value = newLocalValue
    }
    pendingSubmit.value = false

    await $cwa.resourcesManager.updateResource({
      endpoint,
      data: {
        [rootProperty.value]: submittingValue.value
      },
      source
    })
    submittingValue.value = undefined
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
