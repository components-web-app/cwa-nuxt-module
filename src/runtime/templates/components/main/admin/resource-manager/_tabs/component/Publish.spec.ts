// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { resetLocalTimeZone } from '@internationalized/date'
import DatePicker from '#cwa/templates/components/ui/DatePicker.vue'
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

const ToggleStub = {
  name: 'CwaUiFormToggle',
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)">',
}

function mountPublish() {
  return mount(Publish, { global: { stubs: { CwaUiFormButton: ButtonStub, CwaUiFormToggle: ToggleStub } } })
}

async function turnOnScheduling(wrapper: ReturnType<typeof mountPublish>) {
  await wrapper.find('[data-schedule-toggle]').setValue(true)
}

function findButton(wrapper: ReturnType<typeof mountPublish>, label: string) {
  return wrapper.findAll('button').find(button => button.text() === label)
}

describe('Publish tab — scheduling a draft', () => {
  const originalTz = process.env.TZ

  beforeEach(() => {
    process.env.TZ = 'Europe/London'
    resetLocalTimeZone()
    vi.useFakeTimers({ now: new Date('2026-09-25T12:00:00Z'), toFake: ['Date'] })
    updateResource.mockReset()
  })

  afterEach(() => {
    process.env.TZ = originalTz
    resetLocalTimeZone()
    vi.useRealTimers()
  })

  test('a draft offers Publish now, with no date picker, until scheduling is switched on', () => {
    draft()
    const wrapper = mountPublish()

    expect(wrapper.find('[data-schedule-toggle]').element).toHaveProperty('checked', false)
    expect(findButton(wrapper, 'Publish now')).toBeDefined()
    expect(findButton(wrapper, 'Schedule')).toBeUndefined()
    expect(wrapper.findComponent(DatePicker).exists()).toBe(false)
  })

  test('Publish now publishes the draft at the current time', async () => {
    draft()
    const wrapper = mountPublish()

    await findButton(wrapper, 'Publish now')!.trigger('click')
    await flushPromises()

    expect(updateResource).toHaveBeenCalledWith({
      endpoint: '/component/draft',
      data: { publishedAt: '2026-09-25T12:00:00.000Z' },
    })
  })

  test('switching scheduling on shows the date picker, offering nothing earlier than now, and a Schedule button', async () => {
    draft()
    const wrapper = mountPublish()

    await turnOnScheduling(wrapper)

    expect(wrapper.findComponent(DatePicker).props('min')).toBe('2026-09-25T12:00:00.000Z')
    expect(findButton(wrapper, 'Schedule')).toBeDefined()
    expect(findButton(wrapper, 'Publish now')).toBeUndefined()
  })

  test('saves the future time the editor picks as publishedAt on the draft', async () => {
    draft()
    const wrapper = mountPublish()
    await turnOnScheduling(wrapper)

    await wrapper.findComponent(DatePicker).vm.$emit('update:modelValue', '2026-10-01T08:00:00.000Z')
    await findButton(wrapper, 'Schedule')!.trigger('click')
    await flushPromises()

    expect(updateResource).toHaveBeenCalledTimes(1)
    expect(updateResource).toHaveBeenCalledWith({
      endpoint: '/component/draft',
      data: { publishedAt: '2026-10-01T08:00:00.000Z' },
    })
  })

  test('a time that is already past when saved publishes now, as Publish now does', async () => {
    draft()
    const wrapper = mountPublish()
    await turnOnScheduling(wrapper)

    await wrapper.findComponent(DatePicker).vm.$emit('update:modelValue', '2026-09-25T09:00:00.000Z')
    await findButton(wrapper, 'Schedule')!.trigger('click')
    await flushPromises()

    expect(updateResource).toHaveBeenCalledWith({
      endpoint: '/component/draft',
      data: { publishedAt: '2026-09-25T12:00:00.000Z' },
    })
  })

  test('a scheduled draft opens with scheduling on, reads Scheduled, and has its date in the picker', () => {
    draft('2026-10-01T08:00:00+00:00')
    const wrapper = mountPublish()

    expect(wrapper.find('[data-schedule-toggle]').element).toHaveProperty('checked', true)
    expect(wrapper.find('[data-publish-state]').text()).toBe('Scheduled')
    expect(wrapper.findComponent(DatePicker).props('modelValue')).toBe('2026-10-01T08:00:00+00:00')
  })

  test('an unscheduled draft reads Draft', () => {
    draft()
    const wrapper = mountPublish()

    expect(wrapper.find('[data-publish-state]').text()).toBe('Draft')
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

  test('a draft with no schedule offers no cancel, even with scheduling switched on', async () => {
    draft()
    const wrapper = mountPublish()
    await turnOnScheduling(wrapper)

    expect(findButton(wrapper, 'Cancel schedule')).toBeUndefined()
  })

  test('a live resource has nothing to schedule', () => {
    resourceData.value = {
      '@id': iri.value,
      'publishedAt': '2026-01-01T00:00:00+00:00',
      '_metadata': { publishable: { published: true } },
    }
    const wrapper = mountPublish()

    expect(wrapper.findComponent(DatePicker).exists()).toBe(false)
    expect(findButton(wrapper, 'Schedule')).toBeUndefined()
    expect(findButton(wrapper, 'Publish now')).toBeUndefined()
  })
})
