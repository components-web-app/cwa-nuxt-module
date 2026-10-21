// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import { useCwaRealtime } from '#cwa/composables/cwa-realtime'

const cwa = {}
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => cwa }))

const view = vi.hoisted(() => ({ ref: undefined as unknown as { value: unknown } }))
const mockRealtimeView = vi.hoisted(() => vi.fn(() => ({ view: view.ref })))
vi.mock('#cwa/resources/realtime-view', () => ({ realtimeView: mockRealtimeView }))

const SAM = { user: { id: '/users/sam', name: 'Sam' }, state: 'editing', field: 'title', expiresAt: 1 }

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
})
