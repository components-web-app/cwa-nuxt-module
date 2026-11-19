// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { axe } from '../../../../../../test/utils/axe'
import { drawsOpenLine, drawsOpenState, failingInk, shownColour, shownFill } from '../../../../../../test/utils/kit-css'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'
import { announceKey } from '../ui/field-keys'
import BarSummary from './BarSummary.vue'
import Input from '../../ui/Input.vue'
import { fakeFieldModel } from '../../../../../../playground/app/kit/fake-field-model'
import { openBarStatus, registerInlineEditor } from '#cwa/admin/inline-editors'
import { formatDateTime } from '#cwa/resources/date-time-input'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

const iri = ref('/component/c1')
const requestCount = ref(0)
const data = ref<Record<string, any>>({})
const fieldStates = reactive<Record<string, CwaFieldState>>({})
const stackState = reactive<Record<string, any>>({})
const updateResource = vi.fn()

const cwa = vi.hoisted(() => ({}))
vi.mock('#cwa/composables/cwa', () => ({
  useCwa: () => Object.assign(cwa, {
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
      isIriPublishableEquivalent: () => false,
      getResource: () => ({ value: { data: data.value, fieldStates } }),
    },
    resourcesManager: { requestCount, updateResource },
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
    iri.value = '/component/c1'
    requestCount.value = 0
    for (const key of Object.keys(fieldStates)) {
      delete fieldStates[key]
    }
    for (const key of Object.keys(stackState)) {
      delete stackState[key]
    }
    updateResource.mockReset()
  })

  function inPageEditor(field = 'title', label?: string) {
    const element = document.createElement('h1')
    document.body.append(element)
    const retry = vi.fn(async () => {})
    const reset = vi.fn(async () => {})
    const unregisterEditor = registerInlineEditor(cwa, {
      key: { iri: () => iri.value, field },
      element: () => element,
      enabled: () => true,
      focus: vi.fn(),
      model: { model: ref('Mine'), remoteChange: ref(undefined), retry, reset },
      label,
    })
    const unregister = () => {
      unregisterEditor()
      element.remove()
    }
    return { retry, reset, unregister }
  }

  function failed(message?: string): CwaFieldState {
    return { status: 'error', waiting: false, slow: false, error: message ? { kind: 'server', message } : undefined }
  }

  const popover = () => document.querySelector<HTMLElement>('[data-testid="bar-summary-popover"]')
  const retryButton = () => popover()?.querySelector<HTMLElement>('[data-testid="field-status-retry"]')
  const resetButton = () => popover()?.querySelector<HTMLElement>('[data-testid="field-status-reset"]')

  test('an error from an in-page editor opens from the status: a popover naming the field and the reason, with Retry and Reset, and no field shown', async () => {
    const editor = inPageEditor('title', 'Title')
    fieldStates.title = failed('The server is unavailable.')
    const { wrapper, summary } = mountSummary()
    await nextTick()

    expect(summary().attributes('aria-label')).toBe('1 not saved, Retry or Reset')
    expect(summary().attributes('aria-haspopup')).toBe('dialog')
    expect(summary().attributes('aria-expanded')).toBe('false')
    expect(drawsOpenState(summary().element)).toBe(false)
    await summary().trigger('click')
    await vi.advanceTimersByTimeAsync(50)

    expect(wrapper.emitted('show')).toBeUndefined()
    expect(summary().attributes('aria-expanded')).toBe('true')
    expect(drawsOpenState(summary().element)).toBe(true)
    expect(drawsOpenLine(summary().element)).toBe(true)
    expect(popover()?.getAttribute('aria-label')).toBe('Title: not saved')
    expect(popover()?.textContent).toContain('Title: not saved')
    expect(popover()?.textContent).toContain('The server is unavailable.')
    expect(retryButton()).toBeTruthy()
    expect(resetButton()).toBeTruthy()
    editor.unregister()
  })

  test('Retry sends the field again through its editor\'s model, closes the popover and leaves focus on the status', async () => {
    const editor = inPageEditor()
    fieldStates.title = failed()
    const { summary } = mountSummary()
    await nextTick()
    await summary().trigger('click')
    await vi.advanceTimersByTimeAsync(50)

    expect(popover()?.textContent).toContain('title: not saved')
    expect(popover()?.textContent).toContain('The server couldn’t save this.')
    retryButton()!.click()
    await vi.advanceTimersByTimeAsync(50)

    expect(editor.retry).toHaveBeenCalledOnce()
    expect(editor.reset).not.toHaveBeenCalled()
    expect(popover()).toBeNull()
    expect(document.activeElement).toBe(summary().element)
    editor.unregister()
  })

  test('Reset puts the field back through its editor\'s model and sends nothing', async () => {
    const editor = inPageEditor()
    fieldStates.title = failed()
    const { summary } = mountSummary()
    await nextTick()
    await summary().trigger('click')
    await vi.advanceTimersByTimeAsync(50)

    resetButton()!.click()
    await vi.advanceTimersByTimeAsync(50)

    expect(editor.reset).toHaveBeenCalledOnce()
    expect(editor.retry).not.toHaveBeenCalled()
    expect(popover()).toBeNull()
    editor.unregister()
  })

  test('Escape from a failed in-page editor opens the popover with focus on Retry, and only for a field that has failed', async () => {
    const editor = inPageEditor('title', 'Title')
    fieldStates.title = failed()
    const { summary } = mountSummary()
    await nextTick()

    expect(openBarStatus(cwa, 'body')).toBe(false)
    expect(popover()).toBeNull()

    expect(openBarStatus(cwa, 'title')).toBe(true)
    await vi.advanceTimersByTimeAsync(50)

    expect(summary().attributes('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(retryButton())
    editor.unregister()
  })

  test('stops being where an in-page editor\'s Escape goes once unmounted', async () => {
    const editor = inPageEditor()
    fieldStates.title = failed()
    const { wrapper } = mountSummary()
    await nextTick()

    wrapper.unmount()
    expect(openBarStatus(cwa, 'title')).toBe(false)
    editor.unregister()
  })

  test('a conflict on a field an in-page editor holds still shows the field, and Escape there opens nothing', async () => {
    const editor = inPageEditor()
    fieldStates.title = of('conflict')
    const { wrapper, summary } = mountSummary()
    await nextTick()

    expect(openBarStatus(cwa, 'title')).toBe(false)
    await summary().trigger('click')
    await vi.advanceTimersByTimeAsync(50)

    expect(wrapper.emitted('show')).toEqual([['title']])
    expect(popover()).toBeNull()
    editor.unregister()
  })

  test('an error with no in-page editor still shows the field in the bar, whose own status popover has Retry and Reset', async () => {
    fieldStates.title = failed()
    const { wrapper, summary } = mountSummary()
    await nextTick()

    expect(summary().attributes('aria-label')).toBe('1 not saved, show the field')
    await summary().trigger('click')
    await vi.advanceTimersByTimeAsync(50)

    expect(wrapper.emitted('show')).toEqual([['title']])
    expect(popover()).toBeNull()
  })

  const DRAFT_ABOUT = 'This is unpublished, so only content administrators can see it. Publish it when you are ready for it to go live.'
  const LIVE_DRAFT_ABOUT = 'These changes are unpublished, so visitors still see the live version and only content administrators see this draft. Publish it when you are ready for the changes to go live.'
  const LIVE_ABOUT = 'This is published, so visitors can see it. Your changes are saved as a draft, which goes live when you publish it.'

  test.each([
    ['a draft', () => draft(), 'Draft', DRAFT_ABOUT],
    ['a draft of a live component', () => {
      data.value = { '@id': iri.value, 'publishedResource': '/component/live', '_metadata': { publishable: { published: false } } }
    }, 'Draft', LIVE_DRAFT_ABOUT],
    ['a live resource', () => {
      data.value = { '@id': iri.value, '_metadata': { publishable: { published: true } } }
    }, 'Live', LIVE_ABOUT],
    ['a component not added yet', () => {
      iri.value = NEW_RESOURCE_IRI
    }, 'New', 'This component has not been added yet. Add it to place it on the page.'],
    ['a component group', () => {
      iri.value = '/_/component_groups/g1'
      data.value = { '@id': iri.value, '_metadata': {} }
    }, 'Group', 'A component group holds the components placed in it. It is not published itself: each of its components is.'],
    ['a resource that is not published separately', () => {
      iri.value = '/_/component_positions/p1'
      data.value = { '@id': iri.value, '_metadata': {} }
    }, 'Saved', 'All changes are saved. This is not published separately, so visitors see changes as soon as they are saved.'],
  ])('at rest, %s shows only its status word, is named by it, and opens a popover explaining it', async (_label, given, word, about) => {
    given()
    const { summary, wrapper } = mountSummary()

    expect(summary().element.tagName).toBe('BUTTON')
    expect(summary().attributes('aria-label')).toBe(`Status: ${word}`)
    expect(summary().text()).toBe(word)
    expect(summary().attributes('aria-expanded')).toBe('false')
    expect(popover()).toBeNull()

    await summary().trigger('click')
    await nextTick()

    expect(popover()?.getAttribute('aria-label')).toBe(word)
    expect(popover()?.querySelector('p')?.textContent?.trim()).toBe(about)
    expect(document.getElementById(popover()!.getAttribute('aria-describedby')!)?.textContent?.trim()).toBe(about)
    expect(summary().attributes('aria-expanded')).toBe('true')
    expect(wrapper.emitted('show')).toBeUndefined()
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1)
  })

  test.each([
    ['a scheduled draft', () => draft('2026-10-01T08:00:00Z'), (date: string) => `This is unpublished until ${date}, when it goes live. Until then only content administrators can see it.`],
    ['a scheduled draft of a live component', () => {
      data.value = { '@id': iri.value, 'publishedAt': '2026-10-01T08:00:00Z', 'publishedResource': '/component/live', '_metadata': { publishable: { published: false } } }
    }, (date: string) => `Visitors see the live version until ${date}, when these changes go live. Until then only content administrators see this draft.`],
  ])('%s reads Scheduled and its popover names the date as the date picker shows it', async (_label, given, about) => {
    given()
    const { summary } = mountSummary()

    expect(summary().attributes('aria-label')).toBe('Status: Scheduled')
    expect(summary().text()).toBe('Scheduled')
    await summary().trigger('click')
    await nextTick()

    expect(popover()?.querySelector('p')?.textContent?.trim()).toBe(about(formatDateTime('2026-10-01T08:00:00Z')))
  })

  test.each([
    ['Draft', () => draft(), 'muted-on-info'],
    ['Scheduled', () => draft('2026-10-01T08:00:00Z'), 'accent-on-info'],
    ['Live', () => {
      data.value = { '@id': iri.value, '_metadata': { publishable: { published: true } } }
    }, 'success-on-info'],
    ['New', () => {
      iri.value = NEW_RESOURCE_IRI
    }, 'muted-on-info'],
    ['Group', () => {
      iri.value = '/_/component_groups/g1'
      data.value = { '@id': iri.value, '_metadata': {} }
    }, 'muted-on-info'],
    ['Saved', () => {
      iri.value = '/_/component_positions/p1'
      data.value = { '@id': iri.value, '_metadata': {} }
    }, 'success-on-info'],
  ])('%s explains itself on the dark info panel in both themes: its glyph in a colour made for the panel, white text and a white Close, each passing on it (#461)', async (word, given, glyphColour) => {
    given()
    const { summary } = mountSummary()

    await summary().trigger('click')
    await nextTick()

    const panel = popover()!
    expect(panel.getAttribute('aria-label')).toBe(word)
    expect(shownFill(panel)).toBe('surface-info')
    expect(shownColour(panel.querySelector('[data-glyph]')!)).toBe(glyphColour)
    expect(shownColour(panel.querySelector('p')!)).toBe('white')
    expect(shownColour(panel.querySelector('button[aria-label="Close"] svg')!)).toBe('white')
    expect(failingInk(panel)).toEqual([])
  })

  test('the explanation is the info panel, and clicking the status again closes it', async () => {
    draft()
    const { summary } = mountSummary()
    const press = async () => {
      summary().element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))
      await flushPromises()
      await summary().trigger('click')
      await flushPromises()
    }

    await press()
    expect(popover()?.classList).toContain('cwa:bg-surface-info')
    expect(popover()?.classList).toContain('cwa:ring-white/15')
    expect(summary().attributes('aria-expanded')).toBe('true')
    await vi.advanceTimersByTimeAsync(0)

    await press()
    expect(popover()).toBeNull()
    expect(summary().attributes('aria-expanded')).toBe('false')
  })

  test('from the keyboard, Enter opens the explanation, and Escape or its Close closes it with focus back on the status', async () => {
    draft()
    const { summary } = mountSummary()
    summary().element.focus()

    await summary().trigger('click')
    await flushPromises()
    expect(popover()).not.toBeNull()
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(popover()).toBeNull()
    expect(document.activeElement).toBe(summary().element)

    await summary().trigger('click')
    await flushPromises()
    popover()!.querySelector<HTMLElement>('[aria-label="Close"]')!.click()
    await flushPromises()
    expect(popover()).toBeNull()
    expect(document.activeElement).toBe(summary().element)
  })

  test('Close on an in-page editor\'s error popover closes it with focus back on the status, and it stays closed', async () => {
    const editor = inPageEditor('title', 'Title')
    fieldStates.title = failed()
    const { summary } = mountSummary()
    await nextTick()
    await summary().trigger('click')
    await vi.advanceTimersByTimeAsync(50)

    popover()!.querySelector<HTMLElement>('[aria-label="Close"]')!.click()
    await vi.advanceTimersByTimeAsync(400)

    expect(popover()).toBeNull()
    expect(summary().attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(summary().element)
    editor.unregister()
  })

  describe('beside a field in error, only one status popover shows (#461)', () => {
    function mountWithField() {
      const model = fakeFieldModel<string>('Mine', 'error')
      const wrapper = mount(defineComponent({
        setup: () => () => h('div', [h(Input, { label: 'Heading', model }), h(BarSummary, { message: '' })]),
      }), { global: { provide: { [announceKey as symbol]: vi.fn() } }, attachTo: document.body })
      const box = wrapper.get('input').element.closest<HTMLElement>('.cwa\\:relative:not(.cwa\\:group\\/field)')!
      return { box, summary: () => wrapper.get('[data-testid="bar-summary"]') }
    }

    const fieldPopover = () => document.querySelector('[data-testid="field-status-popover"]')

    test('hovering the field while the status explanation is open closes the explanation and shows the field\'s popover', async () => {
      draft()
      const { box, summary } = mountWithField()
      await flushPromises()
      await summary().trigger('click')
      await flushPromises()
      expect(popover()).not.toBeNull()

      box.dispatchEvent(new MouseEvent('mouseenter'))
      await vi.advanceTimersByTimeAsync(310)

      expect(fieldPopover()).not.toBeNull()
      expect(popover()).toBeNull()
      expect(summary().attributes('aria-expanded')).toBe('false')
    })

    test('opening the status explanation while the field\'s popover is open hides the field\'s', async () => {
      draft()
      const { box, summary } = mountWithField()
      await flushPromises()
      box.dispatchEvent(new MouseEvent('mouseenter'))
      await vi.advanceTimersByTimeAsync(310)
      expect(fieldPopover()).not.toBeNull()

      await summary().trigger('click')
      await flushPromises()

      expect(popover()).not.toBeNull()
      expect(fieldPopover()).toBeNull()
    })
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

  test('a publish that failed reads as not published, never as all changes saved, is announced, and the status retries it', async () => {
    const { summary, announce } = mountSummary()

    requestCount.value = 1
    stackState.publishSaving = true
    await nextTick()
    stackState.publishSaving = false
    stackState.publishFailed = 'now'
    requestCount.value = 0
    await nextTick()
    vi.advanceTimersByTime(300)
    await nextTick()

    expect(announce).toHaveBeenLastCalledWith('Not published')
    expect(summary().attributes('data-state')).toBe('error')
    expect(summary().element.tagName).toBe('BUTTON')
    expect(summary().attributes('aria-label')).toBe('Not published, retry')
    expect(summary().text()).toContain('Not published · Retry')

    await summary().trigger('click')
    expect(updateResource).toHaveBeenCalledWith({ endpoint: '/component/c1', data: { publishedAt: 'now' }, retry: expect.any(Function) })
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

  test('has no axe violations with the explanation open', async () => {
    draft()
    const { summary } = mountSummary()
    await summary().trigger('click')
    await flushPromises()
    expect(popover()).not.toBeNull()

    vi.useRealTimers()
    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('the status draws its focus ring when focused from the keyboard', () => {
    expect(drawsFocusRing(mountSummary().summary().classes())).toBe(true)
  })
})
