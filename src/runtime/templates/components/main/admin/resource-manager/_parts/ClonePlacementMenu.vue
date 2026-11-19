<template>
  <CwaUiMenu
    v-model:open="menuOpen"
    :items="items"
    :label="title"
    :at="point"
    side="bottom"
    align="start"
    data-testid="clone-menu"
    @focus-outside="preventFocusOutside"
  >
    <template #header>
      <div class="cwa:border-b cwa:border-line cwa:px-3 cwa:pt-2 cwa:pb-2">
        <p
          data-testid="clone-menu-title"
          class="cwa:m-0 cwa:text-label cwa:text-fg"
        >
          {{ title }}
        </p>
        <p
          v-if="notes.length"
          data-testid="clone-notes"
          class="cwa:m-0 cwa:mt-0.5 cwa:text-helper cwa:text-fg-muted"
        >
          <template
            v-for="(note, index) of notes"
            :key="note.text"
          >
            <template v-if="index">
              ·
            </template>
            <span :data-testid="note.testId">{{ note.text }}</span>
          </template>
        </p>
      </div>
      <div
        v-if="loading"
        role="status"
        class="cwa:flex cwa:justify-center cwa:py-2"
      >
        <CwaUiSpinner />
        <span class="cwa:sr-only">Loading</span>
      </div>
      <p
        v-else-if="loadError"
        role="alert"
        class="cwa:m-0 cwa:px-3 cwa:py-2 cwa:text-danger-fg"
      >
        Could not load the available components
      </p>
    </template>
  </CwaUiMenu>
</template>

<script setup lang="ts">
import { resourcesConfig } from '#build/cwa-config'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import CwaUiMenu from '#cwa/templates/components/ui/Menu.vue'
import CwaUiSpinner from '#cwa/templates/components/ui/Spinner.vue'
import type { MenuItem } from '#cwa/templates/components/core/ui/menu-entries'
import { useCwa } from '#cwa/composables/cwa'
import { useNuxtApp } from '#imports'
import { excerptOf, useCloneMode } from '#cwa/admin/clone-mode'
import { cloneComponent, moveComponent } from '#cwa/admin/clone-component'
import { cloneAnchorIndex, cloneTargetOptions, distinctReasons } from '#cwa/admin/clone-target-options'
import type { CloneScope, CloneTargetOption } from '#cwa/admin/clone-target-options'
import type { ApiDocumentationComponentMetadataCollection } from '#cwa/api/api-documentation'

interface CloneStackItem {
  iri: string
  displayName?: string
  domElements?: Ref<HTMLElement[]>
}

const props = defineProps<{
  stack: CloneStackItem[]
  type: CloneScope
  point: { x: number, y: number }
}>()

const emit = defineEmits<{
  close: []
}>()

const scopeMessages: Record<CloneScope, string> = {
  layout: 'This is in the layout: it will appear on every page using it',
  page: 'This is in the page: it will not appear on other pages using the layout',
}

const confirmations: Record<CloneScope, { title: string, description: string, go: string }> = {
  layout: { title: 'Edit the shared layout?', description: 'It will appear on every page that uses this layout.', go: 'Edit layout' },
  page: { title: 'Edit the page?', description: 'It will appear on this page only, not on other pages using the layout.', go: 'Edit page' },
}

const $cwa = useCwa()
const vueApp = useNuxtApp().vueApp
const cloneMode = useCloneMode($cwa)
const { source } = cloneMode
const resourceStackManager = $cwa.admin.resourceStackManager

const menuOpen = ref(true)
const pending = shallowRef<CloneTargetOption>()
const placing = ref(false)
const loading = ref(true)
const loadError = ref(false)
const componentMetadata = shallowRef<ApiDocumentationComponentMetadataCollection>()

const result = computed(() => {
  if (!source.value || !componentMetadata.value) {
    return
  }
  return cloneTargetOptions({
    stack: props.stack,
    sourceIri: source.value.iri,
    sourceType: $cwa.resources.getResource(source.value.iri).value?.data?.['@type'],
    componentMetadata: componentMetadata.value,
    resources: $cwa.resources,
    isDataPage: $cwa.resources.isDataPage.value,
    isEditingLayout: resourceStackManager.isEditingLayout.value,
    type: props.type,
    move: source.value.move,
    resourcesConfig,
  })
})

const nothingAllowed = computed(() => !!result.value && result.value.options.every(option => option.disabled))

const nothingReasons = computed(() => {
  const reasons = result.value ? distinctReasons(result.value.options) : []
  return reasons.length ? reasons : ['A component cannot be added here']
})

const items = computed<MenuItem[]>(() => {
  if (loading.value || loadError.value || !result.value) {
    return []
  }
  if (nothingAllowed.value) {
    return [{ label: 'Nothing can be placed here', disabled: true, reasons: nothingReasons.value, reasonsLabel: 'Why nothing can be placed here', testId: 'clone-nothing' }]
  }
  return result.value.options.map(option => ({
    label: option.label,
    disabled: option.disabled,
    reasons: option.disabled ? option.reasons : undefined,
    reasonsLabel: `Why ${option.label} is unavailable`,
    testId: 'clone-option',
    onSelect: () => choose(option),
  }))
})

const anchorIndex = computed(() => cloneAnchorIndex(props.stack))

const anchorName = computed(() => {
  const index = anchorIndex.value
  if (index === undefined) {
    return
  }
  const position = props.stack[index]!
  const component = props.stack[index - 1]
  const excerpt = excerptOf(position.domElements?.value ?? component?.domElements?.value ?? [])
  return excerpt ? `“${excerpt}”` : component?.displayName
})

const title = computed(() => {
  const verb = source.value?.move ? 'Move' : 'Clone'
  return anchorName.value ? `${verb} next to ${anchorName.value}` : `${verb} Here`
})

const notes = computed(() => {
  const scope = result.value?.scope
  const list: { text: string, testId: string }[] = []
  if (scope) {
    list.push({ text: scope.switching ? scopeMessages[scope.type] : 'Shared layout: this appears on every page', testId: 'clone-scope' })
  }
  if (result.value?.leavesLayout) {
    list.push({ text: 'This takes it out of the layout: it will no longer appear on other pages', testId: 'move-leaves-layout' })
  }
  for (const option of result.value?.options ?? []) {
    option.warning && list.push({ text: option.warning, testId: 'clone-option-warning' })
  }
  return list
})

const targetElements = computed(() => {
  const index = anchorIndex.value ?? 0
  const own = props.stack[index]?.domElements?.value
  return own?.length ? own : (props.stack[index - 1]?.domElements?.value ?? [])
})

function preventFocusOutside(event: Event) {
  event.preventDefault()
}

async function confirmScope(scope: CloneScope) {
  const { confirmResourceAction } = await import('#cwa/admin/resource-confirm')
  return confirmResourceAction(vueApp, { ...confirmations[scope], keep: 'Cancel', tone: 'accent' })
}

async function choose(option: CloneTargetOption) {
  if (option.disabled || placing.value) {
    return
  }
  pending.value = option
  menuOpen.value = false
  const scope = result.value?.scope
  if (scope?.switching && !await confirmScope(scope.type)) {
    emit('close')
    return
  }
  await place()
}

async function place() {
  const option = pending.value
  const sourceIri = source.value?.iri
  const move = source.value?.move
  if (!option || !sourceIri || placing.value) {
    return
  }
  placing.value = true
  resourceStackManager.isEditingLayout.value = props.type === 'layout'
  try {
    await (move
      ? moveComponent($cwa, { sourceIri, move, target: option.value })
      : cloneComponent($cwa, { sourceIri, target: option.value }))
  }
  finally {
    emit('close')
  }
}

watch(menuOpen, (isOpen) => {
  !isOpen && !pending.value && emit('close')
})

watch(source, (current) => {
  !current && emit('close')
})

watch(targetElements, (elements) => {
  cloneMode.setTarget(elements.length ? elements : undefined)
}, { immediate: true })

onBeforeUnmount(() => {
  cloneMode.target.value === targetElements.value && cloneMode.setTarget()
})

onMounted(async () => {
  try {
    const metadata = await $cwa.getComponentMetadata(false, false)
    if (!metadata) {
      loadError.value = true
      return
    }
    componentMetadata.value = metadata
  }
  catch {
    loadError.value = true
  }
  finally {
    loading.value = false
  }
})
</script>
