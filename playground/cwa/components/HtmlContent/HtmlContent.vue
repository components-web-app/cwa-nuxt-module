<template>
  <article class="prose prose-stone max-w-none">
    <TipTapHtmlEditor v-if="showEditor" v-model="resourceModel.model.value" class="html-content" />
    <div v-else ref="htmlContainer" class="html-content" v-html="htmlContent" />
  </article>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import { useCwaResource, useCwaResourceModel, useHtmlContent } from '#imports'

const props = defineProps<IriProp>()
const iriRef = toRef(props, 'iri')

const { getResource, exposeMeta, $cwa } = useCwaResource(iriRef, {
  styles: {
    multiple: true,
    classes: {
      'Big Text': ['text-2xl']
    }
  }
})
const resource = getResource()

const htmlContainer = ref<null|HTMLElement>(null)
const showEditor = computed(() => $cwa.admin.isEditing)

const htmlContent = computed<string>(() => (resource.value.data?.html || '<div></div>'))
useHtmlContent(htmlContainer)
const resourceModel = useCwaResourceModel<string>(iriRef, 'html')

defineExpose(exposeMeta)
</script>
