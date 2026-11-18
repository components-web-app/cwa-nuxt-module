import { computed, ref } from 'vue'
import type { ResourceModelField, RemoteFieldChange } from '#cwa/resources/model-editors'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

export type FakeStatus = CwaFieldState['status']

export interface FakeFieldModel<T> extends ResourceModelField<T> {
  status: { value: FakeStatus }
  retried: { value: number }
}

const THEIRS_BY = 'Alex'

export function fakeFieldModel<T>(initial: T, status: FakeStatus = 'idle', theirs?: T): FakeFieldModel<T> {
  const value = ref(initial) as { value: T | null | undefined }
  const current = ref<FakeStatus>(status)
  const savedAt = ref(status === 'saved' ? Date.now() : undefined)
  const retried = ref(0)
  const original = initial

  function settle(next: FakeStatus) {
    current.value = next
    savedAt.value = next === 'saved' ? Date.now() : undefined
  }

  const state = computed<CwaFieldState>(() => ({
    status: current.value,
    waiting: current.value === 'pending',
    slow: false,
    savedAt: savedAt.value,
    error: current.value === 'error' ? { kind: 'network', message: 'The connection dropped.' } : undefined,
    held: current.value === 'conflict' ? { user: { id: '/_/users/alex', name: THEIRS_BY }, value: theirs } : undefined,
  }))

  const remoteChange = computed<RemoteFieldChange<T> | undefined>(() => current.value === 'conflict' && theirs !== undefined
    ? {
        name: THEIRS_BY,
        value: theirs,
        accept: () => {
          value.value = theirs
          settle('idle')
        },
        keep: async () => settle('saved'),
      }
    : undefined)

  return {
    model: value,
    remoteChange,
    state,
    status: current,
    retried,
    retry: async () => {
      retried.value++
      settle('saved')
    },
    reset: async () => {
      value.value = original
      settle('idle')
    },
  }
}
