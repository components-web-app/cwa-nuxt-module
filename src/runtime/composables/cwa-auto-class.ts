import { getCurrentInstance, onMounted, watch } from 'vue'
import type { ComputedRef } from 'vue'

export function useCwaAutoClass(
  uiClassNames: ComputedRef<string[] | undefined>,
  opts?: { autoClass?: boolean },
) {
  if (opts?.autoClass === false) return

  const instance = getCurrentInstance()
  const activeSet: string[] = []

  function tokenize(classes: string[]): string[] {
    return classes.flatMap(c => c.split(/\s+/).filter(Boolean))
  }

  function applyClasses(newClasses: string[] | undefined) {
    const el = instance?.proxy?.$el
    if (!el || el.nodeType !== 1 || !el.isConnected) return
    const tokens = tokenize(newClasses ?? [])
    // Only ever remove what WE added: a class already on the element belongs to the component's own
    // markup or to a :class binding (ResourceLoader binds uiClassNames), and that owner keeps it
    // correct. Tracking our own additions means a class the owner supplies is never stolen, and a
    // class we applied is still removed when the style that carried it is deselected - even when the
    // new class list is a subset of what is already on the element.
    const toRemove = activeSet.filter((c: string) => !tokens.includes(c))
    const toAdd = tokens.filter((c: string) => !el.classList.contains(c))
    for (const cls of toRemove) el.classList.remove(cls)
    for (const cls of toAdd) el.classList.add(cls)
    const stillOurs = activeSet.filter((c: string) => tokens.includes(c))
    activeSet.length = 0
    activeSet.push(...stillOurs, ...toAdd)
  }

  onMounted(() => applyClasses(uiClassNames.value))
  watch(uiClassNames, newClasses => applyClasses(newClasses), { flush: 'post' })
}
