<template>
  <ResourceLoader
    v-if="$cwa.resources.pageIri.value"
    :iri="$cwa.resources.pageIri.value"
    component-prefix="CwaPages"
  />
</template>

<script setup>
import { useNuxtApp } from '#app'
import ResourceLoader from './components/core/ResourceLoader'

const { $cwa } = useNuxtApp()
</script>
