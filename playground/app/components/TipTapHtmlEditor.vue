<template>
  <CwaUiFieldPresence
    v-if="editor"
    :model="model"
    v-bind="focusListeners"
  >
    <bubble-menu
      class="bg-stone-700 text-stone-100 rounded overflow-hidden text-sm"
      style="z-index: 760"
      :append-to="appendToBody"
      :options="{ strategy: 'fixed' }"
      :editor="editor"
      :update-delay="0"
      @mousedown.prevent
      @contextmenu.stop
    >
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleHeading', 'heading', [{ level: 1 }])">
        H1
      </BubbleMenuButton>
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleHeading', 'heading', [{ level: 2 }])">
        H2
      </BubbleMenuButton>
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleBold', 'bold')">
        Bold
      </BubbleMenuButton>
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleItalic', 'italic')">
        Italic
      </BubbleMenuButton>
      <button
        class="px-1.5 py-1 content-center items-center"
        :class="[editor.isActive('link') ? 'bg-black text-white' : null]"
        @click="showLinkManager"
      >
        Link
      </button>
    </bubble-menu>

    <floating-menu
      class="floating-menu bg-stone-200 text-stone-700 rounded overflow-hidden"
      style="z-index: 760"
      :append-to="appendToBody"
      :options="{ strategy: 'fixed' }"
      :editor="editor"
      :update-delay="0"
      @mousedown.prevent
      @contextmenu.stop
    >
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleHeading', 'heading', [{ level: 1 }])">
        H1
      </BubbleMenuButton>
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleHeading', 'heading', [{ level: 2 }])">
        H2
      </BubbleMenuButton>
      <BubbleMenuButton v-bind="buttonBubbleMenuProps('toggleBulletList', 'bulletList')">
        Bullet List
      </BubbleMenuButton>
    </floating-menu>
    <editor-content :editor="editor" />
    <CwaUiRemoteChangeConflict
      v-if="remoteChange"
      :change="remoteChange"
      class="mt-2"
    />
  </CwaUiFieldPresence>
</template>

<script lang="ts" setup>
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Link } from '@tiptap/extension-link'
import {
  useEditor,
  EditorContent,
} from '@tiptap/vue-3'
import { BubbleMenu, FloatingMenu } from '@tiptap/vue-3/menus'
import { computed, reactive, toRef, watch } from 'vue'
import type { Editor, ChainedCommands } from '@tiptap/core'
import BubbleMenuButton from '~/components/TipTap/BubbleMenuButton.vue'
import { RemoteCursors, applyRemoteContent, setRemoteCursors } from '~/tiptap/co-editing'
import type { RemoteCursor } from '~/tiptap/co-editing'
import { useCwaRealtime } from '#imports'
import type { useCwaResourceModel } from '#imports'

const props = defineProps<{
  model: ReturnType<typeof useCwaResourceModel<string>>
  iri: string
  disabled?: boolean
  editorClasses?: string
}>()

// Render the menus at the top level so they escape the editor's stacking context and clear the CWA
// page overlay. `document` isn't available in the template expression scope, so define it here.
const appendToBody = () => document.body

const { model: html, remoteChange, focusedBy, focusListeners } = props.model

type Selection = { from: number, to: number } | null
const { send, on } = useCwaRealtime<{ selection: { selection: Selection } }>(() => props.iri)
const selections = reactive(new Map<string, RemoteCursor>())

on('selection', ({ data: { selection }, clientId, name, colour }) => {
  if (!selection) {
    selections.delete(clientId)
    return
  }
  selections.set(clientId, { id: clientId, name, colour, ...selection })
})

const inField = computed(() => focusedBy.value.flatMap(peer => peer.clientIds))

watch(inField, (now, before) => {
  before.filter(clientId => !now.includes(clientId)).forEach(clientId => selections.delete(clientId))
})

const cursors = computed(() => [...selections.values()].filter(({ id }) => inField.value.includes(id)))

function sendSelection(selection: Selection) {
  send('selection', { selection })
}

const editor = useEditor({
  content: html.value,
  editorProps: {
    attributes: {
      class: props.editorClasses || '',
    },
  },
  extensions: [
    StarterKit.configure({
      // TipTap v3 StarterKit includes Link by default — disable it here and
      // register it explicitly below so we can apply custom configuration.
      link: false,
    }),
    Placeholder.configure({
      placeholder: 'Write something …',
      emptyEditorClass: 'is-editor-empty text-inherit opacity-50',
    }),
    Link.configure({
      openOnClick: false,
      defaultProtocol: 'https',
    }),
    RemoteCursors,
  ],
  onUpdate: ({ editor }) => {
    html.value = editor.isEmpty ? null : editor.getHTML()
  },
  onSelectionUpdate: ({ editor }) => {
    editor.isFocused && sendSelection({ from: editor.state.selection.from, to: editor.state.selection.to })
  },
  onFocus: ({ editor }) => sendSelection({ from: editor.state.selection.from, to: editor.state.selection.to }),
  onBlur: () => sendSelection(null),
  editable: !props.disabled,
})

function showLinkManager() {
  if (!editor.value) return
  const previousUrl = editor.value.getAttributes('link').href
  const url = window.prompt('URL', previousUrl)

  // cancelled
  if (url === null) {
    return
  }

  // empty
  if (url === '') {
    editor.value
      .chain()
      .focus()
      .extendMarkRange('link')
      .unsetLink()
      .run()

    return
  }

  // update link
  editor.value
    .chain()
    .focus()
    .extendMarkRange('link')
    .setLink({ href: url })
    .run()
}

watch(html, (value) => {
  if (editor.value && editor.value.getHTML() !== value) {
    applyRemoteContent(editor.value, value)
  }
})

watch([cursors, editor], ([drawn, loaded]) => {
  loaded && setRemoteCursors(loaded, drawn)
})

// Toggle disabled prop and focus when enabled
const disabledRef = toRef(props, 'disabled')
watch(disabledRef, () => {
  if (!editor.value) {
    return
  }
  const editable = !disabledRef.value
  editor.value.setEditable(editable)
  if (editable) {
    editor.value.chain().focus(null, { scrollIntoView: false }).run()
  }
})

// Common menu item props
const buttonBubbleMenuProps = computed(() => (call: keyof ChainedCommands, isActiveName: string, editorArgs?: (string | number | object)[]) => {
  return {
    editor: editor.value as Editor,
    editorFn: {
      call,
      arguments: editorArgs,
    },
    isActiveName,
  }
})

defineExpose({
  editor,
})
</script>

<style>
.ProseMirror:focus {
  outline: none;
}
.ProseMirror {
  white-space: pre-wrap !important;
}
</style>
