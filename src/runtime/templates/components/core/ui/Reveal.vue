<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useCwaReveal } from './reveal'

const { when } = defineProps<{ when: boolean }>()

const root = useTemplateRef<HTMLElement>('root')

useCwaReveal(() => root.value, () => when)
</script>

<template>
  <div
    v-if="when"
    ref="root"
    class="cwa:contents"
    data-cwa-reveal
  >
    <slot />
  </div>
</template>
