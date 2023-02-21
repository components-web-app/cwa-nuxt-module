<template>
  <NuxtLayout :name="layoutName">
    <slot />
  </NuxtLayout>
</template>

<script setup>
import { useNuxtApp } from '#app'
import { computed } from 'vue'

const { $cwa } = useNuxtApp()
const layoutName = computed(() => $cwa.resourcesManager.layout.value.data?.uiComponent || 'cwa-default')
</script>
