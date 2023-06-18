<template>
  <NuxtLayout :name="layoutName">
    <slot />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCwa } from '#imports'

const $cwa = useCwa()
const layoutName = computed(() => {
  const layoutResource = $cwa.resources.layout.value
  return layoutResource?.data?.uiComponent || 'cwa-default'
})
</script>
