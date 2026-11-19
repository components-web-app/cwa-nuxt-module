// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, inject, reactive, ref } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import { fakeDialogForm } from '../../../../../playground/app/kit/fake-dialog-form'
import type { FakeDialogForm } from '../../../../../playground/app/kit/fake-dialog-form'
import Dialog from './Dialog.vue'
import Input from './Input.vue'
import Toggle from './Toggle.vue'
import { dialogSubViewKey } from '../core/ui/field-keys'
import type { DialogSubFooter, DialogSubViewContext, DialogSubViewGuard } from '../core/ui/field-keys'

const { confirmMock } = vi.hoisted(() => ({ confirmMock: vi.fn() }))
vi.mock('#cwa/composables/cwa-confirm', () => ({ useCwaConfirm: () => confirmMock }))

enableAutoUnmount(afterEach)

const tabs = [
  { key: 'details', label: 'Details' },
  { key: 'seo', label: 'Search engines' },
  { key: 'info', label: 'Info' },
]

function mountDialog(form: FakeDialogForm, props: Record<string, unknown> = {}) {
  const Host = defineComponent({
    setup() {
      return () => h(Dialog, { title: 'Kitchens', tabs, form, onSave: () => form.save(), ...props }, {
        details: () => [
          h(Input, { label: 'Reference', field: 'reference', description: 'Only admins see this.' }),
          h(Toggle, { label: 'Public without a route', field: 'isReachableWithoutRoute' }),
        ],
        seo: () => h(Input, { label: 'SEO page title', field: 'title', optional: true }),
        info: () => h('p', 'Created yesterday'),
      })
    },
  })
  return mount(Host, { attachTo: document.body })
}

const dialog = () => document.querySelector<HTMLElement>('[data-testid="dialog"]')!
const q = <T extends HTMLElement = HTMLElement>(selector: string) => dialog().querySelector<T>(selector)
const qa = (selector: string) => [...dialog().querySelectorAll<HTMLElement>(selector)]
const save = () => q<HTMLButtonElement>('[data-testid="dialog-save"]')!
const tab = (label: string) => qa('[role="tab"]').find(element => element.textContent?.trim().startsWith(label))!

function shown(element: HTMLElement) {
  const copy = element.cloneNode(true) as HTMLElement
  copy.querySelectorAll('.cwa\\:sr-only').forEach(hidden => hidden.remove())
  return copy.textContent?.trim()
}

async function type(selector: string, value: string) {
  const input = q<HTMLInputElement>(selector)!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('CwaUiDialog and the Save model (#461)', () => {
  let form: FakeDialogForm

  beforeEach(() => {
    vi.clearAllMocks()
    form = fakeDialogForm({ reference: 'Kitchens', title: 'Hand-built kitchens', isReachableWithoutRoute: false })
  })

  test('opens with focus on its title, never on a header control such as the page type select, the view link or the depth chain, where a stray key would act (#461)', async () => {
    const Host = defineComponent({
      setup() {
        return () => h(Dialog, { title: 'Kitchens', tabs, form, onSave: () => form.save() }, {
          'header-actions': () => h('button', { 'type': 'button', 'data-testid': 'page-type' }, 'Static'),
          'subheader': () => h('nav', [h('a', { 'href': '/kitchens', 'data-testid': 'depth-link' }, 'Kitchens')]),
          'details': () => h(Input, { label: 'Reference', field: 'reference' }),
        })
      },
    })
    mount(Host, { attachTo: document.body })
    await flushPromises()

    const title = document.getElementById(dialog().getAttribute('aria-labelledby')!)!
    expect(document.activeElement).toBe(title)
    expect(title.getAttribute('tabindex')).toBe('-1')
    expect(q('[data-testid="page-type"]')).not.toBeNull()
  })

  test('is a modal dialog named by its title, with tabs, panels and a footer of Cancel and Save only', async () => {
    mountDialog(form)
    await flushPromises()

    expect(dialog().getAttribute('role')).toBe('dialog')
    const titleId = dialog().getAttribute('aria-labelledby')!
    expect(document.getElementById(titleId)?.tagName).toBe('H2')
    expect(document.getElementById(titleId)?.textContent?.trim()).toBe('Kitchens')
    expect(qa('[role="tab"]').map(element => element.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false'])
    expect(qa('footer button').map(shown)).toEqual(['Cancel', 'Save'])
  })

  test.each([true, false])('opens with its title as reka\'s DialogTitle, so reka logs no warning (loading: %s)', async (loading) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mountDialog(form, { loading, placement: 'right' })
    await flushPromises()

    expect(warn.mock.calls.filter(call => String(call[0]).includes('DialogTitle'))).toEqual([])
    expect(document.getElementById(dialog().getAttribute('aria-labelledby')!)?.textContent?.trim()).toBe('Kitchens')
    expect(q('[role="tablist"]')!.getAttribute('aria-labelledby')).toBe(dialog().getAttribute('aria-labelledby'))
    warn.mockRestore()
  })

  test('while its resource loads the dialog is already open with its header and footer: the body is busy with a spinner, the loading is announced, and Save stays off even with a change waiting', async () => {
    const loading = ref(true)
    const Host = defineComponent({
      setup: () => () => h(Dialog, { title: 'Page', tabs, form, noun: 'page', loading: loading.value }, {
        details: () => h(Input, { label: 'Reference', field: 'reference' }),
      }),
    })
    mount(Host, { attachTo: document.body })
    await flushPromises()

    expect(q('h2')!.textContent!.trim()).toBe('Page')
    expect(q('[data-testid="dialog-body"]')!.getAttribute('aria-busy')).toBe('true')
    expect(q('[data-testid="dialog-body"] [data-testid="dialog-loading"] .cwa\\:animate-spinner')).not.toBeNull()
    expect(q('[data-cwa-field="reference"]')).toBeNull()
    expect(q('[data-testid="dialog-announcer"]')!.textContent).toBe('Loading the page.')
    expect(save().getAttribute('aria-disabled')).toBe('true')

    loading.value = false
    await flushPromises()
    expect(q('[data-testid="dialog-announcer"]')!.textContent).toBe('Page loaded.')
    await type('[data-cwa-field="reference"] input', 'Our kitchens')
    expect(save().getAttribute('aria-disabled')).toBeNull()
    expect(q('[data-testid="dialog-body"]')!.getAttribute('aria-busy')).toBeNull()

    loading.value = true
    await flushPromises()
    expect(save().getAttribute('aria-disabled')).toBe('true')
    expect(save().getAttribute('aria-describedby') && document.getElementById(save().getAttribute('aria-describedby')!)?.textContent?.trim()).toBe('Still loading.')
    save().click()
    await flushPromises()
    expect(form.saves).toEqual([])
  })

  describe('announcing a save that worked (4.1.3)', () => {
    const announced = () => q('[data-testid="dialog-announcer"]')!.textContent

    test('a save says what was saved, each time, and a failed one does not', async () => {
      mountDialog(form, { noun: 'blog article' })
      await flushPromises()
      await type('[data-cwa-field="reference"] input', 'Kitchens and baths')
      save().click()
      await flushPromises()
      expect(announced()).toBe('Blog article saved.')

      await type('[data-cwa-field="reference"] input', 'Baths')
      form.failNext({ reference: 'Too short.' })
      save().click()
      await flushPromises()
      expect(announced()).not.toBe('Blog article saved.')

      await type('[data-cwa-field="reference"] input', 'Bathrooms')
      save().click()
      await flushPromises()
      expect(announced()).toBe('Blog article saved.')
    })

    test.each([
      ['a page, naming the tab it moved to', 'page', tabs, 'Page created. Info tab open.'],
      ['a layout, which has no tabs', 'layout', undefined, 'Layout created.'],
    ])('a create says so for %s', async (_, noun, dialogTabs, text) => {
      const state = reactive({ createNoun: noun as string | undefined, tab: 'details' })
      mount(defineComponent({ setup: () => () => h(Dialog, { title: 'New', form, noun, tabs: dialogTabs, createNoun: state.createNoun, tab: dialogTabs ? state.tab : undefined }) }), { attachTo: document.body })
      await flushPromises()
      expect(announced()).toBe('')

      state.createNoun = undefined
      state.tab = 'info'
      await flushPromises()
      expect(announced()).toBe(text)
    })
  })

  describe('the header line while its resource loads', () => {
    function reduceMotion(reduced: boolean) {
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({ matches: query.includes('reduce') ? reduced : false, media: query }) as unknown as MediaQueryList)
    }

    function mountLoading(start: { loading?: boolean, loadFailed?: boolean } = {}) {
      const state = reactive({ loading: false, loadFailed: false, kind: undefined as undefined | { tone: string, label: string }, ...start })
      mount(defineComponent({ setup: () => () => h(Dialog, { title: 'Page', form, noun: 'page', placement: 'right', ...state }) }), { attachTo: document.body })
      return state
    }

    const edge = () => q('[data-testid="dialog-edge"]')
    const header = () => q('[data-testid="dialog-header"]')!

    afterEach(() => {
      vi.restoreAllMocks()
    })

    test('sweeps over the neutral line while loading, and on arrival reveals the kind\'s colour from the start edge, over the line without taking room', async () => {
      reduceMotion(false)
      const state = mountLoading({ loading: true })
      await flushPromises()
      expect(edge()!.getAttribute('data-edge')).toBe('loading')
      expect(edge()!.getAttribute('aria-hidden')).toBe('true')
      expect(edge()!.className).toContain('cwa:dialog-edge')
      expect(header().className).toContain('cwa:border-line')

      state.kind = { tone: 'static', label: 'Static' }
      state.loading = false
      await flushPromises()
      expect(edge()!.getAttribute('data-edge')).toBe('arrived')
      expect(header().className).toContain('cwa:border-type-static')
    })

    test('a resource already stored shows its colour with no line animation', async () => {
      reduceMotion(false)
      mountLoading({ kind: { tone: 'warning', label: 'Not reachable' } })
      await flushPromises()
      expect(edge()).toBeNull()
      expect(header().className).toContain('cwa:border-warning')
    })

    test.each([
      ['after loading', { loading: true }],
      ['when it opens failed', { loadFailed: true }],
    ])('a failed load settles the line to danger %s', async (_, start) => {
      reduceMotion(false)
      const state = mountLoading(start)
      await flushPromises()
      state.loading = false
      state.loadFailed = true
      await flushPromises()
      expect(header().className).toContain('cwa:border-danger')
      expect(header().className).not.toContain('cwa:border-line')
    })

    test('after a failed load the reveal runs over danger, then a retry sweeps again', async () => {
      reduceMotion(false)
      const state = mountLoading({ loading: true })
      await flushPromises()
      state.loading = false
      state.loadFailed = true
      await flushPromises()
      expect(edge()!.getAttribute('data-edge')).toBe('arrived')
      state.loadFailed = false
      state.loading = true
      await flushPromises()
      expect(edge()!.getAttribute('data-edge')).toBe('loading')
    })

    test('with reduced motion the line never sweeps or reveals, and shows its final colour', async () => {
      reduceMotion(true)
      const state = mountLoading({ loading: true })
      await flushPromises()
      expect(edge()).toBeNull()
      state.kind = { tone: 'dynamic', label: 'Dynamic' }
      state.loading = false
      await flushPromises()
      expect(edge()).toBeNull()
      expect(header().className).toContain('cwa:border-type-dynamic')
      expect(q('[data-testid="dialog-loading"]')).toBeNull()
    })
  })

  describe('opening (#461)', () => {
    const overlay = () => document.querySelector<HTMLElement>('[data-testid="dialog-overlay"]')!

    test('a centred dialog rises into place from sm up, over an overlay that fades in', async () => {
      mountDialog(form)
      await flushPromises()

      expect(dialog().className.split(' ')).toEqual(expect.arrayContaining(['cwa:sm:dialog-in', 'cwa:sm:-translate-x-1/2', 'cwa:sm:-translate-y-1/2']))
      expect(overlay().className.split(' ')).toContain('cwa:overlay-in')
    })

    test('a slide-over keeps its slide and never rises, over an overlay that fades in', async () => {
      mountDialog(form, { placement: 'right' })
      await flushPromises()

      expect(dialog().className).toContain('cwa-slide-over-in')
      expect(dialog().className).not.toContain('dialog-in')
      expect(overlay().className.split(' ')).toContain('cwa:overlay-in')
    })
  })

  describe('closing a slide-over', () => {
    function media(reduced = false, wide = true) {
      return vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query.includes('reduce') ? reduced : query.includes('min-width') ? wide : false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList)
    }

    function slidOut(name = 'cwa-slide-over-out') {
      const end = new Event('animationend', { bubbles: true })
      Object.defineProperty(end, 'animationName', { value: name })
      dialog().dispatchEvent(end)
    }

    afterEach(() => {
      vi.restoreAllMocks()
      vi.useRealTimers()
    })

    test('slides out first and says close only when its own slide-out ends, with the page behind it fading and nothing inside it usable meanwhile', async () => {
      media()
      const onClose = vi.fn()
      mountDialog(form, { placement: 'right', onClose })
      await flushPromises()

      q<HTMLButtonElement>('[data-testid="dialog-close"]')!.click()
      await flushPromises()
      expect(onClose).not.toHaveBeenCalled()
      expect(dialog().getAttribute('data-closing')).toBe('true')
      expect(dialog().className).toContain('cwa:sm:motion-safe:animate-[cwa-slide-over-out_var(--cwa-duration-slow)_cubic-bezier(0.8,0,0.8,0.2)_forwards]')
      expect(dialog().className).not.toContain('cwa-slide-over-in')
      expect(dialog().hasAttribute('inert')).toBe(true)
      expect(document.querySelector('[data-testid="dialog-overlay"]')!.className).toContain('cwa:motion-safe:animate-[cwa-fade-out_var(--cwa-duration-slow)_cubic-bezier(0.8,0,0.8,0.2)_forwards]')
      expect(document.querySelector('[data-testid="dialog-overlay"]')!.className).not.toContain('overlay-in')

      slidOut('cwa-spin')
      expect(onClose).not.toHaveBeenCalled()
      slidOut()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    test('a second close request while it slides out says close only once', async () => {
      media()
      const onClose = vi.fn()
      const wrapper = mountDialog(form, { placement: 'right', onClose })
      await flushPromises()

      q<HTMLButtonElement>('[data-testid="dialog-close"]')!.click()
      await flushPromises()
      expect(await (wrapper.findComponent(Dialog).vm as unknown as { requestClose: () => Promise<boolean> }).requestClose()).toBe(false)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      q<HTMLButtonElement>('[data-testid="dialog-close"]')!.click()
      await flushPromises()
      slidOut()
      slidOut()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    test.each([
      ['with reduced motion', true, true, 'right'],
      ['below sm, where it is full screen', false, false, 'right'],
      ['for a centred dialog', false, true, 'center'],
    ] as const)('says close at once %s', async (_, reduced, wide, placement) => {
      media(reduced, wide)
      const onClose = vi.fn()
      mountDialog(form, { placement, onClose })
      await flushPromises()

      q<HTMLButtonElement>('[data-testid="dialog-close"]')!.click()
      await flushPromises()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    test('says close after its slide-out time when the animation never reports its end', async () => {
      media()
      const onClose = vi.fn()
      mountDialog(form, { placement: 'right', onClose })
      await flushPromises()
      vi.useFakeTimers()

      q<HTMLButtonElement>('[data-testid="dialog-close"]')!.click()
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(399)
      expect(onClose).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(onClose).toHaveBeenCalledTimes(1)
      slidOut()
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    test('requestClose resolves once the dialog has said close', async () => {
      media()
      const onClose = vi.fn()
      const wrapper = mountDialog(form, { placement: 'right', onClose })
      await flushPromises()
      const exposed = wrapper.findComponent(Dialog).vm as unknown as { requestClose: () => Promise<boolean> }

      let resolved = false
      exposed.requestClose().then(() => {
        resolved = true
      })
      await flushPromises()
      expect(resolved).toBe(false)
      slidOut()
      await flushPromises()
      expect(resolved).toBe(true)
    })
  })

  test('a dialog that opens loaded announces nothing about loading', async () => {
    mountDialog(form)
    await flushPromises()
    expect(q('[data-testid="dialog-announcer"]')!.textContent).toBe('')
  })

  test('a resource that failed to load says so in the body with Retry, Save off, and the fields stay away', async () => {
    const onRetry = vi.fn()
    const Host = defineComponent({
      setup: () => () => h(Dialog, { title: 'Page', tabs, form, noun: 'page', loadFailed: true, onRetry }, {
        details: () => h(Input, { label: 'Reference', field: 'reference' }),
      }),
    })
    mount(Host, { attachTo: document.body })
    await flushPromises()

    const failed = q('[data-testid="dialog-load-failed"]')!
    expect(failed.textContent).toContain('This page couldn\'t be loaded.')
    expect(q('[data-cwa-field="reference"]')).toBeNull()
    expect(save().getAttribute('aria-disabled')).toBe('true')
    expect(q('[data-testid="dialog-announcer"]')!.textContent).toBe('This page couldn\'t be loaded.')
    failed.querySelector<HTMLButtonElement>('[data-testid="dialog-load-retry"]')!.click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  test('Save is off and sends nothing while nothing has changed', async () => {
    mountDialog(form)
    await flushPromises()

    expect(save().getAttribute('aria-disabled')).toBe('true')
    save().click()
    await flushPromises()
    expect(form.saves).toEqual([])
  })

  test('an edit marks its field Unsaved and its tab with a dot, and Save counts the changes in its name', async () => {
    mountDialog(form)
    await flushPromises()

    await type('[data-cwa-field="reference"] input', 'Our kitchens')

    expect(q('[data-cwa-field="reference"] [data-testid="field-unsaved"]')?.textContent?.trim()).toBe('Unsaved')
    expect(q('[data-cwa-field="isReachableWithoutRoute"] [data-testid="field-unsaved"]')).toBeNull()
    expect(tab('Details').getAttribute('data-badge')).toBe('unsaved')
    expect(tab('Details').getAttribute('aria-label')).toBe('Details, 1 unsaved')
    expect(shown(save())).toBe('Save 1 change')
    expect(save().getAttribute('aria-label')).toBe('Save 1 unsaved change')
    expect(dialog().textContent).not.toMatch(/1 unsaved\b(?! change)/)
    expect(save().getAttribute('aria-disabled')).toBeNull()
  })

  test('Save sends only the changed fields, then reads Saved', async () => {
    mountDialog(form)
    await flushPromises()
    await type('[data-cwa-field="reference"] input', 'Our kitchens')

    save().click()
    await flushPromises()

    expect(form.saves).toEqual([{ reference: 'Our kitchens' }])
    expect(shown(save())).toBe('Saved')
    expect(q('[data-testid="field-unsaved"]')).toBeNull()
  })

  test('a field shows its label above, Optional, and its helper below linked to the input', async () => {
    mountDialog(form)
    await flushPromises()

    const input = q<HTMLInputElement>('[data-cwa-field="reference"] input')!
    const helper = document.getElementById(input.getAttribute('aria-describedby')!)
    expect(helper?.textContent?.trim()).toBe('Only admins see this.')
    tab('Search engines').click()
    await flushPromises()
    expect(q('[data-cwa-field="title"]')?.textContent).toContain('· Optional')
  })

  test('a failed Save opens the tab holding the failed field, shows the alert listing it and puts the error under the field', async () => {
    mountDialog(form)
    await flushPromises()
    tab('Search engines').click()
    await flushPromises()
    await type('[data-cwa-field="title"] input', 'x'.repeat(64))
    tab('Info').click()
    await flushPromises()
    form.failNext({ title: 'Use 60 characters or fewer. This has 64.' })

    save().click()
    await flushPromises()

    expect(tab('Search engines').getAttribute('aria-selected')).toBe('true')
    expect(tab('Search engines').getAttribute('data-badge')).toBe('error')
    expect(tab('Search engines').getAttribute('aria-label')).toBe('Search engines, 1 to fix, 1 unsaved')
    const alert = q('[data-testid="dialog-alert"]')!
    expect(alert.textContent).toContain('This page wasn\'t saved. 1 field needs a change.')
    expect(alert.textContent).toContain('SEO page title')
    expect(alert.textContent).toContain('Search engines tab')
    expect(document.activeElement).toBe(alert)
    const input = q<HTMLInputElement>('[data-cwa-field="title"] input')!
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const described = input.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent?.trim())
    expect(described).toContain('Use 60 characters or fewer. This has 64.')
    expect(q('[data-testid="dialog-blocked"]')?.textContent?.trim()).toBe('1 to fix')
    expect(q('[data-testid="dialog-announcer"]')?.textContent).toBe('This page wasn\'t saved. 1 field needs a change.')
  })

  test('a failed field on a tab never opened is listed by the label its tab declares, opens that tab and marks it, never by its raw name (#461)', async () => {
    const declared = [tabs[0]!, { ...tabs[1]!, fields: { title: 'SEO page title' } }, tabs[2]!]
    mountDialog(form, { tabs: declared })
    await flushPromises()
    await type('[data-cwa-field="reference"] input', 'Kitchens 2')
    form.failNext({ title: 'Use 60 characters or fewer.', reference: 'Already used.' })

    save().click()
    await flushPromises()

    const links = qa('[data-testid="dialog-alert-field"]').map(link => link.textContent?.trim())
    expect(links.toSorted()).toEqual(['Reference', 'SEO page title'])
    expect(q('[data-testid="dialog-alert"]')!.textContent).toContain('Search engines tab')
    expect(tab('Search engines').getAttribute('data-badge')).toBe('error')

    qa('[data-testid="dialog-alert-field"]').find(link => link.textContent?.trim() === 'SEO page title')!.click()
    await flushPromises()
    expect(tab('Search engines').getAttribute('aria-selected')).toBe('true')
  })

  test('editing the failed field clears its error and the alert goes', async () => {
    mountDialog(form)
    await flushPromises()
    await type('[data-cwa-field="reference"] input', '')
    form.failNext({ reference: 'Add a reference.' })
    save().click()
    await flushPromises()

    await type('[data-cwa-field="reference"] input', 'Kitchens 2')

    expect(q('[data-testid="field-error"]')).toBeNull()
    expect(q('[data-testid="dialog-alert"]')).toBeNull()
  })

  test('a conflict shows the notice under the field, blocks Save with its reason, and a choice unblocks it', async () => {
    mountDialog(form)
    await flushPromises()
    await type('[data-cwa-field="reference"] input', 'Mine')
    form.conflictNext({ reference: 'Theirs' })

    save().click()
    await flushPromises()

    const notice = q('[data-testid="conflict-notice"]')!
    expect(notice.getAttribute('role')).toBe('group')
    expect(notice.textContent).toContain('Mia changed this while you were editing.')
    expect(notice.textContent).toContain('Theirs')
    expect(notice.textContent).toContain('Mine')
    expect(q('[data-testid="dialog-alert"]')?.textContent).toContain('1 field changed by Mia while you were editing.')
    expect(tab('Details').getAttribute('data-badge')).toBe('conflict')
    expect(q('[data-testid="dialog-blocked"]')?.textContent?.trim()).toBe('Choose 1 version to save')
    expect(save().getAttribute('aria-disabled')).toBe('true')

    q<HTMLButtonElement>('[data-testid="conflict-keep-mine"]')!.click()
    await flushPromises()

    expect(q('[data-testid="conflict-notice"]')).toBeNull()
    expect(save().getAttribute('aria-disabled')).toBeNull()
    expect(shown(save())).toBe('Save 1 change')
  })

  test('closing with nothing changed asks nothing', async () => {
    const wrapper = mountDialog(form)
    await flushPromises()

    q<HTMLButtonElement>('[data-testid="dialog-cancel"]')!.click()
    await flushPromises()

    expect(confirmMock).not.toHaveBeenCalled()
    expect(wrapper.findComponent(Dialog).emitted('close')).toHaveLength(1)
  })

  test.each([
    ['Cancel', () => q<HTMLButtonElement>('[data-testid="dialog-cancel"]')!.click()],
    ['the close ×', () => q<HTMLButtonElement>('[data-testid="dialog-close"]')!.click()],
    ['Escape', () => dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))],
  ])('%s with unsaved changes asks to discard them, naming them, and Keep editing keeps them', async (_how, close) => {
    confirmMock.mockResolvedValueOnce(false)
    const wrapper = mountDialog(form)
    await flushPromises()
    await type('[data-cwa-field="reference"] input', 'Mine')

    close()
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledWith({
      title: 'Discard 1 unsaved change?',
      description: 'Your changes to Reference will be lost.',
      keep: 'Keep editing',
      go: 'Discard',
    })
    expect(wrapper.findComponent(Dialog).emitted('close')).toBeUndefined()
    expect(form.local.reference).toBe('Mine')
  })

  test('Discard throws the changes away and closes', async () => {
    confirmMock.mockResolvedValueOnce(true)
    const wrapper = mountDialog(form)
    await flushPromises()
    await type('[data-cwa-field="reference"] input', 'Mine')

    q<HTMLButtonElement>('[data-testid="dialog-cancel"]')!.click()
    await flushPromises()

    expect(form.local.reference).toBe('Kitchens')
    expect(wrapper.findComponent(Dialog).emitted('close')).toHaveLength(1)
  })

  test('confirmDiscard asks the same question without closing, and only Discard throws the changes away', async () => {
    const wrapper = mountDialog(form)
    await flushPromises()
    const dialogVm = wrapper.findComponent(Dialog).vm as unknown as { confirmDiscard: () => Promise<boolean> }

    expect(await dialogVm.confirmDiscard()).toBe(true)
    expect(confirmMock).not.toHaveBeenCalled()

    await type('[data-cwa-field="reference"] input', 'Mine')
    confirmMock.mockResolvedValueOnce(false)
    expect(await dialogVm.confirmDiscard()).toBe(false)
    expect(form.local.reference).toBe('Mine')

    confirmMock.mockResolvedValueOnce(true)
    expect(await dialogVm.confirmDiscard()).toBe(true)
    expect(confirmMock).toHaveBeenLastCalledWith({
      title: 'Discard 1 unsaved change?',
      description: 'Your changes to Reference will be lost.',
      keep: 'Keep editing',
      go: 'Discard',
    })
    expect(form.local.reference).toBe('Kitchens')
    expect(wrapper.findComponent(Dialog).emitted('close')).toBeUndefined()
  })

  test('every tab controls a panel in the document, visited or not, and only the visited ones hold their content', async () => {
    mountDialog(form)
    await flushPromises()

    tab('Search engines').click()
    await flushPromises()

    for (const element of qa('[role="tab"]')) {
      const panel = document.getElementById(element.getAttribute('aria-controls')!)
      expect(panel?.getAttribute('role')).toBe('tabpanel')
      expect(panel?.getAttribute('aria-labelledby')).toBe(element.id)
    }
    const info = document.getElementById(tab('Info').getAttribute('aria-controls')!)!
    expect(info.textContent).toBe('')
    expect(info.style.display).toBe('none')
    expect(q('[data-tab="seo"] [data-cwa-field="title"]')).not.toBeNull()
    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('arrow keys move between tabs', async () => {
    mountDialog(form)
    await flushPromises()

    tab('Details').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await flushPromises()
    expect(tab('Search engines').getAttribute('aria-selected')).toBe('true')
    tab('Search engines').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    tab('Details').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await flushPromises()
    expect(tab('Info').getAttribute('aria-selected')).toBe('true')
  })

  test('the selected tab is underlined by one sliding indicator inside the tab row, at its bottom; no tab draws its own', async () => {
    mountDialog(form)
    await flushPromises()
    const tablist = q('[role="tablist"]')!
    const indicators = qa('[data-testid="tab-indicator"]')

    expect(indicators).toHaveLength(1)
    expect(indicators[0]!.parentElement).toBe(tablist)
    expect([...tablist.classList]).toEqual(expect.arrayContaining(['cwa:relative', 'cwa:overflow-x-auto']))
    expect([...indicators[0]!.classList]).toEqual(expect.arrayContaining(['cwa:absolute', 'cwa:bottom-0', 'cwa:bg-accent']))
    for (const element of qa('[role="tab"]')) {
      expect([...element.classList].filter(name => name.startsWith('cwa:after:'))).toEqual([])
    }
  })

  test('Alt, Meta or Ctrl with an arrow key is left to the browser, so Alt+Left goes back instead of switching tabs (#461)', async () => {
    mountDialog(form)
    await flushPromises()

    for (const modifier of ['altKey', 'metaKey', 'ctrlKey']) {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', [modifier]: true, bubbles: true, cancelable: true })
      tab('Details').dispatchEvent(event)
      await flushPromises()
      expect(tab('Details').getAttribute('aria-selected')).toBe('true')
      expect(event.defaultPrevented).toBe(false)
    }
  })

  test('controls in a dialog take the large control size', async () => {
    mountDialog(form)
    await flushPromises()

    expect(dialog().className).toContain('cwa:[--cwa-spacing-control:var(--cwa-spacing-control-lg)]')
  })

  test.each(['idle', 'unsaved', 'error', 'conflict'] as const)('has no axe violations when %s', async (state) => {
    mountDialog(form)
    await flushPromises()
    if (state !== 'idle') {
      await type('[data-cwa-field="reference"] input', 'Mine')
    }
    if (state === 'error') {
      form.failNext({ reference: 'Add a reference.' })
      save().click()
    }
    if (state === 'conflict') {
      form.conflictNext({ reference: 'Theirs' })
      save().click()
    }
    await flushPromises()

    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('the close button, the tabs and the alert\'s field links draw their focus ring', async () => {
    mountDialog(form)
    await flushPromises()
    tab('Search engines').click()
    await flushPromises()
    await type('[data-cwa-field="title"] input', 'x'.repeat(64))
    form.failNext({ title: 'Use 60 characters or fewer. This has 64.' })
    save().click()
    await flushPromises()
    const focusable = [q('[data-testid="dialog-close"]')!, ...qa('[data-testid="dialog-tab"]'), ...qa('[data-testid="dialog-alert-field"]')]

    expect(qa('[data-testid="dialog-alert-field"]')).toHaveLength(1)
    expect(focusable.map(element => drawsFocusRing([...element.classList]))).toEqual(focusable.map(() => true))
  })
  describe('a sub-view inside a tab', () => {
    function mountWithSubView(footer: () => DialogSubFooter | 'none' | undefined, guard?: DialogSubViewGuard, claimant = ref(true)) {
      const Claimant = defineComponent({
        setup() {
          const context = inject(dialogSubViewKey) as DialogSubViewContext
          context.footer(footer)
          guard && context.guard(guard)
          return () => h('p', 'Edit route')
        },
      })
      const Host = defineComponent({
        setup() {
          return () => h(Dialog, { title: 'Kitchens', tabs, form, onSave: () => form.save() }, {
            details: () => h(Input, { label: 'Reference', field: 'reference' }),
            seo: () => claimant.value ? h(Claimant) : h('p', 'No route'),
            info: () => h('p', 'Created yesterday'),
          })
        },
      })
      return mount(Host, { attachTo: document.body })
    }

    function subViewGuard(unsaved: string[] = []) {
      const names = ref(unsaved)
      return { names, guard: { unsaved: vi.fn(() => names.value), leave: vi.fn() } }
    }

    test('a form open in a sub-view replaces the footer with its own Cancel and Save, keeping the page\'s unsaved count beside them', async () => {
      const cancel = vi.fn()
      const saveRoute = vi.fn()
      mountWithSubView(() => ({ saveLabel: 'Save route', saving: false, cancel, save: saveRoute }))
      await flushPromises()
      await type('[data-cwa-field="reference"] input', 'Mine')
      tab('Search engines').click()
      await flushPromises()

      expect(qa('footer button').map(shown)).toEqual(['Cancel', 'Save route'])
      expect(q('[data-testid="dialog-sub-kept"]')?.textContent?.trim()).toBe('1 unsaved page change kept')
      expect(q('[data-testid="dialog-save"]')).toBeNull()
      qa('footer button')[0]!.click()
      qa('footer button')[1]!.click()
      expect(cancel).toHaveBeenCalledTimes(1)
      expect(saveRoute).toHaveBeenCalledTimes(1)
      expect(await axe(document.body)).toHaveNoViolations()
    })

    test('the sub-view\'s Save shows it is saving and says why it is off', async () => {
      const footer = ref<DialogSubFooter>({ saveLabel: 'Add', saving: true, cancel: vi.fn(), save: vi.fn() })
      mountWithSubView(() => footer.value)
      await flushPromises()
      tab('Search engines').click()
      await flushPromises()

      const button = qa('footer button')[1]!
      expect(shown(button)).toBe('Add')
      expect(button.getAttribute('aria-busy')).toBe('true')
      expect(q('[data-testid="dialog-sub-kept"]')).toBeNull()

      footer.value = { ...footer.value, saving: false, disabledReason: 'Type an old address first.' }
      await flushPromises()
      expect(qa('footer button')[1]!.getAttribute('aria-disabled')).toBe('true')
      expect(qa('footer button')[1]!.getAttribute('title')).toBe('Type an old address first.')
    })

    test('a sub-view showing a list hides the footer, and the page\'s footer comes back with it', async () => {
      const footer = ref<'none' | undefined>('none')
      mountWithSubView(() => footer.value)
      await flushPromises()
      tab('Search engines').click()
      await flushPromises()

      expect(q('footer')).toBeNull()
      footer.value = undefined
      await flushPromises()
      expect(qa('footer button').map(shown)).toEqual(['Cancel', 'Save'])
    })

    test('the sub-view\'s footer shows only while its tab is open', async () => {
      mountWithSubView(() => ({ saveLabel: 'Save route', saving: false, cancel: vi.fn(), save: vi.fn() }))
      await flushPromises()
      tab('Search engines').click()
      await flushPromises()
      tab('Details').click()
      await flushPromises()

      expect(qa('footer button').map(shown)).toEqual(['Cancel', 'Save'])
    })

    test('a sub-view mounted while another tab is open still claims the footer of the tab it is in', async () => {
      const claimant = ref(false)
      mountWithSubView(() => ({ saveLabel: 'Save route', saving: false, cancel: vi.fn(), save: vi.fn() }), undefined, claimant)
      await flushPromises()
      tab('Search engines').click()
      await flushPromises()
      tab('Details').click()
      await flushPromises()

      claimant.value = true
      await flushPromises()
      expect(qa('footer button').map(shown)).toEqual(['Cancel', 'Save'])

      tab('Search engines').click()
      await flushPromises()
      expect(qa('footer button').map(shown)).toEqual(['Cancel', 'Save route'])
    })

    test('another tab leaves a sub-view with nothing typed without asking', async () => {
      const { guard } = subViewGuard()
      mountWithSubView(() => undefined, guard)
      await flushPromises()
      tab('Search engines').click()
      await flushPromises()
      expect(guard.leave).not.toHaveBeenCalled()

      tab('Info').click()
      await flushPromises()

      expect(confirmMock).not.toHaveBeenCalled()
      expect(guard.leave).toHaveBeenCalledTimes(1)
      expect(tab('Info').getAttribute('aria-selected')).toBe('true')
    })

    test('another tab asks before throwing away what the sub-view holds, naming it, and stays put on Keep editing', async () => {
      const { guard } = subViewGuard(['Route path'])
      mountWithSubView(() => undefined, guard)
      await flushPromises()
      tab('Search engines').click()
      await flushPromises()
      confirmMock.mockResolvedValueOnce(false)

      tab('Info').click()
      await flushPromises()

      expect(confirmMock).toHaveBeenCalledWith({
        title: 'Discard 1 unsaved change?',
        description: 'Your changes to Route path will be lost. Changes on the other tabs are kept.',
        keep: 'Keep editing',
        go: 'Discard',
      })
      expect(guard.leave).not.toHaveBeenCalled()
      expect(tab('Search engines').getAttribute('aria-selected')).toBe('true')

      confirmMock.mockResolvedValueOnce(true)
      tab('Info').click()
      await flushPromises()
      expect(guard.leave).toHaveBeenCalledTimes(1)
      expect(tab('Info').getAttribute('aria-selected')).toBe('true')
    })

    test('closing asks once, naming the page\'s changes and the sub-view\'s together, and Keep editing keeps both', async () => {
      const { guard } = subViewGuard(['Route path'])
      const wrapper = mountWithSubView(() => undefined, guard)
      await flushPromises()
      await type('[data-cwa-field="reference"] input', 'Mine')
      tab('Search engines').click()
      await flushPromises()
      confirmMock.mockResolvedValueOnce(false)

      q<HTMLButtonElement>('[data-testid="dialog-close"]')!.click()
      await flushPromises()

      expect(confirmMock).toHaveBeenCalledTimes(1)
      expect(confirmMock).toHaveBeenCalledWith({
        title: 'Discard 2 unsaved changes?',
        description: 'Your changes to Reference and Route path will be lost.',
        keep: 'Keep editing',
        go: 'Discard',
      })
      expect(guard.leave).not.toHaveBeenCalled()
      expect(form.unsavedFields).toEqual(['reference'])
      expect(wrapper.findComponent(Dialog).emitted('close')).toBeUndefined()

      confirmMock.mockResolvedValueOnce(true)
      q<HTMLButtonElement>('[data-testid="dialog-close"]')!.click()
      await flushPromises()
      expect(confirmMock).toHaveBeenCalledTimes(2)
      expect(guard.leave).toHaveBeenCalledTimes(1)
      expect(form.unsavedFields).toEqual([])
      expect(wrapper.findComponent(Dialog).emitted('close')).toHaveLength(1)
    })

    test('the discard check a page switch runs asks about the sub-view too', async () => {
      const { guard } = subViewGuard(['Route path'])
      const wrapper = mountWithSubView(() => undefined, guard)
      await flushPromises()
      tab('Search engines').click()
      await flushPromises()
      confirmMock.mockResolvedValueOnce(false)

      expect(await wrapper.findComponent(Dialog).vm.confirmDiscard()).toBe(false)
      expect(confirmMock.mock.calls[0]![0].description).toBe('Your changes to Route path will be lost.')
      expect(guard.leave).not.toHaveBeenCalled()
    })
  })
})

describe('CwaUiDialog without a Save model (#461, the add component dialog)', () => {
  function mountPlain(props: Record<string, unknown> = {}, slots: Record<string, () => unknown> = {}) {
    const Host = defineComponent({
      setup() {
        return () => h(Dialog, { title: 'Add a component', ...props }, {
          default: () => h('p', 'Body'),
          ...slots,
        })
      },
    })
    return mount(Host, { attachTo: document.body })
  }

  test('has no footer unless one is given', async () => {
    mountPlain()
    await flushPromises()

    expect(q('footer')).toBeNull()
  })

  test('renders its own footer in place of Cancel and Save', async () => {
    mountPlain({}, { footer: () => h('button', { type: 'button' }, 'Add') })
    await flushPromises()

    expect(qa('footer button').map(shown)).toEqual(['Add'])
  })

  test('an editor\'s presence flag goes into the body\'s own layer, which scrolls with the fields, on the field\'s right so the label above it stays readable (#476 review 1)', async () => {
    const model = { model: ref('Kitchens'), remoteChange: ref(undefined), focusedBy: ref([{ user: { id: '/_/users/mia', name: 'Mia' }, name: 'Mia', colour: '#d946ef', isSelf: false, clientIds: ['tab-mia'] }]) }
    mountPlain({}, { default: () => h(Input, { label: 'Title', model }) })
    await flushPromises()

    const body = q('[data-testid="dialog-body"]')!
    const layer = body.querySelector<HTMLElement>(':scope > [data-testid="presence-layer"]')!
    expect(body.className).toContain('cwa:relative')
    expect(layer.className).toContain('cwa:absolute')
    const flag = layer.querySelector<HTMLElement>('[data-testid="field-presence-flag"]')
    expect(flag?.textContent).toBe('Mia')
    expect(flag?.style.right).toBeTruthy()
    expect(body.querySelector('[data-cwa-field] [data-testid="field-presence-flag"]')).toBeNull()
  })

  test('the header\'s icon buttons sit together (gap-1), with the title and kind kept apart from them', async () => {
    mountPlain({ kind: { tone: 'warning', label: 'Not reachable' } }, { 'header-actions': () => h('button', { 'data-testid': 'eye' }, 'eye') })
    await flushPromises()

    expect(q('header')!.className.split(' ')).toContain('cwa:gap-1')
    expect(q('header')!.className.split(' ')).not.toContain('cwa:gap-2')
    expect(q('h2')!.className.split(' ')).toContain('cwa:me-2')
    expect(q('[data-testid="dialog-kind"]')!.className.split(' ')).toContain('cwa:me-2')
  })

  test('the close × draws a 24px icon in its unchanged 44px hit area', async () => {
    mountPlain()
    await flushPromises()

    const close = q('[data-testid="dialog-close"]')!
    expect(close.className.split(' ')).toEqual(expect.arrayContaining(['cwa:size-hit', 'cwa:place-items-center']))
    expect(close.querySelector('svg')!.getAttribute('class')).toContain('cwa:size-6')
  })

  test('is centred by default, sized by its size, and does not slide', async () => {
    mountPlain({ size: 'sm' })
    await flushPromises()

    const classes = dialog().className.split(' ')
    expect(classes).toEqual(expect.arrayContaining(['cwa:sm:top-1/2', 'cwa:sm:left-1/2', 'cwa:sm:-translate-y-1/2', 'cwa:sm:w-[28rem]']))
    expect(dialog().dataset.placement).toBe('center')
    expect(classes.some(name => name.includes('slide-over'))).toBe(false)
  })

  test('a right placement is a full-height slide-over anchored right, so its header and footer never move as the content changes height; it slides in only when motion is allowed', async () => {
    mountPlain({ placement: 'right', size: 'sm' }, { footer: () => h('button', 'Save') })
    await flushPromises()

    const classes = dialog().className.split(' ')
    expect(dialog().dataset.placement).toBe('right')
    expect(classes).toEqual(expect.arrayContaining(['cwa:sm:inset-y-0', 'cwa:sm:right-0', 'cwa:sm:left-auto', 'cwa:sm:w-[min(40rem,100vw)]', 'cwa:sm:motion-safe:animate-[cwa-slide-over-in_var(--cwa-duration-slow)_var(--cwa-ease-out)]']))
    expect(classes.filter(name => name.includes('animate-')).every(name => name.includes('motion-safe:'))).toBe(true)
    expect(classes.some(name => /translate|top-1\/2|left-1\/2|max-h-|w-\[28rem\]/.test(name))).toBe(false)
    expect(q('header')!.className).toContain('cwa:shrink-0')
    expect(q('[data-testid="dialog-body"]')!.className).toContain('cwa:overflow-y-auto')
  })

  test.each(['center', 'right'] as const)('a %s dialog gives focus back to what opened it when it closes', async (placement) => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const wrapper = mountPlain({ placement })
    await flushPromises()
    expect(document.activeElement).not.toBe(opener)

    wrapper.unmount()
    await flushPromises()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  test('without a kind, the header has the neutral solid 3px line and says no kind', async () => {
    mountPlain()
    await flushPromises()

    expect(q('header')!.className).toContain('cwa:border-b-3')
    expect(q('header')!.className).toContain('cwa:border-line')
    expect(q('header')!.className).not.toMatch(/dashed|dotted/)
    expect(q('[data-testid="dialog-kind"]')).toBeNull()
    expect(dialog().getAttribute('aria-describedby')).toBeNull()
  })

  test.each([
    ['static', 'cwa:border-type-static'],
    ['dynamic', 'cwa:border-type-dynamic'],
    ['success', 'cwa:border-success'],
    ['warning', 'cwa:border-warning'],
  ] as const)('a %s kind draws the header\'s solid 3px line in its colour and says the kind beside the title, describing the dialog (#461)', async (tone, colour) => {
    mountPlain({ kind: { tone, label: 'Not reachable' } })
    await flushPromises()

    const header = q('header')!
    expect(header.className).toContain('cwa:border-b-3')
    expect(header.className).toContain(colour)
    expect(header.className).not.toContain('cwa:border-line')
    const kind = q('[data-testid="dialog-kind"]')!
    expect(kind.textContent?.trim()).toBe('Not reachable')
    expect(kind.tagName).toBe('SPAN')
    expect(dialog().getAttribute('aria-describedby')).toBe(kind.id)
  })

  test.each([
    ['labelled', { tone: 'warning', label: 'Not reachable' }],
    ['unlabelled', { tone: 'dynamic' }],
    ['without a kind', undefined],
  ] as const)('reka logs no description warning for a dialog %s', async (_, kind) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mountPlain(kind ? { kind } : {})
    await flushPromises()
    expect(warn.mock.calls.filter(call => /Description|DialogTitle/.test(String(call[0])))).toEqual([])
    warn.mockRestore()
  })

  test('a kind with no words colours the line only, for a dialog that says its kind in a header control', async () => {
    mountPlain({ kind: { tone: 'dynamic' } })
    await flushPromises()

    expect(q('header')!.className).toContain('cwa:border-type-dynamic')
    expect(q('[data-testid="dialog-kind"]')).toBeNull()
    expect(dialog().getAttribute('aria-describedby')).toBeNull()
  })

  test('a subheader sits between the header and the tabs, on every tab', async () => {
    mountPlain({ tabs: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] }, { subheader: () => h('p', { 'data-testid': 'sub' }, 'Depths'), a: () => h('p', 'A body'), b: () => h('p', 'B body') })
    await flushPromises()

    const sub = q('[data-testid="sub"]')!
    expect(q('header')!.compareDocumentPosition(sub) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(sub.compareDocumentPosition(q('[role="tablist"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(q('[data-testid="dialog-body"]')!.contains(sub)).toBe(false)
  })

  test('a flush body leaves the padding to its content', async () => {
    mountPlain({ flush: true })
    await flushPromises()

    expect(q('[data-testid="dialog-body"]')!.className).not.toContain('cwa:p-6')
  })

  test('controls inside announce through the dialog\'s own polite region', async () => {
    const { useAnnounce } = await import('../core/ui/field-context')
    let announce: ((text: string) => void) | undefined
    const Speaker = defineComponent({
      setup() {
        announce = useAnnounce()
        return () => h('span')
      },
    })
    mountPlain({}, { default: () => h(Speaker) })
    await flushPromises()

    announce!('3 components')
    await flushPromises()

    expect(q('[data-testid="dialog-announcer"]')!.textContent).toBe('3 components')
  })
})
