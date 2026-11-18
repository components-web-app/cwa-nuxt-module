<script setup lang="ts">
import { ref } from 'vue'
import StateGlyph from '#cwa/templates/components/core/ui/StateGlyph.vue'

const { text } = defineProps<{ text?: string }>()

const line = ref<HTMLElement | null>(null)

defineExpose({ focus: () => line.value?.focus(), element: () => line.value })
</script>

<template>
  <p
    v-if="text"
    ref="line"
    role="status"
    tabindex="-1"
    data-testid="routes-status"
    class="cwa:m-0 cwa:flex cwa:items-start cwa:gap-2 cwa:text-control cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
  >
    <StateGlyph
      kind="saved"
      class="cwa:mt-0.5"
    />
    <span>{{ text }}</span>
  </p>
</template>
