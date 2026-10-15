<script setup lang="ts">
import { useRouter } from '#app/composables/router'
import { useCwa } from '#cwa/composables/cwa'
import { cwaPageLoadPercent } from '#cwa/resources/page-load-percent'

const $cwa = useCwa()
const router = useRouter()
const pageLoadProgress = $cwa.resources.pageLoadProgress

function estimatedProgress(duration: number, elapsed: number) {
  const percent = cwaPageLoadPercent(pageLoadProgress.value, router.currentRoute.value)
  if (percent === undefined) {
    return 2 / Math.PI * 100 * Math.atan(elapsed / duration * 100 / 50)
  }
  return Math.max(percent, 3)
}
</script>

<template>
  <NuxtLoadingIndicator :estimated-progress="estimatedProgress" />
</template>
