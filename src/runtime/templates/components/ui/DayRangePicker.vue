<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { DateValue } from '@internationalized/date'
import { parseDate } from '@internationalized/date'
import type { DateRange } from 'reka-ui'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import Field from '../core/ui/Field.vue'
import type { FieldWidth } from '../core/ui/Field.vue'
import { useFieldModel } from '../core/ui/field-context'
import { fieldBox, fieldFill } from '../core/ui/field-looks'
import Calendar from './Calendar.vue'
import CwaUiButton from './Button.vue'

type DayRange = [string, string]

const props = withDefaults(defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  description?: string
  width?: FieldWidth
  min?: string
  max?: string
  locale?: string
  disabled?: boolean
  field?: string
  model?: ResourceModelField<DayRange>
  modelValue?: DayRange | null
}>(), {
  labelHidden: false,
  info: undefined,
  description: undefined,
  width: 'md',
  min: undefined,
  max: undefined,
  locale: 'en-GB',
  disabled: false,
  field: undefined,
  model: undefined,
  modelValue: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: DayRange | null | undefined]
}>()

const { model, value, state, unbound } = useFieldModel<DayRange>(props, emit)
const id = useId()
const inactive = computed(() => props.disabled || unbound)
const open = ref(false)

function toDate(day?: string) {
  if (!day) {
    return undefined
  }
  try {
    return parseDate(day)
  }
  catch {
    return undefined
  }
}

const range = computed<DateRange | undefined>(() => {
  const [start, end] = value.value ?? []
  const from = toDate(start)
  const to = toDate(end)
  return from && to ? { start: from, end: to } : undefined
})

const format = computed(() => new Intl.DateTimeFormat(props.locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }))

function shown(date: DateValue) {
  return format.value.format(new Date(Date.UTC(date.year, date.month - 1, date.day)))
}

const text = computed(() => range.value ? `${shown(range.value.start!)} – ${shown(range.value.end!)}` : 'Any dates')

function onCalendarUpdate(picked?: DateRange) {
  if (!picked?.start || !picked.end) {
    return
  }
  value.value = [picked.start.toString(), picked.end.toString()]
  open.value = false
}

function clear() {
  value.value = null
}
</script>

<template>
  <Field
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
    <template #default="{ describedBy, tone, busy, labelId }">
      <span class="cwa:flex cwa:min-w-0 cwa:items-center cwa:gap-2">
        <PopoverRoot v-model:open="open">
          <PopoverTrigger
            :id="id"
            :aria-labelledby="labelId"
            :aria-describedby="describedBy"
            :aria-invalid="tone === 'danger' ? 'true' : undefined"
            :aria-busy="busy ? 'true' : undefined"
            :disabled="inactive"
            data-testid="day-range-trigger"
            :class="[fieldBox, fieldFill(tone, inactive), 'cwa:cursor-pointer cwa:gap-2 cwa:px-3 cwa:text-left cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:disabled:cursor-not-allowed']"
          >
            <span
              class="cwa:min-w-0 cwa:flex-1 cwa:truncate"
              :class="range ? 'cwa:text-fg' : 'cwa:text-fg-muted'"
            >{{ text }}</span>
            <svg
              class="cwa:size-4 cwa:shrink-0 cwa:text-fg-muted"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <rect
                x="3.5"
                y="4.5"
                width="13"
                height="12"
                rx="1.5"
                stroke-width="1.5"
              />
              <path
                d="M3.5 8.5h13M7 3v3M13 3v3"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent
              align="start"
              :side-offset="8"
              :collision-padding="8"
              role="dialog"
              :aria-label="`${label}: choose days`"
              data-testid="day-range-popover"
              class="cwa:z-context cwa:bg-surface-menu cwa:p-3 cwa:text-fg cwa:shadow-popover cwa:outline-1 cwa:outline-transparent"
            >
              <Calendar
                range
                :model-value="range"
                :min-value="toDate(min)"
                :max-value="toDate(max)"
                :locale="locale"
                initial-focus
                @update:model-value="onCalendarUpdate"
              />
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <CwaUiButton
          v-if="range && !inactive"
          label="Clear"
          size="sm"
          variant="ghost"
          data-testid="day-range-clear"
          @click="clear"
        />
      </span>
    </template>
  </Field>
</template>
