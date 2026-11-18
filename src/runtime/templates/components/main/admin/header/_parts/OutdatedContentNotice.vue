<script setup lang="ts">
import { useCwa } from '#cwa/composables/cwa'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'

const $cwa = useCwa()
</script>

<template>
  <div
    v-if="$cwa.resources.hasNewResources"
    role="status"
    data-testid="outdated-content-notice"
    class="cwa:flex cwa:items-center cwa:gap-x-3 cwa:bg-surface-menu cwa:py-1 cwa:ps-3 cwa:pe-1 cwa:text-control cwa:text-fg cwa:shadow-popover"
  >
    <span>The content on this page is outdated</span>
    <CwaUiButton
      label="Update"
      variant="solid"
      size="sm"
      @click.stop="$cwa.resourcesManager.mergeNewResources"
    />
  </div>
</template>
