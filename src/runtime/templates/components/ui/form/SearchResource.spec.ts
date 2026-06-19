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

function mockCwaImpl(opts: { results?: any[], currentResource?: any } = {}) {
  vi.spyOn(cwaComposable, 'useCwa').mockReturnValue({
    fetchResource: vi.fn().mockResolvedValue(opts.currentResource ?? null),
    fetch: vi.fn().mockReturnValue({
      response: Promise.resolve({ _data: { member: opts.results ?? mockResults } }),
    }),
  } as any)
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
      // not yet hidden — unfocus has a 100ms delay
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

      // mousedown on panel — with @mousedown.prevent the input won't blur
      await wrapper.find('[data-testid="results-panel"]').trigger('mousedown')
      // panel should still be visible (focussed not changed by mousedown alone)
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
      // results are reversed in displaySearchResults, so index 0 is the last result
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
      // panel still visible — unfocus has not fired yet
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
