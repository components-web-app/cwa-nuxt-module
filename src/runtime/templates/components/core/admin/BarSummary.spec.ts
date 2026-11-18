// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick, reactive, ref } from 'vue'
import { axe } from '../../../../../../test/utils/axe'
import { announceKey } from '../ui/field-keys'
import BarSummary from './BarSummary.vue'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

const iri = ref('/component/c1')
const requestCount = ref(0)
const data = ref<Record<string, any>>({})
const fieldStates = reactive<Record<string, CwaFieldState>>({})
const stackState = reactive<Record<string, any>>({})

vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => ({
    admin: {
      resourceStackManager: {
        currentIri: iri,
        getState: (key: string) => stackState[key],
        setState: (key: string, value: any) => {
          stackState[key] = value
        },
      },
    },
    resources: {
      findAllPublishableIris: (each: string) => [each],
      getResource: () => ({ value: { data: data.value, fieldStates } }),
    },
    resourcesManager: { requestCount },
  }),
}))

enableAutoUnmount(afterEach)

const of = (status: CwaFieldState['status']): CwaFieldState => ({ status, waiting: false, slow: false })

function mountSummary(announce = vi.fn()) {
  const wrapper = mount(BarSummary, { props: { message: '' }, global: { provide: { [announceKey as symbol]: announce } }, attachTo: document.body })
  return { wrapper, announce, summary: () => wrapper.get('[data-testid="bar-summary"]') }
}

function draft(publishedAt?: string) {
  data.value = { '@id': iri.value, publishedAt, '_metadata': { publishable: { published: false } } }
}

describe('BarSummary (#459)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-09-25T12:00:00Z') })
    draft()
  })
  afterEach(() => {
    vi.useRealTimers()
    requestCount.value = 0
    for (const key of Object.keys(fieldStates)) {
      delete fieldStates[key]
    }
  })

  test.each([
    ['a draft', () => draft(), 'Draft · not live'],
    ['a scheduled draft', () => draft('2026-10-01T08:00:00Z'), 'Scheduled ·'],
    ['a live resource', () => {
      data.value = { '@id': iri.value, '_metadata': { publishable: { published: true } } }
    }, 'Live'],
  ])('at rest, %s reads its publish state as status text, not as a control', (_label, given, text) => {
    given()
    const { summary } = mountSummary()

    expect(summary().element.tagName).toBe('SPAN')
    expect(summary().text()).toContain(`Status: ${text}`)
  })

  test('saving shows a spinner, announces "Saving…" only after a second, then holds over a short gap and says all changes saved', async () => {
    const { summary, announce } = mountSummary()

    requestCount.value = 1
    await nextTick()
    expect(summary().attributes('data-state')).toBe('saving')
    vi.advanceTimersByTime(900)
    expect(announce).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(announce).toHaveBeenCalledWith('Saving…')

    requestCount.value = 0
    await nextTick()
    vi.advanceTimersByTime(200)
    requestCount.value = 1
    await nextTick()
    requestCount.value = 0
    await nextTick()
    vi.advanceTimersByTime(250)
    await nextTick()
    expect(summary().attributes('data-state')).toBe('saving')
    vi.advanceTimersByTime(100)
    await nextTick()
    expect(summary().attributes('data-state')).toBe('saved')
    expect(announce).toHaveBeenLastCalledWith('All changes saved')
    vi.advanceTimersByTime(1200)
    await nextTick()
    expect(summary().attributes('data-state')).toBe('rest')
  })

  test('with fields to fix it is a button that counts them and shows the first conflict before any error', async () => {
    fieldStates.title = of('error')
    fieldStates.body = of('conflict')
    const { wrapper, summary } = mountSummary()
    await nextTick()

    expect(summary().element.tagName).toBe('BUTTON')
    expect(summary().attributes('aria-label')).toBe('1 conflict · 1 not saved, show the field')
    await summary().trigger('click')
    expect(wrapper.emitted('show')).toEqual([['body']])
  })

  test('voices the message it is given in its polite live region', async () => {
    const { wrapper } = mountSummary()
    await wrapper.setProps({ message: 'Set to 6, the highest position' })

    const region = wrapper.get('[data-testid="bar-live-region"]')
    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.text()).toBe('Set to 6, the highest position')
  })

  test.each([[{}], [{ title: of('error') }]])('has no axe violations (%o)', async (states) => {
    Object.assign(fieldStates, states)
    const { wrapper } = mountSummary()
    await nextTick()

    vi.useRealTimers()
    expect(await axe(wrapper.element.parentElement as HTMLElement)).toHaveNoViolations()
  })
})
