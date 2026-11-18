<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import CwaUiRemoteChangeConflict from './RemoteChangeConflict.vue'
import { useFieldModel } from '../core/ui/field-context'
import { useCwaInlineEditor } from '#cwa/composables/cwa-inline-editor'
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

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commit(true)
  }
  else if (event.key === 'Escape') {
    finish(false).then(() => {
      document.activeElement === document.body && valueEl.value?.focus({ preventScroll: true })
    })
  }
}

function onRootKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
  }
}

useCwaInlineEditor(props.model, root, { focus: start })
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
      :aria-label="`Edit ${label}: ${text || placeholder || 'empty'}`"
      class="cwa:cursor-text cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
      :class="{ 'cwa:opacity-60': !text }"
      @click="start"
      @keydown.enter.prevent="start"
    >{{ text || placeholder }}</span>
    <CwaUiRemoteChangeConflict
      v-if="remoteChange"
      :change="remoteChange"
      class="cwa:mt-1"
    />
  </component>
</template>
