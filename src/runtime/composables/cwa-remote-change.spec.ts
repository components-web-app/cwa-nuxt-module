// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, effectScope, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import * as processComposables from '#cwa/composables/process'
import { onRemoteChange } from '#cwa/composables/cwa-remote-change'

const isAdmin = ref(false)
const cwa = { auth: { get isAdmin() {
  return computed(() => isAdmin.value)
} } }
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => cwa }))

const mockUnsubscribe = vi.hoisted(() => vi.fn())
const mockSubscribe = vi.hoisted(() => vi.fn((..._args: unknown[]) => mockUnsubscribe))
vi.mock('#cwa/admin/remote-changes', () => ({ subscribeToRemoteChanges: mockSubscribe }))

describe('onRemoteChange (#429)', () => {
  beforeEach(() => {
    isAdmin.value = false
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isServer: false, isClient: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  test('a visitor never loads or subscribes to anything', async () => {
    const scope = effectScope()
    scope.run(() => onRemoteChange('/component/a', vi.fn()))
    await flushPromises()

    expect(mockSubscribe).not.toHaveBeenCalled()
    scope.stop()
  })

  test('an admin subscribes the handler for the IRI, read from a ref or a getter each time', async () => {
    isAdmin.value = true
    const iri = ref('/component/a')
    const handler = vi.fn()
    const scope = effectScope()
    scope.run(() => onRemoteChange(iri, handler))
    await flushPromises()

    expect(mockSubscribe).toHaveBeenCalledOnce()
    const [subscribedCwa, iriGetter, subscribedHandler] = mockSubscribe.mock.calls[0]!
    expect(subscribedCwa).toBe(cwa)
    expect(subscribedHandler).toBe(handler)
    iri.value = '/component/b'
    expect((iriGetter as () => string)()).toBe('/component/b')
    scope.stop()
  })

  test('signing in as an admin later subscribes then', async () => {
    const scope = effectScope()
    scope.run(() => onRemoteChange(() => '/component/a', vi.fn()))
    await flushPromises()
    expect(mockSubscribe).not.toHaveBeenCalled()

    isAdmin.value = true
    await flushPromises()

    expect(mockSubscribe).toHaveBeenCalledOnce()
    scope.stop()
  })

  test('disposing the scope unsubscribes, as does the returned stop', async () => {
    isAdmin.value = true
    const scope = effectScope()
    scope.run(() => onRemoteChange('/component/a', vi.fn()))
    await flushPromises()

    scope.stop()
    expect(mockUnsubscribe).toHaveBeenCalledOnce()

    const stop = onRemoteChange('/component/a', vi.fn())
    await flushPromises()
    stop()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(2)
  })

  test('a scope disposed before the module loads never subscribes', async () => {
    isAdmin.value = true
    const scope = effectScope()
    scope.run(() => onRemoteChange('/component/a', vi.fn()))
    scope.stop()
    await flushPromises()

    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  test('the server never subscribes', async () => {
    vi.spyOn(processComposables, 'useProcess').mockReturnValue({ isServer: true, isClient: false })
    isAdmin.value = true
    const scope = effectScope()
    scope.run(() => onRemoteChange('/component/a', vi.fn()))
    await flushPromises()

    expect(mockSubscribe).not.toHaveBeenCalled()
    scope.stop()
  })
})
