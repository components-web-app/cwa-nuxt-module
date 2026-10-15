<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useNuxtApp } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import { useCwa } from '#cwa/composables/cwa'
import { cwaPageLoadPercent } from '#cwa/resources/page-load-percent'

const $cwa = useCwa()
const router = useRouter()
const pageLoadProgress = $cwa.resources.pageLoadProgress
let highestPercent = 0

const unhookLoadingStart = useNuxtApp().hook('page:loading:start', () => {
  highestPercent = 0
})
onBeforeUnmount(unhookLoadingStart)

function estimatedProgress(duration: number, elapsed: number) {
  const percent = cwaPageLoadPercent(pageLoadProgress.value, router.currentRoute.value)
  if (percent === undefined) {
    return 2 / Math.PI * 100 * Math.atan(elapsed / duration * 100 / 50)
  }
  highestPercent = Math.max(highestPercent, percent, 3)
  return highestPercent
}
</script>

<template>
  <NuxtLoadingIndicator :estimated-progress="estimatedProgress" />
</template>
