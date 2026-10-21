<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@headlessui/vue'
import { computed } from 'vue'
import { useCwaSelectInput } from '#cwa/composables/cwa-select-input'
import type { SelectInputProps } from '#cwa/composables/cwa-select-input'
import { fieldFocusListeners } from '#cwa/resources/model-editors'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import RemoteChangeConflict from '#cwa/templates/components/core/admin/form/RemoteChangeConflict.vue'
import FieldPresence from '#cwa/templates/components/core/admin/form/FieldPresence.vue'

const emit = defineEmits(['update:modelValue'])
const props = defineProps<Omit<SelectInputProps, 'modelValue'> & {
  modelValue?: SelectInputProps['modelValue']
  model?: ResourceModelField<SelectInputProps['modelValue']>
}>()
const inputProps = computed<SelectInputProps>(() => ({ ...props, modelValue: props.model ? props.model.model.value : props.modelValue }))
const { value, compareOptions, displayLabel, selectedOptions, trigger, container } = useCwaSelectInput(inputProps, (event, next) => {
  if (props.model) {
    // eslint-disable-next-line vue/no-mutating-props
    props.model.model.value = next
    return
  }
  emit(event, next)
})
const remoteChange = computed(() => props.model?.remoteChange.value)
const focusListeners = fieldFocusListeners(() => props.model)
const focusedBy = computed(() => props.model?.focusedBy?.value ?? [])

const hasSelection = computed(() => selectedOptions.value.length > 0)
</script>

<template>
  <Listbox
    v-model="value"
    :by="compareOptions"
    :multiple="multiple"
  >
    <div
      class="cwa:relative cwa:group/field cwa:inline-flex cwa:w-full cwa:items-center cwa:gap-x-3"
      v-on="focusListeners"
    >
      <FieldPresence
        v-if="focusedBy.length"
        :peers="focusedBy"
      />
      <ListboxButton
        ref="trigger"
        class="cwa:relative cwa:py-2 cwa:pl-4 cwa:pr-10 cwa:text-left cwa:text-light cwa:w-full cwa:dark-blur cwa:border-0 cwa:outline-dotted cwa:outline-1 cwa:outline-stone-700 cwa:hover:outline-stone-400 cwa:focus-visible:ring-2 cwa:focus-visible:ring-stone-600 cwa:cursor-pointer"
      >
        <span
          class="cwa:block cwa:truncate"
          :class="{ 'cwa:text-stone-500': !hasSelection }"
        >{{ displayLabel }}</span>
        <span class="cwa:pointer-events-none cwa:absolute cwa:inset-y-0 cwa:right-0 cwa:flex cwa:items-center cwa:pr-3">
          <svg
            class="cwa:h-4 cwa:w-4 cwa:text-stone-400"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              d="M6 8l4 4 4-4"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </ListboxButton>
      <ListboxOptions
        ref="container"
        class="cwa:absolute cwa:z-10 cwa:mt-1 cwa:max-h-60 cwa:min-w-full cwa:max-w-[300px] cwa:overflow-auto cwa:dark-blur cwa:border-0 cwa:outline-dotted cwa:outline-1 cwa:outline-stone-400 cwa:focus:outline-none"
      >
        <ListboxOption
          v-for="option in options"
          :key="option.label"
          v-slot="{ active, selected }"
          as="template"
          :value="option.value"
          :disabled="option.disabled"
        >
          <li
            :class="[
              active ? 'cwa:text-white cwa:bg-stone-700/40' : 'cwa:text-stone-400',
              option.disabled ? 'cwa:opacity-50 cwa:cursor-not-allowed' : 'cwa:cursor-pointer',
              'cwa:relative cwa:select-none cwa:py-2 cwa:pl-4 cwa:pr-9',
            ]"
          >
            <span
              :class="[
                selected ? 'cwa:text-white cwa:font-medium' : '',
                'cwa:block cwa:truncate',
              ]"
            >{{ option.label }}</span>
            <span
              v-if="selected"
              class="cwa:absolute cwa:inset-y-0 cwa:right-0 cwa:flex cwa:items-center cwa:pr-3 cwa:text-white"
            >
              <svg
                class="cwa:h-4 cwa:w-4"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M5 10l3 3 7-7"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
          </li>
        </ListboxOption>
      </ListboxOptions>
      <RemoteChangeConflict
        v-if="remoteChange"
        :change="remoteChange"
      />
    </div>
  </Listbox>
</template>
