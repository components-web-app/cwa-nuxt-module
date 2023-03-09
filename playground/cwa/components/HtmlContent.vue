<template>
  <div v-html="resource.data?.html" />
</template>

<script setup>
import { useNuxtApp } from '#app'

const { $cwa } = useNuxtApp()
const props = defineProps({
  iri: {
    type: String,
    required: true
  }
})

const resource = $cwa.resourcesManager.getResource(props.iri)
</script>
