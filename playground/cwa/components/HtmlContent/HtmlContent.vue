<template>
  <article class="prose prose-stone max-w-none min-h-[20px]">
    <TipTapHtmlEditor v-if="$cwa.admin.isEditing" ref="editorComponent" v-model="resourceModel.model.value" :disabled="disableEditor" />
    <div v-else ref="htmlContainer" v-html="htmlContent" />
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch, watchEffect } from 'vue'
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import { useCwaResource, useCwaResourceModel, useHtmlContent } from '#imports'
import TipTapHtmlEditor from '~/components/TipTapHtmlEditor.vue'

// Setup the resource
const props = defineProps<IriProp>()
const iriRef = toRef(props, 'iri')
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

// HTML Content composable, converting anchors to nuxt link and link enable/disable with editable status
const htmlContainer = ref<null|HTMLElement>(null)

const htmlContent = computed<string>(() => (resource.value.data?.html || '<div></div>'))
useHtmlContent(htmlContainer)

// This deals with the HTML editor
const resourceModel = useCwaResourceModel<string>(iriRef, 'html')
const editorComponent = ref<typeof TipTapHtmlEditor|undefined>()
const disableEditor = computed(() => !$cwa.admin.isEditing || $cwa.admin.componentManager.currentIri.value !== iriRef.value)

// instantly update focus when the UI sze changes
watch([disableEditor, resourceModel.model], async () => {
  await nextTick()
  manageable?.manager.updateFocusSize()
}, {
  flush: 'post'
})

// when the editor is enabled, focus it immediately
watchEffect(async () => {
  await nextTick()
  if (editorComponent.value && !disableEditor.value) {
    editorComponent.value.editor.chain().focus(null, { scrollIntoView: false }).run()
  }
})
</script>
