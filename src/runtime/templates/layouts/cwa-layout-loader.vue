<template>
  <NuxtLayout :name="layoutName">
    <slot />
  </NuxtLayout>
</template>

<script setup>
import { useNuxtApp } from '#app'
import { computed } from 'vue'

const { $cwa } = useNuxtApp()
const layoutName = computed(() => {
  const layoutResource = $cwa.resources.layout.value
  return layoutResource?.data?.uiComponent || 'cwa-default'
})
</script>
