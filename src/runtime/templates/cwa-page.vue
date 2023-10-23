<template>
  <ResourceLoader v-if="$cwa.resources.pageIri.value" :iri="$cwa.resources.pageIri.value" component-prefix="CwaPage" />
</template>

<script setup lang="ts">
import ResourceLoader from './components/core/ResourceLoader.vue'
import { useCwa } from '#imports'

const $cwa = useCwa()
</script>
