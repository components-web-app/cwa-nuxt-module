<template>
  <div class="cwa-rounded-lg cwa-py-1.5 cwa-relative cwa-border cwa-bg-dark/90 cwa-border-stone-700 focus-within:cwa-bg-dark focus-within:cwa-border-stone-600">
    <label class="cwa-px-4 cwa-text-stone-400 cwa-absolute" :for="id">
      {{ label }}
    </label>
    <input :id="id" v-model="model" class="cwa-flex cwa-transition-colors cwa-relative cwa-px-4 cwa-pt-6 cwa-pb-0 cwa-text-left cwa-text-light cwa-w-full cwa-border-0 cwa-items-center cwa-bg-transparent focus:cwa-ring-0">
  </div>
</template>

<script lang="ts" setup>
import { useId } from '#app'

const id = useId()
const model = defineModel<string>()
defineProps<{ label: string }>()
</script>
