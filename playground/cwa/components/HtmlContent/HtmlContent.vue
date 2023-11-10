<template>
  <article class="prose prose-stone max-w-none min-h-[20px]">
    <TipTapHtmlEditor v-if="$cwa.admin.isEditing" ref="editorComponent" v-model="resourceModel.model.value" class="html-content" :disabled="disableEditor" />
    <div v-else ref="htmlContainer" class="html-content" v-html="htmlContent" />
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch, watchEffect } from 'vue'
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import { useCwaResource, useCwaResourceModel, useHtmlContent } from '#imports'
import TipTapHtmlEditor from '~/components/TipTapHtmlEditor.vue'

const props = defineProps<IriProp>()
const iriRef = toRef(props, 'iri')
const editorComponent = ref<typeof TipTapHtmlEditor|undefined>()

const { getResource, exposeMeta, $cwa, manageable } = useCwaResource(iriRef, {
  styles: {
    multiple: true,
    classes: {
      'Big Text': ['text-2xl']
    }
  }
})
defineExpose(exposeMeta)

const resource = getResource()

const htmlContainer = ref<null|HTMLElement>(null)
const disableEditor = computed(() => !$cwa.admin.isEditing || $cwa.admin.componentManager.currentIri.value !== iriRef.value)

const htmlContent = computed<string>(() => (resource.value.data?.html || '<div></div>'))
useHtmlContent(htmlContainer)

const resourceModel = useCwaResourceModel<string>(iriRef, 'html')

watch([disableEditor, resourceModel.model], async () => {
  await nextTick()
  manageable?.manager.updateFocusSize()
}, {
  flush: 'post'
})

watchEffect(async () => {
  if (editorComponent.value && !disableEditor.value) {
    await nextTick()
    editorComponent.value.editor.chain().focus(null, { scrollIntoView: false }).run()
  }
})
</script>
