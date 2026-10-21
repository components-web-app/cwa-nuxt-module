// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import * as processComposables from '#cwa/composables/process'
import { realtimeView } from '#cwa/resources/realtime-view'
import type Cwa from '#cwa/cwa'

const mockUsePresence = vi.hoisted(() => vi.fn(() => ({ peers: vi.fn(() => []) })))
vi.mock('#cwa/admin/presence', () => ({ usePresence: mockUsePresence }))

function buildCwa({ isAdmin = false, realtime }: { isAdmin?: boolean, realtime?: { enabled?: boolean } } = {}) {
  const admin = ref(isAdmin)
  const $cwa = {
    options: { realtime },
    auth: { get isAdmin() {
      return computed(() => admin.value)
    } },
  }
  return { $cwa: $cwa as unknown as Cwa, admin }
}

describe('realtimeView: the admin real-time code, loaded only for an admin (#429)', () => {
  beforeEach(() => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isServer: false, isClient: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  test('a visitor never loads it, and load() gives nothing', async () => {
    const { $cwa } = buildCwa()
    const { view, load } = realtimeView($cwa)

    await expect(load()).resolves.toBeUndefined()
    expect(view.value).toBeUndefined()
    expect(mockUsePresence).not.toHaveBeenCalled()
  })

  test('an admin gets the presence view for their Cwa, loaded once however often it is asked for', async () => {
    const { $cwa } = buildCwa({ isAdmin: true })
    const { view } = realtimeView($cwa)
    await flushPromises()

    expect(mockUsePresence).toHaveBeenCalledExactlyOnceWith($cwa)
    expect(view.value).toBe(mockUsePresence.mock.results[0]!.value)
    expect(realtimeView($cwa).view).toBe(view)
    await expect(realtimeView($cwa).load()).resolves.toBe(view.value)
    expect(mockUsePresence).toHaveBeenCalledOnce()
  })

  test('signing in as an admin later loads it then', async () => {
    const { $cwa, admin } = buildCwa()
    const { view } = realtimeView($cwa)
    await flushPromises()
    expect(view.value).toBeUndefined()

    admin.value = true
    await flushPromises()

    expect(view.value).toBeDefined()
  })

  test('with real-time turned off it is never loaded', async () => {
    const { $cwa } = buildCwa({ isAdmin: true, realtime: { enabled: false } })
    const { view, load } = realtimeView($cwa)
    await load()

    expect(view.value).toBeUndefined()
    expect(mockUsePresence).not.toHaveBeenCalled()
  })

  test('on the server nothing is loaded or watched', async () => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isServer: true, isClient: false })
    const { $cwa } = buildCwa({ isAdmin: true })
    const { view } = realtimeView($cwa)
    await flushPromises()

    expect(view.value).toBeUndefined()
    expect(mockUsePresence).not.toHaveBeenCalled()
  })
})
