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
import { writeFieldStates } from '#cwa/resources/field-state-writer'
import type { FocusedPeer } from '#cwa/admin/presence'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'
import type { CwaResource } from '#cwa/resources/resource-utils'

export type { FocusedPeer } from '#cwa/admin/presence'

interface Change {
  value: any
  iri: string
  endpoint: string
  untrack?: () => void
}

export interface ResourceModelOps<T = any, S = any> {
  longWaitThreshold?: number
  debounceTime?: number
  get?: (stored: S | null | undefined) => T | null | undefined
  set?: (shown: T | null | undefined) => S | null | undefined
  valid?: (value: S | null | undefined) => boolean
  alsoSend?: (value: S | null | undefined, iri: string) => Record<string, unknown> | undefined
  /** @internal */
  saved?: () => void
}

const IDLE: CwaFieldState = Object.freeze({ status: 'idle', waiting: false, slow: false })

export const useCwaResourceModel = <T, S = T>(iri: Ref<string | undefined>, property: string | string[], ops?: ResourceModelOps<T, S>) => {
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
  let waitingIri: string | undefined
  let untrackPendingUpdate: (() => void) | undefined

  const requests = ref(0)
  const isSubmitting = computed(() => requests.value > 0)
  const isBusy = computed(() => pendingSubmit.value || isSubmitting.value)
  let debouncing = false
  let episode: Promise<void> | undefined
  let episodes = 0
  const queued = new Map<string, Change>()
  const state = computed<CwaFieldState>(() => resource.value?.fieldStates?.[rootProperty.value] ?? IDLE)
  const heldChange = shallowRef<{ iri: string, change: RemoteFieldChange<T> }>()
  const remoteChange = computed(() => heldChange.value?.iri === iri.value ? heldChange.value?.change : undefined)
  const realtime = realtimeView($cwa)
  const focusOwner = Symbol(source)
  const focusedBy = computed<FocusedPeer[]>(() => iri.value && realtime.view.value ? realtime.view.value.focusedBy(iri.value, rootProperty.value) : [])

  function focus() {
    const focusIri = iri.value
    focusIri && realtime.load().then(view => view?.focus(focusOwner, focusIri, rootProperty.value))
  }

  let stopWatchingOutside: (() => void) | undefined

  function blur() {
    stopWatchingOutside?.()
    stopWatchingOutside = undefined
    realtime.load().then(view => view?.blur(focusOwner))
  }

  function holds(root: Element, node: EventTarget | Element | null) {
    if (!(node instanceof Node)) {
      return false
    }
    if (root.contains(node)) {
      return true
    }
    const controls = [root, ...root.querySelectorAll('[aria-controls]')].flatMap(control => control.getAttribute('aria-controls')?.split(' ') ?? [])
    return controls.some(id => !!id && !!document.getElementById(id)?.contains(node))
  }

  function watchOutside(root: Element) {
    if (stopWatchingOutside) {
      return
    }
    const outside = (down: Event) => {
      holds(root, down.target) || holds(root, document.activeElement) || blur()
    }
    const focusMoved = (event: Event) => {
      holds(root, event.target) || blur()
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('focusin', focusMoved, true)
    stopWatchingOutside = () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('focusin', focusMoved, true)
    }
  }

  const focusListeners = {
    onFocusin: () => focus(),
    onFocusout: (event: FocusEvent) => {
      const root = event.currentTarget as Element
      if (!holds(root, event.relatedTarget)) {
        blur()
      }
      else if (!root.contains(event.relatedTarget as Node)) {
        watchOutside(root)
      }
    },
    // Safari does not focus a button, checkbox or switch on click, so focusin never fires for them
    onPointerdown: (event: PointerEvent) => {
      focus()
      watchOutside(event.currentTarget as Element)
    },
  }

  function rootValue(value: any, at = iri.value) {
    if (!isNestedProperty.value && !isObject(value)) {
      return value
    }
    const root = at === iri.value ? rootStoreValue.value : get(resourceAt(at)?.data, rootProperty.value)
    return set({ [rootProperty.value]: { ...root } }, property, value)[rootProperty.value]
  }

  function resourceAt(at: string | undefined) {
    return at === iri.value ? resource.value : at ? $cwa.resources.getResource(at).value : undefined
  }

  type States = Parameters<Parameters<typeof writeFieldStates>[0]>[0]

  function record(at: string | undefined, write: (states: States, entry: ReturnType<typeof resourceAt>, field: string) => void) {
    const field = rootProperty.value
    at && writeFieldStates(states => write(states, resourceAt(at), field))
  }

  function onRequest(sentTo: string, done?: Promise<{ resource?: CwaResource, error?: any }>) {
    if (!done) {
      record(sentTo, (states, entry, field) => states.skipped(entry, field))
      return
    }
    const field = rootProperty.value
    const sending = resourceAt(sentTo)
    writeFieldStates(states => states.started(sending, [field]))
    done.then(({ resource, error }) => writeFieldStates(states => states.settled(sending, [field], resource, error, at => $cwa.resources.getResource(at).value)))
  }

  function cancelPending() {
    debounced?.cancel()
    debouncing = false
    untrackPendingUpdate?.()
    untrackPendingUpdate = undefined
    const dropped = [iri.value, ...queued.keys()]
    queued.forEach(change => change.untrack?.())
    queued.clear()
    pendingSubmit.value = false
    new Set(dropped).forEach(at => record(at, (states, entry, field) => states.unqueued(entry, field)))
  }

  function hold(untrack?: () => void) {
    if (untrackPendingUpdate) {
      untrack?.()
      return
    }
    untrackPendingUpdate = untrack
  }

  function send(change: Change): Promise<void> {
    if (episode) {
      queued.get(change.iri)?.untrack?.()
      queued.delete(change.iri)
      queued.set(change.iri, change)
      pendingSubmit.value = true
      record(change.iri, (states, entry, field) => states.edited(entry, field))
      return episode
    }
    return start(change)
  }

  function start(change: Change): Promise<void> {
    change.untrack?.()
    const sending: Promise<void> = run(change).finally(() => {
      episode === sending && (episode = undefined)
    })
    episode = sending
    return sending
  }

  async function run(first: Change) {
    const id = ++episodes
    let change = first
    for (;;) {
      const savedAs = await updateResource(change.value, change.iri, change.endpoint)
      const [next] = queued.values()
      if (id !== episodes || !next) {
        return
      }
      queued.delete(next.iri)
      if (heldChange.value) {
        hold(next.untrack)
        return
      }
      next.untrack?.()
      change = savedAs && savedAs !== change.iri && next.iri === change.iri ? { ...next, iri: savedAs, endpoint: savedAs } : next
    }
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

  async function updateResource(newLocalValue: any, submittingIri: string | undefined, submittingEndpoint: string): Promise<string | undefined> {
    if (!submittingIri) {
      return
    }

    // consider: another field is updating the same object and the request is not complete, we could overwrite that change with the new change as we are merging objects from the root property
    // consider: it doesn't matter if THIS field is updated and there is a pending request, we can continue and override that change
    // consider: it doesn't matter if another request is in progress for a DIFFERENT property, it'll update the store value and this request will not interfere
    // consider: it is all about the external sync status of a nested object property that we should need to wait for
    const mergeFromRoot = isNestedProperty.value || isObject(newLocalValue)

    mergeFromRoot && await $cwa.resourcesManager.getWaitForRequestPromise(submittingEndpoint, rootProperty.value, source)

    if (ops?.valid && !ops.valid(newLocalValue)) {
      pendingSubmit.value = debouncing || !!queued.size
      record(submittingIri, (states, entry, field) => states.unqueued(entry, field))
      return
    }

    const submittingResource = resourceAt(submittingIri)
    const extra = submittingResource && ops?.alsoSend?.(rootValue(newLocalValue, submittingIri), submittingIri)
    const hasExtra = !!extra && Object.keys(extra).length > 0
    // if the resource has been deleted, this will trigger a store value update but we do not need to submit this
    if (submittingResource === undefined || (!isSubmitting.value && !hasExtra && isEqual(submittingResource.data ? get(submittingResource.data, property) : undefined, newLocalValue))) {
      pendingSubmit.value = debouncing || !!queued.size
      record(submittingIri, (states, entry, field) => states.skipped(entry, field))
      submittingIri === iri.value && !debouncing && isEqual(localValue.value, newLocalValue) && resetValue()
      return
    }

    requests.value++
    const submittingValue = rootValue(newLocalValue, submittingIri)

    pendingSubmit.value = debouncing || !!queued.size
    record(submittingIri, (states, entry, field) => states.unqueued(entry, field))
    let failed = false
    let local = false
    const newResource = await $cwa.resourcesManager.updateResource({
      endpoint: submittingEndpoint,
      data: {
        [rootProperty.value]: submittingValue,
        ...(hasExtra && extra),
      },
      source,
      onRequest: (sentTo, done) => {
        onRequest(sentTo, done)
        local = !done
        done?.then(({ error }) => {
          failed = !!error
        })
      },
    })
    requests.value--
    if (local || (newResource && !failed)) {
      ops?.saved?.()
    }

    const newIriReturned = newResource?.['@id'] && newResource['@id'] !== submittingIri
    if (newIriReturned) {
      moveLocalValue(submittingIri, newResource['@id'])
    }

    // we want to make sure the value is in sync with the store if we are not updating, which means resetting the locally stored variable
    // sequence of updating is:
    // local var > debounce > submitting var > store value
    isEqual(storeValue.value, submittingValue) && isEqual(storeValue.value, localValue.value) && resetValue()
    return newResource?.['@id']
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
    waitingIri && waitingIri !== iri.value && resetValue(waitingIri)
    untrackPendingUpdate?.()
    pendingSubmit.value = true
    debouncing = true
    const typedIri = iri.value
    const typedEndpoint = endpoint.value
    waitingIri = typedIri
    record(typedIri, (states, entry, field) => states.edited(entry, field))
    const submit = debounce(() => {
      debouncing = false
      if (remoteChange.value) {
        return
      }
      const untrack = untrackPendingUpdate
      untrackPendingUpdate = undefined
      typedIri && typedIri !== iri.value && resetValue(typedIri)
      return typedIri ? send({ value: newLocalValue, iri: typedIri, endpoint: typedEndpoint, untrack }) : untrack?.()
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
      const value = localValue.value
      cancelPending()
      return start({ value, iri: iri.value!, endpoint: endpoint.value })
    },
    conflict: (held) => {
      const previous = heldChange.value
      heldChange.value = held as typeof heldChange.value
      previous && record(previous.iri, (states, entry, field) => states.held(entry, field, undefined))
      held && record(held.iri, (states, entry, field) => states.held(entry, field, {
        ...(held.change.user && { user: { id: held.change.user.id, name: held.change.name } }),
        value: held.change.value,
      }))
    },
  })

  function retry() {
    if (localValue.value === undefined) {
      return Promise.resolve()
    }
    const value = localValue.value
    cancelPending()
    return send({ value, iri: iri.value!, endpoint: endpoint.value })
  }

  async function reset() {
    if (remoteChange.value) {
      remoteChange.value.accept()
      return
    }
    cancelPending()
    resetValue()
    record(iri.value, (states, entry, field) => states.cleared(entry, field))
  }

  onBeforeUnmount(() => {
    blur()
    unregisterEditor()
    unwatchLocalValue()
    unwatchIsBusy()
  })

  const map = ops?.get || ops?.set
  const shown = map
    ? computed<T | null | undefined>({
        get: () => ops.get ? ops.get(model.value as S) : model.value as T,
        set: (value) => {
          model.value = (ops.set ? ops.set(value) : value) as any
        },
      })
    : model as unknown as typeof model
  const shownRemoteChange = map && ops.get
    ? computed(() => remoteChange.value ? { ...remoteChange.value, value: ops.get!(remoteChange.value.value as unknown as S) as T } : undefined)
    : remoteChange

  return {
    state,
    retry,
    reset,
    /** @deprecated use `state` */
    states: {
      pendingSubmit,
      submitting: isSubmitting,
      isBusy,
      isLongWait,
    },
    /** @deprecated use `reset()` */
    resetValue,
    model: shown,
    localValueWithIri,
    remoteChange: shownRemoteChange,
    focus,
    blur,
    focusedBy,
    focusListeners,
  }
}
