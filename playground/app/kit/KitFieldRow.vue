<script setup lang="ts">
import {
  CwaUiDatePicker,
  CwaUiFileUpload,
  CwaUiInput,
  CwaUiMultiSelect,
  CwaUiNumber,
  CwaUiResourceSearch,
  CwaUiSegmented,
  CwaUiSelect,
  CwaUiTextarea,
  CwaUiToggle,
} from '#components'
import KitDemo from './KitDemo.vue'
import { kitAlignOptions, kitSearchLabel, kitSearchSource, kitSelectOptions, kitStyleOptions } from './kit-data'
import { kitFieldKeys, kitFieldLabels } from './kit-field-set'
import type { KitFieldKey, KitFieldSet } from './kit-field-set'
import { kitLoader } from './fake-loader'

const { set, disabled = false, disabledReason, only = kitFieldKeys, testId, bare = false } = defineProps<{
  set: KitFieldSet
  bare?: boolean
  disabled?: boolean
  disabledReason?: string
  only?: KitFieldKey[]
  testId?: string
}>()

const search = kitSearchSource(kitLoader, () => 'results')

function stateOf(key: KitFieldKey) {
  if (disabled) {
    return disabledReason ? 'disabled, with its reason behind ⓘ' : 'disabled, no reason'
  }
  const model = set[key]
  const state = model.state!.value
  const peers = model.focusedBy?.value ?? []
  return [
    state.status,
    state.slow && 'slow',
    state.error && `${state.error.kind}${state.error.status ? ` ${state.error.status}` : ''}`,
    peers.length && `${peers.map(peer => peer.name).join(', ')} here`,
  ].filter(Boolean).join(', ')
}
</script>

<template>
  <div
    :class="bare ? 'kit-field-contents' : 'kit-field-row'"
    :data-testid="testId"
  >
    <template
      v-for="key in only"
      :key="key"
    >
      <KitDemo
        :component="kitFieldLabels[key].component"
        :state="stateOf(key)"
        :bare="bare"
      >
        <CwaUiInput
          v-if="key === 'input'"
          :label="kitFieldLabels[key].label"
          :model="set.input"
          :disabled="disabled"
          :disabled-reason="disabledReason"
          :data-kit-field="key"
        />
        <CwaUiTextarea
          v-else-if="key === 'textarea'"
          :label="kitFieldLabels[key].label"
          :model="set.textarea"
          :disabled="disabled"
          :disabled-reason="disabledReason"
          :data-kit-field="key"
        />
        <CwaUiNumber
          v-else-if="key === 'number'"
          :label="kitFieldLabels[key].label"
          :model="set.number"
          :min="1"
          :max="6"
          :disabled="disabled"
          :disabled-reason="disabledReason"
          :data-kit-field="key"
        />
        <CwaUiToggle
          v-else-if="key === 'toggle'"
          :label="kitFieldLabels[key].label"
          :model="set.toggle"
          :disabled="disabled"
          :disabled-reason="disabledReason"
          :data-kit-field="key"
        />
        <CwaUiSelect
          v-else-if="key === 'select'"
          :label="kitFieldLabels[key].label"
          :model="set.select"
          :options="kitSelectOptions"
          :disabled="disabled"
          :disabled-reason="disabledReason"
          :data-kit-field="key"
        />
        <CwaUiMultiSelect
          v-else-if="key === 'multi'"
          :label="kitFieldLabels[key].label"
          :model="set.multi"
          :options="kitStyleOptions"
          :disabled="disabled"
          :disabled-reason="disabledReason"
          :data-kit-field="key"
        />
        <CwaUiSegmented
          v-else-if="key === 'segmented'"
          :label="kitFieldLabels[key].label"
          :model="set.segmented"
          :options="kitAlignOptions"
          :disabled="disabled"
          :disabled-reason="disabledReason"
          :data-kit-field="key"
        />
        <CwaUiDatePicker
          v-else-if="key === 'date'"
          :label="kitFieldLabels[key].label"
          :model="set.date"
          :disabled="disabled"
          :disabled-reason="disabledReason"
          :data-kit-field="key"
        />
        <CwaUiResourceSearch
          v-else-if="key === 'search'"
          :label="kitFieldLabels[key].label"
          :model="set.search"
          endpoint="/component"
          :label-of="kitSearchLabel"
          :load="search.load"
          :resolve="search.resolve"
          :disabled="disabled"
          :disabled-reason="disabledReason"
          :data-kit-field="key"
        />
        <CwaUiFileUpload
          v-else-if="key === 'file'"
          :label="kitFieldLabels[key].label"
          :upload="set.upload"
          accept="image/*,application/pdf"
          :disabled="disabled"
          :disabled-reason="disabledReason"
          :data-kit-field="key"
        />
      </KitDemo>
    </template>
  </div>
</template>

<style scoped>
.kit-field-contents {
  display: contents;
}

.kit-field-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem 1.5rem;
}
</style>
