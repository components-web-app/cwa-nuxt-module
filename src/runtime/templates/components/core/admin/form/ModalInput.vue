<template>
  <div class="cwa:rounded-lg cwa:py-1.5 cwa:relative cwa:border cwa:bg-dark/90 cwa:border-stone-700 cwa:focus-within:bg-dark cwa:focus-within:border-stone-600">
    <label
      class="cwa:px-4 cwa:text-stone-400 cwa:absolute"
      :for="id"
    >
      {{ label }}
    </label>
    <textarea
      v-if="type === 'textarea'"
      :id="id"
      ref="textarea"
      v-model="input"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      rows="3"
      class="cwa:min-h-[150px] cwa-textarea cwa:[&::-webkit-scrollbar]:hidden cwa:flex cwa:relative cwa:px-4 cwa:pt-6 cwa:pb-0 cwa:text-left cwa:text-light cwa:w-full cwa:border-0 cwa:items-center cwa:bg-transparent cwa:border-0 cwa:focus:ring-0 cwa:outline-0 cwa:resize-none"
    />
    <input
      v-else
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
import { useTextareaAutosize } from '@vueuse/core'

const id = useId()
const model = defineModel<string>()
const { type } = defineProps<{ label: string, type?: 'text' | 'number' | 'email' | 'password' | 'textarea' | 'url', placeholder?: string, autocomplete?: string }>()

const { textarea, input } = useTextareaAutosize({
  // @ts-expect-error MaybeRef expected instead of ModelRef but they should behave the same
  input: model,
})
</script>

<style>
textarea.cwa-textarea {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
</style>
