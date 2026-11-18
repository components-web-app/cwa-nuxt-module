// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { computed, reactive, ref } from 'vue'
import { resetLocalTimeZone } from '@internationalized/date'
import { axe } from '../../../../../../../../../test/utils/axe'
import Publish from './Publish.vue'

const iri = ref('/component/draft')
const resourceData = ref<Record<string, any>>({})
const updateResource = vi.fn()
const alternate = ref<string | undefined>()
const state: Record<string, any> = reactive({})

const mockCwa = {
  resources: {
    getResource: vi.fn(() => computed(() => ({ data: resourceData.value }))),
    findDraftComponentIri: vi.fn(() => computed(() => alternate.value)),
    findPublishedComponentIri: vi.fn(() => computed(() => alternate.value)),
  },
  resourcesManager: { updateResource },
  admin: {
    resourceStackManager: {
      forcePublishedVersion: ref<boolean | undefined>(false),
      currentIri: iri,
      getState: (key: string) => state[key],
      setState: (key: string, value: any) => {
        state[key] = value
      },
    },
  },
}

vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => mockCwa }))

vi.mock('#cwa/composables/cwa-resource-manager-tab', () => ({
  useCwaResourceManagerTab: () => ({
    iri,
    resource: computed(() => ({ data: resourceData.value })),
    $cwa: mockCwa,
    exposeMeta: { disabled: ref(false), fields: [] },
  }),
}))

const DatePicker = {
  name: 'DatePicker',
  props: ['modelValue', 'min', 'label'],
  emits: ['update:modelValue'],
  template: '<input :aria-label="label" :value="modelValue">',
}

function mountPublish(attachTo?: HTMLElement) {
  return mount(Publish, { attachTo, global: { stubs: { DatePicker } } })
}

function draft(publishedAt?: string | null) {
  resourceData.value = {
    '@id': iri.value,
    ...(publishedAt !== undefined ? { publishedAt } : {}),
    '_metadata': { publishable: { published: false } },
  }
}

function switchNamed(wrapper: ReturnType<typeof mountPublish>, name: string) {
  const label = wrapper.findAll('label').find(each => each.text() === name)
  return label ? wrapper.get(`#${label.attributes('for')}`) : undefined
}

enableAutoUnmount(afterEach)

describe('Publish tab on the kit (#459)', () => {
  const originalTz = process.env.TZ

  beforeEach(() => {
    process.env.TZ = 'Europe/London'
    resetLocalTimeZone()
    vi.useFakeTimers({ now: new Date('2026-09-25T12:00:00Z'), toFake: ['Date'] })
    updateResource.mockReset()
    alternate.value = undefined
    mockCwa.admin.resourceStackManager.forcePublishedVersion.value = false
    for (const key of Object.keys(state)) {
      delete state[key]
    }
  })

  afterEach(() => {
    process.env.TZ = originalTz
    resetLocalTimeZone()
    vi.useRealTimers()
  })

  test('is one manager-tab row whose publish action is pinned in the bar, not in the tab', () => {
    draft()
    const wrapper = mountPublish()

    expect(wrapper.find('[data-testid="manager-tab"]').exists()).toBe(true)
    expect(wrapper.findAll('button').map(button => button.text())).not.toContain('Publish now')
    expect(wrapper.findAll('button').map(button => button.text())).not.toContain('Schedule')
  })

  test('a draft has a Schedule switch, off, and no date picker until it is switched on', () => {
    draft()
    const wrapper = mountPublish()

    expect(switchNamed(wrapper, 'Schedule')!.attributes('role')).toBe('switch')
    expect(switchNamed(wrapper, 'Schedule')!.attributes('aria-checked')).toBe('false')
    expect(wrapper.findComponent(DatePicker).exists()).toBe(false)
  })

  test('switching scheduling on shows the date picker, offering nothing earlier than now, and shares the choice with the bar', async () => {
    draft()
    const wrapper = mountPublish()

    await switchNamed(wrapper, 'Schedule')!.trigger('click')

    expect(state.publishScheduling).toBe(true)
    expect(wrapper.findComponent(DatePicker).props('min')).toBe('2026-09-25T12:00:00.000Z')
    await wrapper.findComponent(DatePicker).vm.$emit('update:modelValue', '2026-10-01T08:00:00.000Z')
    expect(state.publishScheduleValue).toBe('2026-10-01T08:00:00.000Z')
  })

  test('a scheduled draft opens with scheduling on and has its date in the picker', () => {
    draft('2026-10-01T08:00:00+00:00')
    const wrapper = mountPublish()

    expect(switchNamed(wrapper, 'Schedule')!.attributes('aria-checked')).toBe('true')
    expect(wrapper.findComponent(DatePicker).props('modelValue')).toBe('2026-10-01T08:00:00+00:00')
  })

  test('a live resource with no draft has nothing to schedule and says so', () => {
    resourceData.value = {
      '@id': iri.value,
      'publishedAt': '2026-01-01T00:00:00+00:00',
      '_metadata': { publishable: { published: true } },
    }
    const wrapper = mountPublish()

    expect(wrapper.findComponent(DatePicker).exists()).toBe(false)
    expect(switchNamed(wrapper, 'Schedule')).toBeUndefined()
    expect(wrapper.text()).toContain('There is no draft to publish')
  })

  test('with both versions, Edit published version switches what the bar edits, and explains itself in an info popover', async () => {
    draft()
    alternate.value = '/component/live'
    const wrapper = mountPublish()

    expect(wrapper.find('[data-testid="field-info"]').attributes('aria-label')).toBe('About Edit published version')
    await switchNamed(wrapper, 'Edit published version')!.trigger('click')

    expect(mockCwa.admin.resourceStackManager.forcePublishedVersion.value).toBe(true)
  })

  test('has no axe violations', async () => {
    draft('2026-10-01T08:00:00+00:00')
    alternate.value = '/component/live'
    const wrapper = mountPublish(document.body)

    expect(await axe(wrapper.element as HTMLElement)).toHaveNoViolations()
  })
})
