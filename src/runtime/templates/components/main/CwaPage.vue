<template>
  <KeepAlive>
    <ResourceLoader
      v-if="pageIri"
      :key="pageIri"
      :iri="pageIri"
      component-prefix="CwaPage"
    />
  </KeepAlive>
</template>

<script setup lang="ts">
import { computed, inject, provide } from 'vue'
import ResourceLoader from '../core/ResourceLoader.vue'
import { useCwa } from '#imports'

const $cwa = useCwa()
const depth = inject('cwa-page-depth', 0)
const pageIri = computed(() => $cwa.resources.pageIriAtDepth(depth).value)
provide('cwa-page-depth', depth + 1)
</script>
