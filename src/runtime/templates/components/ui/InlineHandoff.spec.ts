// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { axe } from '../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../test/utils/focus-ring'
import { registerInlineEditor } from '#cwa/admin/inline-editors'
import type { InlineEditor } from '#cwa/admin/inline-editors'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import { consola } from 'consola'
import InlineHandoff from './InlineHandoff.vue'
import ManagerTab from './ManagerTab.vue'

const cwa = vi.hoisted(() => ({ resources: { isIriPublishableEquivalent: () => false }, admin: { resourceStackManager: { currentIri: { value: '/component/html' } } } }))
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => cwa }))
vi.mock('#cwa/composables/cwa-confirm', () => ({ useCwaConfirm: () => vi.fn(async () => true) }))

enableAutoUnmount(afterEach)

const registered: (() => void)[] = []

afterEach(() => {
  registered.splice(0).forEach(unregister => unregister())
  document.body.innerHTML = ''
})

function fieldModel(initial: string | null): ResourceModelField<string> {
  return {
    model: ref(initial),
    remoteChange: computed(() => undefined),
    editorKey: { iri: () => '/component/html', field: 'html' },
  }
}

function mountHandoff(model = fieldModel('<p>Our kitchens are made in <strong>Norfolk</strong> by hand.</p>'), props: Record<string, unknown> = {}) {
  const wrapper = mount(InlineHandoff, { props: { label: 'Description', model, ...props }, attachTo: document.body })
  return { wrapper, model }
}

function pageEditor(field = 'html', overrides: Partial<InlineEditor> = {}) {
  const element = document.createElement('div')
  element.tabIndex = 0
  document.body.append(element)
  const editor: InlineEditor = { key: { iri: () => '/component/html', field }, element: () => element, enabled: () => true, focus: vi.fn(() => element.focus()), ...overrides }
  const unregister = registerInlineEditor(cwa, editor)
  registered.push(unregister)
  return { editor, element, unregister }
}

function button(wrapper: ReturnType<typeof mountHandoff>['wrapper']) {
  return wrapper.get<HTMLButtonElement>('[data-testid="inline-handoff-edit"]')
}

describe('CwaUiInlineHandoff (#461)', () => {
  test('shows the label and a one-line quoted preview of the text, without markup', () => {
    const { wrapper } = mountHandoff()

    expect(wrapper.text()).toContain('Description')
    const preview = wrapper.get('[data-testid="inline-handoff-preview"]')
    expect(preview.text()).toBe('“Our kitchens are made in Norfolk by hand.”')
    expect(preview.classes()).toEqual(expect.arrayContaining(['cwa:truncate', 'cwa:text-fg-muted']))
  })

  test('paragraphs and line breaks preview as one line', () => {
    const { wrapper } = mountHandoff(fieldModel('<p>One</p>\n\n<p>Two</p>'))

    expect(wrapper.get('[data-testid="inline-handoff-preview"]').text()).toBe('“One Two”')
  })

  test('the preview is worked out the same on the server as in the browser, so hydration matches, with entities decoded', () => {
    const parser = globalThis.DOMParser
    // @ts-expect-error
    delete globalThis.DOMParser
    const { wrapper } = mountHandoff(fieldModel('<p>Made in <strong>Norfolk</strong>, by hand &amp; with care</p>'))
    globalThis.DOMParser = parser

    expect(wrapper.get('[data-testid="inline-handoff-preview"]').text()).toBe('“Made in Norfolk, by hand & with care”')
  })

  test('an empty value previews as Empty', () => {
    const { wrapper } = mountHandoff(fieldModel(null))

    expect(wrapper.get('[data-testid="inline-handoff-preview"]').text()).toBe('Empty')
  })

  test('with an editor on the page the button reads Edit on page, and pressing it opens that editor and Escape returns to the button', async () => {
    const { element, editor } = pageEditor()
    element.scrollIntoView = vi.fn()
    const { wrapper } = mountHandoff()
    await flushPromises()

    expect(button(wrapper).text()).toBe('Edit on page')
    expect(document.getElementById(button(wrapper).attributes('aria-describedby')!.split(' ')[0]!)!.textContent).toBe('Description')
    await button(wrapper).trigger('click')
    expect(element.scrollIntoView).toHaveBeenCalled()
    expect(document.activeElement).toBe(element)
    expect(editor.returnTo).toBe(button(wrapper).element)
  })

  test('the button follows the editor coming and going on the page', async () => {
    const { wrapper } = mountHandoff()
    expect(button(wrapper).text()).toBe('Edit…')

    const { unregister } = pageEditor()
    await flushPromises()
    expect(button(wrapper).text()).toBe('Edit on page')
    unregister()
    await flushPromises()
    expect(button(wrapper).text()).toBe('Edit…')
  })

  test('editor names a registered editor for another field', async () => {
    pageEditor('body')
    const { wrapper } = mountHandoff(undefined, { editor: 'body' })
    await flushPromises()

    expect(button(wrapper).text()).toBe('Edit on page')
  })

  test('without an editor on the page, Edit… opens a dialog titled by the label with a textarea bound to the same model', async () => {
    const { wrapper, model } = mountHandoff(fieldModel('Plain words'))
    await button(wrapper).trigger('click')
    await vi.waitFor(() => expect(document.querySelector('[data-testid="dialog"] textarea')).not.toBeNull())

    const dialog = document.querySelector<HTMLElement>('[data-testid="dialog"]')!
    expect(dialog.querySelector('h2')!.textContent!.trim()).toBe('Description')
    const textarea = dialog.querySelector('textarea')!
    expect(textarea.value).toBe('Plain words')
    textarea.value = 'New words'
    textarea.dispatchEvent(new Event('input'))
    expect(model.model.value).toBe('New words')

    ;(dialog.querySelector('[data-testid="inline-handoff-done"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(document.querySelector('[data-testid="dialog"]')).toBeNull()
  })

  test('the button draws the kit focus ring', () => {
    const { wrapper } = mountHandoff()

    expect(drawsFocusRing(button(wrapper).classes())).toBe(true)
  })

  test('has no axe violations', async () => {
    mountHandoff()

    expect(await axe(document.body)).toHaveNoViolations()
  })

  test('in a manager tab, its Edit… dialog holds the text area without the bar\'s refusal: a dialog is a form surface, not the bar row (#461)', async () => {
    const error = vi.spyOn(consola, 'error').mockImplementation(() => undefined)
    const model = fieldModel('<p>Long text</p>')
    const wrapper = mount(defineComponent({ setup: () => () => h(ManagerTab, null, () => h(InlineHandoff, { label: 'Content', model })) }), { attachTo: document.body })
    await flushPromises()

    await wrapper.get('[data-testid="inline-handoff-edit"]').trigger('click')
    await flushPromises()

    await vi.waitFor(() => expect(document.querySelector('[data-testid="textarea"]')).not.toBeNull())
    expect(error.mock.calls).toEqual([])
    error.mockRestore()
    wrapper.unmount()
  })
})
