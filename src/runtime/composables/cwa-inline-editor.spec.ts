// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useCwaInlineEditor } from './cwa-inline-editor'
import { modelFieldLabel } from '#cwa/resources/model-editors'
import type { ResourceModelField } from '#cwa/resources/model-editors'

const cwa = vi.hoisted(() => ({
  resources: {
    isIriPublishableEquivalent: () => false,
    getResource: (iri: string) => ({ value: { '/component/body': { data: { '@type': 'HtmlContent' } }, '/component/plain': { data: { '@type': 'Plain' } } }[iri] }),
  },
  resourcesConfig: { HtmlContent: { name: 'Body Text' } } as Record<string, { name?: string }>,
}))
vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => cwa }))

enableAutoUnmount(afterEach)

function model(iri = '/component/body'): ResourceModelField<string> {
  return { model: ref('<p>Hi</p>'), remoteChange: ref(undefined), editorKey: { iri: () => iri, field: 'html' } }
}

function editable(attrs: Record<string, string> = {}) {
  const el = document.createElement('div')
  el.setAttribute('contenteditable', 'true')
  Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value))
  document.body.append(el)
  return el
}

function mountEditor(element: { value: HTMLElement | undefined }, ops: { label?: string, enabled?: () => boolean } = {}, field = model()) {
  return mount(defineComponent({
    setup() {
      useCwaInlineEditor(field, () => element.value, ops)
      return () => h('div')
    },
  }))
}

describe('useCwaInlineEditor naming (#461)', () => {
  test('labels its model, so a save that fails once the bar no longer shows it is named by its label', () => {
    const field = model()
    mountEditor(shallowRef(editable()), { label: 'Content' }, field)

    expect(modelFieldLabel(field.editorKey!)).toBe('Content')
  })

  test('names an editable editor for its field and component, as a multi-line textbox', async () => {
    const element = shallowRef<HTMLElement | undefined>(editable())
    mountEditor(element, { label: 'Content' })
    await nextTick()

    expect(element.value!.getAttribute('aria-label')).toBe('Content, Body Text')
    expect(element.value!.getAttribute('role')).toBe('textbox')
    expect(element.value!.getAttribute('aria-multiline')).toBe('true')
  })

  test('a rebuilt editor is named and the old element is left as it was', async () => {
    const first = editable()
    const element = shallowRef<HTMLElement | undefined>(first)
    mountEditor(element, { label: 'Content' })
    await nextTick()

    const second = editable()
    element.value = second
    await nextTick()

    expect(second.getAttribute('aria-label')).toBe('Content, Body Text')
    expect(first.hasAttribute('aria-label')).toBe(false)
    expect(first.hasAttribute('role')).toBe(false)
    expect(first.hasAttribute('aria-multiline')).toBe(false)
  })

  test('while disabled, read-only, or once unmounted it adds nothing', async () => {
    const enabled = ref(false)
    const element = shallowRef<HTMLElement | undefined>(editable())
    const wrapper = mountEditor(element, { label: 'Content', enabled: () => enabled.value })
    await nextTick()
    expect(element.value!.hasAttribute('aria-label')).toBe(false)

    enabled.value = true
    await nextTick()
    expect(element.value!.getAttribute('aria-label')).toBe('Content, Body Text')

    enabled.value = false
    await nextTick()
    expect(element.value!.hasAttribute('aria-label')).toBe(false)
    expect(element.value!.hasAttribute('role')).toBe(false)

    enabled.value = true
    await nextTick()
    wrapper.unmount()
    expect(element.value!.hasAttribute('aria-label')).toBe(false)

    const readOnly = shallowRef<HTMLElement | undefined>(editable({ contenteditable: 'false' }))
    mountEditor(readOnly, { label: 'Content' })
    await nextTick()
    expect(readOnly.value!.hasAttribute('aria-label')).toBe(false)
  })

  test('an editor the app already named, or given no label, keeps what it has; an unknown component is named by its field', async () => {
    const named = shallowRef<HTMLElement | undefined>(editable({ 'aria-label': 'Article body' }))
    mountEditor(named, { label: 'Content' })
    const unlabelled = shallowRef<HTMLElement | undefined>(editable())
    mountEditor(unlabelled)
    const unknown = shallowRef<HTMLElement | undefined>(editable())
    mountEditor(unknown, { label: 'Content' }, model('/component/other'))
    await nextTick()

    expect(named.value!.getAttribute('aria-label')).toBe('Article body')
    expect(named.value!.hasAttribute('role')).toBe(false)
    expect(unlabelled.value!.hasAttribute('aria-label')).toBe(false)
    expect(unknown.value!.getAttribute('aria-label')).toBe('Content')
  })

  test('a component with no configured name is named by its type, and a role the editor already has is kept', async () => {
    const plain = shallowRef<HTMLElement | undefined>(editable({ 'role': 'region', 'aria-multiline': 'false' }))
    mountEditor(plain, { label: 'Content' }, model('/component/plain'))
    await nextTick()

    expect(plain.value!.getAttribute('aria-label')).toBe('Content, Plain')
    expect(plain.value!.getAttribute('role')).toBe('region')
    expect(plain.value!.getAttribute('aria-multiline')).toBe('false')
  })
})
