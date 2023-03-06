<template>
  <div class="cwa-p-4">
    <ResourceLoader :iri="$cwa.resourcesManager.pageIri.value" />
  </div>
</template>

<script setup>
import { useNuxtApp } from '#app'
import ResourceLoader from './components/core/ResourceLoader.vue'

const { $cwa } = useNuxtApp()
</script>
