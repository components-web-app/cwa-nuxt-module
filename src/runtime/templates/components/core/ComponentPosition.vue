<template>
  <!--CWA_MANAGER_START_POSITION-->
  <ResourceLoader :iri="componentIri" component-prefix="CwaComponent" />
  <!--CWA_MANAGER_END_POSITION-->
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ResourceLoader from './ResourceLoader.vue'
import { useCwaResource } from '#imports'
import { IriProp } from '#cwa/runtime/composables/cwa-resource'

const props = defineProps<IriProp>()

const resource = useCwaResource(props.iri).getResource()
const componentIri = computed(() => {
  return resource.value?.data?.component
})
</script>
