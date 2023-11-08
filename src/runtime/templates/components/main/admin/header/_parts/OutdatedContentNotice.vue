<script setup lang="ts">
import { useCwa } from '#cwa/runtime/composables/cwa'

const $cwa = useCwa()
</script>

<template>
  <div v-if="$cwa.resources.hasNewResources" class="cwa-dark-blur cwa-py-2 cwa-px-3 cwa-rounded-full cwa-flex cwa-space-x-1.5 cwa-items-center cwa-opacity-75 hover:cwa-opacity-100 cwa-transition">
    <span class="cwa-text-stone-300">The content on this page is outdated</span>
    <button class="cwa-bg-light/90 hover:cwa-bg-light cwa-text-dark cwa-py-1 cwa-px-2 cwa-rounded-full" @click.stop="$cwa.resourcesManager.mergeNewResources">
      Update
    </button>
  </div>
</template>
