<script setup lang="ts">
import { useCwa } from '#cwa/composables/cwa'
import { buttonLooks } from '#cwa/templates/components/ui/kit-looks'

const $cwa = useCwa()

const updateClass = [
  'cwa:inline-flex cwa:h-8 cwa:shrink-0 cwa:cursor-pointer cwa:items-center cwa:justify-center cwa:whitespace-nowrap cwa:px-3 cwa:text-helper cwa:font-semibold cwa:leading-5 cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:ease-out cwa:motion-reduce:transition-none cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:pointer-coarse:h-hit',
  buttonLooks.solid.accent.rest,
  buttonLooks.solid.accent.hover,
]
</script>

<template>
  <div
    v-if="$cwa.resources.hasNewResources"
    role="status"
    data-testid="outdated-content-notice"
    class="cwa:flex cwa:items-center cwa:gap-x-3 cwa:bg-surface-menu cwa:py-1 cwa:ps-3 cwa:pe-1 cwa:text-control cwa:text-fg cwa:shadow-popover"
  >
    <span>The content on this page is outdated</span>
    <button
      type="button"
      :class="updateClass"
      @click.stop="$cwa.resourcesManager.mergeNewResources"
    >
      Update
    </button>
  </div>
</template>
