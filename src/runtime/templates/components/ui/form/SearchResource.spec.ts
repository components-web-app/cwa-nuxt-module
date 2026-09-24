// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { consola } from 'consola'
import SearchResource from './SearchResource.vue'
import * as cwaComposable from '#cwa/composables/cwa'

vi.mock('consola')

vi.mock('@headlessui/vue', () => ({
  Popover: { name: 'Popover', template: '<div><slot /></div>' },
  PopoverPanel: {
    name: 'PopoverPanel',
    props: ['static'],
    setup() { return { close: vi.fn() } },
    template: '<div><slot :close="close" /></div>',
  },
}))

vi.mock('#cwa/composables/popper', () => ({
  usePopper: vi.fn(() => [ref(null), ref(null)]),
}))

vi.mock('#cwa/composables/cwa')

const mockResults = [
  { '@id': '/_/routes//home', 'path': '/home' },
  { '@id': '/_/routes//about', 'path': '/about' },
]

let fetchMock: ReturnType<typeof vi.fn>

function mockCwaImpl(opts: { results?: any[], currentResource?: any } = {}) {
  fetchMock = vi.fn().mockReturnValue({
    response: Promise.resolve({ _data: { member: opts.results ?? mockResults } }),
  })
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue({
    fetchResource: vi.fn().mockResolvedValue(opts.currentResource ?? null),
    fetch: fetchMock,
  } as any)
}

function mockCwaWithResponses(responses: { response: Promise<any> }[]) {
  let call = 0
  fetchMock = vi.fn(() => responses[call++])
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue({
    fetchResource: vi.fn().mockResolvedValue(null),
    fetch: fetchMock,
  } as any)
}

function deferredFetchResponse() {
  let resolveResponse: (value: any) => void
  let rejectResponse: (error: any) => void
  const response = new Promise((resolve, reject) => {
    resolveResponse = resolve
    rejectResponse = reject
  })
  response.catch(() => undefined)
  return {
    fetchReturn: { response },
    resolveWith(member: any[]) {
      resolveResponse({ _data: { member } })
    },
    rejectWith(error: any) {
      rejectResponse(error)
    },
  }
}

function fetchedParams() {
  return new URLSearchParams(fetchMock.mock.calls[0][0].path.split('?')[1])
}

const stubs = {
  Spinner: true,
  ButtonPopoverGroup: true,
  CwaUiIconXMarkIcon: true,
  ButtonPopoverItem: {
    name: 'ButtonPopoverItem',
    props: ['option'],
    emits: ['click'],
    template: '<button @click="$emit(\'click\', option.value)">{{ option.label }}</button>',
  },
}

function mountComp(props: Record<string, any> = {}) {
  return mount(SearchResource, {
    props: {
      modelValue: null,
      endpoint: '/_/routes',
      property: 'path',
      ...props,
    },
    global: { stubs },
    attachTo: document.body,
  })
}

async function openDropdown(wrapper: ReturnType<typeof mountComp>) {
  const input = wrapper.find('input')
  await input.trigger('focus')
  await input.setValue('/home')
  vi.advanceTimersByTime(250)
  await flushPromises()
}

describe('SearchResource', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockCwaImpl()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('fetched url', () => {
    test('the typed value is sent as the search parameter', async () => {
      const wrapper = mountComp()
      await openDropdown(wrapper)
      expect(fetchedParams().get('search')).toBe('/home')
    })

    test('the typed value is still sent under the display property', async () => {
      const wrapper = mountComp()
      await openDropdown(wrapper)
      expect(fetchedParams().get('path')).toBe('/home')
    })

    test('the typed value is sent under every declared search property', async () => {
      const wrapper = mountComp({ searchProperties: ['path', 'reference'] })
      await openDropdown(wrapper)
      const params = fetchedParams()
      expect(params.get('search')).toBe('/home')
      expect(params.get('path')).toBe('/home')
      expect(params.get('reference')).toBe('/home')
    })

    test('paging and sorting are unchanged', async () => {
      const wrapper = mountComp()
      await openDropdown(wrapper)
      const params = fetchedParams()
      expect(params.get('perPage')).toBe('6')
      expect(params.get('order[path]')).toBe('asc')
    })
  })

  describe('results panel visibility', () => {
    test('panel is not rendered on initial mount (focussed is false)', () => {
      const wrapper = mountComp()
      expect(wrapper.find('[data-testid="results-panel"]').exists()).toBe(false)
    })

    test('panel is rendered when input is focused and search results are available', async () => {
      const wrapper = mountComp()
      await openDropdown(wrapper)
      expect(wrapper.find('[data-testid="results-panel"]').exists()).toBe(true)
    })

    test('panel is hidden after unfocus fires (100ms after blur)', async () => {
      const wrapper = mountComp()
      await openDropdown(wrapper)
      expect(wrapper.find('[data-testid="results-panel"]').exists()).toBe(true)

      await wrapper.find('input').trigger('blur')
      expect(wrapper.find('[data-testid="results-panel"]').exists()).toBe(true)

      vi.advanceTimersByTime(100)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="results-panel"]').exists()).toBe(false)
    })
  })

  describe('mousedown.prevent on results panel', () => {
    test('mousedown on the results panel calls event.preventDefault so input does not lose focus', async () => {
      const wrapper = mountComp()
      await openDropdown(wrapper)

      const panel = wrapper.find('[data-testid="results-panel"]')
      expect(panel.exists()).toBe(true)

      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
      panel.element.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    })

    test('panel stays open when mousedown fires on it (input keeps focus)', async () => {
      const wrapper = mountComp()
      await openDropdown(wrapper)

      await wrapper.find('[data-testid="results-panel"]').trigger('mousedown')
      expect(wrapper.find('[data-testid="results-panel"]').exists()).toBe(true)
    })
  })

  describe('selecting a result', () => {
    test('clicking a result emits update:modelValue with the result IRI', async () => {
      const wrapper = mountComp()
      await openDropdown(wrapper)

      const buttons = wrapper.findAll('button')
      expect(buttons.length).toBeGreaterThan(0)
      await buttons[0].trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      const emittedValue = wrapper.emitted('update:modelValue')![0][0]
      expect(typeof emittedValue === 'string' && emittedValue.startsWith('/_/routes/')).toBe(true)
    })

    test('clicking a result sets focussed to false, closing the panel', async () => {
      const wrapper = mountComp()
      await openDropdown(wrapper)
      expect(wrapper.find('[data-testid="results-panel"]').exists()).toBe(true)

      const buttons = wrapper.findAll('button')
      await buttons[0].trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="results-panel"]').exists()).toBe(false)
    })
  })

  describe('failed search', () => {
    async function typeInto(wrapper: ReturnType<typeof mountComp>, value: string) {
      const input = wrapper.find('input')
      await input.trigger('focus')
      await input.setValue(value)
      vi.advanceTimersByTime(250)
      await flushPromises()
    }

    test('the loading indicator stops when a search fails', async () => {
      mockCwaWithResponses([{ response: Promise.reject({ statusCode: 500 }) }])
      const wrapper = mountComp()
      await typeInto(wrapper, '/home')
      expect(wrapper.text()).not.toContain('Loading...')
    })

    test('a failed search is reported in the panel with the status code', async () => {
      mockCwaWithResponses([{ response: Promise.reject({ statusCode: 500 }) }])
      const wrapper = mountComp()
      await typeInto(wrapper, '/home')
      expect(wrapper.find('[data-testid="results-panel"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Search failed (500)')
    })

    test('a failed search with no status code is reported as a network error', async () => {
      mockCwaWithResponses([{ response: Promise.reject(new Error('fetch failed')) }])
      const wrapper = mountComp()
      await typeInto(wrapper, '/home')
      expect(wrapper.text()).toContain('Search failed (network error)')
    })

    test('the cause of a failed search is logged', async () => {
      const error = { statusCode: 500 }
      mockCwaWithResponses([{ response: Promise.reject(error) }])
      const wrapper = mountComp()
      await typeInto(wrapper, '/home')
      expect(consola.error).toHaveBeenCalledWith('[CWA] Could not search for resources', error)
    })

    test('the failure is cleared when a later search succeeds', async () => {
      mockCwaWithResponses([
        { response: Promise.reject({ statusCode: 500 }) },
        { response: Promise.resolve({ _data: { member: mockResults } }) },
      ])
      const wrapper = mountComp()
      await typeInto(wrapper, '/ho')
      expect(wrapper.text()).toContain('Search failed')

      await typeInto(wrapper, '/home')
      expect(wrapper.text()).not.toContain('Search failed')
      expect(wrapper.findAll('button').length).toBeGreaterThan(0)
    })

    test('an older failure does not replace newer results', async () => {
      const older = deferredFetchResponse()
      const newer = deferredFetchResponse()
      mockCwaWithResponses([older.fetchReturn, newer.fetchReturn])
      const wrapper = mountComp()
      await typeInto(wrapper, '/ho')
      await typeInto(wrapper, '/home')

      newer.resolveWith(mockResults)
      await flushPromises()
      older.rejectWith({ statusCode: 500 })
      await flushPromises()

      expect(wrapper.text()).not.toContain('Search failed')
      expect(wrapper.findAll('button').length).toBeGreaterThan(0)
    })

    test('an older response does not replace newer results', async () => {
      const older = deferredFetchResponse()
      const newer = deferredFetchResponse()
      mockCwaWithResponses([older.fetchReturn, newer.fetchReturn])
      const wrapper = mountComp()
      await typeInto(wrapper, '/ho')
      await typeInto(wrapper, '/home')

      newer.resolveWith([{ '@id': '/_/routes//home', 'path': '/home' }])
      await flushPromises()
      older.resolveWith([{ '@id': '/_/routes//stale', 'path': '/stale' }])
      await flushPromises()

      expect(wrapper.text()).toContain('/home')
      expect(wrapper.text()).not.toContain('/stale')
    })
  })

  describe('unfocus timer', () => {
    test('blur on input does not immediately hide the panel', async () => {
      const wrapper = mountComp()
      await openDropdown(wrapper)

      await wrapper.find('input').trigger('blur')
      expect(wrapper.find('[data-testid="results-panel"]').exists()).toBe(true)
    })

    test('blur on input hides the panel after 100ms', async () => {
      const wrapper = mountComp()
      await openDropdown(wrapper)

      await wrapper.find('input').trigger('blur')
      vi.advanceTimersByTime(100)
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="results-panel"]').exists()).toBe(false)
    })
  })
})
