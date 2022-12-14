<template>
  <div>
    <pre>{{ $cwa.resourcesManager.currentResources }}</pre>
  </div>
</template>

<script setup>
import { useNuxtApp } from '#app'
const { $cwa } = useNuxtApp()
</script>
