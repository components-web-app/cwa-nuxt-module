<script lang="ts" setup>
import { computed } from 'vue'
import StateGlyph from '#cwa/templates/components/core/ui/StateGlyph.vue'
import { badgeWords } from '#cwa/admin/field-badge'
import type { FieldBadge } from '#cwa/admin/field-badge'
import type { CwaResourceManagerTabOptions } from '#cwa/composables/cwa-resource-manager-tab'

const { tab, selected, badge, controls } = defineProps<{
  tab: CwaResourceManagerTabOptions
  selected: boolean
  badge?: FieldBadge
  controls: string
}>()

const words = computed(() => badge?.kind ? badgeWords(badge) : undefined)
</script>

<template>
  <button
    type="button"
    role="tab"
    :aria-label="words ? `${tab.name}: ${words}` : undefined"
    :aria-selected="selected ? 'true' : 'false'"
    :aria-controls="controls"
    :tabindex="selected ? 0 : -1"
    :aria-keyshortcuts="selected ? 'F6' : undefined"
    :title="words"
    :data-badge="badge?.kind"
    class="cwa:relative cwa:inline-flex cwa:h-full cwa:shrink-0 cwa:cursor-pointer cwa:items-center cwa:gap-2 cwa:whitespace-nowrap cwa:px-4 cwa:text-label cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg"
    :class="selected ? 'cwa:text-fg' : 'cwa:text-fg-muted cwa:hover:text-fg'"
  >
    {{ tab.name }}
    <StateGlyph
      v-if="badge?.kind"
      :key="badge.kind"
      :kind="badge.kind"
    />
  </button>
</template>
