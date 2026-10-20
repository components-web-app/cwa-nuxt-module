<template>
  <PopoverRoot v-model:open="menuOpen">
    <PopoverAnchor :reference="reference" />
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        align="start"
        :side-offset="4"
        :collision-padding="8"
        :aria-label="title"
        :avoid-collisions="true"
        data-testid="clone-menu"
        class="cwa:dark-blur cwa:z-context cwa:min-w-[220px] cwa:max-w-[300px] cwa:py-1 cwa:rounded-md cwa:shadow-lg cwa:text-light cwa:outline-none"
        @focus-outside.prevent
      >
        <p
          data-testid="clone-menu-title"
          class="cwa:px-5 cwa:pt-2 cwa:pb-1 cwa:text-sm cwa:font-bold cwa:text-white"
        >
          {{ title }}
        </p>
        <p
          v-if="notes.length"
          data-testid="clone-notes"
          class="cwa:px-5 cwa:pb-2 cwa:text-xs cwa:text-stone-400"
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
        <div class="cwa:border-t cwa:border-solid cwa:border-stone-600 cwa:pt-1">
          <div
            v-if="loading"
            class="cwa:flex cwa:justify-center cwa:py-2"
          >
            <Spinner :show="true" />
          </div>
          <p
            v-else-if="loadError"
            class="cwa:px-5 cwa:py-2 cwa:text-yellow"
          >
            Could not load the available components
          </p>
          <div
            v-else-if="nothingAllowed"
            :class="rowClass"
          >
            <button
              type="button"
              disabled
              data-testid="clone-nothing"
              :class="[optionClass, disabledOptionClass]"
            >
              Nothing can be placed here
            </button>
            <PopoverRoot>
              <PopoverTrigger
                aria-label="Why nothing can be placed here"
                :class="whyClass"
              >
                ?
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverContent
                  v-bind="reasonsPopover"
                  data-testid="clone-option-reasons"
                >
                  <ul>
                    <li
                      v-for="reason of nothingReasons"
                      :key="reason"
                    >
                      {{ reason }}
                    </li>
                  </ul>
                </PopoverContent>
              </PopoverPortal>
            </PopoverRoot>
          </div>
          <template v-else>
            <div
              v-for="option of result?.options"
              :key="option.label"
              :class="rowClass"
            >
              <button
                type="button"
                data-testid="clone-option"
                :disabled="option.disabled"
                :class="[optionClass, option.disabled ? disabledOptionClass : enabledOptionClass]"
                @click="choose(option)"
              >
                {{ option.label }}
              </button>
              <PopoverRoot v-if="option.disabled">
                <PopoverTrigger
                  :aria-label="`Why ${option.label} is unavailable`"
                  :class="whyClass"
                >
                  ?
                </PopoverTrigger>
                <PopoverPortal>
                  <PopoverContent
                    v-bind="reasonsPopover"
                    data-testid="clone-option-reasons"
                  >
                    <ul>
                      <li
                        v-for="reason of option.reasons"
                        :key="reason"
                      >
                        {{ reason }}
                      </li>
                    </ul>
                  </PopoverContent>
                </PopoverPortal>
              </PopoverRoot>
            </div>
          </template>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
  <DialogBox
    v-if="pending && result?.scope"
    v-model="confirmOpen"
    :title="confirmMessages[result.scope.type].title"
    :buttons="confirmButtons"
  >
    <p data-testid="clone-confirm-scope">
      {{ confirmMessages[result.scope.type].text }}
    </p>
  </DialogBox>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import DialogBox from '#cwa/templates/components/core/DialogBox.vue'
import type { ActionButton } from '#cwa/templates/components/core/DialogBox.vue'
import Spinner from '#cwa/templates/components/utils/Spinner.vue'
import { useCwa } from '#cwa/composables/cwa'
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

const confirmMessages: Record<CloneScope, { title: string, text: string, button: string }> = {
  layout: { title: 'Edit the shared layout?', text: 'It will appear on every page that uses this layout.', button: 'Edit layout' },
  page: { title: 'Edit the page?', text: 'It will appear on this page only, not on other pages using the layout.', button: 'Edit page' },
}

const rowClass = 'cwa:flex cwa:items-center cwa:gap-x-2 cwa:pr-3'
const optionClass = 'cwa:grow cwa:py-2 cwa:pl-5 cwa:text-left cwa:transition'
const enabledOptionClass = 'cwa:text-white cwa:hover:bg-dark cwa:cursor-pointer'
const disabledOptionClass = 'cwa:text-stone-400 cwa:cursor-not-allowed'
const whyClass = 'cwa:shrink-0 cwa:flex cwa:items-center cwa:justify-center cwa:size-5 cwa:rounded-full cwa:border cwa:border-solid cwa:border-stone-400 cwa:text-xs cwa:text-stone-300 cwa:cursor-pointer cwa:hover:text-white cwa:hover:border-white'
const reasonsPopover = {
  side: 'right',
  sideOffset: 6,
  collisionPadding: 8,
  class: 'cwa:z-context cwa:max-w-[260px] cwa:py-2 cwa:px-3 cwa:rounded-md cwa:bg-stone-900 cwa:shadow-lg cwa:text-xs cwa:text-light cwa:outline-none',
} as const

const $cwa = useCwa()
const cloneMode = useCloneMode($cwa)
const { source } = cloneMode
const resourceStackManager = $cwa.admin.resourceStackManager

const menuOpen = ref(true)
const confirmOpen = ref(true)
const pending = shallowRef<CloneTargetOption>()
const placing = ref(false)
const loading = ref(true)
const loadError = ref(false)
const componentMetadata = shallowRef<ApiDocumentationComponentMetadataCollection>()

const reference = {
  getBoundingClientRect: () => {
    const { x, y } = props.point
    return { x, y, top: y, left: x, right: x, bottom: y, width: 0, height: 0, toJSON: () => ({}) } as DOMRect
  },
}

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

const nothingAllowed = computed(() => !!result.value && result.value.options.every(option => option.disabled))

const nothingReasons = computed(() => {
  const reasons = result.value ? distinctReasons(result.value.options) : []
  return reasons.length ? reasons : ['A component cannot be added here']
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

const confirmButtons = computed<ActionButton[]>(() => {
  const scope = result.value?.scope
  return [
    { label: scope ? confirmMessages[scope.type].button : 'Ok', color: 'blue', callbackFn: () => place() },
    { label: 'Cancel', color: 'grey' },
  ]
})

function choose(option: CloneTargetOption) {
  if (option.disabled || placing.value) {
    return
  }
  pending.value = option
  menuOpen.value = false
  if (!result.value?.scope?.switching) {
    void place()
  }
}

async function place() {
  const option = pending.value
  const sourceIri = source.value?.iri
  const move = source.value?.move
  if (!option || !sourceIri || placing.value) {
    return
  }
  placing.value = true
  confirmOpen.value = false
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

watch(confirmOpen, (isOpen) => {
  !isOpen && !placing.value && emit('close')
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
