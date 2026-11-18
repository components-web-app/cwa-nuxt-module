// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { findInlineEditor, INLINE_EDITOR_FLASH_MS, openInlineEditor, registerInlineEditor } from './inline-editors'
import type { InlineEditor } from './inline-editors'

const cwa = vi.hoisted(() => ({
  resources: { isIriPublishableEquivalent: (a: string, b: string) => [a, b].sort().join() === ['/component/1', '/component/1-draft'].join() },
}))

vi.mock('#cwa/composables/cwa', () => ({ useCwa: () => cwa }))

enableAutoUnmount(afterEach)

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

function editorFor(iri: string, field: string, overrides: Partial<InlineEditor> = {}) {
  const element = document.createElement('div')
  document.body.append(element)
  const editor: InlineEditor = { key: { iri: () => iri, field }, element: () => element, enabled: () => true, focus: vi.fn(), ...overrides }
  return { editor, element, unregister: registerInlineEditor(cwa, editor) }
}

describe('inline editors (#461)', () => {
  test('a registered editor is found by its resource and field, draft and published as one', () => {
    const { editor, unregister } = editorFor('/component/1', 'html')
    editorFor('/component/1', 'title')

    expect(findInlineEditor(cwa, { iri: () => '/component/1', field: 'html' })).toBe(editor)
    expect(findInlineEditor(cwa, { iri: () => '/component/1-draft', field: 'html' })).toBe(editor)
    expect(findInlineEditor(cwa, { iri: () => '/component/2', field: 'html' })).toBeUndefined()
    unregister()
    expect(findInlineEditor(cwa, { iri: () => '/component/1', field: 'html' })).toBeUndefined()
  })

  test('an editor that is disabled, or no longer in the page, is not found', () => {
    const enabled = ref(false)
    const { element } = editorFor('/component/1', 'html', { enabled: () => enabled.value })

    expect(findInlineEditor(cwa, { iri: () => '/component/1', field: 'html' })).toBeUndefined()
    enabled.value = true
    expect(findInlineEditor(cwa, { iri: () => '/component/1', field: 'html' })).toBeDefined()
    element.remove()
    expect(findInlineEditor(cwa, { iri: () => '/component/1', field: 'html' })).toBeUndefined()
  })

  test('opening one scrolls it to the centre, focuses it and flashes an accent outline for 600 ms', () => {
    const { editor, element } = editorFor('/component/1', 'html')
    element.scrollIntoView = vi.fn()
    element.animate = vi.fn()

    openInlineEditor(editor)

    expect(element.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(editor.focus).toHaveBeenCalled()
    expect(INLINE_EDITOR_FLASH_MS).toBe(600)
    const [frames, options] = vi.mocked(element.animate).mock.calls[0]!
    expect(options).toEqual({ duration: 600 })
    expect(JSON.stringify(frames)).toContain('var(--cwa-color-accent-fg)')
  })

  test('under reduced motion it jumps instead of scrolling smoothly', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }))
    const { editor, element } = editorFor('/component/1', 'html')
    element.scrollIntoView = vi.fn()

    openInlineEditor(editor)

    expect(element.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' })
  })

  describe('useCwaInlineEditor', () => {
    async function mountEditor(enabled = () => true) {
      const { useCwaInlineEditor } = await import('#cwa/composables/cwa-inline-editor')
      const button = document.createElement('button')
      document.body.append(button)
      const model = { model: ref('x'), remoteChange: ref(undefined), editorKey: { iri: () => '/component/1', field: 'html' } }
      const wrapper = mount(defineComponent({
        setup() {
          const root = ref<HTMLElement>()
          useCwaInlineEditor(model, root, { enabled })
          return () => h('div', { ref: root, contenteditable: 'true', tabindex: 0 }, 'Our kitchens')
        },
      }), { attachTo: document.body })
      return { wrapper, button, element: wrapper.element as HTMLElement }
    }

    test('registers the element while mounted, and Escape in it returns focus to the button that opened it, once', async () => {
      const { wrapper, button, element } = await mountEditor()
      const editor = findInlineEditor(cwa, { iri: () => '/component/1', field: 'html' })!
      expect(editor.element()).toBe(element)

      openInlineEditor(editor, button)
      expect(document.activeElement).toBe(element)
      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      element.dispatchEvent(escape)
      expect(document.activeElement).toBe(button)
      expect(escape.defaultPrevented).toBe(true)

      element.focus()
      const again = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      element.dispatchEvent(again)
      expect(document.activeElement).toBe(element)
      expect(again.defaultPrevented).toBe(false)

      wrapper.unmount()
      expect(findInlineEditor(cwa, { iri: () => '/component/1', field: 'html' })).toBeUndefined()
    })

    test('is found only while enabled, as a TipTap editor is only while its component is selected', async () => {
      const enabled = ref(false)
      await mountEditor(() => enabled.value)

      expect(findInlineEditor(cwa, { iri: () => '/component/1', field: 'html' })).toBeUndefined()
      enabled.value = true
      expect(findInlineEditor(cwa, { iri: () => '/component/1', field: 'html' })).toBeDefined()
    })
  })
})
