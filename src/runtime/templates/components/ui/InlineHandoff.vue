<script setup lang="ts">
import { computed, defineAsyncComponent, ref, useId, useTemplateRef } from 'vue'
import Field from '../core/ui/Field.vue'
import { useFieldModel } from '../core/ui/field-context'
import CwaUiButton from './Button.vue'
import { findInlineEditor, openInlineEditor } from '#cwa/admin/inline-editors'
import { useCwa } from '#cwa/composables/cwa'
import type { ResourceModelField } from '#cwa/resources/model-editors'

const CwaUiDialog = defineAsyncComponent(() => import('./Dialog.vue'))
const CwaUiTextarea = defineAsyncComponent(() => import('./Textarea.vue'))

const props = withDefaults(defineProps<{
  label: string
  info?: string
  editor?: string
  field?: string
  model?: ResourceModelField<string>
  modelValue?: string | null
}>(), {
  info: undefined,
  editor: undefined,
  field: undefined,
  model: undefined,
  modelValue: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: string | null | undefined] }>()

const $cwa = useCwa()
const { model, value, state } = useFieldModel<string>(props, emit)
const id = useId()
const labelId = useId()
const previewId = useId()
const editButton = useTemplateRef<{ $el: HTMLElement }>('editButton')
const dialogOpen = ref(false)

const key = computed(() => {
  const own = model.value?.editorKey
  return own && props.editor ? { iri: own.iri, field: props.editor } : own
})
const pageEditor = computed(() => findInlineEditor($cwa, key.value))

function plainText(html: string) {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ')
  }
  return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
}

const preview = computed(() => {
  const text = plainText(value.value ?? '').replace(/\s+/g, ' ').trim()
  return text ? `“${text}”` : 'Empty'
})

function edit() {
  const editor = pageEditor.value
  if (editor) {
    openInlineEditor(editor, editButton.value?.$el)
    return
  }
  dialogOpen.value = true
}

function closeDialog() {
  dialogOpen.value = false
  editButton.value?.$el?.focus()
}
</script>

<template>
  <Field
    :label="label"
    :info="info"
    :state="state"
    :model="model"
    :control-id="id"
    :name="field"
    own-label
  >
    <span class="cwa:flex cwa:min-w-0 cwa:items-center cwa:gap-2">
      <span
        :id="labelId"
        class="cwa:whitespace-nowrap cwa:text-label cwa:text-fg-muted"
      >{{ label }}</span>
      <span
        :id="previewId"
        data-testid="inline-handoff-preview"
        class="cwa:max-w-64 cwa:min-w-0 cwa:truncate cwa:text-control cwa:text-fg-muted"
      >{{ preview }}</span>
      <CwaUiButton
        :id="id"
        ref="editButton"
        size="sm"
        variant="soft"
        :label="pageEditor ? 'Edit on page' : 'Edit…'"
        :aria-describedby="`${labelId} ${previewId}`"
        data-testid="inline-handoff-edit"
        @click="edit"
      />
    </span>
  </Field>
  <CwaUiDialog
    v-if="dialogOpen"
    :title="label"
    @close="closeDialog"
  >
    <CwaUiTextarea
      v-if="model"
      :model="model"
      :label="label"
      label-hidden
    />
    <CwaUiTextarea
      v-else
      v-model="value"
      :label="label"
      label-hidden
    />
    <template #footer>
      <CwaUiButton
        label="Done"
        variant="solid"
        data-testid="inline-handoff-done"
        @click="closeDialog"
      />
    </template>
  </CwaUiDialog>
</template>
