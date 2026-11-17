<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const { tone = 'neutral', icon, dot = false } = defineProps<{
  tone?: BadgeTone
  icon?: Component
  dot?: boolean
}>()

const tones: Record<BadgeTone, { fill: string, mark: string }> = {
  neutral: { fill: 'cwa:bg-field', mark: 'cwa:text-fg-muted' },
  accent: { fill: 'cwa:bg-accent-tint', mark: 'cwa:text-accent-fg' },
  success: { fill: 'cwa:bg-[color-mix(in_srgb,var(--cwa-color-success)_18%,var(--cwa-color-surface))]', mark: 'cwa:text-success' },
  warning: { fill: 'cwa:bg-[color-mix(in_srgb,var(--cwa-color-warning)_18%,var(--cwa-color-surface))]', mark: 'cwa:text-warning' },
  danger: { fill: 'cwa:bg-[color-mix(in_srgb,var(--cwa-color-danger)_18%,var(--cwa-color-surface))]', mark: 'cwa:text-danger' },
}

const look = computed(() => tones[tone])
</script>

<template>
  <span
    class="cwa:inline-flex cwa:max-w-full cwa:items-center cwa:gap-1.5 cwa:whitespace-nowrap cwa:px-2 cwa:py-0.5 cwa:text-flag cwa:text-fg"
    :class="look.fill"
  >
    <component
      :is="icon"
      v-if="icon"
      aria-hidden="true"
      class="cwa:size-2.5 cwa:shrink-0"
      :class="look.mark"
    />
    <span
      v-else-if="dot"
      aria-hidden="true"
      data-testid="badge-mark"
      class="cwa:size-2 cwa:shrink-0 cwa:rounded-full cwa:bg-current"
      :class="look.mark"
    />
    <slot />
  </span>
</template>
