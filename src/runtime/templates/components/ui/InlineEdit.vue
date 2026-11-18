<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef } from 'vue'
import CwaUiRemoteChangeConflict from './RemoteChangeConflict.vue'
import { useFieldModel } from '../core/ui/field-context'
import { useCwa } from '#cwa/composables/cwa'
import { useCwaInlineEditor } from '#cwa/composables/cwa-inline-editor'
import { openBarStatus } from '#cwa/admin/inline-editors'
import type { ResourceModelField } from '#cwa/resources/model-editors'

const props = withDefaults(defineProps<{
  model: ResourceModelField<string>
  label: string
  placeholder?: string
  tag?: string
}>(), {
  placeholder: undefined,
  tag: 'span',
})

const emit = defineEmits<{ 'update:modelValue': [value: string | null | undefined] }>()

const { value } = useFieldModel<string>(props, emit)

const root = useTemplateRef<HTMLElement>('root')
const valueEl = useTemplateRef<HTMLElement>('valueEl')
const input = useTemplateRef<HTMLInputElement>('input')
const editing = ref(false)
const draft = ref('')

const text = computed(() => value.value ?? '')
const remoteChange = computed(() => props.model.remoteChange.value)
const $cwa = useCwa()
const failed = computed(() => props.model.state?.value.status === 'error')
const failedId = useId()
const invalid = computed(() => failed.value ? { 'aria-invalid': 'true' as const, 'aria-describedby': failedId } : {})

async function start() {
  if (editing.value) {
    input.value?.focus()
    return
  }
  draft.value = text.value
  editing.value = true
  await nextTick()
  const el = input.value
  if (!el) {
    return
  }
  el.focus({ preventScroll: true })
  el.setSelectionRange(el.value.length, el.value.length)
}

async function finish(refocus: boolean) {
  editing.value = false
  if (refocus) {
    await nextTick()
    valueEl.value?.focus({ preventScroll: true })
  }
}

function commit(refocus: boolean) {
  if (!editing.value) {
    return
  }
  const next = draft.value === '' ? null : draft.value
  if (next !== (value.value ?? null)) {
    value.value = next
  }
  finish(refocus)
}

let actedOnEscape = false

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault()
    commit(true)
  }
  else if (event.key === 'Escape') {
    actedOnEscape = true
    const toBar = failed.value
    finish(false).then(() => {
      const field = props.model.editorKey?.field
      if (toBar && field && openBarStatus($cwa, field)) {
        return
      }
      document.activeElement === document.body && valueEl.value?.focus({ preventScroll: true })
    })
  }
}

function onRootKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && actedOnEscape) {
    actedOnEscape = false
    event.stopPropagation()
  }
}

useCwaInlineEditor(props.model, root, { focus: start, label: props.label })
</script>

<template>
  <component
    :is="tag"
    ref="root"
    class="cwa:relative"
    v-bind="props.model.focusListeners"
    @keydown="onRootKeydown"
  >
    <input
      v-if="editing"
      ref="input"
      v-model="draft"
      type="text"
      :aria-label="label"
      :placeholder="placeholder"
      v-bind="invalid"
      class="cwa:m-0 cwa:w-full cwa:min-w-[4ch] cwa:appearance-none cwa:border-0 cwa:bg-transparent cwa:p-0 cwa:[font:inherit] cwa:[letter-spacing:inherit] cwa:text-inherit cwa:outline-1 cwa:outline-transparent cwa:focus:ring-0 cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
      @keydown="onKeydown"
      @blur="commit(false)"
    >
    <span
      v-show="!editing"
      ref="valueEl"
      role="button"
      tabindex="0"
      data-testid="inline-edit-value"
      v-bind="invalid"
      :aria-label="`Edit ${label}: ${text || placeholder || 'empty'}`"
      class="cwa:cursor-text cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
      :class="{ 'cwa:opacity-60': !text }"
      @click="start"
      @keydown.enter.prevent="start"
      @keydown.space.prevent="start"
    >{{ text || placeholder }}</span>
    <span
      v-if="failed"
      :id="failedId"
      class="cwa:sr-only"
    >Not saved. Press Escape for Retry and Reset.</span>
    <CwaUiRemoteChangeConflict
      v-if="remoteChange"
      :change="remoteChange"
      class="cwa:mt-1"
    />
  </component>
</template>
