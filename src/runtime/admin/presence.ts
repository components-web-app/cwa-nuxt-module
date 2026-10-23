import { consola as logger } from 'consola'
import { computed, reactive, watch } from 'vue'
import type { FetchError } from 'ofetch'
import type { Router } from 'vue-router'
import type Cwa from '#cwa/cwa'
import { retryAfterSeconds } from '#cwa/api/retry-after'
import type { CwaResourcesStoreInterface } from '#cwa/storage/stores/resources/resources-store'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'

export type PresenceActivity = 'viewing' | 'selected' | 'editing' | 'idle' | 'left'

export interface PresenceData {
  v: 1
  page: string
  state: PresenceActivity
  component?: string
  componentPosition?: string
  pageData?: string
  field?: string
  device?: string
  hello?: true
}

export interface PresenceUser {
  id: string
  name?: string
}

export interface PresencePeer {
  clientId: string
  user: PresenceUser
  state: PresenceActivity
  page: string
  component?: string
  componentPosition?: string
  pageData?: string
  field?: string
  isSelf: boolean
  device?: string
  receivedAt: number
  ttlMs: number
}

export interface RealtimePeer {
  clientId: string
  user: PresenceUser
  name: string
  state: PresenceActivity
  field?: string
  expiresAt: number
  colour: string
  isSelf: boolean
  idle: boolean
  device?: string
}

export interface FocusedPeer {
  user: PresenceUser
  name: string
  colour: string
  isSelf: boolean
  clientIds: string[]
}

export interface RealtimeMessage<Data = unknown> {
  clientId: string
  user: PresenceUser
  name: string
  isSelf: boolean
  colour: string
  event: string
  data: Data
  sentAt?: string
}

export type RealtimeEventHandler<Data = unknown> = (message: RealtimeMessage<Data>) => void

export interface RealtimeEvent {
  '@type'?: string
  'v'?: number
  'clientId'?: string
  'user'?: PresenceUser
  'event'?: string
  'iri'?: string | null
  'data'?: Partial<PresenceData> | null
  'sentAt'?: string
  'expiresAt'?: string
}

interface PresenceState {
  active: boolean
  paused: boolean
  idle: boolean
  page: string | undefined
  peers: Record<string, PresencePeer>
  names: Record<string, string>
  focus: { owner: symbol, iri: string, field: string } | undefined
}

interface Listener {
  iri: () => string | undefined
  event: string
  handler: RealtimeEventHandler
}

interface Outgoing {
  iri: string
  event: string
  data: unknown
}

interface Request {
  body: Record<string, unknown>
  refused: string
  failed: (retry: boolean) => void
}

const REALTIME_PATH = '/_/realtime'
const THROTTLE_MS = 250
const REQUEST_GAP_MS = 125
const HEARTBEAT_MS = 15_000
const IDLE_HEARTBEAT_MS = 60_000
const IDLE_KEEP_MS = 3 * IDLE_HEARTBEAT_MS
const IDLE_AFTER_MS = 5 * 60_000
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'focusin']
const HELLO_JITTER_MS = 2_000
const MAX_BACKOFF_MS = 60_000
const DEFAULT_TTL_MS = 45_000
const PALETTE = ['#c084fc', '#14b8a6', '#4ade80', '#22d3ee', '#f87171']
export const SELF_COLOUR = '#a8a29e'
const BROWSERS: [RegExp, string][] = [[/Edg(e|A|iOS)?\//, 'Edge'], [/OPR\//, 'Opera'], [/Firefox\/|FxiOS/, 'Firefox'], [/Chrome\/|CriOS/, 'Chrome'], [/Safari\//, 'Safari']]
const SYSTEMS: [RegExp, string][] = [[/iPhone|iPad|iPod/, 'iOS'], [/Android/, 'Android'], [/CrOS/, 'ChromeOS'], [/Mac OS X|Macintosh/, 'macOS'], [/Windows/, 'Windows'], [/Linux/, 'Linux']]

const states = new WeakMap<Cwa, PresenceState>()
const listeners = new WeakMap<Cwa, Set<Listener>>()
const transports = new WeakMap<Cwa, Presence>()

function listenersOf($cwa: Cwa) {
  let set = listeners.get($cwa)
  if (!set) {
    set = new Set()
    listeners.set($cwa, set)
  }
  return set
}

function presenceState($cwa: Cwa): PresenceState {
  let state = states.get($cwa)
  if (!state) {
    state = reactive({ active: false, paused: false, idle: false, page: undefined, peers: {}, names: {}, focus: undefined })
    states.set($cwa, state)
  }
  return state
}

function serverTime(value: unknown) {
  return typeof value === 'string' ? Date.parse(value.replace(/(\.\d{3})\d+/, '$1')) : Number.NaN
}

export function presenceColour(userId: string) {
  let hash = 0
  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!
}

export function peerColour(peer: { user: PresenceUser, isSelf: boolean }) {
  return peer.isSelf ? SELF_COLOUR : presenceColour(peer.user.id)
}

export function peerName(name: string | undefined, isSelf: boolean) {
  return isSelf ? 'You (other window)' : name || 'Someone'
}

export function deviceLabel(userAgent: string): string | undefined {
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1]
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1]
  return [browser, system].filter(Boolean).join(' on ') || undefined
}

export function usePresence($cwa: Cwa) {
  const state = presenceState($cwa)
  const peers = computed(() => state.active ? Object.values(state.peers) : [])
  const peersOn = (iri: string) => {
    const iris = $cwa.resources.findAllPublishableIris(iri)
    return peers.value.filter(peer => [peer.component, peer.componentPosition].some(on => !!on && iris.includes(on)))
  }
  return {
    active: computed(() => state.active),
    paused: computed(() => state.active && state.paused),
    onThisPage: computed(() => peers.value.filter(peer => peer.page === state.page)),
    elsewhere: computed(() => peers.value.filter(peer => peer.page !== state.page)),
    nameOf: (userId: string): string | undefined => state.names[userId],
    peers: (iri: string): RealtimePeer[] => peersOn(iri).map(peer => ({
      clientId: peer.clientId,
      user: { ...peer.user },
      name: peerName(peer.user.name, peer.isSelf),
      state: peer.state,
      ...(peer.field ? { field: peer.field } : {}),
      expiresAt: peer.receivedAt + peer.ttlMs,
      colour: peerColour(peer),
      isSelf: peer.isSelf,
      idle: peer.state === 'idle',
      ...(peer.device ? { device: peer.device } : {}),
    })),
    focusedBy: (iri: string, field: string): FocusedPeer[] => {
      const byUser = new Map<string, FocusedPeer>()
      for (const peer of peersOn(iri).filter(peer => peer.field === field)) {
        const focused = byUser.get(peer.user.id) ?? { user: { ...peer.user }, name: peerName(peer.user.name, peer.isSelf), colour: peerColour(peer), isSelf: peer.isSelf, clientIds: [] }
        focused.clientIds.push(peer.clientId)
        byUser.set(peer.user.id, focused)
      }
      return [...byUser.values()]
    },
    focus: (owner: symbol, iri: string, field: string) => {
      state.focus = { owner, iri, field }
    },
    blur: (owner: symbol) => {
      if (state.focus?.owner === owner) {
        state.focus = undefined
      }
    },
    send: (iri: string, event: string, data: unknown): boolean => transports.get($cwa)?.emit(iri, event, data) ?? false,
    on: (iri: () => string | undefined, event: string, handler: RealtimeEventHandler) => {
      const listener = { iri, event, handler }
      listenersOf($cwa).add(listener)
      return () => {
        listenersOf($cwa).delete(listener)
      }
    },
  }
}

export class Presence {
  private readonly state: PresenceState
  private readonly warned = new Set<string>()
  private readonly outbox = new Map<string, Outgoing>()
  private readonly device = deviceLabel(navigator.userAgent)
  private lastActivity = 0
  private running = false
  private disabled = false
  private dirty = false
  private inFlight = false
  private hello = false
  private repeat = false
  private lastKey: string | undefined
  private lastSent = Number.NEGATIVE_INFINITY
  private lastPresence = Number.NEGATIVE_INFINITY
  private blockedUntil = 0
  private failures = 0
  private sendTimer?: ReturnType<typeof setTimeout>
  private helloTimer?: ReturnType<typeof setTimeout>
  private heartbeat?: ReturnType<typeof setInterval>
  private pruner?: ReturnType<typeof setTimeout>
  private unwatch?: () => void
  private readonly onPageHide = () => this.sendLeft()
  private readonly onPageShow = (event: PageTransitionEvent) => event.persisted && this.announce(true)
  private readonly onVisibilityChange = () => this.setIdle(document.visibilityState === 'hidden')
  private readonly onActivity = () => {
    this.lastActivity = Date.now()
    document.visibilityState !== 'hidden' && this.setIdle(false)
  }

  constructor(
    private readonly $cwa: Cwa,
    private readonly store: CwaResourcesStoreInterface,
    private readonly router: Router,
    private readonly clientId: string,
  ) {
    this.state = presenceState($cwa)
    transports.set($cwa, this)
  }

  public start(connected: boolean) {
    if (this.running || this.disabled) {
      return
    }
    this.running = true
    this.state.active = true
    this.state.paused = !connected
    this.state.idle = document.visibilityState === 'hidden'
    this.lastActivity = Date.now()
    this.state.page = this.current().page
    this.unwatch = watch(() => JSON.stringify(this.current()), (key) => {
      this.state.page = (JSON.parse(key) as PresenceData).page
      this.announce()
    }, { flush: 'sync' })
    this.beat()
    this.schedulePrune()
    window.addEventListener('pagehide', this.onPageHide)
    window.addEventListener('pageshow', this.onPageShow)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    ACTIVITY_EVENTS.forEach(type => window.addEventListener(type, this.onActivity, { capture: true, passive: true }))
    this.announce(true)
  }

  public stop() {
    this.running = false
    this.dirty = false
    this.hello = false
    this.lastKey = undefined
    this.unwatch?.()
    clearTimeout(this.sendTimer)
    clearTimeout(this.helloTimer)
    clearInterval(this.heartbeat)
    clearTimeout(this.pruner)
    this.sendTimer = this.helloTimer = this.heartbeat = this.pruner = this.unwatch = undefined
    this.outbox.clear()
    window.removeEventListener('pagehide', this.onPageHide)
    window.removeEventListener('pageshow', this.onPageShow)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    ACTIVITY_EVENTS.forEach(type => window.removeEventListener(type, this.onActivity, { capture: true }))
    this.state.active = false
    this.state.idle = false
    this.state.peers = {}
    this.state.names = {}
  }

  public paused() {
    this.state.paused = true
    this.outbox.clear()
  }

  public resumed() {
    this.state.paused = false
    this.announce(true)
  }

  public emit(iri: string, event: string, data: unknown) {
    if (!this.running || this.state.paused) {
      return false
    }
    const published = this.store.findPublishedComponentIri(iri) ?? iri
    this.outbox.set(JSON.stringify([published, event]), { iri: published, event, data })
    this.schedule()
    return true
  }

  public receive(event: RealtimeEvent) {
    const { clientId, user, data } = event
    if (!this.running || event.v !== 1 || !clientId || clientId === this.clientId || !user?.id) {
      return
    }
    if (event.event !== 'presence') {
      this.dispatch(event, clientId, user)
      return
    }
    if (!data) {
      return
    }
    if (user.name) {
      this.state.names[user.id] = user.name
    }
    if (data.state === 'left') {
      delete this.state.peers[clientId]
      return
    }
    const lifetimeMs = serverTime(event.expiresAt) - serverTime(event.sentAt)
    const ttlMs = lifetimeMs > 0 ? lifetimeMs : DEFAULT_TTL_MS
    const isSelf = user.id === this.$cwa.auth.user?.['@id']
    this.state.peers[clientId] = {
      clientId,
      user: { ...user },
      state: data.state ?? 'viewing',
      page: data.page ?? '',
      component: data.component,
      componentPosition: data.componentPosition,
      pageData: data.pageData,
      field: data.field,
      isSelf,
      ...(isSelf && data.device ? { device: data.device } : {}),
      receivedAt: Date.now(),
      ttlMs: data.state === 'idle' ? Math.max(ttlMs, IDLE_KEEP_MS) : ttlMs,
    }
    this.schedulePrune()
    if (data.hello && !this.helloTimer) {
      this.helloTimer = setTimeout(() => {
        this.helloTimer = undefined
        this.announce(false, true)
      }, Math.random() * HELLO_JITTER_MS)
    }
  }

  private page() {
    const route = this.router.currentRoute.value
    if (route.meta.cwa?.admin) {
      return route.path
    }
    if (this.state.page && !getResourceTypeFromIri(this.state.page) && this.$cwa.resources.isLoading.value) {
      return this.state.page
    }
    return this.$cwa.resources.displayPageIri.value ?? route.path
  }

  private current(): PresenceData {
    const data: PresenceData = { v: 1, page: this.page(), state: 'viewing', ...(this.device ? { device: this.device } : {}) }
    const stackManager = this.$cwa.admin.resourceStackManager
    const selected = stackManager.currentIri.value
    const type = selected ? getResourceTypeFromIri(selected) : undefined
    if (!selected || (type !== CwaResourceTypes.COMPONENT && type !== CwaResourceTypes.COMPONENT_POSITION)) {
      return this.idled(data)
    }
    data.state = 'selected'
    if (type === CwaResourceTypes.COMPONENT) {
      data.component = this.store.findPublishedComponentIri(selected) ?? selected
    }
    const position = type === CwaResourceTypes.COMPONENT_POSITION ? selected : stackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_POSITION)
    const iris: (string | undefined)[] = [...this.store.findAllPublishableIris(selected)]
    if (position) {
      data.componentPosition = position
      const positionData = this.store.current.byId[position]?.data
      const pageData = positionData?._metadata?.isDynamicPosition ? this.$cwa.resources.pageDataIriOf(position).value : undefined
      if (pageData) {
        data.pageData = pageData
      }
      iris.push(position, positionData?.componentGroup)
    }
    const focus = this.state.focus
    if (focus && iris.includes(focus.iri)) {
      data.state = 'editing'
      data.field = focus.field
    }
    else if (iris.some(iri => iri && this.$cwa.resourcesManager.isUpdating(iri))) {
      data.state = 'editing'
    }
    return this.idled(data)
  }

  private idled(data: PresenceData): PresenceData {
    if (!this.state.idle) {
      return data
    }
    const { field: _field, ...rest } = data
    return { ...rest, state: 'idle' }
  }

  private setIdle(idle: boolean) {
    if (this.state.idle === idle) {
      return
    }
    this.state.idle = idle
    this.lastActivity = Date.now()
    this.running && this.beat()
  }

  private beat() {
    clearInterval(this.heartbeat)
    this.heartbeat = setInterval(() => this.announce(false, true), this.state.idle ? IDLE_HEARTBEAT_MS : HEARTBEAT_MS)
  }

  private announce(hello = false, repeat = hello) {
    this.hello ||= hello
    this.repeat ||= repeat
    this.dirty = true
    this.schedule()
  }

  private schedule() {
    if (!this.running || this.sendTimer || this.inFlight || (!this.dirty && !this.outbox.size)) {
      return
    }
    const due = this.outbox.size ? 0 : this.lastPresence + THROTTLE_MS
    const wait = Math.max(due, this.lastSent + REQUEST_GAP_MS, this.blockedUntil) - Date.now()
    this.sendTimer = setTimeout(() => {
      this.sendTimer = undefined
      this.send()
    }, Math.max(wait, 0))
  }

  private async send() {
    const request = (this.dirty && Date.now() >= this.lastPresence + THROTTLE_MS && this.presenceRequest()) || this.eventRequest()
    if (!request) {
      this.schedule()
      return
    }
    this.lastSent = Date.now()
    this.inFlight = true
    try {
      await this.$cwa.cwaFetch.fetch(REALTIME_PATH, {
        method: 'POST',
        body: { clientId: this.clientId, ...request.body },
        retry: 0,
        onResponse: () => {},
      })
      this.failures = 0
    }
    catch (error) {
      request.failed(this.failed(error as FetchError, request.refused))
    }
    finally {
      this.inFlight = false
    }
    this.schedule()
  }

  private presenceRequest(): Request | undefined {
    const current = this.current()
    const key = JSON.stringify(current)
    const { hello, repeat } = this
    this.dirty = this.hello = this.repeat = false
    if (!repeat && key === this.lastKey) {
      return
    }
    this.lastKey = key
    this.lastPresence = Date.now()
    return {
      body: { event: 'presence', data: hello ? { ...current, hello: true } : current },
      refused: 'a real-time presence update',
      failed: (retry) => {
        this.lastKey = undefined
        if (retry) {
          this.dirty = true
          this.hello ||= hello
        }
      },
    }
  }

  private eventRequest(): Request | undefined {
    const [key, outgoing] = this.outbox.entries().next().value ?? []
    if (!key || !outgoing) {
      return
    }
    this.outbox.delete(key)
    const { iri, event, data } = outgoing
    return {
      body: { event, iri, data },
      refused: `the real-time "${event}" event`,
      failed: retry => retry && !this.outbox.has(key) && this.outbox.set(key, outgoing),
    }
  }

  private dispatch(event: RealtimeEvent, clientId: string, user: PresenceUser) {
    const { iri } = event
    const isSelf = user.id === this.$cwa.auth.user?.['@id']
    const message: RealtimeMessage = { clientId, user: { ...user }, name: peerName(user.name, isSelf), isSelf, colour: peerColour({ user, isSelf }), event: event.event!, data: event.data, sentAt: event.sentAt }
    for (const listener of [...listenersOf(this.$cwa)]) {
      const on = listener.iri()
      if (listener.event === event.event && on && iri && this.$cwa.resources.findAllPublishableIris(on).includes(iri)) {
        try {
          listener.handler(message)
        }
        catch (error) {
          logger.error(`A handler for the real-time "${event.event}" event threw.`, error)
        }
      }
    }
  }

  private failed(error: FetchError, refused: string) {
    const status = error.response?.status
    if (status === 401 || status === 403) {
      this.stop()
      return false
    }
    if (status === 404 || status === 405) {
      this.disabled = true
      this.stop()
      this.warnOnce('off', 'Real-time presence is turned off on the API, so other editors will not be shown.')
      return false
    }
    if (status && status !== 429 && status < 500) {
      this.warnOnce(refused, `The API refused ${refused} (${status}).`)
      return false
    }
    const retryAfter = status === 429 ? retryAfterSeconds(error) : undefined
    if (retryAfter !== undefined) {
      this.blockedUntil = Date.now() + retryAfter * 1000
    }
    else {
      this.blockedUntil = Date.now() + Math.min(1000 * 2 ** this.failures, MAX_BACKOFF_MS)
      this.failures++
    }
    return true
  }

  private warnOnce(key: string, message: string) {
    if (this.warned.has(key)) {
      return
    }
    this.warned.add(key)
    logger.warn(message)
  }

  private prune() {
    const now = Date.now()
    now - this.lastActivity >= IDLE_AFTER_MS && this.setIdle(true)
    for (const [clientId, peer] of Object.entries(this.state.peers)) {
      if (now >= peer.receivedAt + peer.ttlMs) {
        delete this.state.peers[clientId]
      }
    }
    this.schedulePrune()
  }

  private schedulePrune() {
    clearTimeout(this.pruner)
    const due = Math.min(this.lastActivity + IDLE_AFTER_MS, ...Object.values(this.state.peers).map(peer => peer.receivedAt + peer.ttlMs))
    this.pruner = setTimeout(() => this.prune(), due - Date.now())
  }

  private sendLeft() {
    if (!this.running || typeof navigator.sendBeacon !== 'function') {
      return
    }
    const body = { clientId: this.clientId, event: 'presence', data: { v: 1, page: this.state.page, state: 'left' } }
    try {
      navigator.sendBeacon(`${this.$cwa.apiUrlBase.replace(/\/+$/, '')}${REALTIME_PATH}`, new Blob([JSON.stringify(body)], { type: 'text/plain' }))
    }
    catch {
      return
    }
  }
}
