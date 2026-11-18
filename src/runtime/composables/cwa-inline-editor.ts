import { onBeforeUnmount, onMounted, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { registerInlineEditor, returnFromInlineEditor } from '#cwa/admin/inline-editors'
import type { InlineEditor } from '#cwa/admin/inline-editors'
import type { ResourceModelField } from '#cwa/resources/model-editors'

export interface CwaInlineEditorOps {
  focus?: () => void
  enabled?: () => boolean
}

function focusAtEnd(element: HTMLElement) {
  element.focus({ preventScroll: true })
  const selection = window.getSelection?.()
  if (!selection || !element.isContentEditable) {
    return
  }
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

export function useCwaInlineEditor(model: ResourceModelField<any>, element: MaybeRefOrGetter<HTMLElement | null | undefined>, ops: CwaInlineEditorOps = {}) {
  const $cwa = useCwa()
  const key = model.editorKey
  if (!key) {
    return
  }
  const target = () => toValue(element) ?? undefined
  const editor: InlineEditor = {
    key,
    element: target,
    enabled: ops.enabled ?? (() => true),
    focus: () => {
      if (ops.focus) {
        ops.focus()
        return
      }
      const el = target()
      el && focusAtEnd(el)
    },
  }
  const unregister = registerInlineEditor($cwa, editor)
  let listeningOn: HTMLElement | undefined

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !event.defaultPrevented && returnFromInlineEditor(editor)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  function listen() {
    const el = target()
    if (el === listeningOn) {
      return
    }
    listeningOn?.removeEventListener('keydown', onKeydown)
    listeningOn = el
    el?.addEventListener('keydown', onKeydown)
  }

  onMounted(listen)
  const originalFocus = editor.focus
  editor.focus = () => {
    listen()
    originalFocus()
  }

  onBeforeUnmount(() => {
    listeningOn?.removeEventListener('keydown', onKeydown)
    unregister()
  })
}
