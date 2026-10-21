import { consola as logger } from 'consola'
import { computed, reactive, watch } from 'vue'
import type { FetchError } from 'ofetch'
import type { Router } from 'vue-router'
import type Cwa from '#cwa/cwa'
import type { CwaResourcesStoreInterface } from '#cwa/storage/stores/resources/resources-store'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'

export type PresenceActivity = 'viewing' | 'selected' | 'editing' | 'left'

export interface PresenceData {
  v: 1
  page: string
  state: PresenceActivity
  component?: string
  componentPosition?: string
  pageData?: string
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
  receivedAt: number
  ttlMs: number
}

export interface RealtimeEvent {
  '@type'?: string
  'v'?: number
  'clientId'?: string
  'user'?: PresenceUser
  'event'?: string
  'data'?: Partial<PresenceData> | null
  'sentAt'?: string
  'expiresAt'?: string
}

interface PresenceState {
  active: boolean
  paused: boolean
  page: string | undefined
  peers: Record<string, PresencePeer>
  names: Record<string, string>
}

const REALTIME_PATH = '/_/realtime'
const THROTTLE_MS = 250
const HEARTBEAT_MS = 15_000
const PRUNE_MS = 1_000
const HELLO_JITTER_MS = 2_000
const MAX_BACKOFF_MS = 60_000
const DEFAULT_TTL_MS = 45_000
const PALETTE = ['#c084fc', '#14b8a6', '#f472b6', '#22d3ee', '#f87171', '#d6a77a']

const states = new WeakMap<Cwa, PresenceState>()

function presenceState($cwa: Cwa): PresenceState {
  let state = states.get($cwa)
  if (!state) {
    state = reactive({ active: false, paused: false, page: undefined, peers: {}, names: {} })
    states.set($cwa, state)
  }
  return state
}

function serverTime(value: unknown) {
  return typeof value === 'string' ? Date.parse(value.replace(/(\.\d{3})\d+/, '$1')) : Number.NaN
}

function retryAfterSeconds(error: FetchError) {
  const headers = error.response?.headers
  const value = headers?.get('Retry-After')?.trim()
  if (!value) {
    return undefined
  }
  if (/^\d+$/.test(value)) {
    return Number(value)
  }
  const seconds = Math.ceil((Date.parse(value) - Date.parse(headers?.get('Date') ?? '')) / 1000)
  return seconds > 0 ? seconds : undefined
}

export async function flushPendingUpdates($cwa: Cwa) {
  const pending: Map<string, Set<() => unknown>> = $cwa.resourcesManager['pendingUpdates']
  await Promise.all([...pending.values()].flatMap(flushes => [...flushes]).map(flush => flush()))
}

export function presenceColour(userId: string) {
  let hash = 0
  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!
}

export function usePresence($cwa: Cwa) {
  const state = presenceState($cwa)
  const peers = computed(() => state.active ? Object.values(state.peers) : [])
  return {
    active: computed(() => state.active),
    paused: computed(() => state.active && state.paused),
    onThisPage: computed(() => peers.value.filter(peer => peer.page === state.page)),
    elsewhere: computed(() => peers.value.filter(peer => peer.page !== state.page)),
    nameOf: (userId: string): string | undefined => state.names[userId],
  }
}

export class Presence {
  private readonly state: PresenceState
  private readonly warned = new Set<string>()
  private running = false
  private disabled = false
  private dirty = false
  private inFlight = false
  private hello = false
  private lastSent = Number.NEGATIVE_INFINITY
  private blockedUntil = 0
  private failures = 0
  private sendTimer?: ReturnType<typeof setTimeout>
  private helloTimer?: ReturnType<typeof setTimeout>
  private heartbeat?: ReturnType<typeof setInterval>
  private pruner?: ReturnType<typeof setInterval>
  private unwatch?: () => void
  private readonly onPageHide = () => this.sendLeft()
  private readonly onPageShow = (event: PageTransitionEvent) => event.persisted && this.announce(true)

  constructor(
    private readonly $cwa: Cwa,
    private readonly store: CwaResourcesStoreInterface,
    private readonly router: Router,
    private readonly clientId: string,
  ) {
    this.state = presenceState($cwa)
  }

  public start(connected: boolean) {
    if (this.running || this.disabled) {
      return
    }
    this.running = true
    this.state.active = true
    this.state.paused = !connected
    this.state.page = this.current().page
    this.unwatch = watch(() => JSON.stringify(this.current()), (key) => {
      this.state.page = (JSON.parse(key) as PresenceData).page
      this.announce()
    }, { flush: 'sync' })
    this.heartbeat = setInterval(() => this.announce(), HEARTBEAT_MS)
    this.pruner = setInterval(() => this.prune(), PRUNE_MS)
    window.addEventListener('pagehide', this.onPageHide)
    window.addEventListener('pageshow', this.onPageShow)
    this.announce(true)
  }

  public stop() {
    this.running = false
    this.dirty = false
    this.hello = false
    this.unwatch?.()
    clearTimeout(this.sendTimer)
    clearTimeout(this.helloTimer)
    clearInterval(this.heartbeat)
    clearInterval(this.pruner)
    this.sendTimer = this.helloTimer = this.heartbeat = this.pruner = this.unwatch = undefined
    window.removeEventListener('pagehide', this.onPageHide)
    window.removeEventListener('pageshow', this.onPageShow)
    this.state.active = false
    this.state.peers = {}
    this.state.names = {}
  }

  public paused() {
    this.state.paused = true
  }

  public resumed() {
    this.state.paused = false
    this.announce(true)
  }

  public receive(event: RealtimeEvent) {
    const { clientId, user, data } = event
    if (!this.running || event.v !== 1 || event.event !== 'presence' || !clientId || clientId === this.clientId || !user?.id || !data) {
      return
    }
    if (user.name) {
      this.state.names[user.id] = user.name
    }
    if (data.state === 'left') {
      delete this.state.peers[clientId]
      return
    }
    const ttlMs = serverTime(event.expiresAt) - serverTime(event.sentAt)
    this.state.peers[clientId] = {
      clientId,
      user: { ...user },
      state: data.state ?? 'viewing',
      page: data.page ?? '',
      component: data.component,
      componentPosition: data.componentPosition,
      pageData: data.pageData,
      receivedAt: Date.now(),
      ttlMs: ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS,
    }
    if (data.hello && !this.helloTimer) {
      this.helloTimer = setTimeout(() => {
        this.helloTimer = undefined
        this.announce()
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
    const data: PresenceData = { v: 1, page: this.page(), state: 'viewing' }
    const stackManager = this.$cwa.admin.resourceStackManager
    const selected = stackManager.currentIri.value
    const type = selected ? getResourceTypeFromIri(selected) : undefined
    if (!selected || (type !== CwaResourceTypes.COMPONENT && type !== CwaResourceTypes.COMPONENT_POSITION)) {
      return data
    }
    data.state = 'selected'
    if (type === CwaResourceTypes.COMPONENT) {
      data.component = this.store.findPublishedComponentIri(selected) ?? selected
    }
    const position = type === CwaResourceTypes.COMPONENT_POSITION ? selected : stackManager.getClosestStackItemByType(CwaResourceTypes.COMPONENT_POSITION)
    if (position) {
      data.componentPosition = position
      const pageData = this.store.current.byId[position]?.data?._metadata?.isDynamicPosition ? this.$cwa.resources.pageDataIriOf(position).value : undefined
      if (pageData) {
        data.pageData = pageData
      }
    }
    return data
  }

  private announce(hello = false) {
    this.hello ||= hello
    this.dirty = true
    this.schedule()
  }

  private schedule() {
    if (!this.running || this.sendTimer || this.inFlight) {
      return
    }
    const wait = Math.max(this.lastSent + THROTTLE_MS, this.blockedUntil) - Date.now()
    if (wait <= 0) {
      this.send()
      return
    }
    this.sendTimer = setTimeout(() => {
      this.sendTimer = undefined
      this.send()
    }, wait)
  }

  private async send() {
    if (!this.running || !this.dirty) {
      return
    }
    const hello = this.hello
    this.dirty = this.hello = false
    this.lastSent = Date.now()
    this.inFlight = true
    const data: PresenceData = hello ? { ...this.current(), hello: true } : this.current()
    try {
      await this.$cwa['cwaFetch'].fetch(REALTIME_PATH, {
        method: 'POST',
        body: { clientId: this.clientId, event: 'presence', data },
        retry: 0,
        onResponse: () => {},
      })
      this.failures = 0
    }
    catch (error) {
      this.failed(error as FetchError, hello)
    }
    finally {
      this.inFlight = false
    }
    this.dirty && this.schedule()
  }

  private failed(error: FetchError, hello: boolean) {
    const status = error.response?.status
    if (status === 401 || status === 403) {
      this.stop()
      return
    }
    if (status === 404 || status === 405) {
      this.disabled = true
      this.stop()
      this.warnOnce('off', 'Real-time presence is turned off on the API, so other editors will not be shown.')
      return
    }
    if (status && status !== 429 && status < 500) {
      this.warnOnce('refused', `The API refused a real-time presence update (${status}).`)
      return
    }
    this.dirty = true
    this.hello ||= hello
    const retryAfter = status === 429 ? retryAfterSeconds(error) : undefined
    if (retryAfter !== undefined) {
      this.blockedUntil = Date.now() + retryAfter * 1000
    }
    else {
      this.blockedUntil = Date.now() + Math.min(1000 * 2 ** this.failures, MAX_BACKOFF_MS)
      this.failures++
    }
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
    for (const [clientId, peer] of Object.entries(this.state.peers)) {
      if (now >= peer.receivedAt + peer.ttlMs) {
        delete this.state.peers[clientId]
      }
    }
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
