<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@headlessui/vue'

import { computed } from 'vue'
import { type SelectInputProps, useCwaSelectInput } from '#cwa/runtime/composables/cwa-select-input'

const emit = defineEmits(['update:modelValue'])
const props = defineProps<SelectInputProps>()
const { value, compareOptions, selectedOption, trigger, container } = useCwaSelectInput(computed(() => props), emit)
</script>

<template>
  <Listbox
    v-model="value"
    :by="compareOptions"
  >
    <div class="cwa:relative cwa:inline-flex">
      <ListboxButton
        ref="trigger"
        class="cwa:relative cwa:py-2 cwa:px-4 cwa:text-left cwa:text-light cwa:w-full cwa:dark-blur cwa:border-0 cwa:outline-dotted cwa:outline-1 cwa:outline-stone-700 cwa:hover:outline-stone-400 cwa:focus-visible:ring-2 cwa:focus-visible:ring-stone-600 cwa:cursor-pointer"
      >
        <span class="cwa:block cwa:truncate">{{ selectedOption?.label }}</span>
      </ListboxButton>
      <ListboxOptions
        ref="container"
        class="cwa:absolute cwa:max-h-60 cwa:min-w-full cwa:max-w-[300px] cwa:overflow-auto cwa:dark-blur cwa:border-0 cwa:outline-dotted cwa:outline-1 cwa:outline-stone-400"
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
              active ? 'cwa:text-white' : 'cwa:text-stone-400',
              'cwa:relative cwa:cursor-pointer cwa:select-none cwa:py-2 cwa:px-4',
            ]"
          >
            <span
              :class="[
                selected ? 'cwa:text-white' : '',
                'cwa:block cwa:truncate',
              ]"
            >{{ option.label }}</span>
          </li>
        </ListboxOption>
      </ListboxOptions>
    </div>
  </Listbox>
</template>
