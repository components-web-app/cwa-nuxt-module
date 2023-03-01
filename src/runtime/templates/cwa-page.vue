<template>
  <div class="cwa-p-4">
    CWA PAGE... {{ $cwa.resourcesManager.pageIri.value }}<br>
    <ResourceLoader :iri="$cwa.resourcesManager.pageIri.value" />
    <CwaCurrentResources />
  </div>
</template>

<script setup>
import { useNuxtApp } from '#app'
import CwaCurrentResources from './components/CwaCurrentResources.vue'
import ResourceLoader from './components/core/ResourceLoader.vue'

const { $cwa } = useNuxtApp()
</script>
