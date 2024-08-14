<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption, provideUseId
} from '@headlessui/vue'

import { useId } from '#app'
import { computed } from 'vue'
import { type SelectInputProps, useCwaSelectInput } from '#cwa/runtime/composables/cwa-select-input'

// see https://github.com/tailwindlabs/headlessui/issues/2913 - temporary until headless ui 2 and vue 3.5
provideUseId(() => useId())

const emit = defineEmits(['update:modelValue'])
const props = defineProps<SelectInputProps>()
const { value, compareOptions, selectedOption, trigger, container } = useCwaSelectInput(computed(() => props), emit)
</script>

<template>
  <Listbox v-slot="{ open }" v-model="value" :by="compareOptions">
    <div class="cwa-relative cwa-inline-flex">
      <ListboxButton
        ref="trigger"
        class="cwa-flex cwa-transition-colors cwa-relative cwa-rounded-lg cwa-py-2 cwa-px-4 cwa-text-left cwa-text-light cwa-w-full cwa-border-0"
        :class="[open ? 'cwa-bg-stone-700' : 'cwa-bg-stone-700/80']"
      >
        <span class="cwa-block cwa-truncate cwa-flex-grow">{{ selectedOption?.label }}</span>
        <svg class="-cwa-mr-1 cwa-h-6 cwa-w-6 cwa-transition-transform" :class="{ 'cwa-rotate-180': open }" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
        </svg>
      </ListboxButton>
      <Transition
        enter-active-class="cwa-transition-opacity cwa-duration-100 cwa-ease-out"
        enter-from-class="cwa-opacity-0"
        enter-to-class="cwa-opacity-100"
        leave-active-class="cwa-transition-opacity cwa-duration-100 cwa-ease-in"
        leave-from-class="cwa-opacity-100"
        leave-to-class="cwa-opacity-0"
      >
        <ListboxOptions
          v-show="open"
          ref="container"
          static
          class="cwa-absolute cwa-scale-50 cwa-max-h-60 cwa-min-w-full cwa-overflow-auto cwa-dark-blur cwa-rounded-lg cwa-z-dialog cwa-border cwa-border-stone-600"
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
      </Transition>
    </div>
  </Listbox>
</template>
