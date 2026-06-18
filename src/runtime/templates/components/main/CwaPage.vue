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
const pageDataIri = computed(() => $cwa.resources.pageDataIriAtDepth(depth).value)
// cwa-page-own-depth: the depth at which THIS template is rendered — for template components to inject
provide('cwa-page-own-depth', depth)
// cwa-page-depth: incremented for any nested <CwaPage /> to render the next level
provide('cwa-page-depth', depth + 1)
provide('cwa-page-data-iri', pageDataIri)
</script>
