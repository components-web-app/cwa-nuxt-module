import { computed, reactive, ref } from 'vue'
import isEqual from 'lodash-es/isEqual'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'
import type { DialogFieldConflict, DialogForm } from '#cwa/templates/components/core/ui/dialog-form'

const IDLE: CwaFieldState = { status: 'idle', waiting: false, slow: false }

export interface FakeDialogForm extends DialogForm {
  local: Record<string, unknown>
  saves: Record<string, unknown>[]
  save: () => Promise<void>
  failNext: (errors: Record<string, string>) => void
  conflictNext: (theirs: Record<string, unknown>, name?: string) => void
}

export function fakeDialogForm(stored: Record<string, unknown>): FakeDialogForm {
  const saved = ref({ ...stored })
  const local = reactive({ ...stored }) as Record<string, unknown>
  const fieldErrors = ref<Record<string, string>>({})
  const conflicts = ref<Record<string, DialogFieldConflict>>({})
  const saving = ref(false)
  const savedAt = ref<number>()
  const failures = ref(0)
  const saves: Record<string, unknown>[] = []
  let nextErrors: Record<string, string> | undefined
  let nextConflict: { theirs: Record<string, unknown>, name: string } | undefined

  const unsavedFields = computed(() => Object.keys(local).filter(field => !isEqual(local[field], saved.value[field])))

  const models = new Map<string, ResourceModelField<any>>()
  function model<T>(field: string): ResourceModelField<T> {
    let found = models.get(field)
    if (!found) {
      found = {
        field,
        model: computed({
          get: () => local[field] as T,
          set: (value) => {
            local[field] = value
            if (fieldErrors.value[field]) {
              const { [field]: _cleared, ...rest } = fieldErrors.value
              fieldErrors.value = rest
            }
          },
        }),
        state: computed<CwaFieldState>(() => {
          const conflict = conflicts.value[field]
          if (conflict) {
            return { status: 'conflict', waiting: false, slow: false, held: { user: { id: '', name: conflict.name }, value: conflict.value } }
          }
          const error = fieldErrors.value[field]
          return error ? { status: 'error', waiting: false, slow: false, error: { kind: 'violation', message: error } } : IDLE
        }),
        remoteChange: computed(() => {
          const conflict = conflicts.value[field]
          if (!conflict) {
            return undefined
          }
          const resolve = () => {
            const { [field]: _resolved, ...rest } = conflicts.value
            conflicts.value = rest
          }
          return {
            name: conflict.name,
            value: conflict.value,
            accept: () => {
              local[field] = conflict.value
              resolve()
            },
            keep: async () => resolve(),
          }
        }),
      }
      models.set(field, found)
    }
    return found as ResourceModelField<T>
  }

  async function save() {
    const sent = Object.fromEntries(unsavedFields.value.map(field => [field, local[field]]))
    saving.value = true
    await Promise.resolve()
    saving.value = false
    if (nextErrors) {
      fieldErrors.value = nextErrors
      nextErrors = undefined
      failures.value++
      return
    }
    if (nextConflict) {
      const { theirs, name } = nextConflict
      nextConflict = undefined
      saved.value = { ...saved.value, ...theirs }
      conflicts.value = Object.fromEntries(Object.keys(theirs).filter(field => field in sent).map(field => [field, { name, value: theirs[field] }]))
      failures.value++
      return
    }
    saves.push(sent)
    saved.value = { ...saved.value, ...sent }
    savedAt.value = Date.now()
  }

  return reactive({
    unsavedFields,
    fieldErrors,
    conflicts,
    formError: undefined,
    saving,
    savedAt,
    failures,
    model,
    discard: () => {
      Object.assign(local, saved.value)
      fieldErrors.value = {}
      conflicts.value = {}
    },
    local,
    saves,
    save,
    failNext: (errors: Record<string, string>) => {
      nextErrors = errors
    },
    conflictNext: (theirs: Record<string, unknown>, name = 'Mia') => {
      nextConflict = { theirs, name }
    },
  }) as unknown as FakeDialogForm
}
