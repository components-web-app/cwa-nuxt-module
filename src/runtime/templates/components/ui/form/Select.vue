<script setup lang="ts">
import { isEqual } from 'lodash-es'
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption
} from '@headlessui/vue'

import { computed } from 'vue'
import { defu } from 'defu'
import type { PopperOptions } from '#cwa/runtime/types/popper'
import { usePopper } from '#cwa/runtime/composables/popper'

type ModelValue = undefined | string | number | boolean | object | null | (string | number | boolean | object)[]

export interface SelectOption {
  label: string,
  value: ModelValue,
  disabled?: boolean
}

const props = defineProps<{
  options: SelectOption[],
  modelValue: ModelValue,
  popper?: PopperOptions
}>()

const emit = defineEmits(['update:modelValue'])

const value = computed({
  get () {
    return props.modelValue
  },
  set (value) {
    emit('update:modelValue', value)
  }
})

const ops = {
  popper: {
    placement: 'bottom-start'
  }
}

const selectedOption = computed(() => props.options.find(i => isEqual(i, props.modelValue)) || props.options[0] || { label: '', value: null })
const popperOps = computed<PopperOptions>(() => defu({}, props.popper, ops.popper as PopperOptions))
const [trigger, container] = usePopper(popperOps.value)

</script>

<template>
  <Listbox v-model="value">
    <div class="cwa-relative cwa-inline-flex">
      <ListboxButton
        ref="trigger"
        class="cwa-relative cwa-py-2 cwa-px-4 cwa-text-left cwa-text-light cwa-w-full cwa-dark-blur cwa-border-0 cwa-outline-dotted cwa-outline-1 cwa-outline-stone-700 hover:cwa-outline-stone-400 focus-visible:cwa-ring-2 focus-visible:cwa-ring-stone-600"
      >
        <span class="cwa-block cwa-truncate">{{ selectedOption?.label }}</span>
      </ListboxButton>
      <ListboxOptions
        ref="container"
        class="cwa-absolute cwa-max-h-60 cwa-min-w-full cwa-max-w-[300px] cwa-overflow-auto cwa-dark-blur cwa-border-0 cwa-outline-dotted cwa-outline-1 cwa-outline-stone-400"
      >
        <ListboxOption
          v-for="option in options"
          v-slot="{ active, selected }"
          :key="option.label"
          as="template"
          :value="option"
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
