import { computed, nextTick, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useCwaResourceModel, useCwa } from '#imports'
import type TipTapHtmlEditor from '~/components/TipTapHtmlEditor.vue'

export const useCustomHtmlComponent = (iriRef: Ref<string>) => {
  const $cwa = useCwa()
  const editorComponent = ref<typeof TipTapHtmlEditor | undefined>()

  const resourceModel = useCwaResourceModel<string>(iriRef, 'html')
  const disableEditor = computed(() => !$cwa.admin.isEditing || $cwa.admin.resourceStackManager.currentIri.value !== iriRef.value)

  // instantly update focus when the UI sze changes
  watch([disableEditor, resourceModel.model], async () => {
    await nextTick()
    $cwa.admin.resourceStackManager.redrawFocus()
  }, {
    flush: 'post',
  })

  return {
    editorComponent,
    resourceModel,
    disableEditor,
  }
}
