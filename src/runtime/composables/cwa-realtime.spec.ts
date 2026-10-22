// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { effectScope, nextTick, ref, shallowRef } from 'vue'
import { useCwaRealtime } from '#cwa/composables/cwa-realtime'

const cwa = {}
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => cwa }))

const view = vi.hoisted(() => ({ ref: undefined as unknown as { value: unknown } }))
const mockRealtimeView = vi.hoisted(() => vi.fn(() => ({ view: view.ref })))
vi.mock('#cwa/resources/realtime-view', () => ({ realtimeView: mockRealtimeView }))

const SAM = { user: { id: '/users/sam', name: 'Sam' }, state: 'editing', field: 'title', expiresAt: 1 }

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('useCwaRealtime (#429)', () => {
  test('peers is empty until the admin real-time code has loaded, then lists the peers on the IRI, read from a ref or a getter', () => {
    view.ref = shallowRef()
    const iri = ref('/component/a')
    const { peers } = useCwaRealtime(iri)
    expect(mockRealtimeView).toHaveBeenCalledWith(cwa)
    expect(peers.value).toStrictEqual([])

    const onIri = vi.fn((on: string) => on === '/component/b' ? [SAM] : [])
    view.ref.value = { peers: onIri }
    expect(peers.value).toStrictEqual([])

    iri.value = '/component/b'
    expect(peers.value).toStrictEqual([SAM])
    expect(useCwaRealtime(() => '/component/b').peers.value).toStrictEqual([SAM])
  })

  test('peers is empty with no IRI', () => {
    view.ref = shallowRef({ peers: vi.fn(() => [SAM]) })

    expect(useCwaRealtime(() => undefined).peers.value).toStrictEqual([])
  })

  test('send is a no-op until the admin real-time code has loaded, then sends the event on the IRI it is given now', () => {
    view.ref = shallowRef()
    const iri = ref<string | undefined>('/component/a')
    const { send } = useCwaRealtime(iri)
    send('cursor', { from: 1 })

    const viewSend = vi.fn()
    view.ref.value = { send: viewSend }
    iri.value = '/component/b'
    send('cursor', { from: 2 })
    iri.value = undefined
    send('cursor', { from: 3 })

    expect(viewSend.mock.calls).toStrictEqual([['/component/b', 'cursor', { from: 2 }]])
  })

  test('a handler registered before the admin real-time code has loaded is registered once it loads, following the IRI', async () => {
    view.ref = shallowRef()
    const iri = ref('/component/a')
    const handler = vi.fn()
    useCwaRealtime(iri).on('cursor', handler)

    const viewOn = vi.fn(() => vi.fn())
    view.ref.value = { on: viewOn }
    await nextTick()
    view.ref.value = { on: viewOn }
    await nextTick()

    expect(viewOn).toHaveBeenCalledOnce()
    const [getIri, event, registered] = viewOn.mock.calls[0] as unknown as [() => string, string, unknown]
    expect([event, registered]).toStrictEqual(['cursor', handler])
    iri.value = '/component/b'
    expect(getIri()).toBe('/component/b')
  })

  test('on registers at once once loaded, and its unsubscribe unsubscribes', () => {
    const off = vi.fn()
    view.ref = shallowRef({ on: vi.fn(() => off) })
    const stop = useCwaRealtime(() => '/component/a').on('cursor', vi.fn())

    expect(off).not.toHaveBeenCalled()
    stop()
    expect(off).toHaveBeenCalledOnce()
  })

  test('unsubscribing before the admin real-time code has loaded means it never registers', async () => {
    view.ref = shallowRef()
    const viewOn = vi.fn(() => vi.fn())
    useCwaRealtime(() => '/component/a').on('cursor', vi.fn())()

    view.ref.value = { on: viewOn }
    await nextTick()

    expect(viewOn).not.toHaveBeenCalled()
  })

  test('on unsubscribes when its scope is disposed, and never registers after that', async () => {
    const off = vi.fn()
    const viewOn = vi.fn(() => off)
    view.ref = shallowRef({ on: viewOn })
    const loaded = effectScope()
    loaded.run(() => useCwaRealtime(() => '/component/a').on('cursor', vi.fn()))
    loaded.stop()
    expect(off).toHaveBeenCalledOnce()

    view.ref = shallowRef()
    const waiting = effectScope()
    waiting.run(() => useCwaRealtime(() => '/component/a').on('cursor', vi.fn()))
    waiting.stop()
    view.ref.value = { on: viewOn }
    await nextTick()
    expect(viewOn).toHaveBeenCalledOnce()
  })

  test.each(['presence', 'cwa:', 'cwa:cursor'])('the reserved event name "%s" throws for send and on', (name) => {
    const viewSend = vi.fn()
    const viewOn = vi.fn()
    view.ref = shallowRef({ send: viewSend, on: viewOn })
    const { send, on } = useCwaRealtime(() => '/component/a')

    expect(() => send(name, 1)).toThrow(`"${name}" is reserved`)
    expect(() => on(name, vi.fn())).toThrow(`"${name}" is reserved`)
    expect(viewSend).not.toHaveBeenCalled()
    expect(viewOn).not.toHaveBeenCalled()
  })

  test('outside development a reserved event name is ignored instead of throwing', () => {
    vi.stubEnv('DEV', false)
    const viewSend = vi.fn()
    const viewOn = vi.fn()
    view.ref = shallowRef({ send: viewSend, on: viewOn })
    const { send, on } = useCwaRealtime(() => '/component/a')

    send('cwa:cursor', 1)
    on('presence', vi.fn())()

    expect(viewSend).not.toHaveBeenCalled()
    expect(viewOn).not.toHaveBeenCalled()
  })

  test.each(['presences', 'my:cwa:cursor', 'cwa'])('"%s" is not reserved', (name) => {
    const viewSend = vi.fn()
    view.ref = shallowRef({ send: viewSend })

    useCwaRealtime(() => '/component/a').send(name, 1)

    expect(viewSend).toHaveBeenCalledOnce()
  })

  test('send and on are typed by the events map', () => {
    view.ref = shallowRef({ send: vi.fn(), on: vi.fn(() => vi.fn()) })
    const { send, on } = useCwaRealtime<{ cursor: { from: number } }>(() => '/component/a')

    send('cursor', { from: 1 })
    on('cursor', (data, { user }) => [data.from, user.id])
    // @ts-expect-error data must match the event
    send('cursor', { from: 'one' })
    // @ts-expect-error the event must be in the map
    send('selection', { from: 1 })
  })
})
