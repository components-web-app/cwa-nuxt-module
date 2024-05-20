<template>
  <ResourceLoader v-if="$cwa.resources.pageIri.value" :iri="$cwa.resources.pageIri.value" component-prefix="CwaPage" />
</template>

<script setup lang="ts">
import { useHead } from '#app'
import ResourceLoader from './components/core/ResourceLoader.vue'
import { definePageMeta, useCwa } from '#imports'

const $cwa = useCwa()

definePageMeta({
  cwa: true
})

useHead({
  title: () => $cwa.resources.pageData?.value?.data?.title || $cwa.resources.page?.value?.data?.title,
  meta: [
    { name: 'description', content: () => $cwa.resources.pageData?.value?.data?.metaDescription || $cwa.resources.page?.value?.data?.metaDescription }
  ]
})
</script>
