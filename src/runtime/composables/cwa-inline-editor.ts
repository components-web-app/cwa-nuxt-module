import { onBeforeUnmount, onMounted, shallowRef, toValue, watchEffect } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { registerInlineEditor, returnFromInlineEditor } from '#cwa/admin/inline-editors'
import type { InlineEditor } from '#cwa/admin/inline-editors'
import { labelModelField } from '#cwa/resources/model-editors'
import type { ResourceModelField } from '#cwa/resources/model-editors'

export interface CwaInlineEditorOps {
  focus?: () => void
  enabled?: () => boolean
  label?: string
}

const NAME_ATTRIBUTES = ['role', 'aria-multiline', 'aria-label'] as const

function isEditable(element: HTMLElement) {
  return element.getAttribute('contenteditable') === 'true' || element.getAttribute('contenteditable') === ''
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
  ops.label && labelModelField(key, ops.label)
  const target = () => toValue(element) ?? undefined
  const editor: InlineEditor = {
    key,
    element: target,
    enabled: ops.enabled ?? (() => true),
    model,
    label: ops.label,
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
    if (event.key === 'Escape' && returnFromInlineEditor(editor)) {
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

  let named: { element: HTMLElement, added: string[] } | undefined

  function unname() {
    named?.added.forEach(attribute => named!.element.removeAttribute(attribute))
    named = undefined
  }

  const typeNames = shallowRef<Record<string, { name?: string }>>()

  function componentName() {
    const iri = key!.iri()
    const type = iri ? $cwa.resources.getResource(iri).value?.data?.['@type'] : undefined
    return type ? (typeNames.value?.[type]?.name ?? type) : undefined
  }

  const stopNaming = watchEffect(() => {
    const el = target()
    const wanted = !!el && !!ops.label && editor.enabled() && isEditable(el) && !el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')
    if (named && (named.element !== el || !editor.enabled())) {
      unname()
    }
    if (!wanted || named) {
      return
    }
    if (!typeNames.value) {
      import('#build/cwa-config').then(({ resourcesConfig }) => {
        typeNames.value = resourcesConfig
      })
      return
    }
    const values: Record<typeof NAME_ATTRIBUTES[number], string> = { 'role': 'textbox', 'aria-multiline': 'true', 'aria-label': [ops.label, componentName()].filter(Boolean).join(', ') }
    const added = NAME_ATTRIBUTES.filter(attribute => !el!.hasAttribute(attribute))
    added.forEach(attribute => el!.setAttribute(attribute, values[attribute]))
    named = { element: el!, added }
  }, { flush: 'post' })

  onBeforeUnmount(() => {
    listeningOn?.removeEventListener('keydown', onKeydown)
    stopNaming()
    unname()
    unregister()
  })
}
