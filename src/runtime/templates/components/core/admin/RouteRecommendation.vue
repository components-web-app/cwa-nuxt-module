<script setup lang="ts">
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import StateGlyph from '#cwa/templates/components/core/ui/StateGlyph.vue'

const { path, action = 'Use this' } = defineProps<{
  path: string
  action?: string
}>()

const emit = defineEmits<{ use: [] }>()
</script>

<template>
  <div
    role="note"
    data-testid="route-recommendation"
    class="cwa:@container cwa:border-s-3 cwa:border-accent-fg cwa:bg-[color-mix(in_srgb,var(--cwa-color-accent-fg)_10%,var(--cwa-color-surface))]"
  >
    <div class="cwa:flex cwa:items-center cwa:gap-3 cwa:px-4 cwa:py-2.5 cwa:@max-[25rem]:flex-wrap">
      <StateGlyph
        kind="info"
        class="cwa:text-accent-fg"
      />
      <p class="cwa:m-0 cwa:min-w-0 cwa:flex-1 cwa:text-control cwa:text-fg">
        Recommended: <span class="cwa:break-all cwa:font-mono">{{ path }}</span>
      </p>
      <CwaUiButton
        size="sm"
        :label="action"
        :aria-label="`${action}: the recommended path, ${path}`"
        data-testid="route-use-recommended"
        class="cwa:@max-[25rem]:ms-7"
        @click="emit('use')"
      />
    </div>
  </div>
</template>
