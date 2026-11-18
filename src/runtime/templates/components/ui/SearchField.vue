<script setup lang="ts">
import { useTemplateRef } from 'vue'
import SearchIcon from './icon/SearchIcon.vue'
import XMarkIcon from './icon/XMarkIcon.vue'
import { fieldBox, fieldFill } from '../core/ui/field-looks'

const { label, placeholder } = defineProps<{
  label: string
  placeholder?: string
}>()

const model = defineModel<string | null | undefined>()
const input = useTemplateRef<HTMLInputElement>('input')

function clear() {
  model.value = ''
  input.value?.focus()
}
</script>

<template>
  <div
    data-testid="search-field"
    :class="[fieldBox, fieldFill(undefined, false)]"
  >
    <SearchIcon
      aria-hidden="true"
      class="cwa:ms-3 cwa:size-4 cwa:shrink-0 cwa:text-muted-on-field"
    />
    <input
      ref="input"
      type="search"
      :value="model ?? ''"
      :aria-label="label"
      :placeholder="placeholder ?? label"
      autocomplete="off"
      spellcheck="false"
      class="cwa:h-full cwa:min-w-0 cwa:flex-1 cwa:appearance-none cwa:border-0 cwa:bg-transparent cwa:px-2 cwa:text-control cwa:text-inherit cwa:outline-none cwa:placeholder:text-muted-on-field cwa:focus:ring-0 cwa:pointer-coarse:text-base cwa:[&::-webkit-search-cancel-button]:appearance-none"
      @input="model = ($event.target as HTMLInputElement).value"
      @keydown.escape="model && ($event.stopPropagation(), clear())"
    >
    <button
      v-if="model"
      type="button"
      aria-label="Clear search"
      data-testid="search-field-clear"
      class="cwa:grid cwa:size-control cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:text-muted-on-field cwa:outline-1 cwa:outline-transparent cwa:hover:text-fg cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:pointer-coarse:size-hit"
      @click="clear"
    >
      <XMarkIcon
        aria-hidden="true"
        class="cwa:size-4"
      />
    </button>
  </div>
</template>
