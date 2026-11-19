<script setup lang="ts">
import { useCwa } from '#cwa/composables/cwa'
import { useCloneMode } from '#cwa/admin/clone-mode'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'

const $cwa = useCwa()
const { source, end } = useCloneMode($cwa)
</script>

<template>
  <div
    v-if="source"
    data-testid="clone-mode-bar"
    class="cwa:flex cwa:items-center cwa:gap-x-3 cwa:bg-surface-raised cwa:py-1 cwa:ps-3 cwa:pe-1 cwa:text-control"
  >
    <span
      class="cwa:whitespace-nowrap cwa:text-fg"
      data-testid="clone-mode-source"
    >{{ source.move ? 'Moving' : 'Cloning' }}: {{ source.name || source.iri }}<template v-if="source.excerpt"> — “{{ source.excerpt }}”</template></span>
    <span
      class="cwa:text-helper cwa:text-fg-muted"
      data-testid="clone-mode-hint"
    >Click where it should go</span>
    <CwaUiButton
      label="Cancel"
      size="sm"
      @click.stop="end"
    />
  </div>
</template>
