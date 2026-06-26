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
    if (tokens.length > 0 && tokens.every((cls: string) => el.classList.contains(cls))) {
      activeSet.length = 0
      return
    }
    const toRemove = activeSet.filter((c: string) => !tokens.includes(c))
    const toAdd = tokens.filter((c: string) => !el.classList.contains(c))
    for (const cls of toRemove) el.classList.remove(cls)
    for (const cls of toAdd) el.classList.add(cls)
    activeSet.length = 0
    activeSet.push(...tokens)
  }

  onMounted(() => applyClasses(uiClassNames.value))
  watch(uiClassNames, newClasses => applyClasses(newClasses), { flush: 'post' })
}
