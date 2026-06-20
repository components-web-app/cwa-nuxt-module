import { computed, reactive } from 'vue'
import type { Ref } from 'vue'
import { useCwa } from '#cwa/composables/cwa'

function replaceNameInTree(node: Record<string, any>, index: string): Record<string, any> {
  if (typeof node?.vars?.full_name === 'string') {
    node.vars.full_name = node.vars.full_name.replace(/__name__/g, index)
  }
  // Symfony uses "__name__label__" as a sentinel label on collection prototypes.
  // It has no meaning once the entry is given an index — clear it so the consuming
  // template's own fallback label takes effect.
  if (typeof node?.vars?.label === 'string' && node.vars.label.includes('__name__')) {
    delete node.vars.label
  }
  if (Array.isArray(node?.children)) {
    for (const child of node.children) {
      replaceNameInTree(child, index)
    }
  }
  return node
}

export const useCwaFormCollection = (iri: Ref<string | undefined>, collectionFullName: string) => {
  const $cwa = useCwa()

  const formEntry = computed(() => {
    if (!iri.value) return undefined
    return $cwa.forms.getForm(iri.value).value?.[collectionFullName]
  })

  const vars = computed(() => formEntry.value?.vars)

  const _entries = reactive<string[]>([])
  const _entryKeys = new Map<string, string[]>()
  let _nextIndex = 0

  const entries = computed(() => [..._entries])

  const addEntry = () => {
    const prototype = formEntry.value?.prototype
    if (!prototype || !iri.value) return
    const index = _nextIndex++
    const cloned = replaceNameInTree(JSON.parse(JSON.stringify(prototype)), String(index))
    const keys = $cwa.forms.registerLocalEntry(iri.value, cloned)
    _entryKeys.set(cloned.vars.full_name, keys)
    _entries.push(cloned.vars.full_name)
  }

  const removeEntry = (fullName: string) => {
    const idx = _entries.indexOf(fullName)
    if (idx !== -1) {
      _entries.splice(idx, 1)
      if (iri.value) {
        $cwa.forms.unregisterLocalEntries(iri.value, _entryKeys.get(fullName) ?? [])
      }
      _entryKeys.delete(fullName)
    }
  }

  return { entries, addEntry, removeEntry, vars }
}
