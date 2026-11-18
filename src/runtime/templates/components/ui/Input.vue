<script setup lang="ts">
import { inject, useId } from 'vue'
import type { Directive } from 'vue'
import StateGlyph from '../core/ui/StateGlyph.vue'
import Field from '../core/ui/Field.vue'
import type { FieldWidth } from '../core/ui/Field.vue'
import { useFieldModel } from '../core/ui/field-context'
import { fieldBox, fieldFill } from '../core/ui/field-looks'
import { formSurfaceKey } from '../core/ui/field-keys'
import type { ResourceModelField } from '#cwa/resources/model-editors'

const props = withDefaults(defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  description?: string
  optional?: boolean
  placeholder?: string
  width?: FieldWidth
  disabled?: boolean
  readonly?: boolean
  type?: 'text' | 'email' | 'url' | 'search' | 'password' | 'tel'
  inputmode?: 'text' | 'email' | 'url' | 'search' | 'tel' | 'numeric' | 'decimal' | 'none'
  nullable?: boolean
  invalid?: string
  name?: string
  autocomplete?: string
  required?: boolean
  field?: string
  model?: ResourceModelField<string>
  modelValue?: string | null
}>(), {
  labelHidden: false,
  info: undefined,
  description: undefined,
  optional: false,
  placeholder: undefined,
  width: 'md',
  disabled: false,
  readonly: false,
  type: 'text',
  inputmode: undefined,
  nullable: false,
  invalid: undefined,
  name: undefined,
  autocomplete: undefined,
  required: false,
  field: undefined,
  model: undefined,
  modelValue: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: string | null | undefined] }>()

const { model, value, state, unbound } = useFieldModel<string>(props, emit)
const id = useId()
const invalidId = useId()
const onSurface = !!inject(formSurfaceKey, undefined)

const vKeepPrefilledValue: Directive<HTMLInputElement> = {
  created(el) {
    if (!props.field && !props.model && props.autocomplete !== 'off' && el.value && el.value !== (value.value ?? '')) {
      value.value = el.value
    }
  },
}

function onInput(event: Event) {
  const text = (event.target as HTMLInputElement).value
  value.value = props.nullable && text === '' ? null : text
}
</script>

<template>
  <Field
    :label="label"
    :label-hidden="labelHidden"
    :info="info"
    :description="description"
    :optional="optional"
    :width="width"
    :state="state"
    :model="model"
    :control-id="id"
    :name="field"
    :invalid="invalid"
  >
    <template #default="{ describedBy, tone, busy }">
      <div
        :class="[fieldBox, readonly ? 'cwa:bg-transparent' : fieldFill(tone, disabled || unbound), { 'cwa:opacity-50 cwa:cursor-not-allowed': disabled || unbound }]"
        v-bind="model?.focusListeners"
      >
        <slot name="prefix" />
        <input
          :id="id"
          v-keep-prefilled-value
          :type="type"
          :name="name"
          :autocomplete="autocomplete"
          :required="required"
          :inputmode="inputmode"
          :value="value ?? ''"
          :placeholder="placeholder"
          :disabled="disabled || unbound"
          :readonly="readonly"
          :aria-describedby="[describedBy, invalid && !onSurface ? invalidId : undefined].filter(Boolean).join(' ') || undefined"
          :aria-invalid="tone === 'danger' || invalid ? 'true' : undefined"
          :aria-busy="busy ? 'true' : undefined"
          class="cwa:h-full cwa:min-w-0 cwa:flex-1 cwa:appearance-none cwa:border-0 cwa:bg-transparent cwa:px-3 cwa:text-control cwa:text-inherit cwa:outline-none cwa:placeholder:text-muted-on-field cwa:focus:ring-0 cwa:disabled:cursor-not-allowed cwa:pointer-coarse:text-base"
          @input="onInput"
        >
        <slot name="suffix" />
      </div>
    </template>
    <template #after>
      <span
        v-if="invalid && !onSurface"
        :id="invalidId"
        data-testid="input-invalid"
        class="cwa:inline-flex cwa:items-center cwa:gap-1.5 cwa:whitespace-nowrap cwa:text-control cwa:text-danger-fg"
      >
        <StateGlyph kind="error" />
        {{ invalid }}
      </span>
    </template>
  </Field>
</template>
