<!--
  Ported from Nuxt UI's Calendar component (https://github.com/nuxt/ui), MIT License,
  Copyright (c) 2023 NuxtLabs. Restyled with cwa: utilities, without its theme variants.
-->
<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { Component } from 'vue'
import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone, today } from '@internationalized/date'
import type { DateRange } from 'reka-ui'
import { Calendar as SingleCalendar, MonthPicker, MonthRangePicker, RangeCalendar, YearPicker, YearRangePicker } from 'reka-ui/namespaced'

type CalendarView = 'day' | 'month' | 'year'
type DateMatcher = (date: DateValue) => boolean

const props = withDefaults(defineProps<{
  modelValue?: DateValue | DateValue[] | DateRange | null
  type?: CalendarView
  range?: boolean
  multiple?: boolean
  minValue?: DateValue
  maxValue?: DateValue
  isDateDisabled?: DateMatcher
  isDateUnavailable?: DateMatcher
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  numberOfMonths?: number
  fixedWeeks?: boolean
  locale?: string
  monthControls?: boolean
  yearControls?: boolean
  viewControl?: boolean
  disabled?: boolean
  readonly?: boolean
  initialFocus?: boolean
}>(), {
  type: 'day',
  weekStartsOn: 1,
  fixedWeeks: true,
  locale: 'en-GB',
  monthControls: true,
  yearControls: true,
  viewControl: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const VIEWS: CalendarView[] = ['day', 'month', 'year']
const minView = computed<CalendarView>(() => props.type)
const view = ref<CalendarView>(minView.value)
watch(() => props.type, () => {
  view.value = minView.value
})
const isMinView = computed(() => view.value === minView.value)
const switchable = computed(() => minView.value !== 'year')

function cycleView() {
  const index = VIEWS.indexOf(view.value)
  view.value = index >= VIEWS.length - 1 ? minView.value : VIEWS[index + 1]!
}

function resolveDateValue(value: typeof props.modelValue): DateValue | undefined {
  if (!value) {
    return undefined
  }
  if (Array.isArray(value)) {
    return value[0]
  }
  if ('start' in value || 'end' in value) {
    const range = value as DateRange
    return range.start ?? range.end
  }
  return value as DateValue
}

const placeholder = shallowRef<DateValue>(resolveDateValue(props.modelValue) ?? today(getLocalTimeZone()))
watch(() => props.modelValue, (value) => {
  const resolved = resolveDateValue(value)
  if (resolved) {
    placeholder.value = resolved
  }
})

function onSelect(value: any) {
  if (isMinView.value) {
    emit('update:modelValue', value)
    return
  }
  const resolved = resolveDateValue(value)
  if (resolved) {
    placeholder.value = resolved
  }
  view.value = VIEWS[VIEWS.indexOf(view.value) - 1]!
}

const Picker = computed<Record<string, Component>>(() => {
  const range = props.range && isMinView.value
  if (view.value === 'year') {
    return range ? YearRangePicker : YearPicker
  }
  if (view.value === 'month') {
    return range ? MonthRangePicker : MonthPicker
  }
  return props.range ? RangeCalendar : SingleCalendar
})

const rootProps = computed(() => {
  const shared = {
    minValue: props.minValue,
    maxValue: props.maxValue,
    locale: props.locale,
    disabled: props.disabled,
    readonly: props.readonly,
    initialFocus: props.initialFocus,
  }
  if (view.value !== 'day') {
    return shared
  }
  return {
    ...shared,
    multiple: props.range ? undefined : props.multiple,
    isDateDisabled: props.isDateDisabled,
    isDateUnavailable: props.isDateUnavailable,
    weekStartsOn: props.weekStartsOn,
    numberOfMonths: props.numberOfMonths,
    fixedWeeks: props.fixedWeeks,
  }
})

function paginateYear(date: DateValue, sign: -1 | 1) {
  return sign === -1 ? date.subtract({ years: 1 }) : date.add({ years: 1 })
}

function cellProps(cellDate: DateValue, monthValue: DateValue) {
  if (view.value === 'month') {
    return { month: cellDate }
  }
  if (view.value === 'year') {
    return { year: cellDate }
  }
  return { day: cellDate, month: monthValue }
}

const navButtonClass = 'cwa:flex cwa:items-center cwa:justify-center cwa:size-8 cwa:rounded-md cwa:text-stone-300 cwa:hover:bg-stone-700 cwa:hover:text-light cwa:focus-visible:outline-2 cwa:focus-visible:outline-stone-400 cwa:disabled:opacity-40 cwa:disabled:pointer-events-none cwa:cursor-pointer'
</script>

<template>
  <component
    :is="Picker.Root"
    v-slot="slotProps"
    v-bind="rootProps"
    :model-value="isMinView ? modelValue ?? undefined : undefined"
    :placeholder="placeholder"
    class="cwa:text-light"
    @update:placeholder="(value: DateValue) => placeholder = value"
    @update:model-value="onSelect"
  >
    <component
      :is="Picker.Header"
      class="cwa:flex cwa:items-center cwa:justify-between cwa:gap-x-1"
    >
      <component
        :is="Picker.Prev"
        v-if="view === 'day' && yearControls"
        :prev-page="(date: DateValue) => paginateYear(date, -1)"
        aria-label="Previous year"
        data-previous-year
        :class="navButtonClass"
      >
        <svg
          class="cwa:size-4"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        ><path
          d="M11 6l-4 4 4 4M15 6l-4 4 4 4"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        /></svg>
      </component>
      <component
        :is="Picker.Prev"
        v-if="view !== 'day' || monthControls"
        :aria-label="view === 'day' ? 'Previous month' : 'Previous year'"
        data-previous-month
        :class="navButtonClass"
      >
        <svg
          class="cwa:size-4"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        ><path
          d="M12 6l-4 4 4 4"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        /></svg>
      </component>
      <component
        :is="Picker.Heading"
        v-slot="{ headingValue }"
        class="cwa:flex-1 cwa:min-w-0 cwa:text-center cwa:text-sm cwa:font-medium"
      >
        <button
          v-if="switchable && viewControl"
          type="button"
          data-month-label
          class="cwa:w-full cwa:truncate cwa:rounded-md cwa:px-2 cwa:py-1.5 cwa:hover:bg-stone-700 cwa:focus-visible:outline-2 cwa:focus-visible:outline-stone-400 cwa:cursor-pointer"
          @click="cycleView"
        >
          {{ headingValue }}
        </button>
        <span
          v-else
          data-month-label
          class="cwa:block cwa:truncate cwa:p-1.5"
        >{{ headingValue }}</span>
      </component>
      <component
        :is="Picker.Next"
        v-if="view !== 'day' || monthControls"
        :aria-label="view === 'day' ? 'Next month' : 'Next year'"
        data-next-month
        :class="navButtonClass"
      >
        <svg
          class="cwa:size-4"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        ><path
          d="M8 6l4 4-4 4"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        /></svg>
      </component>
      <component
        :is="Picker.Next"
        v-if="view === 'day' && yearControls"
        :next-page="(date: DateValue) => paginateYear(date, 1)"
        aria-label="Next year"
        data-next-year
        :class="navButtonClass"
      >
        <svg
          class="cwa:size-4"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        ><path
          d="M9 6l4 4-4 4M5 6l4 4-4 4"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        /></svg>
      </component>
    </component>
    <div class="cwa:flex cwa:flex-col cwa:gap-4 cwa:pt-3 cwa:sm:flex-row">
      <component
        :is="Picker.Grid"
        v-for="month in Array.isArray(slotProps.grid) ? slotProps.grid : [slotProps.grid]"
        :key="month.value.toString()"
        class="cwa:w-full cwa:border-collapse cwa:select-none cwa:focus:outline-none"
      >
        <component
          :is="Picker.GridHead"
          v-if="'GridHead' in Picker"
        >
          <component
            :is="Picker.GridRow"
            class="cwa:mb-1 cwa:grid cwa:w-full cwa:grid-cols-7"
          >
            <component
              :is="Picker.HeadCell"
              v-for="day in ('weekDays' in slotProps ? slotProps.weekDays : [])"
              :key="day"
              class="cwa:text-xs cwa:font-normal cwa:text-stone-400"
            >
              {{ day }}
            </component>
          </component>
        </component>
        <component
          :is="Picker.GridBody"
          class="cwa:grid"
        >
          <component
            :is="Picker.GridRow"
            v-for="(row, index) in month.rows"
            :key="`row-${index}`"
            class="cwa:grid cwa:place-items-center"
            :class="view === 'day' ? 'cwa:grid-cols-7' : 'cwa:grid-cols-4'"
          >
            <component
              :is="Picker.Cell"
              v-for="cellDate in row"
              :key="cellDate.toString()"
              :date="cellDate"
              class="cwa:relative cwa:text-center cwa:text-sm"
            >
              <component
                :is="Picker.CellTrigger"
                v-slot="cell"
                v-bind="cellProps(cellDate, month.value)"
                :data-date="cellDate.toString()"
                class="cwa:m-0.5 cwa:flex cwa:items-center cwa:justify-center cwa:whitespace-nowrap cwa:rounded-md cwa:cursor-pointer cwa:transition cwa:hover:bg-stone-700 cwa:focus-visible:outline-2 cwa:focus-visible:outline-stone-400 cwa:data-today:font-semibold cwa:data-today:underline cwa:data-today:underline-offset-4 cwa:data-outside-view:text-stone-500 cwa:data-disabled:text-stone-600 cwa:data-disabled:pointer-events-none cwa:data-unavailable:line-through cwa:data-unavailable:text-stone-600 cwa:data-unavailable:pointer-events-none cwa:data-selected:bg-light cwa:data-selected:text-dark cwa:data-selected:hover:bg-light"
                :class="view === 'day' ? 'cwa:size-8' : 'cwa:h-8 cwa:px-3'"
              >
                <template v-if="view === 'day'">
                  {{ cellDate.day }}
                </template>
                <template v-else-if="view === 'month'">
                  {{ 'monthValue' in cell ? cell.monthValue : '' }}
                </template>
                <template v-else>
                  {{ 'yearValue' in cell ? cell.yearValue : '' }}
                </template>
              </component>
            </component>
          </component>
        </component>
      </component>
    </div>
  </component>
</template>
