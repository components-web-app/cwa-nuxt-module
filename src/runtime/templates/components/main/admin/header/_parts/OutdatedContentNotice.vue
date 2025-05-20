<script setup lang="ts">
import { useCwa } from '#cwa/runtime/composables/cwa'

const $cwa = useCwa()
</script>

<template>
  <div
    v-if="$cwa.resources.hasNewResources"
    class="cwa:dark-blur cwa:py-2 cwa:px-3 cwa:rounded-full cwa:flex cwa:gap-x-1.5 cwa:items-center cwa:opacity-75 cwa:hover:opacity-100 cwa:transition"
  >
    <span class="cwa:text-stone-300">The content on this page is outdated</span>
    <button
      class="cwa:bg-light/90 cwa:hover:bg-light cwa:text-dark cwa:py-1 cwa:px-2 cwa:rounded-full cwa:cursor-pointer"
      @click.stop="$cwa.resourcesManager.mergeNewResources"
    >
      Update
    </button>
  </div>
</template>
