<script lang="ts" setup>
import { computed } from 'vue'
import StateGlyph from '#cwa/templates/components/core/ui/StateGlyph.vue'
import { badgeWords } from '#cwa/admin/field-badge'
import type { FieldBadge } from '#cwa/admin/field-badge'
import type { CwaResourceManagerTabOptions } from '#cwa/composables/cwa-resource-manager-tab'

const { tab, selected, badge } = defineProps<{
  tab: CwaResourceManagerTabOptions
  selected: boolean
  badge?: FieldBadge
}>()

const words = computed(() => badge?.kind ? badgeWords(badge) : undefined)
</script>

<template>
  <button
    type="button"
    :aria-label="words ? `${tab.name}: ${words}` : undefined"
    :aria-pressed="selected"
    :title="words"
    :data-badge="badge?.kind"
    class="cwa:relative cwa:inline-flex cwa:h-full cwa:shrink-0 cwa:cursor-pointer cwa:items-center cwa:gap-2 cwa:whitespace-nowrap cwa:px-4 cwa:text-label cwa:outline-none cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:after:absolute cwa:after:inset-x-0 cwa:after:bottom-0 cwa:after:h-0.5 cwa:after:content-['']"
    :class="selected ? 'cwa:text-fg cwa:after:bg-accent' : 'cwa:text-fg-muted cwa:hover:text-fg'"
  >
    {{ tab.name }}
    <StateGlyph
      v-if="badge?.kind"
      :key="badge.kind"
      :kind="badge.kind"
    />
  </button>
</template>
