<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import Field from '../core/ui/Field.vue'
import type { FieldWidth } from '../core/ui/Field.vue'
import StateGlyph from '../core/ui/StateGlyph.vue'
import { useAnnounce, useFieldModel } from '../core/ui/field-context'
import { fieldBox, fieldDisabled, fieldFill } from '../core/ui/field-looks'
import type { FieldTone } from '../core/ui/field-looks'
import type { ResourceModelField } from '#cwa/resources/model-editors'

const props = withDefaults(defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  description?: string
  width?: FieldWidth
  disabled?: boolean
  disabledReason?: string
  min?: number
  max?: number
  step?: number
  noun?: string
  minReason?: string
  maxReason?: string
  decrementLabel?: string
  incrementLabel?: string
  field?: string
  model?: ResourceModelField<number>
  modelValue?: number | null
}>(), {
  labelHidden: false,
  info: undefined,
  description: undefined,
  width: 'sm',
  disabled: false,
  disabledReason: undefined,
  min: Number.NEGATIVE_INFINITY,
  max: Number.POSITIVE_INFINITY,
  step: 1,
  noun: 'value',
  minReason: undefined,
  maxReason: undefined,
  decrementLabel: 'Decrease',
  incrementLabel: 'Increase',
  field: undefined,
  model: undefined,
  modelValue: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: number | null | undefined] }>()

const { model, value, state, unbound } = useFieldModel<number>(props, emit)
const announce = useAnnounce()
const id = useId()
const reasonId = useId()
const rangeId = useId()

const text = ref(value.value === null || value.value === undefined ? '' : String(value.value))
const editing = ref(false)

watch(value, (next) => {
  if (!editing.value) {
    text.value = next === null || next === undefined ? '' : String(next)
  }
})

const typed = computed(() => text.value === '' || text.value === '-' ? undefined : Number(text.value))
const outOfRange = computed(() => typed.value !== undefined && (typed.value < props.min || typed.value > props.max))
const atMin = computed(() => typed.value !== undefined && typed.value <= props.min)
const atMax = computed(() => typed.value !== undefined && typed.value >= props.max)
const inactive = computed(() => props.disabled || unbound)
const bounded = computed(() => Number.isFinite(props.min) && Number.isFinite(props.max))
const rangeText = computed(() => bounded.value ? `Between ${props.min} and ${props.max}` : Number.isFinite(props.min) ? `${props.min} or more` : `${props.max} or less`)

function clamp(n: number) {
  return Math.min(props.max, Math.max(props.min, n))
}

function commit(n: number) {
  text.value = String(n)
  if (n !== value.value) {
    value.value = n
  }
}

function settle() {
  if (typed.value === undefined) {
    text.value = value.value === null || value.value === undefined ? '' : String(value.value)
    return
  }
  if (outOfRange.value) {
    const highest = typed.value > props.max
    const snapped = highest ? props.max : props.min
    commit(snapped)
    announce(`Set to ${snapped}, the ${highest ? 'highest' : 'lowest'} ${props.noun}`)
    return
  }
  commit(typed.value)
}

function stepBy(delta: number) {
  if (inactive.value) {
    return
  }
  const from = typed.value ?? (Number.isFinite(props.min) ? props.min : 0)
  commit(clamp(from + delta))
}

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const allowMinus = props.min < 0
  const cleaned = input.value.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '').replace(/^-/, allowMinus ? '-' : '')
  if (cleaned !== input.value) {
    input.value = cleaned
  }
  editing.value = true
  text.value = cleaned
}

function onKeydown(event: KeyboardEvent) {
  const moves: Record<string, () => void> = {
    ArrowUp: () => stepBy(props.step),
    ArrowDown: () => stepBy(-props.step),
    PageUp: () => stepBy(props.step * 5),
    PageDown: () => stepBy(-props.step * 5),
    Home: () => Number.isFinite(props.min) && commit(props.min),
    End: () => Number.isFinite(props.max) && commit(props.max),
    Enter: () => {
      editing.value = false
      settle()
    },
  }
  const move = moves[event.key]
  if (move) {
    event.preventDefault()
    move()
  }
}

function onBlur() {
  editing.value = false
  settle()
}

function press(delta: number, blocked: boolean) {
  if (!blocked) {
    editing.value = false
    stepBy(delta)
  }
}

onBeforeUnmount(() => {
  if (editing.value && typed.value !== undefined) {
    settle()
  }
})

const stepButton = 'cwa:grid cwa:h-full cwa:w-control cwa:shrink-0 cwa:place-items-center cwa:text-base cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:pointer-coarse:w-hit'

function stepLook(blocked: boolean) {
  return inactive.value ? fieldDisabled : blocked ? 'cwa:text-fg/40 cwa:cursor-not-allowed' : 'cwa:cursor-pointer cwa:hover:bg-step-hover cwa:active:bg-step-press'
}

const holdFill: Record<'none' | 'danger' | 'warning', string> = {
  none: 'cwa:has-[[data-step]:hover]:bg-field',
  danger: 'cwa:has-[[data-step]:hover]:bg-field-danger',
  warning: 'cwa:has-[[data-step]:hover]:bg-field-warning',
}

function toneOf(tone: FieldTone) {
  return outOfRange.value ? 'danger' : tone
}
</script>

<template>
  <Field
    :disabled-reason="disabled ? disabledReason : undefined"
    :label="label"
    :label-hidden="labelHidden"
    :info="info"
    :description="description"
    :width="width"
    :state="state"
    :model="model"
    :control-id="id"
    :inactive="inactive"
    :name="field"
  >
    <template #default="{ describedBy, tone, busy }">
      <div
        :class="[fieldBox, fieldFill(toneOf(tone), inactive), holdFill[toneOf(tone) ?? 'none'], { [fieldDisabled]: inactive }]"
      >
        <button
          type="button"
          data-step="down"
          :aria-label="decrementLabel"
          :aria-disabled="atMin || inactive ? 'true' : undefined"
          :aria-describedby="[describedBy, atMin && minReason ? `${reasonId}-min` : undefined].filter(Boolean).join(' ') || undefined"
          :title="atMin ? minReason : undefined"
          :class="[stepButton, stepLook(atMin)]"
          @click="press(-step, atMin)"
        >
          −
        </button>
        <input
          :id="id"
          type="text"
          inputmode="numeric"
          role="spinbutton"
          :value="text"
          :disabled="inactive"
          :aria-valuemin="Number.isFinite(min) ? min : undefined"
          :aria-valuemax="Number.isFinite(max) ? max : undefined"
          :aria-valuenow="typed"
          :aria-valuetext="typed !== undefined && Number.isFinite(max) ? `${typed} of ${max}` : undefined"
          :aria-invalid="toneOf(tone) === 'danger' ? 'true' : undefined"
          :aria-describedby="[describedBy, outOfRange ? rangeId : undefined].filter(Boolean).join(' ') || undefined"
          :aria-busy="busy ? 'true' : undefined"
          class="cwa:h-full cwa:w-0 cwa:min-w-0 cwa:flex-1 cwa:appearance-none cwa:border-0 cwa:bg-transparent cwa:p-0 cwa:text-center cwa:text-control cwa:tabular-nums cwa:text-inherit cwa:outline-none cwa:focus:ring-0 cwa:disabled:cursor-not-allowed cwa:pointer-coarse:text-base"
          @input="onInput"
          @keydown="onKeydown"
          @blur="onBlur"
        >
        <button
          type="button"
          data-step="up"
          :aria-label="incrementLabel"
          :aria-disabled="atMax || inactive ? 'true' : undefined"
          :aria-describedby="[describedBy, atMax && maxReason ? `${reasonId}-max` : undefined].filter(Boolean).join(' ') || undefined"
          :title="atMax ? maxReason : undefined"
          :class="[stepButton, stepLook(atMax)]"
          @click="press(step, atMax)"
        >
          +
        </button>
        <span
          v-if="minReason"
          :id="`${reasonId}-min`"
          class="cwa:sr-only"
        >{{ minReason }}</span>
        <span
          v-if="maxReason"
          :id="`${reasonId}-max`"
          class="cwa:sr-only"
        >{{ maxReason }}</span>
      </div>
    </template>
    <template #after>
      <span
        v-if="outOfRange"
        :id="rangeId"
        data-testid="number-range"
        class="cwa:inline-flex cwa:items-center cwa:gap-1.5 cwa:whitespace-nowrap cwa:text-control cwa:text-danger-fg"
      >
        <StateGlyph kind="error" />
        {{ rangeText }}
      </span>
    </template>
  </Field>
</template>
