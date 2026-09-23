// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import SearchResource from './SearchResource.vue'
import * as cwaComposable from '#cwa/composables/cwa'

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
