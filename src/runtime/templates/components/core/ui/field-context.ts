import { computed, getCurrentInstance, inject, ref } from 'vue'
import { consola } from 'consola'
import { useCwaResourceModel } from '#cwa/composables/cwa-resource-model'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'
import { announceKey, fieldGroupKey, managerTabKey, tabMetaOnlyKey } from './field-keys'
import type { Announce } from './field-keys'

export const IDLE_STATE: CwaFieldState = Object.freeze({ status: 'idle', waiting: false, slow: false })

export interface FieldBindingProps<T> {
  field?: string
  model?: ResourceModelField<T>
  modelValue?: T | null
}

const BINDINGS = [['field', 'field'], ['model', 'model'], ['modelValue', 'model-value']] as const

export function createAnnouncer(delay = 100) {
  const message = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined
  function announce(text: string) {
    clearTimeout(timer)
    message.value = ''
    timer = setTimeout(() => {
      message.value = text
    }, delay)
  }
  return { message, announce }
}

export function useAnnounce(): Announce {
  return inject(announceKey, () => {})
}

export function useFieldModel<T>(props: FieldBindingProps<T>, emit: (event: 'update:modelValue', value: T | null | undefined) => void) {
  const given = Object.keys(getCurrentInstance()?.vnode.props ?? {})
  const bound = BINDINGS.filter(([camel, kebab]) => given.includes(camel) || given.includes(kebab)).map(([camel]) => camel)
  const tab = inject(managerTabKey, undefined)
  const metaOnly = inject(tabMetaOnlyKey, false)
  const group = inject(fieldGroupKey, undefined)
  let unbound = false

  if (bound.length > 1 && import.meta.env.DEV) {
    consola.error(`A kit control takes exactly one of \`field\`, \`:model\` or \`v-model\`, but was given ${bound.map(name => `\`${name}\``).join(' and ')}.`)
  }

  let fieldModel: ResourceModelField<T> | undefined
  const grouped = props.field ? group?.model(props.field) : undefined
  if (props.field && grouped) {
    tab?.register(props.field)
    fieldModel = grouped
  }
  else if (props.field) {
    if (!tab) {
      unbound = true
      import.meta.env.DEV && consola.error(`\`field="${props.field}"\` needs a CwaUiManagerTab, CwaUiDialog or CwaUiFormGroup`)
    }
    else {
      tab.register(props.field)
      if (!metaOnly) {
        fieldModel = useCwaResourceModel<T>(tab.iri, props.field) as unknown as ResourceModelField<T>
      }
    }
  }

  const model = computed<ResourceModelField<T> | undefined>(() => fieldModel ?? props.model)

  const value = computed<T | null | undefined>({
    get() {
      return model.value ? model.value.model.value : props.modelValue
    },
    set(next) {
      if (model.value) {
        model.value.model.value = next
        return
      }
      emit('update:modelValue', next)
    },
  })

  const state = computed<CwaFieldState>(() => model.value?.state?.value ?? IDLE_STATE)

  return { model, value, state, unbound, metaOnly }
}
