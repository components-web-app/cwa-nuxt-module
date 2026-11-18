<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectLabel,
  SelectPortal,
  SelectRoot,
  SelectSeparator,
  SelectTrigger,
  SelectViewport,
} from 'reka-ui'
import Field from '../core/ui/Field.vue'
import type { FieldWidth } from '../core/ui/Field.vue'
import ChevronGlyph from '../core/ui/ChevronGlyph.vue'
import CheckGlyph from '../core/ui/CheckGlyph.vue'
import { useFieldModel } from '../core/ui/field-context'
import { fieldBox, fieldFill, groupHeading, menuPanel, optionLook } from '../core/ui/field-looks'
import { menuGroups } from '../core/ui/menu-entries'
import type { MenuEntry, MenuItem } from '../core/ui/menu-entries'
import type { ResourceModelField } from '#cwa/resources/model-editors'

const NONE = '__cwa-none__'

const props = withDefaults(defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  description?: string
  placeholder?: string
  width?: FieldWidth
  disabled?: boolean
  options: MenuEntry[]
  nullable?: boolean
  noneLabel?: string
  field?: string
  model?: ResourceModelField<string>
  modelValue?: string | null
}>(), {
  labelHidden: false,
  info: undefined,
  description: undefined,
  placeholder: 'Choose…',
  width: 'md',
  disabled: false,
  nullable: false,
  noneLabel: 'None',
  field: undefined,
  model: undefined,
  modelValue: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: string | null | undefined] }>()

const { model, value, state, unbound } = useFieldModel<string>(props, emit)
const id = useId()
const open = ref(false)

const groups = computed(() => menuGroups(props.options))
const items = computed(() => groups.value.flatMap(group => group.items))
const chosen = computed<MenuItem | undefined>(() => items.value.find(item => item.value === value.value))
const shown = computed(() => {
  if (chosen.value) {
    return chosen.value.label
  }
  return props.nullable && (value.value === null || value.value === undefined) ? props.noneLabel : undefined
})

const selected = computed(() => value.value === null || value.value === undefined ? (props.nullable ? NONE : undefined) : value.value)

function choose(next: unknown) {
  const picked = next === NONE ? null : next as string
  if (picked !== value.value) {
    value.value = picked
  }
}

const inactive = computed(() => props.disabled || unbound)
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
    :name="field"
  >
    <template #default="{ describedBy, tone, busy }">
      <SelectRoot
        v-model:open="open"
        :model-value="selected"
        :disabled="inactive"
        @update:model-value="choose"
      >
        <SelectTrigger
          :id="id"
          :aria-describedby="describedBy"
          :aria-invalid="tone === 'danger' ? 'true' : undefined"
          :aria-busy="busy ? 'true' : undefined"
          data-testid="select-trigger"
          :class="[fieldBox, fieldFill(tone, inactive), 'cwa:cursor-pointer cwa:gap-2 cwa:px-3 cwa:text-left cwa:outline-none cwa:data-[state=open]:outline-2 cwa:data-[state=open]:outline-offset-2 cwa:data-[state=open]:outline-accent-fg cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:disabled:cursor-not-allowed', { 'cwa:opacity-50': inactive }]"
          v-bind="model?.focusListeners"
        >
          <span
            class="cwa:min-w-0 cwa:flex-1 cwa:truncate"
            :class="{ 'cwa:text-muted-on-field': !shown }"
          >{{ shown ?? placeholder }}</span>
          <ChevronGlyph />
        </SelectTrigger>
        <SelectPortal>
          <SelectContent
            position="popper"
            side="bottom"
            align="start"
            :side-offset="4"
            :collision-padding="8"
            :class="[menuPanel, 'cwa:min-w-(--reka-select-trigger-width)']"
            data-testid="select-menu"
          >
            <SelectViewport class="cwa:py-1">
              <SelectItem
                v-if="nullable"
                :value="NONE"
                :class="[optionLook, 'cwa:text-fg-muted']"
              >
                <SelectItemText class="cwa:flex-1">
                  {{ noneLabel }}
                </SelectItemText>
                <SelectItemIndicator><CheckGlyph /></SelectItemIndicator>
              </SelectItem>
              <template
                v-for="(group, groupIndex) in groups"
                :key="groupIndex"
              >
                <SelectSeparator
                  v-if="groupIndex > 0 && !group.group"
                  class="cwa:my-1 cwa:h-px cwa:bg-line"
                />
                <SelectGroup>
                  <SelectLabel
                    v-if="group.group"
                    :class="groupHeading"
                  >
                    {{ group.group }}
                  </SelectLabel>
                  <SelectItem
                    v-for="item in group.items"
                    :key="item.value ?? item.label"
                    :value="item.value ?? item.label"
                    :disabled="item.disabled"
                    :class="optionLook"
                  >
                    <span class="cwa:flex cwa:min-w-0 cwa:flex-1 cwa:flex-col">
                      <SelectItemText :class="{ 'cwa:opacity-50': item.disabled }">{{ item.label }}</SelectItemText>
                      <span
                        v-if="item.disabled && item.disabledReason"
                        class="cwa:text-helper cwa:text-fg-muted"
                      >{{ item.disabledReason }}</span>
                      <span
                        v-else-if="item.description"
                        class="cwa:text-helper cwa:text-fg-muted"
                      >{{ item.description }}</span>
                    </span>
                    <SelectItemIndicator><CheckGlyph /></SelectItemIndicator>
                  </SelectItem>
                </SelectGroup>
              </template>
            </SelectViewport>
          </SelectContent>
        </SelectPortal>
      </SelectRoot>
    </template>
  </Field>
</template>
