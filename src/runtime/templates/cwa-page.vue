<template>
  <ResourceLoader :iri="$cwa.resourcesManager.pageIri.value" component-prefix="CwaPage" />
</template>

<script setup>
import { useNuxtApp } from '#app'
import ResourceLoader from './components/core/ResourceLoader.vue'

const { $cwa } = useNuxtApp()
</script>
