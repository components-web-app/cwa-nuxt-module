<script setup lang="ts">
import { computed, useId, useTemplateRef } from 'vue'
import StateGlyph from '../core/ui/StateGlyph.vue'
import type { GlyphKind } from '../core/ui/StateGlyph.vue'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const { tone = 'info', title } = defineProps<{
  tone?: AlertTone
  title?: string
}>()

const titleId = useId()
const root = useTemplateRef<HTMLElement>('root')

const looks: Record<AlertTone, { box: string, glyph: GlyphKind, accent?: true }> = {
  info: { box: 'cwa:border-s-3 cwa:border-accent-fg cwa:bg-[color-mix(in_srgb,var(--cwa-color-accent-fg)_10%,var(--cwa-color-surface))]', glyph: 'info', accent: true },
  success: { box: 'cwa:border-s-3 cwa:border-success cwa:bg-[color-mix(in_srgb,var(--cwa-color-success)_10%,var(--cwa-color-surface))]', glyph: 'saved' },
  warning: { box: 'cwa:border-s-3 cwa:border-warning cwa:bg-[color-mix(in_srgb,var(--cwa-color-warning)_10%,var(--cwa-color-surface))]', glyph: 'conflict' },
  danger: { box: 'cwa:border-s-3 cwa:border-danger-fg cwa:bg-[color-mix(in_srgb,var(--cwa-color-danger-fg)_10%,var(--cwa-color-surface))]', glyph: 'error' },
}

const look = computed(() => looks[tone])

defineExpose({ focus: () => root.value?.focus() })
</script>

<template>
  <div
    ref="root"
    role="group"
    tabindex="-1"
    :aria-labelledby="title ? titleId : undefined"
    :data-tone="tone"
    data-testid="alert"
    class="cwa:flex cwa:gap-3 cwa:p-4 cwa:text-control cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
    :class="look.box"
  >
    <StateGlyph
      :kind="look.glyph"
      class="cwa:mt-0.5"
      :accent="look.accent"
    />
    <div class="cwa:min-w-0 cwa:flex-1">
      <p
        v-if="title"
        :id="titleId"
        class="cwa:m-0 cwa:font-semibold"
      >
        {{ title }}
      </p>
      <div
        v-if="$slots.default"
        class="cwa:text-fg-secondary"
        :class="{ 'cwa:mt-1': title }"
      >
        <slot />
      </div>
      <div
        v-if="$slots.actions"
        class="cwa:mt-3 cwa:flex cwa:flex-wrap cwa:gap-2"
      >
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
