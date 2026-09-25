// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import ModalInput from '#cwa/templates/components/core/admin/form/ModalInput.vue'
import Publish from './Publish.vue'

const iri = ref('/component/draft')
const resourceData = ref<Record<string, any>>({})
const updateResource = vi.fn()

const mockCwa = {
  resources: {
    findDraftComponentIri: vi.fn(() => computed(() => undefined)),
    findPublishedComponentIri: vi.fn(() => computed(() => undefined)),
  },
  resourcesManager: { updateResource },
  admin: { resourceStackManager: { forcePublishedVersion: ref(false) } },
}

vi.mock('#cwa/composables/cwa-resource-manager-tab', () => ({
  useCwaResourceManagerTab: () => ({
    iri,
    resource: computed(() => ({ data: resourceData.value })),
    $cwa: mockCwa,
    exposeMeta: { disabled: ref(false) },
  }),
}))

const ButtonStub = {
  name: 'CwaUiFormButton',
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>',
}

function draft(publishedAt?: string | null) {
  resourceData.value = {
    '@id': iri.value,
    ...(publishedAt !== undefined ? { publishedAt } : {}),
    '_metadata': { publishable: { published: false } },
  }
}

function mountPublish() {
  return mount(Publish, { global: { stubs: { CwaUiFormButton: ButtonStub, CwaUiFormToggle: true } } })
}

function findButton(wrapper: ReturnType<typeof mountPublish>, label: string) {
  return wrapper.findAll('button').find(button => button.text() === label)
}

describe('Publish tab — scheduling a draft', () => {
  const originalTz = process.env.TZ

  beforeEach(() => {
    process.env.TZ = 'Europe/London'
    vi.useFakeTimers({ now: new Date('2026-09-25T12:00:00Z'), toFake: ['Date'] })
    updateResource.mockReset()
  })

  afterEach(() => {
    process.env.TZ = originalTz
    vi.useRealTimers()
  })

  test('saves a future time the editor picks, in their own timezone, as a UTC publishedAt on the draft', async () => {
    draft()
    const wrapper = mountPublish()

    await wrapper.findComponent(ModalInput).vm.$emit('update:modelValue', '2026-10-01T09:00')
    await findButton(wrapper, 'Schedule')!.trigger('click')
    await flushPromises()

    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(updateResource).toHaveBeenCalledWith({
      endpoint: '/component/draft',
      data: { publishedAt: '2026-10-01T08:00:00.000Z' },
    })
  })

  test('does not offer a time earlier than now', () => {
    draft()
    const wrapper = mountPublish()

    expect(wrapper.find('input[type="datetime-local"]').attributes('min')).toBe('2026-09-25T13:00')
  })

  test('a time that is already past when saved publishes now, as the Publish button does', async () => {
    draft()
    const wrapper = mountPublish()

    await wrapper.findComponent(ModalInput).vm.$emit('update:modelValue', '2026-09-25T10:00')
    await findButton(wrapper, 'Schedule')!.trigger('click')
    await flushPromises()

    expect(updateResource).toHaveBeenCalledWith({
      endpoint: '/component/draft',
      data: { publishedAt: '2026-09-25T12:00:00.000Z' },
    })
  })

  test('shows when a scheduled draft will publish, and the timezone it is shown in', () => {
    draft('2026-10-01T08:00:00+00:00')
    const wrapper = mountPublish()

    expect(wrapper.text()).toContain('Scheduled for 1 Oct 2026, 09:00')
    expect(wrapper.text()).toContain('Europe/London, UTC+01:00')
  })

  test('cancelling a schedule clears publishedAt so the draft stays a draft', async () => {
    draft('2026-10-01T08:00:00+00:00')
    const wrapper = mountPublish()

    await findButton(wrapper, 'Cancel schedule')!.trigger('click')
    await flushPromises()

    expect(updateResource).toHaveBeenCalledWith({
      endpoint: '/component/draft',
      data: { publishedAt: null },
    })
  })

  test('a draft with no schedule offers no cancel', () => {
    draft()
    const wrapper = mountPublish()

    expect(findButton(wrapper, 'Cancel schedule')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Scheduled for')
  })

  test('a live resource has nothing to schedule', () => {
    resourceData.value = {
      '@id': iri.value,
      'publishedAt': '2026-01-01T00:00:00+00:00',
      '_metadata': { publishable: { published: true } },
    }
    const wrapper = mountPublish()

    expect(wrapper.findComponent(ModalInput).exists()).toBe(false)
    expect(findButton(wrapper, 'Schedule')).toBeUndefined()
  })
})
