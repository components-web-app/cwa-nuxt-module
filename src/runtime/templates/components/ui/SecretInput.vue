<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import Field from '../core/ui/Field.vue'
import type { FieldWidth } from '../core/ui/Field.vue'
import { useFieldModel } from '../core/ui/field-context'
import { fieldBox, fieldDisabled, fieldFill, placeholderLook } from '../core/ui/field-looks'
import CwaUiBadge from './Badge.vue'
import CwaUiButton from './Button.vue'
import RevealButton from '../core/ui/RevealButton.vue'
import type { ResourceModelField } from '#cwa/resources/model-editors'

type SecretValue = string | { set: boolean } | null

const props = withDefaults(defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  description?: string
  optional?: boolean
  required?: boolean
  placeholder?: string
  width?: FieldWidth
  disabled?: boolean
  disabledReason?: string
  field?: string
  model?: ResourceModelField<SecretValue>
  modelValue?: SecretValue
}>(), {
  labelHidden: false,
  info: undefined,
  description: undefined,
  optional: false,
  required: false,
  placeholder: undefined,
  width: 'md',
  disabled: false,
  disabledReason: undefined,
  field: undefined,
  model: undefined,
  modelValue: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: SecretValue | undefined] }>()

const { model, value, state, unbound } = useFieldModel<SecretValue>(props, emit)
const id = useId()
const input = useTemplateRef<HTMLInputElement>('input')

const inactive = computed(() => props.disabled || unbound)

function isSet(stored: unknown) {
  return typeof stored === 'object' && stored !== null && (stored as { set?: unknown }).set === true
}

const original = ref<{ value: SecretValue | undefined }>()
const replacing = ref(false)
const revealed = ref(false)
let written: { value: SecretValue | undefined } | undefined

watch(() => value.value, (now) => {
  if (written && written.value === now) {
    written = undefined
    return
  }
  written = undefined
  original.value = undefined
  replacing.value = false
  revealed.value = false
})

function write(next: SecretValue | undefined) {
  original.value ??= { value: value.value }
  written = { value: next }
  value.value = next
}

const mode = computed(() => {
  if (typeof value.value === 'string') {
    return 'input'
  }
  if (value.value === null && original.value && isSet(original.value.value)) {
    return 'removed'
  }
  return !replacing.value && isSet(value.value) ? 'set' : 'input'
})

const canKeep = computed(() => !!original.value && isSet(original.value.value) && (mode.value === 'removed' || replacing.value || typeof value.value === 'string'))

function format(shown: unknown) {
  if (typeof shown === 'string') {
    return 'New value'
  }
  return isSet(shown) ? 'Set' : 'Not set'
}

async function replace() {
  original.value ??= { value: value.value }
  replacing.value = true
  await nextTick()
  input.value?.focus()
}

function remove() {
  write(null)
}

function keep() {
  replacing.value = false
  write(original.value?.value)
}

function onInput(event: Event) {
  const text = (event.target as HTMLInputElement).value
  if (text) {
    write(text)
    return
  }
  replacing.value = isSet(original.value?.value)
  write(original.value ? original.value.value : value.value)
}
</script>

<template>
  <Field
    :disabled-reason="disabled ? disabledReason : undefined"
    :label="label"
    :label-hidden="labelHidden"
    :info="info"
    :description="description"
    :optional="optional"
    :width="mode === 'input' ? width : undefined"
    :state="state"
    :model="model"
    :control-id="id"
    :inactive="inactive"
    :name="field"
    :format="format"
  >
    <template #default="{ describedBy, tone, busy }">
      <div
        v-if="mode === 'input'"
        :class="[fieldBox, fieldFill(tone, inactive), { [fieldDisabled]: inactive }]"
      >
        <input
          :id="id"
          ref="input"
          :type="revealed ? 'text' : 'password'"
          autocomplete="new-password"
          :value="typeof value === 'string' ? value : ''"
          :placeholder="placeholder"
          :disabled="inactive"
          :aria-describedby="describedBy"
          :aria-invalid="tone === 'danger' ? 'true' : undefined"
          :aria-busy="busy ? 'true' : undefined"
          class="cwa:h-full cwa:min-w-0 cwa:flex-1 cwa:appearance-none cwa:border-0 cwa:bg-transparent cwa:px-3 cwa:text-control cwa:text-inherit cwa:outline-none cwa:focus:ring-0 cwa:disabled:cursor-not-allowed cwa:pointer-coarse:text-base"
          :class="placeholderLook(inactive)"
          @input="onInput"
        >
        <RevealButton
          v-model="revealed"
          data-testid="secret-reveal"
          noun="value"
          :controls="id"
          :disabled="inactive"
        />
      </div>
      <output
        v-else
        :id="id"
        data-testid="secret-status"
        :aria-describedby="describedBy"
        class="cwa:flex cwa:h-control cwa:items-center cwa:pointer-coarse:h-hit"
      >
        <CwaUiBadge
          :tone="mode === 'removed' ? 'warning' : 'success'"
          dot
        >{{ mode === 'removed' ? 'Will be removed' : 'Set' }}</CwaUiBadge>
      </output>
    </template>
    <template #beside>
      <span
        v-if="mode === 'set' || canKeep"
        class="cwa:flex cwa:shrink-0 cwa:items-center cwa:gap-2"
      >
        <template v-if="mode === 'set'">
          <CwaUiButton
            data-testid="secret-replace"
            label="Replace"
            variant="soft"
            :aria-label="`Replace ${label}`"
            :disabled="inactive"
            @click="replace"
          />
          <CwaUiButton
            data-testid="secret-remove"
            label="Remove"
            variant="ghost"
            tone="danger"
            :aria-label="`Remove ${label}`"
            :disabled="inactive || required"
            :disabled-reason="required ? 'Required: replace it instead' : undefined"
            @click="remove"
          />
        </template>
        <CwaUiButton
          v-else
          data-testid="secret-keep"
          label="Keep current"
          variant="ghost"
          :aria-label="`Keep the current ${label}`"
          :disabled="inactive"
          @click="keep"
        />
      </span>
    </template>
  </Field>
</template>
