<template>
  <div ref="htmlContainer" v-html="htmlContent" />
</template>

<script setup lang="ts">
// Todo: work on the nuxt link replacement so external links are not clickable during editing - make into composable for dynamically  changing anchor links into components for internal routing and easier manipulation of disabling
import { ref, defineProps } from 'vue'
import { useCwaResource, useHtmlContent, IriProp } from '#imports'

const props = defineProps<IriProp>()

const { getResource, exposeMeta } = useCwaResource(props.iri)
const resource = getResource()
defineExpose(exposeMeta)

const htmlContainer = ref<null|HTMLElement>(null)
const htmlContent = ref<string>(resource.value.data?.html || '<div></div>')

useHtmlContent(htmlContainer)
</script>

<style>
.html-content p:not(:last-child) {
  margin-bottom: 1rem
}
</style>
