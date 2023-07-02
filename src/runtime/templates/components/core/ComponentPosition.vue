<template>
  <ResourceLoader :iri="componentIri" component-prefix="CwaComponents" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ResourceLoader from './ResourceLoader.vue'
import { useCwaResourceUtils } from '#imports'
import { IriProp } from '#cwa/runtime/composables/cwa-resource'

const props = defineProps<IriProp>()
const resource = useCwaResourceUtils(props.iri).getResource()
const componentIri = computed(() => {
  return resource.value?.data?.component
})
</script>
