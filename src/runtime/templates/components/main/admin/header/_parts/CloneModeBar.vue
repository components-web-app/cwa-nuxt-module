<script setup lang="ts">
import { useCwa } from '#cwa/composables/cwa'
import { useCloneMode } from '#cwa/admin/clone-mode'

const $cwa = useCwa()
const { source, end } = useCloneMode($cwa)
</script>

<template>
  <div
    v-if="source"
    data-testid="clone-mode-bar"
    class="cwa:py-1 cwa:px-3 cwa:rounded-full cwa:bg-light/10 cwa:text-sm cwa:flex cwa:gap-x-1.5 cwa:items-center"
  >
    <span class="cwa:text-stone-300 cwa:whitespace-nowrap">{{ source.move ? 'Moving' : 'Cloning' }}: {{ source.name || source.iri }}</span>
    <span
      class="cwa:text-stone-400 cwa:text-xs"
      data-testid="clone-mode-hint"
    >{{ $cwa.admin.navigationGuardDisabled ? 'Follow links to the page you want, then turn off Enable Navigation to place it.' : 'Click a component to place it before or after. To use another page, turn on Enable Navigation.' }}</span>
    <button
      type="button"
      class="cwa:bg-light/90 cwa:hover:bg-light cwa:text-dark cwa:py-1 cwa:px-2 cwa:rounded-full cwa:cursor-pointer"
      @click.stop="end"
    >
      Cancel
    </button>
  </div>
</template>
