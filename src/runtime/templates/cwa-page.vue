<template>
  <div class="cwa-p-4">
    <ResourceLoader :iri="$cwa.resourcesManager.pageIri" />
    <CwaCurrentResources />
  </div>
</template>

<script setup>
import { useNuxtApp } from '#app'
import CwaCurrentResources from './components/CwaCurrentResources.vue'
import ResourceLoader from './components/core/ResourceLoader.vue'

const { $cwa } = useNuxtApp()
</script>
