<script setup lang="ts">
import { useId } from 'vue'
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import Field from '../core/ui/Field.vue'
import InfoPopover from '../core/ui/InfoPopover.vue'
import { useFieldModel } from '../core/ui/field-context'
import type { ResourceModelField } from '#cwa/resources/model-editors'

const props = withDefaults(defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  description?: string
  disabled?: boolean
  field?: string
  model?: ResourceModelField<boolean>
  modelValue?: boolean | null
}>(), {
  labelHidden: false,
  info: undefined,
  description: undefined,
  disabled: false,
  field: undefined,
  model: undefined,
  modelValue: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean | null | undefined] }>()

const { model, value, state, unbound } = useFieldModel<boolean>(props, emit)
const id = useId()

function onChecked(checked: boolean) {
  value.value = checked
}
</script>

<template>
  <Field
    :label="label"
    :info="info"
    :description="description"
    :state="state"
    :model="model"
    :control-id="id"
    :inactive="disabled || unbound"
    :name="field"
    :format="value => value ? 'On' : 'Off'"
    own-label
  >
    <template #lead="{ modal, unsaved, help, helpId }">
      <span
        v-if="modal"
        class="cwa:flex cwa:flex-wrap cwa:items-center cwa:gap-x-2"
        :class="[{ 'cwa:sr-only': labelHidden }, { 'cwa:opacity-50': disabled || unbound }]"
      >
        <label
          :for="id"
          class="cwa:text-label cwa:text-fg"
          :class="disabled || unbound ? 'cwa:cursor-not-allowed' : 'cwa:cursor-pointer'"
        >{{ label }}</label>
        <InfoPopover
          v-if="help && helpId"
          :label="label"
          :text="help"
          :text-id="helpId"
        />
        <span
          v-if="unsaved"
          data-testid="field-unsaved"
          class="cwa:inline-flex cwa:items-center cwa:gap-1.5 cwa:text-helper cwa:font-medium cwa:text-fg-muted"
        ><span
          aria-hidden="true"
          class="cwa:size-2 cwa:rounded-toggle cwa:bg-accent-fg"
        />Unsaved</span>
      </span>
      <label
        v-else
        :for="id"
        class="cwa:whitespace-nowrap cwa:text-label cwa:text-fg-muted"
        :class="[labelHidden ? 'cwa:sr-only' : '', disabled || unbound ? 'cwa:cursor-not-allowed cwa:opacity-50' : 'cwa:cursor-pointer']"
      >{{ label }}</label>
    </template>
    <template #default="{ describedBy, busy, modal }">
      <div
        class="cwa:flex cwa:items-center"
        :class="[modal ? 'cwa:min-h-hit cwa:px-1' : 'cwa:h-control cwa:px-1 cwa:pointer-coarse:h-hit', { 'cwa:opacity-50': disabled || unbound }]"
      >
        <SwitchRoot
          :id="id"
          :model-value="!!value"
          :disabled="disabled || unbound"
          :aria-describedby="describedBy"
          :aria-busy="busy ? 'true' : undefined"
          class="cwa:relative cwa:inline-flex cwa:h-5 cwa:w-9 cwa:shrink-0 cwa:items-center cwa:rounded-toggle cwa:bg-toggle-off cwa:p-0.5 cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:motion-reduce:transition-none cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:data-[state=checked]:bg-accent cwa:disabled:cursor-not-allowed cwa:cursor-pointer"
          @update:model-value="onChecked"
        >
          <SwitchThumb class="cwa:block cwa:size-4 cwa:rounded-toggle cwa:bg-white cwa:transition-transform cwa:duration-(--cwa-duration-fast) cwa:motion-reduce:transition-none cwa:data-[state=checked]:translate-x-4" />
        </SwitchRoot>
      </div>
    </template>
  </Field>
</template>
