<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useCwaReveal } from './reveal'

const { when, keep = false } = defineProps<{ when: boolean, keep?: boolean }>()

const root = useTemplateRef<HTMLElement>('root')

useCwaReveal(() => root.value, () => when)
</script>

<template>
  <div
    v-if="keep || when"
    v-show="when"
    ref="root"
    class="cwa:contents"
    data-cwa-reveal
  >
    <slot />
  </div>
</template>
