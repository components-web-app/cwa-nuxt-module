<template>
  <ResourceLoader v-if="$cwa.resources.pageIri.value" :iri="$cwa.resources.pageIri.value" component-prefix="CwaPages" />
</template>

<script setup>
import ResourceLoader from './components/core/ResourceLoader.vue'
import { useNuxtApp } from '#app'

const { $cwa } = useNuxtApp()
</script>
