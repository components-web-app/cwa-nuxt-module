<script setup lang="ts">
import { useId } from 'vue'
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import Field from '../core/ui/Field.vue'
import { useFieldModel } from '../core/ui/field-context'
import type { ResourceModelField } from '#cwa/resources/model-editors'

export interface SegmentedOption {
  value: string
  label: string
}

const props = withDefaults(defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  description?: string
  optional?: boolean
  disabled?: boolean
  options: SegmentedOption[]
  field?: string
  model?: ResourceModelField<string>
  modelValue?: string | null
}>(), {
  labelHidden: false,
  info: undefined,
  description: undefined,
  optional: false,
  disabled: false,
  field: undefined,
  model: undefined,
  modelValue: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: string | null | undefined] }>()

const { model, value, state, unbound } = useFieldModel<string>(props, emit)
const id = useId()

function choose(next: unknown) {
  if (typeof next === 'string' && next !== value.value) {
    value.value = next
  }
}
</script>

<template>
  <Field
    :label="label"
    :label-hidden="labelHidden"
    :info="info"
    :description="description"
    :optional="optional"
    :state="state"
    :model="model"
    :control-id="id"
    :inactive="disabled || unbound"
    :name="field"
  >
    <template #default="{ describedBy, busy, labelId }">
      <ToggleGroupRoot
        :id="id"
        type="single"
        :model-value="value ?? undefined"
        :disabled="disabled || unbound"
        :roving-focus="false"
        :aria-labelledby="labelId"
        :aria-describedby="describedBy"
        :aria-busy="busy ? 'true' : undefined"
        data-testid="segmented"
        class="cwa:flex cwa:h-control cwa:bg-field cwa:pointer-coarse:h-hit"
        :class="{ 'cwa:opacity-50': disabled || unbound }"
        @update:model-value="choose"
      >
        <ToggleGroupItem
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          class="cwa:h-full cwa:cursor-pointer cwa:whitespace-nowrap cwa:px-4 cwa:text-control cwa:text-fg-secondary cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:hover:bg-field-hover cwa:focus-visible:z-1 cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:disabled:cursor-not-allowed cwa:data-[state=on]:bg-surface cwa:data-[state=on]:font-medium cwa:data-[state=on]:text-fg cwa:data-[state=on]:shadow-[inset_0_0_0_3px_var(--cwa-color-field)] cwa:motion-reduce:transition-none"
        >
          {{ option.label }}
        </ToggleGroupItem>
      </ToggleGroupRoot>
    </template>
  </Field>
</template>
