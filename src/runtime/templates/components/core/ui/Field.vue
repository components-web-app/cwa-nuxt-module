<script setup lang="ts">
import { computed, inject, onBeforeUnmount, useId, useTemplateRef, watch } from 'vue'
import FieldStatus from './FieldStatus.vue'
import InfoPopover from './InfoPopover.vue'
import StateGlyph from './StateGlyph.vue'
import ConflictNotice from './ConflictNotice.vue'
import type { FieldValueFormat } from './field-value'
import CwaUiFieldPresence from '../../ui/FieldPresence.vue'
import { fieldGroupKey, formSurfaceKey } from './field-keys'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'

export type FieldWidth = 'xs' | 'sm' | 'md' | 'lg' | 'full'

const { label, labelHidden = false, info, disabledReason, description, optional = false, width, state, model, controlId, ownLabel = false, name, inactive = false, invalid, format, hug = false } = defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  disabledReason?: string
  description?: string
  optional?: boolean
  width?: FieldWidth
  state: CwaFieldState
  model?: ResourceModelField<any>
  controlId: string
  ownLabel?: boolean
  name?: string
  inactive?: boolean
  invalid?: string
  format?: FieldValueFormat
  hug?: boolean
}>()

defineSlots<{
  default: (props: { describedBy: string | undefined, tone: 'danger' | 'warning' | undefined, busy: boolean, labelId: string, modal: boolean, unsaved: boolean, help?: string, helpId?: string }) => any
  lead?: (props: { modal: boolean, unsaved: boolean, help?: string, helpId?: string }) => any
  after?: () => any
  beside?: () => any
}>()

const widths: Record<FieldWidth, string> = {
  xs: 'cwa:w-[4.5rem]',
  sm: 'cwa:w-[9rem]',
  md: 'cwa:w-[13rem]',
  lg: 'cwa:w-[19rem]',
  full: 'cwa:w-full',
}

const box = useTemplateRef<HTMLElement>('box')
const group = inject(fieldGroupKey, undefined)
const undo = computed(() => name ? group?.undo(name) : undefined)
const statusId = useId()
const infoId = useId()
const labelId = useId()

const surface = inject(formSurfaceKey, undefined)
const fieldName = computed(() => name ?? model?.field)
const helperId = useId()

const help = computed(() => [disabledReason, ...(surface ? [info] : [info, description])].filter(Boolean).join(' ') || undefined)

const tone = computed(() => state.status === 'error' || (surface && invalid) ? 'danger' : state.status === 'conflict' ? 'warning' : undefined)

const unsaved = computed(() => !!surface && !!fieldName.value && surface.unsaved(fieldName.value))
const errorText = computed(() => surface ? (state.status === 'error' ? state.error?.message : undefined) ?? invalid : undefined)
const conflict = computed(() => surface && state.status === 'conflict' ? model?.remoteChange.value : undefined)

const describedBy = computed(() => {
  if (surface) {
    return [help.value && infoId, !errorText.value && description && helperId, (errorText.value || conflict.value) && statusId].filter(Boolean).join(' ') || undefined
  }
  return [help.value && infoId, (tone.value || undo.value) && statusId].filter(Boolean).join(' ') || undefined
})

let unregister: (() => void) | undefined
watch(fieldName, (field) => {
  unregister?.()
  unregister = field && surface ? surface.register(field, label) : undefined
}, { immediate: true })
onBeforeUnmount(() => unregister?.())

watch(() => inactive, (now) => {
  now && model?.blur?.()
})
</script>

<template>
  <div
    v-if="surface"
    class="cwa:flex cwa:min-w-0 cwa:flex-col"
    :data-cwa-field="fieldName"
  >
    <div
      v-if="!ownLabel"
      class="cwa:flex cwa:min-h-6 cwa:flex-wrap cwa:items-center cwa:gap-x-2"
      :class="{ 'cwa:sr-only': labelHidden }"
    >
      <label
        :id="labelId"
        :for="controlId"
        class="cwa:text-label cwa:text-fg"
      >{{ label }}</label>
      <span
        v-if="optional"
        class="cwa:text-label cwa:font-normal cwa:text-fg-muted"
      >· Optional</span>
      <InfoPopover
        v-if="help"
        :label="label"
        :text="help"
        :text-id="infoId"
      />
      <span
        v-if="unsaved"
        data-testid="field-unsaved"
        class="cwa:inline-flex cwa:items-center cwa:gap-1.5 cwa:text-helper cwa:font-medium cwa:text-fg-muted"
      ><span
        aria-hidden="true"
        class="cwa:size-2 cwa:rounded-toggle cwa:bg-accent-fg"
      />Unsaved</span>
    </div>
    <div
      class="cwa:w-full cwa:min-w-0"
      :class="{ 'cwa:mt-1.5': !ownLabel && !labelHidden, 'cwa:flex cwa:min-h-hit cwa:items-center cwa:justify-between cwa:gap-3': $slots.lead, 'cwa:flex cwa:items-center cwa:gap-2': $slots.beside && !$slots.lead }"
    >
      <slot
        name="lead"
        :modal="true"
        :unsaved="unsaved"
        :help="ownLabel ? help : undefined"
        :help-id="infoId"
      />
      <CwaUiFieldPresence
        :model="model"
        :class="{ 'cwa:w-fit cwa:max-w-full': hug }"
        v-bind="inactive ? undefined : model?.focusListeners"
      >
        <slot
          :described-by="describedBy"
          :tone="tone"
          :busy="false"
          :label-id="labelId"
          :modal="true"
          :unsaved="unsaved"
          :help="ownLabel ? help : undefined"
          :help-id="infoId"
        />
      </CwaUiFieldPresence>
      <slot name="beside" />
    </div>
    <p
      v-if="errorText"
      :id="statusId"
      data-testid="field-error"
      class="cwa:mt-2 cwa:mb-0 cwa:flex cwa:items-start cwa:gap-1.5 cwa:text-helper cwa:text-danger-fg"
    >
      <StateGlyph
        kind="error"
        class="cwa:mt-0.5"
      />
      <span>{{ errorText }}</span>
    </p>
    <p
      v-else-if="description"
      :id="helperId"
      class="cwa:mt-2 cwa:mb-0 cwa:text-helper cwa:text-fg-muted"
    >
      {{ description }}
    </p>
    <ConflictNotice
      v-if="conflict"
      :id="statusId"
      :change="conflict"
      :mine="model?.model.value"
      :format="format"
    />
    <slot name="after" />
  </div>
  <div
    v-else
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
    <slot
      name="lead"
      :modal="false"
      :unsaved="false"
    />
    <div
      ref="box"
      class="cwa:relative cwa:min-w-0"
      :class="width ? widths[width] : undefined"
    >
      <CwaUiFieldPresence
        :model="model"
        :class="{ 'cwa:w-fit cwa:max-w-full': hug }"
        v-bind="inactive ? undefined : model?.focusListeners"
      >
        <slot
          :described-by="describedBy"
          :tone="tone"
          :busy="state.status === 'saving'"
          :label-id="labelId"
          :modal="false"
          :unsaved="false"
        />
      </CwaUiFieldPresence>
      <FieldStatus
        :state="state"
        :name="label"
        :box="box"
        :model="model"
        :undo="undo"
        :description-id="statusId"
        :format="format"
      />
    </div>
    <slot name="beside" />
    <InfoPopover
      v-if="help && ownLabel"
      :label="label"
      :text="help"
      :text-id="infoId"
    />
    <slot name="after" />
  </div>
</template>
