import { computed, getCurrentInstance, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import debounce from 'lodash-es/debounce'
import get from 'lodash-es/get'
import isObject from 'lodash-es/isObject'
import set from 'lodash-es/set'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaResourceEndpoint } from '#cwa/composables/cwa-resource-endpoint'
import { registerModelEditor } from '#cwa/resources/model-editors'
import type { RemoteFieldChange } from '#cwa/resources/model-editors'
import { realtimeView } from '#cwa/resources/realtime-view'
import type { FocusedPeer } from '#cwa/admin/presence'

export type { FocusedPeer } from '#cwa/admin/presence'

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
      return property[0] || ''
    }
    return property.split('.')[0]?.split('[')[0] || ''
  })
  const rootStoreValue = computed(() => (resource.value?.data ? get(resource.value.data, rootProperty.value) : undefined))
  const isNestedProperty = computed(() => Array.isArray(property) ? property.length > 1 : rootProperty.value !== property)

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
  let untrackPendingUpdate: (() => void) | undefined

  const isBusy = computed(() => pendingSubmit.value || isSubmitting.value)
  const isSubmitting = ref(false)
  const lastSubmittedValueInProgress = ref()
  const heldChange = shallowRef<{ iri: string, change: RemoteFieldChange<T> }>()
  const remoteChange = computed(() => heldChange.value?.iri === iri.value ? heldChange.value?.change : undefined)
  const realtime = realtimeView($cwa)
  const focusOwner = Symbol(source)
  const focusedBy = computed<FocusedPeer[]>(() => iri.value && realtime.view.value ? realtime.view.value.focusedBy(iri.value, rootProperty.value) : [])

  function focus() {
    const focusIri = iri.value
    focusIri && realtime.load().then(view => view?.focus(focusOwner, focusIri, rootProperty.value))
  }

  function blur() {
    realtime.load().then(view => view?.blur(focusOwner))
  }

  let stopWatchingOutside: (() => void) | undefined

  function leave() {
    stopWatchingOutside?.()
    stopWatchingOutside = undefined
    blur()
  }

  const focusListeners = {
    onFocusin: () => focus(),
    onFocusout: (event: FocusEvent) => {
      (event.currentTarget as Node).contains(event.relatedTarget as Node | null) || leave()
    },
    // Safari does not focus a button, checkbox or switch on click, so focusin never fires for them
    onPointerdown: (event: PointerEvent) => {
      focus()
      if (stopWatchingOutside) {
        return
      }
      const root = event.currentTarget as Node
      const outside = (down: Event) => {
        root.contains(down.target as Node | null) || root.contains(document.activeElement) || leave()
      }
      document.addEventListener('pointerdown', outside, true)
      stopWatchingOutside = () => document.removeEventListener('pointerdown', outside, true)
    },
  }

  function rootValue(value: any) {
    if (!isNestedProperty.value && !isObject(value)) {
      return value
    }
    return set({ [rootProperty.value]: { ...rootStoreValue.value } }, property, value)[rootProperty.value]
  }

  function cancelPending() {
    debounced?.cancel()
    untrackPendingUpdate?.()
    untrackPendingUpdate = undefined
    pendingSubmit.value = false
  }

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
    const mergeFromRoot = isNestedProperty.value || isObject(newLocalValue)

    // todo: resolve the correct iri for the endpoint we are checking with the applied querystring -
    //  should be the same unless we will be creating a new draft in a request perhaps??
    //  ...but then would that matter, because the endpoint would be the same until then... to think about...
    mergeFromRoot && await $cwa.resourcesManager.getWaitForRequestPromise(endpoint.value, rootProperty.value, source)

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
    const submittingValue = rootValue(newLocalValue)
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
      moveLocalValue(submittingIri, newResource['@id'])
    }

    // we want to make sure the value is in sync with the store if we are not updating, which means resetting the locally stored variable
    // sequence of updating is:
    // local var > debounce > submitting var > store value
    isEqual(storeValue.value, submittingValue) && isEqual(storeValue.value, localValue.value) && resetValue()
  }

  function moveLocalValue(from: string, to: string) {
    localValueWithIri.value[to] = localValueWithIri.value[from]
    resetValue(from)
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
    untrackPendingUpdate?.()
    pendingSubmit.value = true
    const typedIri = iri.value
    const submit = debounce(() => {
      if (remoteChange.value) {
        return
      }
      untrackPendingUpdate?.()
      typedIri && typedIri !== iri.value && resetValue(typedIri)
      return updateResource(newLocalValue)
    }, debounceTime)
    debounced = submit
    untrackPendingUpdate = iri.value ? $cwa.resourcesManager.registerPendingUpdate(iri.value, (keepConflict = true) => remoteChange.value ? keepConflict && remoteChange.value.keep() : submit.flush()) : undefined
    submit()
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
      if (storeValue.value === undefined) {
        return null
      }
      return storeValue.value
    },
    set(value) {
      localValue.value = value
    },
  })

  const unregisterEditor = registerModelEditor($cwa, {
    iri: () => iri.value,
    field: () => rootProperty.value,
    value: data => get(data, property),
    hasLocalChange: () => localValue.value !== undefined,
    hasUnsentChange: () => pendingSubmit.value || (localValue.value !== undefined && !isSubmitting.value),
    localPatch: () => rootValue(localValue.value),
    discardLocal: () => {
      cancelPending()
      resetValue()
    },
    adopt: (value) => {
      localValue.value = value as T
    },
    moveTo: moveLocalValue,
    submit: () => {
      cancelPending()
      return updateResource(localValue.value)
    },
    conflict: (held) => {
      heldChange.value = held as typeof heldChange.value
    },
  })

  onBeforeUnmount(() => {
    leave()
    unregisterEditor()
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
    remoteChange,
    focus,
    blur,
    focusedBy,
    focusListeners,
  }
}
