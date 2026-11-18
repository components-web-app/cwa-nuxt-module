<script setup lang="ts">
import { POPOVER_GAP } from '../core/ui/popover-gap'
import { computed, ref, useId, watch } from 'vue'
import { consola as logger } from 'consola'
import type { DateValue } from '@internationalized/date'
import { CalendarDateTime, toCalendarDate } from '@internationalized/date'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { isZonedDateTime } from 'reka-ui/date'
import { dateTimeZoneLabel, earliestSelectable, formatDateTime, fromLocalDateTime, toLocalDateTime } from '#cwa/resources/date-time-input'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import Field from '../core/ui/Field.vue'
import type { FieldWidth } from '../core/ui/Field.vue'
import { useFieldModel } from '../core/ui/field-context'
import { fieldBox, fieldFill } from '../core/ui/field-looks'
import Calendar from './Calendar.vue'
import InputDate from './InputDate.vue'

const props = withDefaults(defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  description?: string
  width?: FieldWidth
  min?: string
  minuteStep?: number
  locale?: string
  disabled?: boolean
  disabledReason?: string
  field?: string
  model?: ResourceModelField<string>
  modelValue?: string | null
}>(), {
  labelHidden: false,
  info: undefined,
  description: undefined,
  width: 'md',
  min: undefined,
  minuteStep: 5,
  locale: 'en-GB',
  disabled: false,
  disabledReason: undefined,
  field: undefined,
  model: undefined,
  modelValue: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null | undefined]
}>()

const { model, value, state, unbound } = useFieldModel<string>(props, emit)
const id = useId()
const inactive = computed(() => props.disabled || unbound)

const open = ref(false)

const localValue = computed(() => toLocalDateTime(value.value))
const timeZone = computed(() => dateTimeZoneLabel(value.value))

let duplicateChecked = false
watch(localValue, (local) => {
  if (!local || duplicateChecked) {
    return
  }
  duplicateChecked = true
  if (!isZonedDateTime(local)) {
    logger.warn('[CWA] Two copies of @internationalized/date are installed, so reka-ui cannot read the date picker value and its time is not shown. Run `pnpm dedupe` (or your package manager\'s equivalent) to keep one copy.')
  }
}, { immediate: true })
const earliest = computed(() => props.min ? earliestSelectable(props.min, props.minuteStep) : undefined)
const localMin = computed(() => toLocalDateTime(earliest.value))
const calendarValue = computed(() => localValue.value ? toCalendarDate(localValue.value) : undefined)
const calendarMin = computed(() => localMin.value ? toCalendarDate(localMin.value) : undefined)

function commit(chosen: string | null) {
  if (!chosen) {
    return
  }
  const next = earliest.value && new Date(chosen).getTime() < new Date(earliest.value).getTime() ? earliest.value : chosen
  if (next !== value.value) {
    value.value = next
  }
}

function onFieldUpdate(local?: DateValue) {
  commit(fromLocalDateTime(local))
}

function onCalendarUpdate(date?: DateValue) {
  if (!date) {
    return
  }
  const current = localValue.value
  const picked = current
    ? current.set({ year: date.year, month: date.month, day: date.day })
    : new CalendarDateTime(date.year, date.month, date.day, 9, 0)
  commit(fromLocalDateTime(picked))
  open.value = false
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
    :format="value => typeof value === 'string' ? formatDateTime(value) : ''"
  >
    <template #default="{ describedBy, tone, busy, labelId }">
      <InputDate
        :id="id"
        :aria-labelledby="labelId"
        :aria-describedby="describedBy"
        :aria-invalid="tone === 'danger' ? 'true' : undefined"
        :aria-busy="busy ? 'true' : undefined"
        :model-value="localValue"
        granularity="minute"
        :hour-cycle="24"
        :step="{ minute: minuteStep }"
        :min-value="localMin"
        :locale="locale"
        :disabled="inactive"
        :class="[fieldBox, fieldFill(tone, inactive), 'cwa:pl-3']"
        @update:model-value="onFieldUpdate"
      >
        <PopoverRoot v-model:open="open">
          <PopoverTrigger
            data-date-picker-trigger
            aria-label="Choose a date"
            :title="`Times are in ${timeZone}`"
            :disabled="inactive"
            class="cwa:flex cwa:h-control cwa:w-9 cwa:cursor-pointer cwa:items-center cwa:justify-center cwa:text-fg-muted cwa:hover:bg-step-hover cwa:hover:text-fg cwa:aria-expanded:bg-step-hover cwa:aria-expanded:text-fg cwa:aria-expanded:shadow-[inset_0_-2px_0_currentColor] cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:disabled:cursor-not-allowed cwa:pointer-coarse:h-hit"
          >
            <svg
              class="cwa:size-4"
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
              align="end"
              :side-offset="POPOVER_GAP"
              :collision-padding="8"
              role="dialog"
              :aria-label="`${label}: choose a date`"
              class="cwa:z-context cwa:bg-surface-menu cwa:p-3 cwa:text-fg cwa:shadow-popover cwa:outline-none"
            >
              <Calendar
                :model-value="calendarValue"
                :min-value="calendarMin"
                :locale="locale"
                initial-focus
                @update:model-value="onCalendarUpdate"
              />
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
      </InputDate>
    </template>
  </Field>
</template>
