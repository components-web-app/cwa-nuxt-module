// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { computed, h, reactive, ref } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import LinkInput from './LinkInput.vue'
import { managerTabKey, tabMetaOnlyKey } from '../core/ui/field-keys'

const store = vi.hoisted(() => ({ entry: undefined as any }))
const mockUpdateResource = vi.hoisted(() => vi.fn())

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    resources: { getResource: (iri: string) => computed(() => iri === '/component/links/1' ? store.entry : undefined) },
    resourcesManager: {
      getWaitForRequestPromise: vi.fn().mockResolvedValue(undefined),
      updateResource: mockUpdateResource,
      registerPendingUpdate: vi.fn(() => () => {}),
    },
    fetchResource: vi.fn(async () => ({ '@id': '/_/routes/a', 'path': '/showrooms' })),
  }),
}))
vi.mock('#cwa/resources/model-editors', () => ({ registerModelEditor: vi.fn(() => () => {}) }))
vi.mock('#cwa/resources/realtime-view', () => ({ realtimeView: () => ({ view: { value: undefined }, load: vi.fn().mockResolvedValue(undefined) }) }))
vi.mock('#cwa/composables/cwa-resource-endpoint', () => ({ useCwaResourceEndpoint: () => ({ endpoint: { value: '/component/links/1' } }) }))
vi.mock('#cwa/resources/field-state-writer', () => ({
  writeFieldStates: (write: (states: any) => void) => write({
    edited: () => {},
    unqueued: () => {},
    skipped: () => {},
    cleared: () => {},
    held: () => {},
    started: (entry: any, fields: string[]) => fields.forEach((field) => {
      entry.fieldStates = { ...entry.fieldStates, [field]: { status: 'saving', waiting: false, slow: false } }
    }),
    settled: (entry: any, fields: string[]) => fields.forEach((field) => {
      entry.fieldStates = { ...entry.fieldStates, [field]: { status: 'saved', waiting: false, slow: false, savedAt: Date.now() } }
    }),
  }),
}))

enableAutoUnmount(afterEach)

async function mountLink(data: Record<string, unknown>, metaOnly = false) {
  store.entry = reactive({ data: { '@id': '/component/links/1', ...data }, apiState: {}, fieldStates: {} })
  const fields: string[] = []
  const wrapper = mount({ render: () => h(LinkInput) }, {
    global: { provide: { [managerTabKey as symbol]: { iri: ref('/component/links/1'), register: (field: string) => fields.push(field) }, [tabMetaOnlyKey]: metaOnly } },
    attachTo: document.body,
  })
  await flushPromises()
  return { wrapper, fields }
}

function segment(wrapper: Awaited<ReturnType<typeof mountLink>>['wrapper'], label: string) {
  return wrapper.findAll('[data-testid="segmented"] button').find(button => button.text() === label)!
}

describe('CwaUiLinkInput and CwaUiEitherOr (#460)', () => {
  beforeEach(() => {
    mockUpdateResource.mockReset()
    mockUpdateResource.mockImplementation(async (event: any) => {
      const done = Promise.resolve({ resource: store.entry.data })
      event.onRequest?.('/component/links/1', done)
      Object.assign(store.entry.data, event.data)
      return store.entry.data
    })
  })

  test('shows the option that holds a value, and switching shows the other without saving', async () => {
    const { wrapper } = await mountLink({ route: null, rawPath: '/about' })

    expect(segment(wrapper, 'URL').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('input[type="url"]').exists()).toBe(true)

    await segment(wrapper, 'Page').trigger('click')
    expect(wrapper.find('input[type="url"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="search-input"]').exists()).toBe(true)
    expect(mockUpdateResource).not.toHaveBeenCalled()
  })

  test('a valid URL saves 250ms after typing stops, with no blur, and clears the page in the same request', async () => {
    vi.useFakeTimers()
    const { wrapper } = await mountLink({ route: '/_/routes/a', rawPath: null })
    await segment(wrapper, 'URL').trigger('click')
    const input = wrapper.get('input[type="url"]')
    await input.setValue('/about')
    vi.advanceTimersByTime(250)
    await flushPromises()

    expect(mockUpdateResource).toHaveBeenCalledTimes(1)
    expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { rawPath: '/about', route: null } }))
    vi.useRealTimers()
  })

  test('an invalid URL waits silently and shows why only on blur', async () => {
    vi.useFakeTimers()
    const { wrapper } = await mountLink({ route: null, rawPath: null })
    await segment(wrapper, 'URL').trigger('click')
    const input = wrapper.get('input[type="url"]')
    await input.setValue('about us')
    vi.advanceTimersByTime(1000)
    await flushPromises()

    expect(mockUpdateResource).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="input-invalid"]').exists()).toBe(false)

    await input.trigger('focusout')
    expect(wrapper.get('[data-testid="input-invalid"]').text()).toContain('Use /path or https://')
    expect(input.attributes('aria-invalid')).toBe('true')
    vi.useRealTimers()
  })

  test('after the save that cleared the page, the URL keeps a saved line with Undo, which puts the page back in one save', async () => {
    vi.useFakeTimers()
    const { wrapper } = await mountLink({ route: '/_/routes/a', rawPath: null })
    await segment(wrapper, 'URL').trigger('click')
    await wrapper.get('input[type="url"]').setValue('/about')
    vi.advanceTimersByTime(250)
    await flushPromises()
    vi.useRealTimers()

    expect(wrapper.get('[data-cwa-field="rawPath"] [data-testid="field-status-line"]').attributes('data-line')).toBe('undo')
    await wrapper.get('input[type="url"]').trigger('focusin')
    await flushPromises()
    const popover = document.querySelector<HTMLElement>('[data-testid="field-status-popover"]')!
    expect(popover.textContent).toContain('This save also cleared Page.')
    mockUpdateResource.mockClear()

    popover.querySelector<HTMLElement>('[data-testid="field-status-undo"]')!.click()
    await flushPromises()

    expect(mockUpdateResource).toHaveBeenCalledTimes(1)
    expect(mockUpdateResource).toHaveBeenCalledWith(expect.objectContaining({ data: { route: '/_/routes/a', rawPath: null } }))
    expect(segment(wrapper, 'Page').attributes('aria-pressed')).toBe('true')
  })

  test('old data holding both says so', async () => {
    const { wrapper } = await mountLink({ route: '/_/routes/a', rawPath: '/about' })

    expect(wrapper.get('[data-testid="either-or-both"]').text()).toBe('Both are set. Saving one clears the other.')
  })

  test('an off-site URL is marked', async () => {
    const { wrapper } = await mountLink({ route: null, rawPath: 'https://example.com' })

    expect(wrapper.find('[data-testid="link-off-site"]').exists()).toBe(true)
  })

  test('the metadata render registers both fields and creates no models', async () => {
    const { fields } = await mountLink({ route: null, rawPath: null }, true)

    expect(fields.sort()).toEqual(['rawPath', 'route'])
    expect(mockUpdateResource).not.toHaveBeenCalled()
  })

  test('has no axe violations', async () => {
    const { wrapper } = await mountLink({ route: null, rawPath: '/about' })

    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })
})
