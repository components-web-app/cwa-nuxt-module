<script lang="ts" setup>
import type { ButtonOption, ModelValue } from './Button.vue'

const emit = defineEmits<{ (e: 'click', value?: ModelValue): void }>()

defineProps<{
  option: ButtonOption
}>()
</script>

<template>
  <button
    class="cwa-block cwa-w-full cwa-py-2 cwa-px-5 hover:cwa-bg-dark cwa-text-left cwa-transition"
    @click.prevent.stop="emit('click', option.value)"
  >
    {{ option.label }}
  </button>
</template>
