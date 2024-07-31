<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption
} from '@headlessui/vue'

import { type SelectInputProps, useCwaSelectInput } from '#cwa/runtime/composables/cwa-select-input'

const emit = defineEmits(['update:modelValue'])
const props = defineProps<SelectInputProps>()
const { value, compareOptions, selectedOption, trigger, container } = useCwaSelectInput(props, emit)
</script>

<template>
  <Listbox v-slot="{ open }" v-model="value" :by="compareOptions">
    <div class="cwa-relative cwa-inline-flex">
      <ListboxButton
        :id="props.id || 'filter-select'"
        ref="trigger"
        class="cwa-flex cwa-transition-colors cwa-relative cwa-rounded-lg cwa-py-2 cwa-px-4 cwa-text-left cwa-text-light cwa-w-full cwa-bg-light/10 cwa-border-0 focus-visible:cwa-bg-light/15"
      >
        <span class="cwa-block cwa-truncate cwa-flex-grow">{{ selectedOption?.label }}</span>
        <svg class="-cwa-mr-1 cwa-h-6 cwa-w-6 cwa-transition-transform" :class="{ 'cwa-rotate-180': open }" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
        </svg>
      </ListboxButton>
      <ListboxOptions
        ref="container"
        class="cwa-absolute cwa-max-h-60 cwa-min-w-full cwa-overflow-auto cwa-bg-light/10 cwa-border-0 cwa-rounded-lg"
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
              active ? 'cwa-text-white' : 'cwa-text-stone-400',
              'cwa-relative cwa-cursor-pointer cwa-select-none cwa-py-2 cwa-px-4',
            ]"
          >
            <span
              :class="[
                selected ? 'cwa-text-white' : '',
                'cwa-block cwa-truncate',
              ]"
            >{{ option.label }}</span>
          </li>
        </ListboxOption>
      </ListboxOptions>
    </div>
  </Listbox>
</template>
