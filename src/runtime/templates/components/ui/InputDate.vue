<!--
  Ported from Nuxt UI's InputDate component (https://github.com/nuxt/ui), MIT License,
  Copyright (c) 2023 NuxtLabs. Restyled with cwa: utilities, without its theme variants.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import type { DateValue } from '@internationalized/date'
import type { DateRange } from 'reka-ui'
import { DateField as SingleDateField, DateRangeField as RangeDateField } from 'reka-ui/namespaced'

type DateStep = Partial<Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>>

const props = withDefaults(defineProps<{
  modelValue?: DateValue | DateRange | null
  range?: boolean
  granularity?: 'day' | 'hour' | 'minute' | 'second'
  hourCycle?: 12 | 24
  step?: DateStep
  minValue?: DateValue
  maxValue?: DateValue
  isDateUnavailable?: (date: DateValue) => boolean
  locale?: string
  hideTimeZone?: boolean
  disabled?: boolean
  readonly?: boolean
  id?: string
  name?: string
}>(), {
  locale: 'en-GB',
  hideTimeZone: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const DateField = computed<Record<string, Component>>(() => props.range ? RangeDateField : SingleDateField)

const rootProps = computed(() => ({
  granularity: props.granularity,
  hourCycle: props.hourCycle,
  step: props.step,
  minValue: props.minValue,
  maxValue: props.maxValue,
  isDateUnavailable: props.isDateUnavailable,
  locale: props.locale,
  hideTimeZone: props.hideTimeZone,
  disabled: props.disabled,
  readonly: props.readonly,
  id: props.id,
  name: props.name,
}))

const segmentClass = 'cwa:px-0.5 cwa:tabular-nums cwa:focus:outline-none cwa:focus:bg-menu-highlight cwa:focus:text-fg cwa:data-placeholder:not-data-disabled:text-muted-on-field cwa:data-[segment=literal]:text-fg-muted cwa:data-[segment=literal]:px-0'
</script>

<template>
  <component
    :is="DateField.Root"
    v-slot="{ segments }"
    v-bind="rootProps"
    :model-value="modelValue ?? undefined"
    class="cwa:relative cwa:flex cwa:items-center cwa:gap-x-0.5 cwa:w-full cwa:data-disabled:text-fg-disabled"
    @update:model-value="(value: any) => emit('update:modelValue', value)"
  >
    <template v-if="Array.isArray(segments)">
      <component
        :is="DateField.Input"
        v-for="(segment, index) in segments"
        :key="`${segment.part}-${index}`"
        :part="segment.part"
        :data-segment="segment.part"
        :class="segmentClass"
      >
        {{ segment.value.trim() }}
      </component>
    </template>
    <template v-else>
      <component
        :is="DateField.Input"
        v-for="(segment, index) in segments.start"
        :key="`start-${segment.part}-${index}`"
        type="start"
        :part="segment.part"
        :data-segment="segment.part"
        :class="segmentClass"
      >
        {{ segment.value.trim() }}
      </component>
      <span class="cwa:px-1 cwa:text-fg-muted">–</span>
      <component
        :is="DateField.Input"
        v-for="(segment, index) in segments.end"
        :key="`end-${segment.part}-${index}`"
        type="end"
        :part="segment.part"
        :data-segment="segment.part"
        :class="segmentClass"
      >
        {{ segment.value.trim() }}
      </component>
    </template>
    <span class="cwa:ml-auto cwa:flex cwa:items-center">
      <slot />
    </span>
  </component>
</template>
