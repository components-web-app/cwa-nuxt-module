import { shallowReactive } from 'vue'

export interface InlineEditorKey {
  iri: () => string | undefined
  field: string
}

export interface InlineEditor {
  key: InlineEditorKey
  element: () => HTMLElement | null | undefined
  enabled: () => boolean
  focus: () => void
  returnTo?: HTMLElement
}

interface EquivalenceSource {
  resources: { isIriPublishableEquivalent: (a: string, b: string) => boolean }
}

export const INLINE_EDITOR_FLASH_MS = 600

const registries = new WeakMap<object, Set<InlineEditor>>()

function registry(owner: object) {
  let editors = registries.get(owner)
  if (!editors) {
    editors = shallowReactive(new Set<InlineEditor>())
    registries.set(owner, editors)
  }
  return editors
}

export function registerInlineEditor(owner: object, editor: InlineEditor) {
  const editors = registry(owner)
  editors.add(editor)
  return () => {
    editors.delete(editor)
  }
}

export function findInlineEditor(owner: EquivalenceSource, key: InlineEditorKey | undefined) {
  const iri = key?.iri()
  if (!key || !iri) {
    return undefined
  }
  for (const editor of registry(owner)) {
    const editorIri = editor.key.iri()
    if (editor.key.field === key.field && editorIri && editor.enabled() && editor.element()?.isConnected
      && (editorIri === iri || owner.resources.isIriPublishableEquivalent(editorIri, iri))) {
      return editor
    }
  }
  return undefined
}

function reducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function openInlineEditor(editor: InlineEditor, returnTo?: HTMLElement) {
  const element = editor.element()
  if (!element) {
    return
  }
  editor.returnTo = returnTo
  element.scrollIntoView?.({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
  editor.focus()
  element.animate?.([
    { outline: '1px solid var(--cwa-color-accent-fg)', outlineOffset: '2px' },
    { outline: '1px solid var(--cwa-color-accent-fg)', outlineOffset: '2px', offset: 0.8 },
    { outline: '1px solid transparent', outlineOffset: '2px' },
  ], { duration: INLINE_EDITOR_FLASH_MS })
}

export function returnFromInlineEditor(editor: InlineEditor) {
  const target = editor.returnTo
  editor.returnTo = undefined
  if (!target?.isConnected) {
    return false
  }
  target.focus()
  return true
}
