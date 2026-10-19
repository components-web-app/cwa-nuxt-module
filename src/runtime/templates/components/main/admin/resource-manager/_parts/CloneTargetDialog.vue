<template>
  <DialogBox
    v-model="open"
    :title="title"
    :buttons="buttons"
    :is-loading="adding"
  >
    <Spinner
      v-if="loading"
      :show="true"
    />
    <CwaUiAlertWarning v-else-if="loadError">
      Could not load the available components
    </CwaUiAlertWarning>
    <p
      v-else-if="confirming && result?.scope"
      data-testid="clone-confirm-scope"
    >
      {{ confirmMessages[result.scope.type].text }}
    </p>
    <template v-else-if="result">
      <p
        v-if="scopeNote"
        :class="['cwa:mb-4', scopeNote.className]"
        data-testid="clone-scope"
      >
        {{ scopeNote.text }}
      </p>
      <p
        v-if="result.leavesLayout"
        class="cwa:mb-4 cwa:text-yellow"
        data-testid="move-leaves-layout"
      >
        This takes it out of the layout: it will no longer appear on other pages
      </p>
      <p
        v-if="!result.options.length"
        data-testid="clone-no-options"
      >
        A component cannot be added here.
      </p>
      <ul
        v-if="shared.length"
        class="cwa:mb-4 cwa:text-sm cwa:text-stone-300"
        data-testid="clone-reasons"
      >
        <li
          v-for="reason of shared"
          :key="reason"
        >
          {{ reason }}
        </li>
      </ul>
      <div class="cwa:flex cwa:flex-col cwa:gap-y-3">
        <div
          v-for="option of result.options"
          :key="option.label"
        >
          <button
            type="button"
            :class="[buttonClass, option.disabled ? disabledButtonClass : enabledButtonClass]"
            :disabled="option.disabled || adding"
            data-testid="clone-option"
            @click="choose(option)"
          >
            {{ option.label }}
          </button>
          <p
            v-if="option.warning"
            class="cwa:mt-1 cwa:text-sm cwa:text-yellow"
            data-testid="clone-option-warning"
          >
            {{ option.warning }}
          </p>
          <ul
            v-if="ownReasons(option).length"
            class="cwa:mt-1 cwa:text-sm cwa:text-stone-400"
          >
            <li
              v-for="reason of ownReasons(option)"
              :key="reason"
            >
              {{ reason }}
            </li>
          </ul>
        </div>
      </div>
    </template>
  </DialogBox>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import DialogBox from '#cwa/templates/components/core/DialogBox.vue'
import type { ActionButton } from '#cwa/templates/components/core/DialogBox.vue'
import Spinner from '#cwa/templates/components/utils/Spinner.vue'
import { useCwa } from '#cwa/composables/cwa'
import { excerptOf, useCloneMode } from '#cwa/admin/clone-mode'
import { cloneComponent, moveComponent } from '#cwa/admin/clone-component'
import { cloneAnchorIndex, cloneTargetOptions, sharedReasons } from '#cwa/admin/clone-target-options'
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
}>()

const emit = defineEmits<{
  close: []
}>()

const scopeMessages: Record<CloneScope, string> = {
  layout: 'This is in the layout: it will appear on every page using it',
  page: 'This is in the page: it will not appear on other pages using the layout',
}

const confirmMessages: Record<CloneScope, { title: string, text: string, button: string }> = {
  layout: { title: 'Edit the shared layout?', text: 'It will appear on every page that uses this layout.', button: 'Edit layout' },
  page: { title: 'Edit the page?', text: 'It will appear on this page only, not on other pages using the layout.', button: 'Edit page' },
}

const buttonClass = 'cwa:w-full cwa:rounded-lg cwa:py-3 cwa:px-4 cwa:transition cwa:border cwa:border-solid'
const enabledButtonClass = 'cwa:text-white cwa:bg-stone-700 cwa:border-stone-400 cwa:hover:bg-stone-600 cwa:cursor-pointer'
const disabledButtonClass = 'cwa:text-stone-400 cwa:bg-transparent cwa:border-dashed cwa:border-stone-700 cwa:cursor-not-allowed'

const $cwa = useCwa()
const { source } = useCloneMode($cwa)
const resourceStackManager = $cwa.admin.resourceStackManager

const open = ref(true)
const loading = ref(true)
const loadError = ref(false)
const adding = ref(false)
const confirmed = ref(false)
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
    resourcesConfig: $cwa.resourcesConfig,
  })
})

const confirming = computed(() => {
  return !confirmed.value && !!result.value?.scope?.switching && result.value.options.some(option => !option.disabled)
})

const shared = computed(() => result.value ? sharedReasons(result.value.options) : [])

function ownReasons(option: CloneTargetOption) {
  return option.reasons.filter(reason => !shared.value.includes(reason))
}

const anchorName = computed(() => {
  const index = cloneAnchorIndex(props.stack)
  if (index === undefined) {
    return
  }
  const position = props.stack[index]!
  const component = props.stack[index - 1]
  const excerpt = excerptOf(position.domElements?.value ?? component?.domElements?.value ?? [])
  return excerpt ? `“${excerpt}”` : component?.displayName
})

const title = computed(() => {
  if (confirming.value && result.value?.scope) {
    return confirmMessages[result.value.scope.type].title
  }
  const verb = source.value?.move ? 'Move' : 'Clone'
  return anchorName.value ? `${verb} next to ${anchorName.value}` : `${verb} Here`
})

const buttons = computed<ActionButton[]>(() => {
  const cancel: ActionButton = { label: 'Cancel', color: 'grey' }
  if (!confirming.value || !result.value?.scope) {
    return [cancel]
  }
  return [
    { label: confirmMessages[result.value.scope.type].button, color: 'blue', callbackFn: () => (confirmed.value = true) },
    cancel,
  ]
})

const scopeNote = computed(() => {
  const scope = result.value?.scope
  if (!scope) {
    return
  }
  if (!scope.switching) {
    return { text: 'Shared layout: this appears on every page', className: 'cwa:text-stone-400' }
  }
  return { text: scopeMessages[scope.type], className: 'cwa:text-yellow' }
})

async function choose(option: CloneTargetOption) {
  const sourceIri = source.value?.iri
  const move = source.value?.move
  if (option.disabled || adding.value || !sourceIri) {
    return
  }
  adding.value = true
  resourceStackManager.isEditingLayout.value = props.type === 'layout'
  try {
    await (move
      ? moveComponent($cwa, { sourceIri, move, target: option.value })
      : cloneComponent($cwa, { sourceIri, target: option.value }))
  }
  finally {
    adding.value = false
    open.value = false
  }
}

watch(open, (isOpen) => {
  !isOpen && emit('close')
})

watch(source, (current) => {
  if (!current) {
    open.value = false
  }
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
