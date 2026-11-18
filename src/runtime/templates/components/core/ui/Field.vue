<script setup lang="ts">
import { computed, useId, useTemplateRef } from 'vue'
import FieldStatus from './FieldStatus.vue'
import InfoPopover from './InfoPopover.vue'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

export type FieldWidth = 'xs' | 'sm' | 'md' | 'lg' | 'full'

const { label, labelHidden = false, info, description, width, state, model, controlId, ownLabel = false, name } = defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  description?: string
  width?: FieldWidth
  state: CwaFieldState
  model?: ResourceModelField<any>
  controlId: string
  ownLabel?: boolean
  name?: string
}>()

defineSlots<{
  default: (props: { describedBy: string | undefined, tone: 'danger' | 'warning' | undefined, busy: boolean, labelId: string }) => any
  after?: () => any
}>()

const widths: Record<FieldWidth, string> = {
  xs: 'cwa:w-[4.5rem]',
  sm: 'cwa:w-[9rem]',
  md: 'cwa:w-[13rem]',
  lg: 'cwa:w-[19rem]',
  full: 'cwa:w-full',
}

const box = useTemplateRef<HTMLElement>('box')
const statusId = useId()
const infoId = useId()
const labelId = useId()

const help = computed(() => [info, description].filter(Boolean).join(' ') || undefined)

const tone = computed(() => state.status === 'error' ? 'danger' : state.status === 'conflict' ? 'warning' : undefined)

const describedBy = computed(() => [help.value && infoId, tone.value && statusId].filter(Boolean).join(' ') || undefined)
</script>

<template>
  <div
    class="cwa:flex cwa:min-w-0 cwa:shrink-0 cwa:items-center cwa:gap-2"
    :data-cwa-field="name"
  >
    <label
      v-if="!ownLabel"
      :id="labelId"
      :for="controlId"
      class="cwa:whitespace-nowrap cwa:text-label cwa:text-fg-muted"
      :class="{ 'cwa:sr-only': labelHidden }"
    >{{ label }}</label>
    <InfoPopover
      v-if="help && !ownLabel"
      :label="label"
      :text="help"
      :text-id="infoId"
    />
    <div
      ref="box"
      class="cwa:relative cwa:min-w-0"
      :class="width ? widths[width] : undefined"
    >
      <slot
        :described-by="describedBy"
        :tone="tone"
        :busy="state.status === 'saving'"
        :label-id="labelId"
      />
      <FieldStatus
        :state="state"
        :name="label"
        :box="box"
        :model="model"
        :description-id="statusId"
      />
    </div>
    <InfoPopover
      v-if="help && ownLabel"
      :label="label"
      :text="help"
      :text-id="infoId"
    />
    <slot name="after" />
  </div>
</template>
