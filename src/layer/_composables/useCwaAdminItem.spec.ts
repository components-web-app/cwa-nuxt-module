// @vitest-environment nuxt
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed, defineComponent, reactive, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useCwaAdminItem } from './useCwaAdminItem'
import * as cwaComposable from '#cwa/composables/cwa'

const showToast = vi.hoisted(() => vi.fn())
const confirm = vi.hoisted(() => vi.fn())

vi.mock('#cwa/composables/cwa-toast', () => ({
  useCwaToast: () => ({ show: showToast, dismiss: vi.fn() }),
}))

vi.mock('#cwa/composables/cwa-confirm', () => ({
  useCwaConfirm: () => confirm,
}))

vi.mock('vue-router', async (importOriginal) => {
  const mod = await importOriginal<typeof import('vue-router')>()
  return {
    ...mod,
    useRoute: () => ({ name: '_cwa-orders-iri', params: {}, query: {}, hash: '' }),
    useRouter: () => ({ push: vi.fn() }),
  }
})

const orderIri = '/_ecommerce/orders/order-uuid'
const refundEndpoint = `${orderIri}/refund`
const order = { '@id': orderIri, '@type': 'Order', '_metadata': { persisted: true }, 'state': 'paid' }

type Outcome = { ok: true, body?: unknown } | { ok: false }

function setup() {
  const store = reactive<Record<string, any>>({
    [orderIri]: { data: { ...order }, apiState: { status: 'SUCCESS' } },
  })
  const errors = reactive<any[]>([])
  const outcomes: Outcome[] = []
  const send = vi.fn(async (endpoint: string, _method: string, _body: unknown) => {
    const index = errors.findIndex(error => error.event.endpoint === endpoint)
    index > -1 && errors.splice(index, 1)
    const outcome = outcomes.shift() ?? { ok: true }
    if (!outcome.ok) {
      errors.push({ timestamp: 1, event: { endpoint }, detail: 'failed' })
      return undefined
    }
    return outcome.body
  })
  const fetchResource = vi.fn()
  // @ts-expect-error
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    resources: { getResource: vi.fn((iri: string) => computed(() => store[iri])) },
    resourcesManager: { send, errors, removeError: vi.fn(), createResource: vi.fn(), updateResource: vi.fn(), deleteResource: vi.fn() },
    fetchResource,
  }))
  const emit = vi.fn()
  let item!: ReturnType<typeof useCwaAdminItem>
  mount(defineComponent({
    setup() {
      item = useCwaAdminItem({
        createEndpoint: '/_ecommerce/orders',
        emit,
        resourceType: 'Order',
        defaultResource: {},
        endpoint: ref(orderIri),
      })
      return () => null
    },
  }))
  return { item, send, fetchResource, emit, errors, outcomes }
}

const refund = {
  endpoint: refundEndpoint,
  confirm: { title: 'Refund this order?', go: 'Refund', tone: 'danger' as const },
  success: 'Order refunded',
}

describe('useCwaAdminItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    confirm.mockResolvedValue(true)
  })

  afterEach(() => {
    confirm.mockReset()
    vi.useRealTimers()
  })

  test('a confirmed action sends, shows its success toast, reloads the item and emits reload', async () => {
    const { item, send, fetchResource, emit } = setup()
    await flushPromises()
    const loadsBefore = fetchResource.mock.calls.length
    emit.mockClear()

    expect(await item.runAction(refund)).toBe(true)

    expect(confirm).toHaveBeenCalledWith(refund.confirm)
    expect(send).toHaveBeenCalledWith(refundEndpoint, 'POST', undefined)
    expect(showToast).toHaveBeenCalledWith({ tone: 'success', title: 'Order refunded' })
    expect(fetchResource.mock.calls.length).toBe(loadsBefore + 1)
    expect(fetchResource).toHaveBeenLastCalledWith({ path: orderIri, iri: undefined, shallowFetch: true })
    expect(emit).toHaveBeenCalledWith('reload')
  })

  test('an action sends its method and body', async () => {
    const { item, send } = setup()
    await flushPromises()
    await item.runAction({ endpoint: refundEndpoint, method: 'PATCH', body: { reason: 'damaged' } })
    expect(send).toHaveBeenCalledWith(refundEndpoint, 'PATCH', { reason: 'damaged' })
  })

  test('an action with no confirm sends without asking, and with no success message shows no toast', async () => {
    const { item, send, emit } = setup()
    await flushPromises()
    expect(await item.runAction({ endpoint: refundEndpoint })).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledOnce()
    expect(showToast).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith('reload')
  })

  test('a cancelled confirm sends nothing, reloads nothing and frees the dialog for the next action', async () => {
    const { item, send, fetchResource, emit } = setup()
    await flushPromises()
    const loadsBefore = fetchResource.mock.calls.length
    emit.mockClear()
    confirm.mockResolvedValueOnce(false)

    expect(await item.runAction(refund)).toBe(false)

    expect(confirm).toHaveBeenCalledOnce()
    expect(send).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
    expect(fetchResource.mock.calls.length).toBe(loadsBefore)
    expect(emit).not.toHaveBeenCalled()
    expect(item.actionRunning.value).toBe(false)
  })

  test('a failed request shows no success toast, does not reload and reports failure', async () => {
    const { item, send, fetchResource, emit, outcomes } = setup()
    await flushPromises()
    const loadsBefore = fetchResource.mock.calls.length
    emit.mockClear()
    outcomes.push({ ok: false })

    expect(await item.runAction(refund)).toBe(false)

    expect(send).toHaveBeenCalledOnce()
    expect(showToast).not.toHaveBeenCalled()
    expect(fetchResource.mock.calls.length).toBe(loadsBefore)
    expect(emit).not.toHaveBeenCalled()
    expect(item.actionRunning.value).toBe(false)
  })

  test('a 204 with an empty body counts as success', async () => {
    const { item, outcomes, emit } = setup()
    await flushPromises()
    outcomes.push({ ok: true, body: undefined })
    expect(await item.runAction(refund)).toBe(true)
    expect(showToast).toHaveBeenCalledWith({ tone: 'success', title: 'Order refunded' })
    expect(emit).toHaveBeenCalledWith('reload')
  })

  test('a retry after a failure succeeds once the request does', async () => {
    const { item, outcomes } = setup()
    await flushPromises()
    outcomes.push({ ok: false }, { ok: true })
    expect(await item.runAction(refund)).toBe(false)
    expect(await item.runAction(refund)).toBe(true)
  })

  test('a second action while one runs is ignored', async () => {
    const { item, send } = setup()
    await flushPromises()
    let answer!: (confirmed: boolean) => void
    confirm.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
      answer = resolve
    }))

    const first = item.runAction(refund)
    expect(item.actionRunning.value).toBe(true)
    expect(await item.runAction({ endpoint: `${orderIri}/resend_confirmation` })).toBe(false)
    answer(true)

    expect(await first).toBe(true)
    expect(send).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith(refundEndpoint, 'POST', undefined)
    expect(item.actionRunning.value).toBe(false)
  })

  test('useItemPage\'s returns are passed through', async () => {
    const { item } = setup()
    await flushPromises()
    expect(item.resource.value).toEqual(order)
    expect(item.isAdding.value).toBe(false)
    for (const key of ['isLoading', 'loadFailed', 'isUpdating', 'resource', 'localResourceData', 'isAdding', 'apiState', 'formatDate', 'deleteResource', 'saveTitle', 'saveResource', 'loadResource', 'resetResource', 'getInternalResourceLink', 'form']) {
      expect(item).toHaveProperty(key)
    }
  })
})
