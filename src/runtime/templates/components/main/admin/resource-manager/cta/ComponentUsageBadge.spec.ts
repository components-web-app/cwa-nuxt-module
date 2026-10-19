// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ComponentUsageBadge from './ComponentUsageBadge.vue'
import * as cwaComposable from '#cwa/composables/cwa'
import { fetchComponentUsage } from '#cwa/admin/component-usage'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'

vi.mock('#cwa/admin/component-usage', () => ({
  fetchComponentUsage: vi.fn(),
}))

const COMPONENT = '/component/html_contents/c1'
const OTHER = '/component/html_contents/c2'

function mockCwa(initial: { iri?: string, byId?: Record<string, any> } = {}) {
  const state = reactive<{ iri: string | undefined, byId: Record<string, any> }>({ iri: initial.iri ?? COMPONENT, byId: initial.byId ?? { [COMPONENT]: { '@id': COMPONENT, 'componentPositions': ['/_/component_positions/p1', '/_/component_positions/p2'] } } })
  const cwa = {
    admin: { resourceStackManager: { currentIri: computed(() => state.iri) } },
    resources: { getResource: (iri: string) => computed(() => state.byId[iri] ? { data: state.byId[iri] } : undefined) },
  }
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue(cwa as any)
  return { cwa, state }
}

async function mountBadge() {
  const wrapper = mount(ComponentUsageBadge)
  await flushPromises()
  return wrapper
}

describe('ComponentUsageBadge', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('says the selected component is shared and in how many places when it is used more than once', async () => {
    vi.mocked(fetchComponentUsage).mockResolvedValue({ positionCount: 2, pageDataCount: 1, total: 3 })
    const { cwa } = mockCwa()
    const wrapper = await mountBadge()
    expect(fetchComponentUsage).toHaveBeenCalledWith(cwa, COMPONENT)
    expect(wrapper.get('[data-testid="component-usage-badge"]').text()).toBe('Shared · 3 places')
  })

  test.each([
    ['used once', { positionCount: 1, pageDataCount: 0, total: 1 }],
    ['not answered', undefined],
  ])('shows nothing for a component %s', async (_label, usage) => {
    vi.mocked(fetchComponentUsage).mockResolvedValue(usage)
    mockCwa()
    const wrapper = await mountBadge()
    expect(wrapper.find('[data-testid="component-usage-badge"]').exists()).toBe(false)
  })

  test.each([
    ['a position', '/_/component_positions/p1', {}],
    ['a group', '/_/component_groups/g1', {}],
    ['a component being added', NEW_RESOURCE_IRI, {}],
    ['a component not yet saved', COMPONENT, { [COMPONENT]: { '@id': COMPONENT, '_metadata': { persisted: false } } }],
  ])('never asks for usage for %s', async (_label, iri, byId) => {
    mockCwa({ iri, byId })
    const wrapper = await mountBadge()
    expect(fetchComponentUsage).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="component-usage-badge"]').exists()).toBe(false)
  })

  test('reads usage again when another component is selected, dropping the previous answer at once', async () => {
    vi.mocked(fetchComponentUsage).mockResolvedValueOnce({ positionCount: 3, pageDataCount: 0, total: 3 })
    const { state } = mockCwa({ byId: { [COMPONENT]: { '@id': COMPONENT }, [OTHER]: { '@id': OTHER } } })
    const wrapper = await mountBadge()
    let resolveOther: (value: any) => void = () => {}
    vi.mocked(fetchComponentUsage).mockReturnValueOnce(new Promise((resolve) => {
      resolveOther = resolve
    }))
    state.iri = OTHER
    await flushPromises()
    expect(wrapper.find('[data-testid="component-usage-badge"]').exists()).toBe(false)
    resolveOther({ positionCount: 2, pageDataCount: 0, total: 2 })
    await flushPromises()
    expect(wrapper.get('[data-testid="component-usage-badge"]').text()).toBe('Shared · 2 places')
    expect(vi.mocked(fetchComponentUsage).mock.calls.map(call => call[1])).toEqual([COMPONENT, OTHER])
  })

  test('an answer for a component no longer selected is ignored', async () => {
    let resolveFirst: (value: any) => void = () => {}
    vi.mocked(fetchComponentUsage).mockReturnValueOnce(new Promise((resolve) => {
      resolveFirst = resolve
    }))
    vi.mocked(fetchComponentUsage).mockResolvedValueOnce({ positionCount: 1, pageDataCount: 0, total: 1 })
    const { state } = mockCwa({ byId: { [COMPONENT]: { '@id': COMPONENT }, [OTHER]: { '@id': OTHER } } })
    const wrapper = await mountBadge()
    state.iri = OTHER
    await flushPromises()
    resolveFirst({ positionCount: 5, pageDataCount: 0, total: 5 })
    await flushPromises()
    expect(wrapper.find('[data-testid="component-usage-badge"]').exists()).toBe(false)
  })

  test('a slow answer from before the component changed never overwrites the newer one', async () => {
    let resolveFirst: (value: any) => void = () => {}
    vi.mocked(fetchComponentUsage).mockReturnValueOnce(new Promise((resolve) => {
      resolveFirst = resolve
    }))
    vi.mocked(fetchComponentUsage).mockResolvedValueOnce({ positionCount: 1, pageDataCount: 0, total: 1 })
    const { state } = mockCwa()
    const wrapper = await mountBadge()
    state.byId[COMPONENT] = { ...state.byId[COMPONENT], componentPositions: ['/_/component_positions/p1'] }
    await flushPromises()
    resolveFirst({ positionCount: 2, pageDataCount: 0, total: 2 })
    await flushPromises()
    expect(wrapper.find('[data-testid="component-usage-badge"]').exists()).toBe(false)
  })

  test('reads usage again when the component gains or loses a position, as after a clone or a removal', async () => {
    vi.mocked(fetchComponentUsage).mockResolvedValueOnce({ positionCount: 2, pageDataCount: 0, total: 2 })
    const { state } = mockCwa()
    const wrapper = await mountBadge()
    vi.mocked(fetchComponentUsage).mockResolvedValueOnce({ positionCount: 1, pageDataCount: 0, total: 1 })
    state.byId[COMPONENT] = { ...state.byId[COMPONENT], componentPositions: ['/_/component_positions/p1'] }
    await flushPromises()
    expect(fetchComponentUsage).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="component-usage-badge"]').exists()).toBe(false)
  })
})
