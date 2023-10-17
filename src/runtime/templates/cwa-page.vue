<template>
  <ResourceLoader v-if="$cwa.resources.pageIri.value" :iri="$cwa.resources.pageIri.value" component-prefix="CwaPages" />
</template>

<script setup lang="ts">
import ResourceLoader from './components/core/ResourceLoader'
import { useCwa } from '#imports'

const $cwa = useCwa()
</script>
