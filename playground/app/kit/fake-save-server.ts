import { computed, reactive, ref, shallowRef } from 'vue'
import { edited, failed, held, started, succeeded, unqueued } from '../../../src/runtime/admin/field-states'
import type { CwaCurrentResourceInterface, CwaFieldState } from '../../../src/runtime/storage/stores/resources/state'
import type { FocusedPeer } from '../../../src/runtime/admin/presence'
import type { RemoteFieldChange, ResourceModelField } from '../../../src/runtime/resources/model-editors'

export type KitFailure = '422' | '500' | 'offline' | '412'

export const kitFailures: { value: KitFailure, label: string }[] = [
  { value: '422', label: '422 with field errors' },
  { value: '500', label: '500 server error' },
  { value: 'offline', label: 'Offline' },
  { value: '412', label: '412 conflict' },
]

export interface KitRequestError {
  statusCode?: number
  message?: string
  data?: Record<string, unknown>
}

export const KIT_SAVE_DELAY = 400
export const KIT_SLOW_DELAY = 4000
export const KIT_DEBOUNCE = 250

export const kitMia: FocusedPeer = { user: { id: '/_/users/mia', name: 'Mia' } as FocusedPeer['user'], name: 'Mia', colour: '#d946ef', isSelf: false, clientIds: ['kit-mia'] }

export interface FakeSaveServer {
  readonly state: { nextFailure?: KitFailure, nextRouteFailure: boolean, offline: boolean, slow: boolean, requests: number }
  theirs: Record<string, unknown>
  failNext: (failure: KitFailure | undefined) => void
  failNextRouteAction: (fail?: boolean) => void
  save: (patch: Record<string, unknown>) => Promise<void>
  routeAction: () => Promise<void>
}

function errorFor(failure: KitFailure, patch: Record<string, unknown>, theirs: Record<string, unknown>): KitRequestError {
  switch (failure) {
    case '422':
      return { statusCode: 422, message: 'Unprocessable Content', data: { violations: Object.keys(patch).map(field => ({ propertyPath: field, message: 'This value is already used by another page.' })) } }
    case '500':
      return { statusCode: 500, message: 'Internal Server Error', data: { detail: 'The server could not save it.' } }
    case '412':
      return { statusCode: 412, message: 'Precondition Failed', data: Object.fromEntries(Object.keys(patch).map(field => [field, theirs[field]])) }
    default:
      return { message: 'The connection dropped.' }
  }
}

export function createFakeSaveServer(wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): FakeSaveServer {
  const state = reactive<FakeSaveServer['state']>({ nextFailure: undefined, nextRouteFailure: false, offline: false, slow: false, requests: 0 })
  const theirs: Record<string, unknown> = {}

  async function answer() {
    state.requests++
    await wait(state.slow ? KIT_SLOW_DELAY : KIT_SAVE_DELAY)
  }

  return {
    state,
    theirs,
    failNext: (failure) => {
      state.nextFailure = failure
    },
    failNextRouteAction: (fail = true) => {
      state.nextRouteFailure = fail
    },
    save: async (patch) => {
      await answer()
      const failure = state.offline ? 'offline' : state.nextFailure
      state.nextFailure = undefined
      if (failure) {
        throw errorFor(failure, patch, theirs)
      }
    },
    routeAction: async () => {
      await answer()
      const fail = state.offline || state.nextRouteFailure
      state.nextRouteFailure = false
      if (fail) {
        throw errorFor(state.offline ? 'offline' : '500', {}, theirs)
      }
    },
  }
}

const IDLE: CwaFieldState = { status: 'idle', waiting: false, slow: false }

export interface LiveFieldModel<T> extends ResourceModelField<T> {
  model: { value: T | null | undefined }
  saved: { readonly value: T | null | undefined }
  peers: { value: FocusedPeer[] }
  remote: (value: T, peer?: FocusedPeer) => void
  force: (status: CwaFieldState['status'] | 'disabled', theirs?: T) => void
  armRemoteOnNextEdit: (value: T, peer?: FocusedPeer) => void
}

export function liveFieldModel<T>(server: FakeSaveServer, field: string, initial: T, schedule: { set: typeof setTimeout, clear: typeof clearTimeout } = { set: setTimeout, clear: clearTimeout }): LiveFieldModel<T> {
  const fresh = () => reactive({ fieldStates: {} }) as unknown as CwaCurrentResourceInterface
  const current = shallowRef(fresh())
  const local = shallowRef<T | null | undefined>(initial)
  const saved = shallowRef<T | null | undefined>(initial)
  const peers = ref<FocusedPeer[]>([])
  let timer: ReturnType<typeof setTimeout> | undefined
  let armed: { value: T, peer: FocusedPeer } | undefined

  const state = computed<CwaFieldState>(() => current.value.fieldStates?.[field] ?? IDLE)

  function clearState() {
    current.value = fresh()
  }

  async function send() {
    schedule.clear(timer)
    timer = undefined
    const entry = current.value
    unqueued(entry, field)
    const value = local.value
    started(entry, [field])
    try {
      await server.save({ [field]: value })
      saved.value = value
      succeeded(entry, [field])
    }
    catch (error) {
      const requestError = error as KitRequestError
      if (requestError.statusCode === 412) {
        const theirs = requestError.data?.[field] as T
        saved.value = theirs
        held(entry, field, { user: { id: kitMia.user.id, name: kitMia.name }, value: theirs })
      }
      failed(entry, [field], requestError)
    }
  }

  function hold(value: T, peer: FocusedPeer) {
    schedule.clear(timer)
    timer = undefined
    unqueued(current.value, field)
    saved.value = value
    held(current.value, field, { user: { id: peer.user.id, name: peer.name }, value })
  }

  const remoteChange = computed<RemoteFieldChange<T> | undefined>(() => {
    const change = state.value.held
    if (state.value.status !== 'conflict' || !change) {
      return undefined
    }
    return {
      name: change.user?.name ?? 'Someone',
      value: change.value as T,
      accept: () => {
        local.value = change.value as T
        saved.value = change.value as T
        clearState()
      },
      keep: async () => {
        held(current.value, field, undefined)
        await send()
      },
    }
  })

  return {
    field,
    model: computed({
      get: () => local.value,
      set: (value) => {
        local.value = value
        if (armed) {
          const { value: theirs, peer } = armed
          armed = undefined
          hold(theirs, peer)
          return
        }
        edited(current.value, field)
        if (state.value.status === 'conflict') {
          return
        }
        schedule.clear(timer)
        timer = schedule.set(() => void send(), KIT_DEBOUNCE)
      },
    }),
    saved: computed(() => saved.value),
    state,
    remoteChange,
    peers,
    focusedBy: computed(() => peers.value),
    retry: send,
    reset: async () => {
      schedule.clear(timer)
      timer = undefined
      local.value = saved.value
      clearState()
    },
    remote: (value, peer = kitMia) => {
      if (timer !== undefined || state.value.status === 'conflict') {
        hold(value, peer)
        return
      }
      local.value = value
      saved.value = value
    },
    armRemoteOnNextEdit: (value, peer = kitMia) => {
      armed = { value, peer }
    },
    force: (status, theirs) => {
      schedule.clear(timer)
      timer = undefined
      clearState()
      local.value = saved.value
      if (status === 'idle' || status === 'disabled') {
        return
      }
      const entry = current.value
      if (status === 'pending') {
        edited(entry, field)
        return
      }
      if (status === 'conflict') {
        hold(theirs as T, kitMia)
        return
      }
      started(entry, [field])
      if (status === 'saved') {
        succeeded(entry, [field])
      }
      if (status === 'error') {
        failed(entry, [field], { message: 'The connection dropped.' })
      }
    },
  }
}
