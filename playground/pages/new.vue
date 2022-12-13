<template>
  <div>
    <pre>{{ $cwa.resourcesManager.currentIds }}</pre>
  </div>
</template>

<script setup>
import { useNuxtApp } from '#app'
const { $cwa } = useNuxtApp()
</script>
