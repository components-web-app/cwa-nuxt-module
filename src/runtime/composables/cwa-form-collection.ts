import { computed, reactive } from 'vue'
import type { Ref } from 'vue'
import { useCwa } from '#cwa/composables/cwa'

function replaceNameInTree(node: Record<string, any>, index: string): Record<string, any> {
  if (typeof node?.vars?.full_name === 'string') {
    node.vars.full_name = node.vars.full_name.replace(/__name__/g, index)
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

  const vars = computed(() => {
    if (!iri.value) return undefined
    return $cwa.forms.getForm(iri.value).value?.[collectionFullName]?.vars
  })

  const _entries = reactive<string[]>([])
  let _nextIndex = 0

  const entries = computed(() => [..._entries])

  const addEntry = () => {
    const prototype = vars.value?.prototype
    if (!prototype) return
    const index = _nextIndex++
    const cloned = replaceNameInTree(JSON.parse(JSON.stringify(prototype)), String(index))
    _entries.push(cloned.vars.full_name)
  }

  const removeEntry = (fullName: string) => {
    const idx = _entries.indexOf(fullName)
    if (idx !== -1) _entries.splice(idx, 1)
  }

  return { entries, addEntry, removeEntry, vars }
}
