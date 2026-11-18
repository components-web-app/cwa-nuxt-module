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

interface Sending {
  key: string
  restore: Record<string, unknown>
  undo: boolean
}

function isSet(value: unknown) {
  return value !== null && value !== undefined && value !== ''
}

export const useCwaResourceFieldGroup = (iri: Ref<string | undefined>, options: (string | string[])[] = [], ops: CwaResourceFieldGroupOps = {}) => {
  const $cwa = useCwa()
  const data = computed(() => iri.value ? $cwa.resources.getResource(iri.value).value?.data : undefined)
  const groups = shallowReactive<string[][]>([])
  const models: Record<string, ResourceModelField<any>> = {}
  const resets: Record<string, () => unknown> = {}
  const stored: Record<string, { value: unknown }> = {}
  const chosen = ref<number>()
  const cleared = ref<ClearedFields>()
  const undoing = new Set<string>()
  const sending = new Map<string, Sending>()

  function keyOf(at: string) {
    return $cwa.resources.findPublishedComponentIri(at).value ?? at
  }

  const key = computed(() => iri.value ? keyOf(iri.value) : undefined)

  const setOptions = computed(() => groups.map((fields, index) => fields.some(field => isSet(data.value?.[field])) ? index : -1).filter(index => index !== -1))
  const active = computed(() => chosen.value ?? setOptions.value[0] ?? 0)
  const bothSet = computed(() => setOptions.value.length > 1)

  watch(key, () => {
    chosen.value = undefined
    cleared.value = undefined
    undoing.clear()
  })

  function optionOf(field: string) {
    return groups.findIndex(fields => fields.includes(field))
  }

  function clearOthers(field: string, at: string) {
    const own = optionOf(field)
    const saving = $cwa.resources.getResource(at).value?.data
    const restore: Record<string, unknown> = {}
    groups.forEach((fields, index) => {
      index !== own && fields.forEach((other) => {
        isSet(saving?.[other]) && (restore[other] = saving?.[other])
      })
    })
    sending.set(field, { key: keyOf(at), restore, undo: undoing.delete(field) })
    const fields = Object.keys(restore)
    return fields.length ? Object.fromEntries(fields.map(other => [other, null])) : undefined
  }

  function saved(field: string) {
    const sent = sending.get(field)
    sending.delete(field)
    const own = optionOf(field)
    if (!sent || sent.key !== key.value) {
      return
    }
    groups.forEach((fields, index) => {
      index !== own && fields.forEach(other => resets[other]?.())
    })
    if (!sent.undo && Object.keys(sent.restore).length) {
      cleared.value = { field, restore: sent.restore }
    }
  }

  function addOption(fields: string[]) {
    for (const field of fields) {
      const fieldModel = useCwaResourceModel<any>(iri, field, {
        debounceTime: ops.debounceTime?.[field],
        valid: ops.valid?.[field],
        alsoSend: (value, at) => {
          sending.delete(field)
          return isSet(value) ? clearOthers(field, at) : undefined
        },
        saved: () => saved(field),
      })
      models[field] = {
        ...fieldModel,
        model: computed({
          get: () => fieldModel.model.value,
          set: (value) => {
            cleared.value = undefined
            undoing.clear()
            fieldModel.model.value = value
          },
        }),
        reset: () => {
          cleared.value = undefined
          return fieldModel.reset()
        },
      }
      resets[field] = fieldModel.reset
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
      undoing.add(field)
      stored[field]!.value = value
    }
  }

  return { models, active, choose, bothSet, cleared, undoClear, addOption }
}
