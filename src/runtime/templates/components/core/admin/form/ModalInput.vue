<template>
  <div class="cwa:rounded-lg cwa:py-1.5 cwa:relative cwa:border cwa:bg-dark/90 cwa:border-stone-700 cwa:focus-within:bg-dark cwa:focus-within:border-stone-600">
    <label
      class="cwa:px-4 cwa:text-stone-400 cwa:absolute"
      :for="id"
    >
      {{ label }}
    </label>
    <input
      :id="id"
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      class="cwa:flex cwa:relative cwa:px-4 cwa:pt-6 cwa:pb-0 cwa:text-left cwa:text-light cwa:w-full cwa:border-0 cwa:items-center cwa:bg-transparent cwa:border-0 cwa:focus:ring-0 cwa:outline-0"
    >
  </div>
</template>

<script lang="ts" setup>
import { useId } from 'vue'

const id = useId()
const model = defineModel<string>()
defineProps<{ label: string, type?: 'text' | 'number' | 'email' | 'password', placeholder?: string, autocomplete?: string }>()
</script>
