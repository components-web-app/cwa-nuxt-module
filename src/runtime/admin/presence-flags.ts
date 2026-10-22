import { onScopeDispose, shallowReactive, watch } from 'vue'

const FLAG_MS = 3000

export function useFreshFlags(signatures: () => Record<string, string>) {
  const fresh = shallowReactive(new Set<string>())
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  watch(signatures, (next, previous) => {
    for (const [key, signature] of Object.entries(next)) {
      if (previous?.[key] === signature) {
        continue
      }
      fresh.add(key)
      clearTimeout(timers.get(key))
      timers.set(key, setTimeout(() => {
        fresh.delete(key)
        timers.delete(key)
      }, FLAG_MS))
    }
  }, { immediate: true })
  onScopeDispose(() => timers.forEach(timer => clearTimeout(timer)))
  return fresh
}
