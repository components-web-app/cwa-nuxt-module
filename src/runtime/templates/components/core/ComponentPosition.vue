<template>
  <ResourceLoader :iri="componentIri" component-prefix="CwaComponents" />
</template>

<script setup>
import { computed } from 'vue'
import ResourceLoader from './ResourceLoader.vue'
import { useCwaComponent } from '#imports'

const props = defineProps({
  iri: {
    type: String,
    required: true
  }
})

const resource = useCwaComponent(props.iri)
const componentIri = computed(() => {
  return resource.value?.data?.component
})
</script>
