<script setup lang="ts">
import { computed, inject, provide, reactive } from 'vue'
import CwaUiBadge from './Badge.vue'
import CwaUiSegmented from './Segmented.vue'
import { eitherOrKey, fieldGroupKey, managerTabKey, tabMetaOnlyKey } from '../core/ui/field-keys'
import type { FieldUndo } from '../core/ui/field-keys'
import { useCwaResourceFieldGroup } from '#cwa/composables/cwa-resource-field-group'
import type { CwaResourceFieldGroupOps } from '#cwa/composables/cwa-resource-field-group'

const { label, info, ops } = defineProps<{
  label: string
  info?: string
  ops?: CwaResourceFieldGroupOps
}>()

const tab = inject(managerTabKey, undefined)
const metaOnly = inject(tabMetaOnlyKey, false)
const iri = computed(() => tab?.iri.value)
const group = metaOnly ? undefined : useCwaResourceFieldGroup(iri, [], ops)
const labels = reactive<string[]>([])
const optionFields: string[][] = []

function optionIndex(field: string) {
  return optionFields.findIndex(fields => fields.includes(field))
}

provide(eitherOrKey, {
  active: computed(() => group?.active.value ?? 0),
  register(optionLabel, fields) {
    labels.push(optionLabel)
    optionFields.push(fields)
    return group ? group.addOption(fields) : labels.length - 1
  },
})

provide(fieldGroupKey, {
  model: field => group?.models[field],
  undo(field): FieldUndo | undefined {
    const cleared = group?.cleared.value
    if (!group || !cleared || cleared.field !== field) {
      return undefined
    }
    const from = [...new Set(Object.keys(cleared.restore).map(other => labels[optionIndex(other)]))].filter(Boolean)
    return {
      text: `This save also cleared ${from.join(' and ')}.`,
      run: group.undoClear,
    }
  },
})

const segments = computed(() => labels.map((optionLabel, index) => ({ value: String(index), label: optionLabel })))
const segment = computed({
  get: () => String(group?.active.value ?? 0),
  set: value => group?.choose(Number(value)),
})
</script>

<template>
  <slot v-if="metaOnly" />
  <div
    v-else
    class="cwa:flex cwa:shrink-0 cwa:items-center cwa:gap-2"
    data-testid="either-or"
  >
    <CwaUiSegmented
      v-model="segment"
      :label="label"
      :info="info"
      :options="segments"
    />
    <CwaUiBadge
      v-if="group?.bothSet.value"
      tone="warning"
      data-testid="either-or-both"
    >
      Both are set. Saving one clears the other.
    </CwaUiBadge>
    <slot />
  </div>
</template>
