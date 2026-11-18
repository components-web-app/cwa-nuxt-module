// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import type { Router } from 'vue-router'
import { axe } from '../../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../../test/utils/focus-ring'
import { fakeDialogForm } from '../../../../../../playground/app/kit/fake-dialog-form'
import type { FakeDialogForm } from '../../../../../../playground/app/kit/fake-dialog-form'
import FormGroup from './FormGroup.vue'
import FormSection from '../../ui/FormSection.vue'
import Input from '../../ui/Input.vue'
import Toggle from '../../ui/Toggle.vue'

const { confirmMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
}))
vi.mock('#cwa/composables/cwa-confirm', () => ({ useCwaConfirm: () => confirmMock }))

enableAutoUnmount(afterEach)

function settingsPage(form: FakeDialogForm) {
  return defineComponent({
    setup() {
      return () => h('div', [
        h('h1', 'Site settings'),
        h(FormGroup, { form, onSave: () => form.save() }, {
          default: () => [
            h(FormSection, { title: 'General' }, () => [
              h(Input, { label: 'Site name', field: 'siteName', description: 'Shown in page titles.' }),
              h(Toggle, { label: 'Enable maintenance mode', field: 'maintenanceModeEnabled' }),
            ]),
            h(FormSection, { title: 'Sitemap' }, () => h(Input, { label: 'Canonical URL', field: 'canonicalUrl' })),
          ],
        }),
      ])
    },
  })
}

async function mountRouted(form: FakeDialogForm) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', component: settingsPage(form) },
      { path: '/:other(.*)', component: { render: () => h('p', 'Elsewhere') } },
    ],
  })
  await router.push('/settings')
  await router.isReady()
  mount({ render: () => h(RouterView) }, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return router
}

async function go(router: Router, to: string) {
  await router.push(to)
  await flushPromises()
  return router.currentRoute.value.fullPath
}

const group = () => document.querySelector<HTMLElement>('[data-testid="form-group"]')!
const q = <T extends HTMLElement = HTMLElement>(selector: string) => group().querySelector<T>(selector)
const qa = (selector: string) => [...group().querySelectorAll<HTMLElement>(selector)]
const save = () => q<HTMLButtonElement>('[data-testid="form-group-save"]')!
const cancel = () => q<HTMLButtonElement>('[data-testid="form-group-cancel"]')!

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

describe('FormGroup and the page Save model (#461)', () => {
  let form: FakeDialogForm

  beforeEach(() => {
    vi.clearAllMocks()
    form = fakeDialogForm({ siteName: 'Kitchens', maintenanceModeEnabled: false, canonicalUrl: '' })
  })

  test('holds its sections, whose headings follow the page heading, and ends in a row of Cancel and Save only', async () => {
    await mountRouted(form)
    await flushPromises()

    expect(qa('[data-testid="form-section"] :is(h2, h3)').map(heading => `${heading.tagName} ${heading.textContent?.trim()}`)).toEqual(['H2 General', 'H2 Sitemap'])
    expect(qa('[data-testid="form-group-actions"] button').map(shown)).toEqual(['Cancel', 'Save'])
  })

  test('controls on a page take the large control size, inside a 40rem column', async () => {
    await mountRouted(form)
    await flushPromises()

    expect(group().className).toContain('cwa:[--cwa-spacing-control:var(--cwa-spacing-control-lg)]')
    expect(group().className).toContain('cwa:max-w-[40rem]')
  })

  test('with nothing changed, Save and Cancel are off with their reason and nothing is sent', async () => {
    await mountRouted(form)
    await flushPromises()

    expect(save().getAttribute('aria-disabled')).toBe('true')
    expect(cancel().getAttribute('aria-disabled')).toBe('true')
    expect(save().getAttribute('title')).toBe('Nothing has changed.')
    save().click()
    cancel().click()
    await flushPromises()
    expect(form.saves).toEqual([])
    expect(confirmMock).not.toHaveBeenCalled()
  })

  test('an edit marks its field Unsaved and the one count is on Save, with no other unsaved notice', async () => {
    await mountRouted(form)
    await flushPromises()

    await type('[data-cwa-field="siteName"] input', 'Our kitchens')

    expect(q('[data-cwa-field="siteName"] [data-testid="field-unsaved"]')?.textContent?.trim()).toBe('Unsaved')
    expect(shown(save())).toBe('Save 1 change')
    expect(save().getAttribute('aria-label')).toBe('Save 1 unsaved change')
    expect(group().textContent).not.toMatch(/1 unsaved\b(?! change)/)
    expect(q('[data-testid="form-group-actions"]')!.textContent).not.toMatch(/unsaved/i)
    expect(save().getAttribute('aria-disabled')).toBeNull()
  })

  test('Save sends only the changed fields, then reads Saved with its check', async () => {
    await mountRouted(form)
    await flushPromises()
    await type('[data-cwa-field="siteName"] input', 'Our kitchens')

    save().click()
    await flushPromises()

    expect(form.saves).toEqual([{ siteName: 'Our kitchens' }])
    expect(shown(save())).toBe('Saved')
    expect(save().querySelector('svg')).not.toBeNull()
    expect(q('[data-testid="field-unsaved"]')).toBeNull()
  })

  test('Saved goes back to Save after 1.5 s', async () => {
    vi.useFakeTimers()
    try {
      await mountRouted(form)
      await flushPromises()
      await type('[data-cwa-field="siteName"] input', 'Our kitchens')
      save().click()
      await flushPromises()
      expect(shown(save())).toBe('Saved')

      vi.advanceTimersByTime(1500)
      await flushPromises()

      expect(shown(save())).toBe('Save')
    }
    finally {
      vi.useRealTimers()
    }
  })

  test('a failed Save shows the alert listing the field, focuses it, announces it once and puts the error under the field', async () => {
    await mountRouted(form)
    await flushPromises()
    await type('[data-cwa-field="canonicalUrl"] input', 'kitchens')
    form.failNext({ canonicalUrl: 'Enter a full address, like https://example.com.' })

    save().click()
    await flushPromises()

    const alert = q('[data-testid="form-group-alert"]')!
    expect(alert.textContent).toContain('Your changes weren\'t saved. 1 field needs a change.')
    expect(qa('[data-testid="form-group-alert-field"]').map(shown)).toEqual(['Canonical URL'])
    expect(document.activeElement).toBe(alert)
    const input = q<HTMLInputElement>('[data-cwa-field="canonicalUrl"] input')!
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent?.trim())).toContain('Enter a full address, like https://example.com.')
    expect(q('[data-testid="form-group-blocked"]')?.textContent?.trim()).toBe('1 to fix')
    expect(q('[data-testid="form-group-announcer"]')?.textContent).toBe('Your changes weren\'t saved. 1 field needs a change.')
    expect(q('[data-testid="form-group-announcer"]')?.getAttribute('aria-live')).toBe('polite')
  })

  test('a field in the alert takes focus to that field', async () => {
    await mountRouted(form)
    await flushPromises()
    await type('[data-cwa-field="canonicalUrl"] input', 'kitchens')
    form.failNext({ canonicalUrl: 'Enter a full address.' })
    save().click()
    await flushPromises()

    q<HTMLButtonElement>('[data-testid="form-group-alert-field"]')!.click()
    await flushPromises()

    expect(document.activeElement).toBe(q('[data-cwa-field="canonicalUrl"] input'))
  })

  test('a failure with no field says why in the alert', async () => {
    await mountRouted(form)
    await flushPromises()
    await type('[data-cwa-field="siteName"] input', 'Our kitchens')
    form.failNext({}, 'The server couldn\'t save it. Nothing changed, and what you typed is still here.')

    save().click()
    await flushPromises()

    const alert = q('[data-testid="form-group-alert"]')!
    expect(alert.textContent).toContain('Your changes weren\'t saved.')
    expect(alert.textContent).toContain('The server couldn\'t save it. Nothing changed, and what you typed is still here.')
  })

  test('Cancel with changes asks first; Keep editing keeps them and Discard throws them away', async () => {
    await mountRouted(form)
    await flushPromises()
    await type('[data-cwa-field="siteName"] input', 'Our kitchens')

    confirmMock.mockResolvedValueOnce(false)
    cancel().click()
    await flushPromises()
    expect(confirmMock).toHaveBeenCalledWith({
      title: 'Discard 1 unsaved change?',
      description: 'Your changes to Site name will be lost.',
      keep: 'Keep editing',
      go: 'Discard',
    })
    expect(form.local.siteName).toBe('Our kitchens')

    confirmMock.mockResolvedValueOnce(true)
    cancel().click()
    await flushPromises()
    expect(form.local.siteName).toBe('Kitchens')
    expect(shown(save())).toBe('Save')
  })

  test('leaving with nothing changed asks nothing', async () => {
    const router = await mountRouted(form)

    expect(await go(router, '/pages')).toBe('/pages')
    expect(confirmMock).not.toHaveBeenCalled()
  })

  test('leaving with changes asks, naming them; Keep editing stays, and Leave goes without discarding first', async () => {
    const discard = vi.spyOn(form, 'discard')
    const router = await mountRouted(form)
    await type('[data-cwa-field="siteName"] input', 'Our kitchens')
    q<HTMLButtonElement>('[data-cwa-field="maintenanceModeEnabled"] [role="switch"]')!.click()
    await flushPromises()

    confirmMock.mockResolvedValueOnce(false)
    expect(await go(router, '/pages')).toBe('/settings')
    expect(confirmMock).toHaveBeenCalledWith({
      title: 'Leave without saving?',
      description: '2 unsaved changes (Site name and Enable maintenance mode) will be lost.',
      keep: 'Keep editing',
      go: 'Leave',
    })
    expect(form.local.siteName).toBe('Our kitchens')

    confirmMock.mockResolvedValueOnce(true)
    expect(await go(router, '/pages')).toBe('/pages')
    expect(discard).not.toHaveBeenCalled()
  })

  test('a leave another guard then cancels keeps the edits, and the next leave asks again', async () => {
    const router = await mountRouted(form)
    router.beforeEach(to => to.path !== '/locked')
    await type('[data-cwa-field="siteName"] input', 'Our kitchens')

    confirmMock.mockResolvedValue(true)
    expect(await go(router, '/locked')).toBe('/settings')
    expect(form.local.siteName).toBe('Our kitchens')
    expect(form.unsavedFields).toEqual(['siteName'])

    expect(await go(router, '/locked')).toBe('/settings')
    expect(confirmMock).toHaveBeenCalledTimes(2)
  })

  test('an approved leave re-run without cwa_force goes on without asking again', async () => {
    const router = await mountRouted(form)
    router.beforeEach((to) => {
      if (!('cwa_force' in to.query)) {
        return true
      }
      const { cwa_force: _force, ...query } = to.query
      return { path: to.path, query, hash: to.hash }
    })
    await type('[data-cwa-field="siteName"] input', 'Our kitchens')

    confirmMock.mockResolvedValue(true)
    expect(await go(router, '/pages?cwa_force=true&page=2')).toBe('/pages?page=2')
    expect(confirmMock).toHaveBeenCalledTimes(1)
  })

  test('a second click while the leave is being asked waits for the same answer, and goes to where it was clicked', async () => {
    const router = await mountRouted(form)
    await type('[data-cwa-field="siteName"] input', 'Our kitchens')
    let answer!: (go: boolean) => void
    confirmMock.mockReturnValueOnce(new Promise<boolean>((resolve) => {
      answer = resolve
    }))

    void router.push('/pages')
    await flushPromises()
    const second = router.push('/layouts')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/settings')
    answer(true)
    await second
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/layouts')
    expect(confirmMock).toHaveBeenCalledTimes(1)
  })

  test('closing or reloading the tab gets the browser\'s prompt only while something is unsaved', async () => {
    await mountRouted(form)
    await flushPromises()
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }

    expect(unload()).toBe(false)
    await type('[data-cwa-field="siteName"] input', 'Our kitchens')
    expect(unload()).toBe(true)
    save().click()
    await flushPromises()
    expect(unload()).toBe(false)
  })

  test('while it is on the page, the scroll container keeps focused fields clear of the sticky Save row, whatever its height', async () => {
    const observers: { callback: () => void, observed: Element[], disconnect: () => void }[] = []
    vi.stubGlobal('ResizeObserver', class {
      observed: Element[] = []
      disconnect = vi.fn()
      constructor(public callback: () => void) {
        observers.push(this)
      }

      observe(element: Element) {
        this.observed.push(element)
      }
    })
    let rowHeight = 72.4
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { height: this.dataset.testid === 'form-group-actions' ? rowHeight : 0 } as DOMRect
    })
    const scroller = document.documentElement
    scroller.style.scrollPaddingBottom = '8px'
    try {
      const router = await mountRouted(form)
      expect(scroller.style.scrollPaddingBottom).toBe('73px')

      rowHeight = 140
      observers.find(observer => observer.observed.some(element => (element as HTMLElement).dataset.testid === 'form-group-actions'))!.callback()
      expect(scroller.style.scrollPaddingBottom).toBe('140px')

      await go(router, '/pages')
      expect(scroller.style.scrollPaddingBottom).toBe('8px')
      expect(observers[0]!.disconnect).toHaveBeenCalled()
    }
    finally {
      scroller.style.scrollPaddingBottom = ''
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    }
  })

  test('the sticky Save row is painted with the page\'s own background and adds no rule of its own', async () => {
    await mountRouted(form)

    const row = q('[data-testid="form-group-actions"]')!
    expect(row.className).toContain('cwa:bg-stone-800')
    expect(row.className).not.toMatch(/cwa:bg-surface|cwa:border-t/)
  })

  test('a conflict blocks Save with its reason until a version is chosen', async () => {
    await mountRouted(form)
    await flushPromises()
    await type('[data-cwa-field="siteName"] input', 'Mine')
    form.conflictNext({ siteName: 'Theirs' })

    save().click()
    await flushPromises()

    expect(q('[data-testid="conflict-notice"]')?.textContent).toContain('Mia changed this while you were editing.')
    expect(q('[data-testid="form-group-alert"]')?.textContent).toContain('1 field changed by Mia while you were editing.')
    expect(q('[data-testid="form-group-blocked"]')?.textContent?.trim()).toBe('Choose 1 version to save')
    expect(save().getAttribute('aria-disabled')).toBe('true')

    q<HTMLButtonElement>('[data-testid="conflict-keep-mine"]')!.click()
    await flushPromises()
    expect(save().getAttribute('aria-disabled')).toBeNull()
  })

  test.each(['idle', 'unsaved', 'saved', 'error', 'conflict'] as const)('has no axe violations when %s', async (state) => {
    await mountRouted(form)
    await flushPromises()
    if (state !== 'idle') {
      await type('[data-cwa-field="siteName"] input', 'Mine')
    }
    if (state === 'error') {
      form.failNext({ siteName: 'Add a site name.' })
    }
    if (state === 'conflict') {
      form.conflictNext({ siteName: 'Theirs' })
    }
    if (state !== 'idle' && state !== 'unsaved') {
      save().click()
    }
    await flushPromises()

    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('the alert\'s field links draw their focus ring', async () => {
    await mountRouted(form)
    await flushPromises()
    await type('[data-cwa-field="siteName"] input', '')
    form.failNext({ siteName: 'Add a site name.' })
    save().click()
    await flushPromises()

    const links = qa('[data-testid="form-group-alert-field"]')
    expect(links).toHaveLength(1)
    expect(links.map(element => drawsFocusRing([...element.classList]))).toEqual([true])
  })
})
