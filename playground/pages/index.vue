<template>
  <div>
    <pre>{{ resourcesStore.$state.current.byId }}</pre>
  </div>
</template>

<script setup>
import { useNuxtApp } from '#app'
const { $cwa } = useNuxtApp()
const resourcesStore = $cwa.stores.resources.useStore()
</script>
