<template>
  <div class="relative">
    <CwaUiProgressBar
      :show="showPageLoadBar"
      :percent="percent"
      class="page-progress-bar fixed left-0 top-0 z-200"
    />
    <div class="bg-inherit">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCwa, useCwaLayout } from '#imports'

const $cwa = useCwa()
useCwaLayout()

const percent = computed(() => $cwa.resources.pageLoadProgress.value.percent || 3)
const showPageLoadBar = computed(() => percent.value < 100)
</script>
