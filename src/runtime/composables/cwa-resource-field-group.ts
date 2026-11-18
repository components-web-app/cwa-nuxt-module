import { computed, ref, shallowReactive, watch } from 'vue'
import type { Ref } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaResourceModel } from '#cwa/composables/cwa-resource-model'
import type { ResourceModelField } from '#cwa/resources/model-editors'

export interface CwaResourceFieldGroupOps {
  debounceTime?: Record<string, number>
  valid?: Record<string, (value: any) => boolean>
}

export interface ClearedFields {
  field: string
  restore: Record<string, unknown>
}

function isSet(value: unknown) {
  return value !== null && value !== undefined && value !== ''
}

export const useCwaResourceFieldGroup = (iri: Ref<string | undefined>, options: (string | string[])[] = [], ops: CwaResourceFieldGroupOps = {}) => {
  const $cwa = useCwa()
  const data = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value?.data : undefined)
  const groups = shallowReactive<string[][]>([])
  const models: Record<string, ResourceModelField<any>> = {}
  const stored: Record<string, { value: unknown }> = {}
  const chosen = ref<number>()
  const cleared = ref<ClearedFields>()
  let undoing = false

  const setOptions = computed(() => groups.map((fields, index) => fields.some(field => isSet(data.value?.[field])) ? index : -1).filter(index => index !== -1))
  const active = computed(() => chosen.value ?? setOptions.value[0] ?? 0)
  const bothSet = computed(() => setOptions.value.length > 1)

  watch(iri, () => {
    chosen.value = undefined
    cleared.value = undefined
  })

  function optionOf(field: string) {
    return groups.findIndex(fields => fields.includes(field))
  }

  function clearOthers(field: string) {
    const own = optionOf(field)
    const restore: Record<string, unknown> = {}
    groups.forEach((fields, index) => {
      index !== own && fields.forEach((other) => {
        isSet(data.value?.[other]) && (restore[other] = data.value?.[other])
      })
    })
    const fields = Object.keys(restore)
    if (!fields.length) {
      return undefined
    }
    if (!undoing) {
      cleared.value = { field, restore }
    }
    undoing = false
    return Object.fromEntries(fields.map(other => [other, null]))
  }

  function addOption(fields: string[]) {
    for (const field of fields) {
      const fieldModel = useCwaResourceModel<any>(iri, field, {
        debounceTime: ops.debounceTime?.[field],
        valid: ops.valid?.[field],
        alsoSend: value => isSet(value) ? clearOthers(field) : undefined,
      })
      models[field] = {
        ...fieldModel,
        model: computed({
          get: () => fieldModel.model.value,
          set: (value) => {
            cleared.value = undefined
            fieldModel.model.value = value
          },
        }),
        reset: () => {
          cleared.value = undefined
          return fieldModel.reset()
        },
      }
      stored[field] = fieldModel.model
    }
    groups.push(fields)
    return groups.length - 1
  }

  options.forEach(option => addOption(Array.isArray(option) ? option : [option]))

  function choose(index: number) {
    chosen.value = index
  }

  function undoClear() {
    const last = cleared.value
    if (!last) {
      return
    }
    cleared.value = undefined
    const entries = Object.entries(last.restore)
    const [firstField] = entries[0]!
    chosen.value = optionOf(firstField)
    for (const [field, value] of entries) {
      undoing = true
      stored[field]!.value = value
    }
  }

  return { models, active, choose, bothSet, cleared, undoClear, addOption }
}
