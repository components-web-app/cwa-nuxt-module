<script setup lang="ts">
import { useCwa } from '#cwa/composables/cwa'
import { useCloneMode } from '#cwa/admin/clone-mode'

const { source, end } = useCloneMode(useCwa())
</script>

<template>
  <div
    v-if="source"
    data-testid="clone-mode-bar"
    class="cwa:dark-blur cwa:py-2 cwa:px-3 cwa:rounded-full cwa:flex cwa:gap-x-1.5 cwa:items-center"
  >
    <span class="cwa:text-stone-300">Cloning: {{ source.name || source.iri }}</span>
    <button
      type="button"
      class="cwa:bg-light/90 cwa:hover:bg-light cwa:text-dark cwa:py-1 cwa:px-2 cwa:rounded-full cwa:cursor-pointer"
      @click.stop="end"
    >
      Cancel
    </button>
  </div>
</template>
