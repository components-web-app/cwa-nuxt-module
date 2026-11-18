import { reactive } from 'vue'

export type KitLoadMode = 'normal' | 'slow' | 'once' | 'held'

export const KIT_LOAD_NORMAL = 300
export const KIT_LOAD_SLOW = 4000
export const KIT_LOAD_ONCE = 7000

export const kitLoadModes: { value: KitLoadMode, label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'slow', label: 'Slow (4 s)' },
  { value: 'once', label: 'Load once (7 s)' },
  { value: 'held', label: 'Held' },
]

export interface FakeLoader {
  readonly state: { mode: KitLoadMode, loads: number, holding: number }
  setMode: (mode: KitLoadMode) => void
  release: () => void
  wait: () => Promise<void>
}

export function createFakeLoader(sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): FakeLoader {
  const state = reactive({ mode: 'normal' as KitLoadMode, loads: 0, holding: 0 })
  let waiting: (() => void)[] = []
  let onceUsed = false

  function release() {
    const resolvers = waiting
    waiting = []
    state.holding = 0
    resolvers.forEach(resolve => resolve())
  }

  return {
    state,
    release,
    setMode: (mode) => {
      if (state.mode === 'held' && mode !== 'held') {
        release()
      }
      onceUsed = false
      state.mode = mode
    },
    wait: async () => {
      state.loads++
      if (state.mode === 'held') {
        state.holding++
        return new Promise<void>(resolve => waiting.push(resolve))
      }
      if (state.mode === 'once' && !onceUsed) {
        onceUsed = true
        return sleep(KIT_LOAD_ONCE)
      }
      return sleep(state.mode === 'slow' ? KIT_LOAD_SLOW : KIT_LOAD_NORMAL)
    },
  }
}

export const kitLoader = createFakeLoader()
