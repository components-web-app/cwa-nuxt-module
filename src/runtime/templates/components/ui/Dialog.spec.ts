// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import { fakeDialogForm } from '../../../../../playground/app/kit/fake-dialog-form'
import type { FakeDialogForm } from '../../../../../playground/app/kit/fake-dialog-form'
import Dialog from './Dialog.vue'
import Input from './Input.vue'
import Toggle from './Toggle.vue'

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
})
