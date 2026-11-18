<script setup lang="ts">
import { computed, inject, nextTick, onMounted, useId, useTemplateRef, watch } from 'vue'
import { consola } from 'consola'
import Field from '../core/ui/Field.vue'
import { useFieldModel } from '../core/ui/field-context'
import { fieldFill } from '../core/ui/field-looks'
import { formSurfaceKey, managerTabKey } from '../core/ui/field-keys'
import type { ResourceModelField } from '#cwa/resources/model-editors'

const LINE_HEIGHT_REM = 1.25
const PADDING_REM = 1.25

const props = withDefaults(defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  description?: string
  optional?: boolean
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  maxlength?: number
  counter?: boolean
  maxRows?: number
  field?: string
  model?: ResourceModelField<string>
  modelValue?: string | null
}>(), {
  labelHidden: false,
  info: undefined,
  description: undefined,
  optional: false,
  placeholder: undefined,
  disabled: false,
  readonly: false,
  maxlength: undefined,
  counter: false,
  maxRows: 8,
  field: undefined,
  model: undefined,
  modelValue: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: string | null | undefined] }>()

const inBar = !!inject(managerTabKey, undefined) && !inject(formSurfaceKey, undefined)
if (inBar && import.meta.env.DEV) {
  consola.error('CwaUiTextarea is for modals and pages; the manager bar is one row, so edit long text on the page instead.')
}

const { model, value, state, unbound } = useFieldModel<string>(props, emit)
const id = useId()
const counterId = useId()
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')

const length = computed(() => (value.value ?? '').length)
const maxHeight = computed(() => `${props.maxRows * LINE_HEIGHT_REM + PADDING_REM}rem`)
const minHeight = `${3 * LINE_HEIGHT_REM + PADDING_REM}rem`

function fitsContentNatively() {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content')
}

function fit() {
  const element = textarea.value
  if (!element || fitsContentNatively()) {
    return
  }
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

function onInput(event: Event) {
  value.value = (event.target as HTMLTextAreaElement).value
  fit()
}

watch(value, () => nextTick(fit))
onMounted(fit)
</script>

<template>
  <Field
    v-if="!inBar"
    :label="label"
    :label-hidden="labelHidden"
    :info="info"
    :description="description"
    :optional="optional"
    width="full"
    :state="state"
    :model="model"
    :control-id="id"
    :name="field"
  >
    <template #default="{ describedBy, tone }">
      <textarea
        :id="id"
        ref="textarea"
        :value="value ?? ''"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :disabled="disabled || unbound"
        :readonly="readonly"
        rows="3"
        :aria-describedby="[describedBy, counter ? counterId : undefined].filter(Boolean).join(' ') || undefined"
        :aria-invalid="tone === 'danger' ? 'true' : undefined"
        data-testid="textarea"
        class="cwa:block cwa:w-full cwa:resize-none cwa:appearance-none cwa:border-0 cwa:px-3 cwa:py-2.5 cwa:text-control cwa:leading-5 cwa:text-fg cwa:outline-none cwa:[field-sizing:content] cwa:placeholder:text-muted-on-field cwa:focus:ring-0 cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:pointer-coarse:text-base"
        :class="[readonly ? 'cwa:bg-transparent' : fieldFill(tone, disabled || unbound), { 'cwa:cursor-not-allowed cwa:opacity-50': disabled || unbound }]"
        :style="{ minHeight, maxHeight }"
        v-bind="model?.focusListeners"
        @input="onInput"
      />
    </template>
    <template
      v-if="counter"
      #after
    >
      <p
        :id="counterId"
        data-testid="textarea-counter"
        class="cwa:mt-1 cwa:mb-0 cwa:text-end cwa:text-helper cwa:tabular-nums cwa:text-fg-muted"
      >
        {{ maxlength ? `${length} / ${maxlength}` : length }}
      </p>
    </template>
  </Field>
</template>
