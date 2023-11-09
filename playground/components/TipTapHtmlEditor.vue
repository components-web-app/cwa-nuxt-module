<template>
  <div v-if="editor">
    <bubble-menu
      class="bg-stone-700 text-stone-100 rounded overflow-hidden"
      :tippy-options="{ duration: 150, animation: 'fade' }"
      :editor="editor"
      :update-delay="0"
      @contextmenu.stop
    >
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleHeading', 'heading', { level: 1 })">
        H1
      </BubbleMenuButton>
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleHeading', 'heading', { level: 2 })">
        H2
      </BubbleMenuButton>
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleBold', 'bold')">
        Bold
      </BubbleMenuButton>
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleItalic', 'italic')">
        Italic
      </BubbleMenuButton>
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleStrike', 'strike')">
        Strike
      </BubbleMenuButton>
    </bubble-menu>

    <floating-menu
      class="floating-menu bg-stone-200 text-stone-700 rounded overflow-hidden"
      :tippy-options="{ duration: 150, animation: 'fade' }"
      :editor="editor"
      :update-delay="0"
      @contextmenu.stop
    >
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleHeading', 'heading', { level: 1 })">
        H1
      </BubbleMenuButton>
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleHeading', 'heading', { level: 2 })">
        H2
      </BubbleMenuButton>
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleBulletList', 'bulletList')">
        Bullet List
      </BubbleMenuButton>
    </floating-menu>
    <editor-content :editor="editor" />
  </div>
</template>

<script lang="ts" setup>
import { StarterKit } from '@tiptap/starter-kit'
import {
  BubbleMenu,
  useEditor,
  EditorContent,
  FloatingMenu
} from '@tiptap/vue-3'
import { computed, watch } from 'vue'
import type { UnionCommands } from '@tiptap/core/src/types'
import type { Editor } from '@tiptap/core'
import BubbleMenuButton from '~/components/TipTap/BubbleMenuButton.vue'

const props = defineProps<{
  modelValue: string|null
}>()

const emit = defineEmits(['update:modelValue'])

const value = computed({
  get () {
    return props.modelValue
  },
  set (value) {
    emit('update:modelValue', value)
  }
})

const buttonBubbleMenuProps = computed(() => (call: UnionCommands, isActiveName: string, attributes?: {}) => {
  return {
    editor: editor.value as Editor,
    editorFn: {
      call,
      attributes
    },
    isActiveName
  }
})

const editor = useEditor({
  content: value.value,
  extensions: [
    StarterKit
  ],
  onUpdate: () => {
    // HTML
    value.value = editor.value?.getHTML() || ''

    // JSON
    // this.$emit('update:modelValue', this.editor.getJSON())
  }
})

watch(value, (newValue) => {
  if (!editor.value) {
    return
  }
  // HTML
  const isSame = editor.value.getHTML() === newValue

  // JSON
  // const isSame = JSON.stringify(this.editor.getJSON()) === JSON.stringify(value)
  if (isSame) {
    return
  }

  editor.value.commands.setContent(newValue, false)
}, {
  immediate: true
})
</script>
