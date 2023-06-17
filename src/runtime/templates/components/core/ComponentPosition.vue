<template>
  <ResourceLoader :iri="componentIri" component-prefix="CwaComponents" />
</template>

<script setup>
import { computed } from 'vue'
import ResourceLoader from './ResourceLoader.vue'
import { useCwaResourceUtils, iri } from '#imports'

const props = defineProps({
  ...iri
})
const resource = useCwaResourceUtils().getResource(props.iri)
const componentIri = computed(() => {
  return resource.value?.data?.component
})
</script>
