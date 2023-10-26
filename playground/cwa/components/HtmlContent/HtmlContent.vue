<template>
  <div ref="htmlContainer" class="html-content" v-html="htmlContent" />
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import { useCwaResource, useHtmlContent } from '#imports'

const props = defineProps<IriProp>()
const { getResource, exposeMeta } = useCwaResource(toRef(props, 'iri'), {
  styles: {
    multiple: true,
    classes: {
      'Big Text': ['text-2xl']
    }
  }
})
const resource = getResource()
defineExpose(exposeMeta)

const htmlContainer = ref<null|HTMLElement>(null)
const htmlContent = computed<string>(() => (resource.value.data?.html || '<div></div>'))
useHtmlContent(htmlContainer)
</script>

<style>
.html-content {
  a {
    @apply underline
  }
  p:not(:last-child) {
    margin-bottom: 1rem
  }
}
</style>
