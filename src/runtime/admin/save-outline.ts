import { computed, onScopeDispose, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { badgeFor } from './field-badge'
import type { CwaFieldState } from '../storage/stores/resources/state'

export type SaveOutlinePhase = 'rest' | 'saving' | 'saved' | 'error' | 'conflict'
export type SaveOutlineTone = 'light' | 'dark'

export const SAVE_OUTLINE_GAP = 300
export const SAVE_OUTLINE_SAVED_FOR = 1180

export function useSaveOutline(states: Ref<CwaFieldState[]>, selection: Ref<unknown>): ComputedRef<SaveOutlinePhase> {
  const busy = computed(() => states.value.some(state => state.status === 'saving'))
  const sweeping = ref(busy.value)
  const saved = ref(false)
  let gapTimer: ReturnType<typeof setTimeout> | undefined
  let savedTimer: ReturnType<typeof setTimeout> | undefined

  function clearTimers() {
    clearTimeout(gapTimer)
    clearTimeout(savedTimer)
  }

  watch(busy, (isBusy) => {
    clearTimeout(gapTimer)
    if (isBusy) {
      clearTimeout(savedTimer)
      saved.value = false
      sweeping.value = true
      return
    }
    if (!sweeping.value) {
      return
    }
    gapTimer = setTimeout(() => {
      sweeping.value = false
      if (badgeFor(states.value).kind) {
        return
      }
      saved.value = true
      savedTimer = setTimeout(() => {
        saved.value = false
      }, SAVE_OUTLINE_SAVED_FOR)
    }, SAVE_OUTLINE_GAP)
  })

  watch(selection, () => {
    clearTimers()
    saved.value = false
    sweeping.value = busy.value
  })

  onScopeDispose(clearTimers)

  return computed(() => {
    if (sweeping.value) {
      return 'saving'
    }
    const kind = badgeFor(states.value).kind
    if (kind) {
      return kind
    }
    return saved.value ? 'saved' : 'rest'
  })
}

function luminance(colour: string) {
  const channels = colour.match(/[\d.]+/g)?.map(Number)
  if (!channels || channels.length < 3 || channels[3] === 0) {
    return
  }
  const [r, g, b] = channels.slice(0, 3).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function toneBehind(element: Element | undefined, read: (element: Element) => string = each => getComputedStyle(each).backgroundColor): SaveOutlineTone {
  for (let each: Element | null | undefined = element instanceof Element ? element : undefined; each; each = each.parentElement) {
    const value = luminance(read(each))
    if (value !== undefined) {
      return value > 0.18 ? 'light' : 'dark'
    }
  }
  return 'light'
}
