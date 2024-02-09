import { computed, getCurrentInstance, ref, watch, watchEffect } from 'vue'
import type { Ref } from 'vue'
import { debounce, get, isObject, set } from 'lodash-es'
import { useCwa } from '#cwa/runtime/composables/cwa'
import { getPublishedResourceState } from '#cwa/runtime/resources/resource-utils'

interface ResourceModelOps {
  longWaitThreshold?: number,
  debounceTime?: number
}

export const useCwaResourceModel = <T>(iri: Ref<string|undefined>, property: string|string[], ops?: ResourceModelOps) => {
  const proxy = getCurrentInstance()?.proxy
  const source = `input_${proxy?.$?.uid}`
  const $cwa = useCwa()
  const resource = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value : undefined)
  const applyPostfix = ref(false)
  const postfix = ref('')

  const endpoint = computed(() => `${iri.value}${postfix.value}`)

  const storeValue = computed<T|undefined>(() => (resource.value?.data ? get(resource.value.data, property) : undefined))
  const rootProperty = computed(() => {
    if (Array.isArray(property)) {
      return property[0]
    }
    return property.split('.')[0].split('[')[0]
  })
  const rootStoreValue = computed(() => (resource.value?.data ? get(resource.value.data, rootProperty.value) : undefined))

  const localValue = ref<T|undefined|null>()
  const pendingSubmit = ref(false)
  const isLongWait = ref(false)
  const submittingValue = ref<T|undefined>()

  const longWaitThreshold = ops?.longWaitThreshold || 5000
  const debounceTime = ops?.debounceTime !== undefined ? ops.debounceTime : 250
  let debounced: any

  const isBusy = computed(() => pendingSubmit.value || submitting.value)
  const submitting = computed(() => submittingValue.value !== undefined)

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

    // todo: resolve the correct iri for the endpoint we are checking with the applied querystring - should be the same unless we will be creating a new draft in a request perhaps??
    // but then would that matter, because the endpoint would be the same until then... to think about...
    isNewValueObject && await $cwa.resourcesManager.getWaitForRequestPromise(endpoint.value, rootProperty.value, source)

    if (!submitting.value && isEqual(storeValue.value, newLocalValue)) {
      pendingSubmit.value = false
      resetValue()
      return
    }
    // if updating a nested property within an object, we need to submit the object from the root, merging in the new value
    if (isNewValueObject) {
      const newObject = set({ [rootProperty.value]: { ...rootStoreValue.value } }, property, newLocalValue)
      submittingValue.value = newObject[rootProperty.value]
    } else {
      submittingValue.value = newLocalValue
    }
    pendingSubmit.value = false
    await $cwa.resourcesManager.updateResource({
      endpoint: endpoint.value,
      data: {
        [rootProperty.value]: submittingValue.value
      },
      source
    })
    isEqual(storeValue.value, submittingValue.value) && resetValue()
    submittingValue.value = undefined
  }

  function resetValue () {
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

  let longWaitTimeoutFn: ReturnType<typeof setTimeout>|undefined

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

  watchEffect(() => {
    if (!resource.value) {
      applyPostfix.value = false
      return
    }
    const publishableState = getPublishedResourceState(resource.value)
    applyPostfix.value = $cwa.admin.resourceStackManager.forcePublishedVersion.value !== undefined && publishableState === true
  })

  watch(applyPostfix, (newApplyPostfix) => {
    if (!newApplyPostfix) {
      postfix.value = ''
      return
    }
    postfix.value = $cwa.admin.resourceStackManager.forcePublishedVersion.value ? '?published=true' : '?published=false'
  }, {
    immediate: true
  })

  const model = computed<T|undefined|null>({
    get () {
      if (localValue.value !== undefined) {
        return localValue.value
      }
      return storeValue.value || null
    },
    set (value) {
      localValue.value = value
    }
  })

  return {
    states: {
      pendingSubmit,
      submitting,
      isBusy,
      isLongWait
    },
    resetValue,
    model
  }
}
