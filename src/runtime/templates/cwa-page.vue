<template>
  <ResourceLoader v-if="$cwa.resources.pageIri.value" :iri="$cwa.resources.pageIri.value" component-prefix="CwaPage" />
</template>

<script setup>
import { useNuxtApp } from '#app'
import ResourceLoader from './components/core/ResourceLoader.vue'

const { $cwa } = useNuxtApp()
</script>
