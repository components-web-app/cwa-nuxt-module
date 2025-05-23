<template>
  <div
    ref="cwaPage"
    class="cwa:page cwa:h-full"
  >
    <ResourceLoader
      v-if="$cwa.resources.pageIri.value"
      :iri="$cwa.resources.pageIri.value"
      component-prefix="CwaPage"
    />
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { useTemplateRef, watch } from 'vue'
import ResourceLoader from './components/core/ResourceLoader.vue'
import { useHead } from '#app'
import { useCwa } from '#imports'

// to prevent errors navigating between pages, a page should have a single root element
// resource loader will be 1 at a time but can switch between 3 states

const $cwa = useCwa()

const cwaPage = useTemplateRef('cwaPage')
const { width, height } = useElementSize(cwaPage)

watch([width, height], () => {
  $cwa.admin.emitRedraw()
})

useHead({
  title: () => $cwa.resources.pageData?.value?.data?.title || $cwa.resources.page?.value?.data?.title,
  meta: [
    { name: 'description', content: () => $cwa.resources.pageData?.value?.data?.metaDescription || $cwa.resources.page?.value?.data?.metaDescription },
  ],
})
</script>
