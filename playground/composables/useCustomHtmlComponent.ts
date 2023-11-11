import { computed, nextTick, ref, watch } from 'vue'
import type ManageableComponent from '#cwa/runtime/admin/manageable-component'
import type { Ref } from 'vue'
import { useCwaResourceModel, useCwa } from '#imports'
import TipTapHtmlEditor from '~/components/TipTapHtmlEditor.vue'

export const useCustomHtmlComponent = (iriRef: Ref<string>, manager: Ref<ManageableComponent|undefined>) => {
  const $cwa = useCwa()
  const editorComponent = ref<typeof TipTapHtmlEditor|undefined>()

  const resourceModel = useCwaResourceModel<string>(iriRef, 'html')
  const disableEditor = computed(() => !$cwa.admin.isEditing || $cwa.admin.componentManager.currentIri.value !== iriRef.value)

  // instantly update focus when the UI sze changes
  watch([disableEditor, resourceModel.model], async () => {
    await nextTick()
    manager.value?.updateFocusSize()
  }, {
    flush: 'post'
  })

  return {
    editorComponent,
    resourceModel,
    disableEditor
  }
}
