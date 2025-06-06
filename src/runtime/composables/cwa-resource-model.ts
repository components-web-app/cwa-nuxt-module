import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue'
import type { Ref } from 'vue'
import debounce from 'lodash-es/debounce'
import get from 'lodash-es/get'
import isObject from 'lodash-es/isObject'
import set from 'lodash-es/set'
import { useCwa } from '#cwa/runtime/composables/cwa'
import { useCwaResourceEndpoint } from '#cwa/runtime/composables/cwa-resource-endpoint'

interface ResourceModelOps {
  longWaitThreshold?: number
  debounceTime?: number
}

export const useCwaResourceModel = <T>(iri: Ref<string | undefined>, property: string | string[], ops?: ResourceModelOps) => {
  const proxy = getCurrentInstance()?.proxy
  const source = `input_${proxy?.$?.uid}`
  const $cwa = useCwa()
  const resource = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value : undefined)

  const { endpoint } = useCwaResourceEndpoint(iri)

  const storeValue = computed<T | undefined>(() => (resource.value?.data ? get(resource.value.data, property) : undefined))
  const rootProperty = computed(() => {
    if (Array.isArray(property)) {
      return property[0]
    }
    return property.split('.')[0].split('[')[0]
  })
  const rootStoreValue = computed(() => (resource.value?.data ? get(resource.value.data, rootProperty.value) : undefined))

  const localValueWithIri = ref<{ [iri: string]: T | null | undefined }>({})
  const localValue = computed({
    get() {
      if (!iri.value) {
        return undefined
      }
      return localValueWithIri.value[iri.value]
    },
    set(newValue: T | null | undefined) {
      if (!iri.value) {
        return
      }
      localValueWithIri.value[iri.value] = newValue
    },
  })

  const pendingSubmit = ref(false)
  const isLongWait = ref(false)

  const longWaitThreshold = ops?.longWaitThreshold || 5000
  const debounceTime = ops?.debounceTime !== undefined ? ops.debounceTime : 250
  let debounced: any

  const isBusy = computed(() => pendingSubmit.value || isSubmitting.value)
  const isSubmitting = ref(false)
  const lastSubmittedValueInProgress = ref()

  function isEqual(value1: any, value2: any) {
    function requiresNormalizing(value: any) {
      const type = typeof value
      return value !== undefined && value !== null && (type === 'object' || Array.isArray(value))
    }

    function getNormalizedValue(value: any): string | null | undefined {
      return requiresNormalizing(value) ? JSON.stringify(value) : value
    }

    return getNormalizedValue(value1) === getNormalizedValue(value2)
  }

  async function updateResource(newLocalValue: any) {
    const submittingIri = iri.value
    if (!submittingIri) {
      return
    }

    // consider: another field is updating the same object and the request is not complete, we could overwrite that change with the new change as we are merging objects from the root property
    // consider: it doesn't matter if THIS field is updated and there is a pending request, we can continue and override that change
    // consider: it doesn't matter if another request is in progress for a DIFFERENT property, it'll update the store value and this request will not interfere
    // consider: it is all about the external sync status of a nested object property that we should need to wait for
    const isNewValueObject = isObject(newLocalValue)

    // todo: resolve the correct iri for the endpoint we are checking with the applied querystring -
    //  should be the same unless we will be creating a new draft in a request perhaps??
    //  ...but then would that matter, because the endpoint would be the same until then... to think about...
    isNewValueObject && await $cwa.resourcesManager.getWaitForRequestPromise(endpoint.value, rootProperty.value, source)

    // if we are already submitting this value, just skip - we shouldn't really get here
    // if the resource has been deleted, this will trigger a store value update but we do not need to submit this
    if (
      resource.value === undefined
      || (isSubmitting.value && isEqual(lastSubmittedValueInProgress.value, newLocalValue))
    ) {
      resetValue()
      return
    }

    // if we are submitting already, then we will already be updating the store value in a moment,
    // so the equality check would be invalid
    if (!isSubmitting.value && isEqual(storeValue.value, newLocalValue)) {
      pendingSubmit.value = false
      resetValue()
      return
    }

    isSubmitting.value = true
    let submittingValue
    // if updating a nested property within an object, we need to submit the object from the root, merging in the new value
    if (isNewValueObject) {
      const newObject = set({ [rootProperty.value]: { ...rootStoreValue.value } }, property, newLocalValue)
      submittingValue = newObject[rootProperty.value]
    }
    else {
      submittingValue = newLocalValue
    }
    lastSubmittedValueInProgress.value = submittingValue

    pendingSubmit.value = false
    const newResource = await $cwa.resourcesManager.updateResource({
      endpoint: endpoint.value,
      data: {
        [rootProperty.value]: submittingValue,
      },
      source,
    })
    isSubmitting.value = false

    // todo: check on when second request made before initial is complete
    const newIriReturned = newResource?.['@id'] && newResource['@id'] !== submittingIri
    if (newIriReturned) {
      localValueWithIri.value[newResource['@id']] = localValueWithIri.value[submittingIri]
      resetValue(submittingIri)
    }

    // we want to make sure the value is in sync with the store if we are not updating, which means resetting the locally stored variable
    // sequence of updating is:
    // local var > debounce > submitting var > store value
    isEqual(storeValue.value, submittingValue) && isEqual(storeValue.value, localValue.value) && resetValue()
  }

  function resetValue(resetIri?: string) {
    const useIri = resetIri || iri.value
    if (!useIri) {
      return
    }
    localValueWithIri.value[useIri] = undefined
  }

  const unwatchLocalValue = watch(localValue, (newLocalValue) => {
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

  let longWaitTimeoutFn: ReturnType<typeof setTimeout> | undefined

  const unwatchIsBusy = watch(isBusy, (newBusy) => {
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

  const model = computed<T | undefined | null>({
    get() {
      if (localValue.value !== undefined) {
        return localValue.value
      }
      // when deleted, the store value is updating to undefined, then this model getter is null
      return storeValue.value || null
    },
    set(value) {
      localValue.value = value
    },
  })

  onBeforeUnmount(() => {
    unwatchLocalValue()
    unwatchIsBusy()
  })

  return {
    states: {
      pendingSubmit,
      submitting: isSubmitting,
      isBusy,
      isLongWait,
    },
    resetValue,
    model,
    localValueWithIri,
  }
}
