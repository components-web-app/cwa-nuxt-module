<template>
  <ResourceLoader :iri="componentIri" component-prefix="CwaComponents" />
</template>

<script setup>
import { useNuxtApp } from '#app'
import { computed } from 'vue'
import ResourceLoader from './ResourceLoader.vue'

const { $cwa } = useNuxtApp()

const props = defineProps({
  iri: {
    type: String,
    required: true
  }
})

const resource = $cwa.resources.getResource(props.iri)
const componentIri = computed(() => {
  return resource.value?.data?.component
})
</script>
