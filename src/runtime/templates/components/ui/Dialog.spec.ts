// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, inject, ref } from 'vue'
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
    expect(dialog().getAttribute('aria-describedby')).toBe(kind.id)
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
