<template>
  <article class="prose prose-stone max-w-none min-h-[20px]">
    <TipTapHtmlEditor v-if="showEditor" ref="editorComponent" v-model="resourceModel.model.value" class="html-content" />
    <div v-else ref="htmlContainer" class="html-content" v-html="htmlContent" />
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue'
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
const showEditor = computed(() => $cwa.admin.isEditing && $cwa.admin.componentManager.currentIri.value === iriRef.value)

const htmlContent = computed<string>(() => (resource.value.data?.html || '<div></div>'))
useHtmlContent(htmlContainer)

const resourceModel = useCwaResourceModel<string>(iriRef, 'html')

watch(editorComponent, async (newValue) => {
  await nextTick()
  if (!newValue) {
    return
  }
  newValue.editor.chain().focus('end').run()
}, {
  flush: 'post'
})

watch([showEditor, resourceModel.model], async () => {
  await nextTick()
  manageable?.manager.updateFocusSize()
}, {
  flush: 'post'
})
</script>
