<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { badgeText, badgeTintPercent, badgeTones } from './kit-looks'
import type { BadgeTone } from './kit-looks'

const { tone = 'neutral', icon, dot = false } = defineProps<{
  tone?: BadgeTone
  icon?: Component
  dot?: boolean
}>()

const look = computed(() => badgeTones[tone])

const tint = { '--cwa-badge-tint': `${badgeTintPercent}%` }
</script>

<template>
  <span
    class="cwa:inline-flex cwa:max-w-full cwa:items-center cwa:gap-1.5 cwa:whitespace-nowrap cwa:px-2 cwa:py-0.5 cwa:text-flag"
    :class="[badgeText, look.fill]"
    :style="tint"
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
