import type { CwaCurrentResourceInterface, CwaFieldState } from '#cwa/storage/stores/resources/state'
import type { CwaResource } from '#cwa/resources/resource-utils'

type Entry = CwaCurrentResourceInterface | undefined

interface RequestError {
  statusCode?: number
  message?: string
  data?: any
}

interface Flight {
  count: number
  timer?: ReturnType<typeof setTimeout>
}

const SLOW_AFTER = 1000
const PRECONDITION_FAILED = 'Someone else saved this first, so your change was not saved.'

const flights = new WeakMap<object, Map<string, Flight>>()

function flightOf(entry: object, field: string): Flight {
  let fields = flights.get(entry)
  if (!fields) {
    fields = new Map()
    flights.set(entry, fields)
  }
  let flight = fields.get(field)
  if (!flight) {
    flight = { count: 0 }
    fields.set(field, flight)
  }
  return flight
}

function stateOf(entry: CwaCurrentResourceInterface, field: string): CwaFieldState | undefined {
  return entry.fieldStates?.[field]
}

function put(entry: CwaCurrentResourceInterface, field: string, state: CwaFieldState | undefined) {
  if (state) {
    entry.fieldStates = { ...entry.fieldStates, [field]: state }
    return
  }
  if (entry.fieldStates && field in entry.fieldStates) {
    const { [field]: _removed, ...rest } = entry.fieldStates
    entry.fieldStates = rest
  }
}

function base(state: CwaFieldState | undefined): CwaFieldState {
  return { status: state?.status ?? 'idle', waiting: !!state?.waiting, slow: !!state?.slow }
}

function settle(entry: CwaCurrentResourceInterface, field: string) {
  const flight = flightOf(entry, field)
  flight.count = Math.max(0, flight.count - 1)
  if (!flight.count) {
    clearTimeout(flight.timer)
    flight.timer = undefined
  }
  return flight.count
}

function violationOf(error: RequestError, field: string): string | undefined {
  const violations: { propertyPath?: string, message?: string }[] = error.data?.violations ?? []
  return violations.find(({ propertyPath }) => propertyPath === field || !!propertyPath?.startsWith(`${field}.`) || !!propertyPath?.startsWith(`${field}[`))?.message
}

function errorOf(error: RequestError, field: string): NonNullable<CwaFieldState['error']> {
  const status = error.statusCode
  if (status === 412) {
    return { kind: 'precondition', status, message: PRECONDITION_FAILED }
  }
  if (!status) {
    return { kind: 'network', message: error.message || 'The request could not be sent.' }
  }
  const detail = error.data?.detail || error.data?.description || error.message || 'The server could not save it.'
  if (error.data?.violations) {
    return { kind: 'violation', status, message: violationOf(error, field) ?? detail }
  }
  return { kind: 'server', status, message: detail }
}

export function edited(entry: Entry, field: string) {
  if (!entry) {
    return
  }
  const state = stateOf(entry, field)
  const keep = state?.status === 'saving' || state?.status === 'conflict'
  put(entry, field, {
    ...base(state),
    status: keep ? state!.status : 'pending',
    waiting: true,
    ...(state?.status === 'conflict' && { error: state.error, held: state.held }),
  })
}

export function unqueued(entry: Entry, field: string) {
  const state = entry && stateOf(entry, field)
  if (entry && state) {
    put(entry, field, state.status === 'pending' && !flightOf(entry, field).count ? undefined : { ...state, waiting: false })
  }
}

export function skipped(entry: Entry, field: string) {
  const state = entry && stateOf(entry, field)
  if (!entry || !state || flightOf(entry, field).count) {
    unqueued(entry, field)
    return
  }
  if (state.status === 'pending') {
    put(entry, field, undefined)
    return
  }
  put(entry, field, state.status === 'saving' ? { ...base(state), status: 'saved', waiting: false, savedAt: Date.now() } : { ...state, waiting: false })
}

export function started(entry: Entry, fields: string[]) {
  if (!entry) {
    return
  }
  for (const field of fields) {
    const flight = flightOf(entry, field)
    flight.count++
    if (!flight.timer) {
      flight.timer = setTimeout(() => {
        const state = stateOf(entry, field)
        flight.count && state && put(entry, field, { ...state, slow: true })
      }, SLOW_AFTER)
    }
    put(entry, field, { ...base(stateOf(entry, field)), status: 'saving' })
  }
}

export function succeeded(entry: Entry, fields: string[], to: Entry = entry) {
  if (!entry) {
    return
  }
  for (const field of fields) {
    const inFlight = settle(entry, field)
    const state = stateOf(entry, field)
    const next: CwaFieldState = state?.held
      ? { ...state, slow: !!inFlight && state.slow }
      : {
          ...base(state),
          status: inFlight || state?.waiting ? 'saving' : 'saved',
          slow: !!inFlight && !!state?.slow,
          savedAt: Date.now(),
        }
    put(entry, field, undefined)
    put(to ?? entry, field, next)
  }
}

export function failed(entry: Entry, fields: string[], error: RequestError, to: Entry = entry) {
  if (!entry) {
    return
  }
  const target = to ?? entry
  for (const field of fields) {
    const inFlight = settle(entry, field)
    const state = stateOf(entry, field)
    const own = target === entry ? state : stateOf(target, field)
    const fieldError = errorOf(error, field)
    const heldValue = own?.held
    put(entry, field, undefined)
    put(target, field, {
      ...base(state),
      waiting: !!state?.waiting || !!own?.waiting,
      slow: !!inFlight && !!state?.slow,
      status: heldValue ? 'conflict' : 'error',
      error: fieldError,
      ...(heldValue && { held: heldValue }),
    })
  }
}

export function settled(entry: Entry, fields: string[], response: CwaResource | undefined, error: RequestError | undefined, find: (iri: string) => Entry) {
  const answered = error ? error.statusCode === 412 && error.data?.['@id'] : response?.['@id']
  const to = typeof answered === 'string' ? find(answered) : undefined
  error ? failed(entry, fields, error, to) : succeeded(entry, fields, to)
}

export function held(entry: Entry, field: string, change: CwaFieldState['held']) {
  if (!entry) {
    return
  }
  const state = stateOf(entry, field)
  if (change) {
    put(entry, field, { ...base(state), status: 'conflict', held: change })
    return
  }
  if (!state) {
    return
  }
  const status = flightOf(entry, field).count ? 'saving' : state.waiting ? 'pending' : undefined
  put(entry, field, status ? { ...base(state), status } : undefined)
}

export function cleared(entry: Entry, field: string) {
  entry && put(entry, field, undefined)
}

export interface FailedSave {
  iri: string
  field: string
  label: () => string
  retry: () => void
  reset: () => void
}

const failures = new WeakMap<object, { saves: Map<string, FailedSave>, listeners: Set<() => void> }>()

function failuresOf(owner: object) {
  let registry = failures.get(owner)
  if (!registry) {
    registry = { saves: new Map(), listeners: new Set() }
    failures.set(owner, registry)
  }
  return registry
}

function failedSaveKey(save: FailedSave) {
  return `${save.iri} ${save.field}`
}

export function failedSaves(owner: object): ReadonlyMap<string, FailedSave> {
  return failuresOf(owner).saves
}

export function onFailedSavesChange(owner: object, listener: () => void) {
  const { listeners } = failuresOf(owner)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function changed(owner: object) {
  failuresOf(owner).listeners.forEach(listener => listener())
}

export function trackFailedSave(owner: object, save: FailedSave) {
  failuresOf(owner).saves.set(failedSaveKey(save), save)
  changed(owner)
}

export function forgetFailedSave(owner: object, save: FailedSave) {
  const { saves } = failuresOf(owner)
  const key = failedSaveKey(save)
  if (saves.get(key) === save) {
    saves.delete(key)
    changed(owner)
  }
}
