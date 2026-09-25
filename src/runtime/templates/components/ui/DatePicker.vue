<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { consola as logger } from 'consola'
import type { DateValue } from '@internationalized/date'
import { CalendarDateTime, toCalendarDate } from '@internationalized/date'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { isZonedDateTime } from 'reka-ui/date'
import { dateTimeZoneLabel, earliestSelectable, fromLocalDateTime, toLocalDateTime } from '#cwa/resources/date-time-input'
import Calendar from './Calendar.vue'
import InputDate from './InputDate.vue'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  min?: string
  label?: string
  minuteStep?: number
  locale?: string
  disabled?: boolean
}>(), {
  minuteStep: 5,
  locale: 'en-GB',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const labelId = useId()

const localValue = computed(() => toLocalDateTime(props.modelValue))
const timeZone = computed(() => dateTimeZoneLabel(props.modelValue))

let duplicateChecked = false
watch(localValue, (value) => {
  if (!value || duplicateChecked) {
    return
  }
  duplicateChecked = true
  if (!isZonedDateTime(value)) {
    logger.warn('[CWA] Two copies of @internationalized/date are installed, so reka-ui cannot read the date picker value and its time is not shown. Run `pnpm dedupe` (or your package manager\'s equivalent) to keep one copy.')
  }
}, { immediate: true })
const earliest = computed(() => props.min ? earliestSelectable(props.min, props.minuteStep) : undefined)
const localMin = computed(() => toLocalDateTime(earliest.value))
const calendarValue = computed(() => localValue.value ? toCalendarDate(localValue.value) : undefined)
const calendarMin = computed(() => localMin.value ? toCalendarDate(localMin.value) : undefined)

function commit(value: string | null) {
  if (!value) {
    return
  }
  const next = earliest.value && new Date(value).getTime() < new Date(earliest.value).getTime() ? earliest.value : value
  if (next !== props.modelValue) {
    emit('update:modelValue', next)
  }
}

function onFieldUpdate(value?: DateValue) {
  commit(fromLocalDateTime(value))
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
  <div class="cwa:flex cwa:flex-col cwa:gap-y-1">
    <span
      v-if="label"
      :id="labelId"
      data-date-picker-label
      class="cwa:text-sm cwa:text-stone-400"
    >{{ label }}</span>
    <InputDate
      :aria-labelledby="label ? labelId : undefined"
      :model-value="localValue"
      granularity="minute"
      :hour-cycle="24"
      :step="{ minute: minuteStep }"
      :min-value="localMin"
      :locale="locale"
      :disabled="disabled"
      @update:model-value="onFieldUpdate"
    >
      <PopoverRoot v-model:open="open">
        <PopoverTrigger
          data-date-picker-trigger
          aria-label="Choose a date"
          :disabled="disabled"
          class="cwa:flex cwa:items-center cwa:justify-center cwa:size-7 cwa:rounded-md cwa:text-stone-400 cwa:hover:bg-stone-700 cwa:hover:text-light cwa:focus-visible:outline-2 cwa:focus-visible:outline-stone-400 cwa:cursor-pointer"
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
            :side-offset="8"
            class="cwa:z-context cwa:p-3 cwa:rounded-lg cwa:dark-blur cwa:outline-dotted cwa:outline-1 cwa:outline-stone-400 cwa:shadow-lg"
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
    <p
      data-time-zone
      class="cwa:text-xs cwa:text-stone-300"
    >
      Times are in {{ timeZone }}.
    </p>
  </div>
</template>
