<script setup lang="ts">
import { ComboboxInput, ComboboxRoot, ListboxContent } from 'reka-ui'
import BottomSheet from './BottomSheet.vue'
import SearchIcon from '../../ui/icon/SearchIcon.vue'
import { fieldBox, fieldFill } from './field-looks'

const { label, placeholder = 'Search', multiple = false, modelValue, panelId, returnTo, testId } = defineProps<{
  label: string
  placeholder?: string
  multiple?: boolean
  modelValue?: string | string[]
  panelId: string
  returnTo?: HTMLElement | null
  testId: string
}>()

const open = defineModel<boolean>('open', { required: true })
const query = defineModel<string>('query', { required: true })

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  'keydown': [event: KeyboardEvent]
}>()

defineSlots<{
  chips?: () => any
  default?: () => any
}>()
</script>

<template>
  <ComboboxRoot
    :open="true"
    :multiple="multiple"
    :model-value="modelValue"
    ignore-filter
    :reset-search-term-on-blur="false"
    :reset-search-term-on-select="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <BottomSheet
      v-model:open="open"
      :label="label"
      close-label="Done"
      search
      :panel-id="panelId"
      :return-to="returnTo"
      :test-id="testId"
    >
      <template #header>
        <div class="cwa:shrink-0 cwa:px-4 cwa:py-3">
          <div :class="[fieldBox, fieldFill(undefined, false), 'cwa:h-hit cwa:gap-2 cwa:px-3']">
            <SearchIcon
              aria-hidden="true"
              class="cwa:size-4 cwa:shrink-0 cwa:text-muted-on-field"
            />
            <ComboboxInput
              :model-value="query"
              :aria-label="`Search ${label}`"
              :aria-controls="`${panelId}-list`"
              :placeholder="placeholder"
              spellcheck="false"
              data-sheet-focus
              :data-testid="`${testId}-input`"
              class="cwa:h-full cwa:min-w-0 cwa:flex-1 cwa:appearance-none cwa:border-0 cwa:bg-transparent cwa:p-0 cwa:text-control cwa:text-inherit cwa:outline-none cwa:placeholder:text-muted-on-field cwa:focus:ring-0 cwa:pointer-coarse:text-base"
              @update:model-value="query = $event"
              @keydown="emit('keydown', $event)"
            />
          </div>
        </div>
        <slot name="chips" />
      </template>
      <ListboxContent
        :id="`${panelId}-list`"
        :aria-label="label"
        class="cwa:py-1 cwa:outline-none"
      >
        <slot />
      </ListboxContent>
    </BottomSheet>
  </ComboboxRoot>
</template>
