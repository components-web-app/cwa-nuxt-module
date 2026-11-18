<script setup lang="ts">
import { computed, nextTick, ref, unref, useTemplateRef, watch } from 'vue'
import { consola as logger } from 'consola'
import { useCwa } from '#imports'
import { adminResources } from '#build/cwa-admin-resources'
import type { AddResourceEvent } from '#cwa/admin/resource-stack-manager'
import type { ApiDocumentationComponentMetadata } from '#cwa/api/api-documentation'
import type { CwaResourceMeta } from '#cwa/types'
import { CwaResourceTypes, getResourceTypeFromIri, ResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { excerptOf } from '#cwa/admin/clone-mode'
import { useDynamicPositionSelectOptions } from '#cwa/templates/components/main/admin/_common/useDynamicPositionSelectOptions'
import { isComponentAllowedInGroup } from '#cwa/templates/components/main/admin/resource-manager/_parts/available-components'
import { canInsertSelection } from '#cwa/templates/components/main/admin/resource-manager/_parts/add-component-selection'
import {
  addTargetPlace,
  groupDisplayName,
  buildAddComponentList,
  countComponentsInGroup,
  DYNAMIC_COMPONENT,
  hasMarkup,
  normaliseQuery,
  pageDataNoun,
  plainText,
} from '#cwa/templates/components/main/admin/resource-manager/_parts/add-component-list'
import type { AddComponentChoice } from '#cwa/templates/components/main/admin/resource-manager/_parts/add-component-list'
import CwaUiDialog from '#cwa/templates/components/ui/Dialog.vue'
import CwaUiSubView from '#cwa/templates/components/ui/SubView.vue'
import CwaUiCombobox from '#cwa/templates/components/ui/Combobox.vue'
import type { ComboboxSection } from '#cwa/templates/components/ui/Combobox.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import CwaUiSelect from '#cwa/templates/components/ui/Select.vue'
import CwaUiAlert from '#cwa/templates/components/ui/Alert.vue'
import AddComponentLead from '#cwa/templates/components/main/admin/resource-manager/_parts/AddComponentLead.vue'
import AddComponentUiChoices from '#cwa/templates/components/main/admin/resource-manager/_parts/AddComponentUiChoices.vue'

interface AvailableComponent {
  apiMetadata: ApiDocumentationComponentMetadata
  config: CwaResourceMeta
}

interface DisplayData {
  event: AddResourceEvent
  available: Record<string, AvailableComponent>
  choices: AddComponentChoice[]
  dynamic?: AddComponentChoice
  groupName: string
  place?: string
}

const warnedMarkup = new Set<string>()

const $cwa = useCwa()
const { getTypeOptions, getPropertyOptions } = useDynamicPositionSelectOptions($cwa)

const dialog = useTemplateRef<InstanceType<typeof CwaUiDialog>>('dialog')
const combobox = useTemplateRef<InstanceType<typeof CwaUiCombobox>>('combobox')
const loadingComponents = ref(true)
const loadError = ref(false)
const displayData = ref<DisplayData>()
const dialogLoading = ref(false)
const query = ref('')
const detailName = ref<string>()
const detailOpener = ref<HTMLElement | null>(null)
const activeChip = ref(0)

const uiComponent = ref<string | null>(null)
const uiClassNames = ref<string[]>([])
const selectedDynamicType = ref<string | null>(null)
const selectedDynamicProperty = ref<string | null>(null)
const dynamicTypeOptions = ref<{ label: string, value: string }[]>([])
const dynamicPropertyOptions = ref<{ label: string, value: string }[]>([])

const addResourceEvent = computed(() => $cwa.resourcesManager.addResourceEvent.value)
const isInstantAddResourceSaved = computed(() => {
  return !!$cwa.resources.newResource.value?.data?._metadata.adding?.instantAdd
})

const open = computed(() => {
  return !!addResourceEvent.value && !!addResourceEvent.value?.closest.group && (!$cwa.resources.newResource.value || isInstantAddResourceSaved.value)
})

function close() {
  $cwa.resourcesManager.clearAddResource()
}

const list = computed(() => displayData.value
  ? buildAddComponentList(displayData.value.choices, query.value, displayData.value.dynamic)
  : { quick: [], sections: [] })

const sections = computed<ComboboxSection[]>(() => list.value.sections.map(section => ({
  key: section.key,
  label: section.label,
  options: section.options.map(option => ({
    value: option.name,
    label: option.label,
    description: option.description,
    detail: option.count ? `${option.count} here` : undefined,
  })),
})))

const quickShown = computed(() => !normaliseQuery(query.value) && list.value.quick.length > 0)
const term = computed(() => normaliseQuery(query.value))

const noneText = computed(() => list.value.blocked
  ? `${list.value.blocked.label} isn't allowed in ${displayData.value?.groupName}`
  : `No component called ${term.value}`)

const detail = computed(() => {
  const name = detailName.value
  if (!name || !displayData.value) {
    return
  }
  if (name === DYNAMIC_COMPONENT) {
    return displayData.value.dynamic
  }
  return displayData.value.choices.find(choice => choice.name === name)
})

const isDynamic = computed(() => detailName.value === DYNAMIC_COMPONENT)
const detailConfig = computed(() => detailName.value ? displayData.value?.available[detailName.value]?.config : undefined)
const detailImage = computed(() => detailName.value && !isDynamic.value ? adminResources[detailName.value]?.image : undefined)
const instantAdd = computed(() => !!detailConfig.value?.instantAdd)

const ready = computed(() => canInsertSelection(detailName.value, selectedDynamicType.value, selectedDynamicProperty.value))
const addReason = computed(() => {
  if (!detailName.value) {
    return 'Choose a component first.'
  }
  return ready.value ? undefined : 'Choose a data type and a field first.'
})

const placeSuffix = computed(() => displayData.value?.place ? `, ${displayData.value.place}` : '')

const targetText = computed(() => {
  const data = displayData.value
  return data ? `${data.groupName}${data.place ? `, ${data.place}` : ''}` : ''
})

function anchorName(event: AddResourceEvent): string | undefined {
  const stack = $cwa.admin.resourceStackManager.resourceStack.value
  const index = stack.findIndex(item => item.iri === event.targetIri)
  if (index < 0) {
    return
  }
  const isComponent = (at: number) => stack[at] && getResourceTypeFromIri(stack[at].iri) === CwaResourceTypes.COMPONENT
  const at = isComponent(index) ? index : isComponent(index - 1) ? index - 1 : -1
  const item = stack[at]
  if (!item) {
    return
  }
  const excerpt = excerptOf(unref(item.domElements) ?? [])
  return excerpt ? `“${excerpt}”` : item.displayName
}

function describe(name: string, config: CwaResourceMeta) {
  if (!config.description) {
    return
  }
  if (import.meta.env.DEV && hasMarkup(config.description) && !warnedMarkup.has(name)) {
    warnedMarkup.add(name)
    logger.warn(`[CWA] cwa.resources.${name}.description contains HTML. Descriptions are plain text, so the tags are removed.`)
  }
  return plainText(config.description) || undefined
}

async function createDisplayData(event: AddResourceEvent): Promise<DisplayData> {
  const groupIri = event.closest.group
  const group = groupIri ? $cwa.resources.getResource(groupIri).value?.data : undefined
  const enableDynamicPosition = !$cwa.admin.resourceStackManager.isEditingLayout.value && $cwa.resources.isDynamicPage.value
  const apiComponents = await $cwa.getComponentMetadata(true, enableDynamicPosition)
  if (!apiComponents) {
    throw new Error('Could not retrieve component metadata from the API')
  }

  const prefix = ResourceTypeFromIri.getPathPrefix()
  const strip = (iri: string) => prefix && iri.startsWith(prefix) ? iri.slice(prefix.length) : iri
  const allowedComponents: string[] | undefined = group?.allowedComponents?.map(strip)

  const available: Record<string, AvailableComponent> = {}
  for (const [name, apiMetadata] of Object.entries(apiComponents)) {
    const config = $cwa.resourcesConfig?.[name]
    config && (available[name] = { apiMetadata, config })
  }

  const endpoints = Object.fromEntries(Object.entries(available).map(([name, { apiMetadata }]) => [name, apiMetadata.endpoint]))
  const positionComponents = (group?.componentPositions ?? []).map((positionIri: string) => {
    const component = $cwa.resources.getResource(positionIri).value?.data?.component
    return typeof component === 'string' ? strip(component) : undefined
  })
  const counts = countComponentsInGroup(positionComponents, endpoints)

  const choices = Object.entries(available)
    .filter(([name]) => name !== DYNAMIC_COMPONENT)
    .map(([name, { apiMetadata, config }]) => ({
      name,
      label: config.name || apiMetadata.resourceName,
      description: describe(name, config),
      group: adminResources[name]?.group,
      count: counts[name] ?? 0,
      allowed: isComponentAllowedInGroup(apiMetadata, allowedComponents),
    }))

  const position = available[DYNAMIC_COMPONENT]
  const noun = pageDataNoun($cwa.resources.pageData.value?.data?.['@type'])
  const dynamic = enableDynamicPosition && position && isComponentAllowedInGroup(position.apiMetadata, allowedComponents)
    ? { name: DYNAMIC_COMPONENT, label: 'Dynamic', description: `Changes per ${noun}: each ${noun} picks what shows here`, count: 0, allowed: true }
    : undefined

  const targetIsGroup = getResourceTypeFromIri(event.targetIri) === CwaResourceTypes.COMPONENT_GROUP
  return {
    event,
    available,
    choices,
    dynamic,
    groupName: groupDisplayName(group?.reference),
    place: addTargetPlace({
      targetIsGroup,
      addAfter: event.addAfter,
      groupHasPositions: !!group?.componentPositions?.length,
      anchor: targetIsGroup ? undefined : anchorName(event),
    }),
  }
}

function resetDetail() {
  uiComponent.value = null
  uiClassNames.value = []
  selectedDynamicType.value = null
  selectedDynamicProperty.value = null
  dynamicPropertyOptions.value = []
}

function openDetail(name: string, opener?: HTMLElement) {
  resetDetail()
  detailOpener.value = opener ?? null
  detailName.value = name
  if (name === DYNAMIC_COMPONENT && !dynamicTypeOptions.value.length) {
    loadDynamicTypeOptions()
  }
  const label = detail.value?.label
  label && dialog.value?.announce(`${label}. Adding to ${targetText.value}.`)
}

function back() {
  detailName.value = undefined
}

function dialogElement(testId: string) {
  return document.querySelector<HTMLElement>(`[data-testid="dialog"] [data-testid="${testId}"]`)
}

function initialFocus() {
  return isDynamic.value
    ? dialogElement('add-component-data-type')?.querySelector<HTMLElement>('[data-testid="select-trigger"]')
    : dialogElement('add-component-add')
}

function returnFocus() {
  return detailOpener.value?.isConnected ? detailOpener.value : dialogElement('combobox-input')
}

function chips() {
  return [...document.querySelectorAll<HTMLElement>('[data-testid="dialog"] [data-testid="add-component-chip"]')]
}

function focusChip(index: number) {
  activeChip.value = index
  nextTick(() => chips()[index]?.focus({ preventScroll: true }))
}

function onChipKeydown(event: KeyboardEvent, index: number) {
  const count = list.value.quick.length
  const moves: Record<string, number> = { ArrowRight: (index + 1) % count, ArrowLeft: (index - 1 + count) % count, Home: 0, End: count - 1 }
  if (event.key in moves) {
    event.preventDefault()
    focusChip(moves[event.key]!)
    return
  }
  if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
    event.preventDefault()
    combobox.value?.focus(true)
  }
}

function onAddClick() {
  if (addReason.value) {
    dialog.value?.announce(addReason.value)
    return
  }
  add()
}

function add() {
  const name = detailName.value
  const meta = name ? displayData.value?.available[name] : undefined
  if (!name || !meta) {
    return
  }
  const data: Record<string, any> = { ...(meta.config.defaultData || {}) }
  if (name === DYNAMIC_COMPONENT) {
    data.pageDataClass = selectedDynamicType.value ?? null
    data.pageDataProperty = selectedDynamicProperty.value ?? null
  }
  else {
    uiComponent.value && (data.uiComponent = uiComponent.value)
    uiClassNames.value.length && (data.uiClassNames = [...uiClassNames.value])
  }
  $cwa.resourcesManager.setAddResourceEventResource(name, meta.apiMetadata.endpoint, meta.apiMetadata.isPublishable, instantAdd.value, data)
}

async function loadDynamicTypeOptions() {
  dynamicTypeOptions.value = await getTypeOptions() as { label: string, value: string }[]
}

async function loadDynamicPropertyOptions() {
  if (!selectedDynamicType.value) {
    dynamicPropertyOptions.value = []
    return
  }
  const groupIri = displayData.value?.event.closest.group
  const allowedComponents = groupIri ? $cwa.resources.getResource(groupIri).value?.data?.allowedComponents ?? null : null
  dynamicPropertyOptions.value = []
  dynamicPropertyOptions.value = await getPropertyOptions(selectedDynamicType.value, allowedComponents) as { label: string, value: string }[]
}

function onDynamicTypeChange(value: string | null | undefined) {
  selectedDynamicType.value = value ?? null
  selectedDynamicProperty.value = null
  loadDynamicPropertyOptions()
}

watch(isInstantAddResourceSaved, async (newlySaved) => {
  if (!newlySaved) {
    return
  }
  dialogLoading.value = true
  try {
    const newResource = await $cwa.resourcesManager.addResourceAction()

    if (newResource) {
      await nextTick(() => {
        $cwa.admin.eventBus.emit('selectResource', newResource['@id'])
      })
    }
  }
  finally {
    $cwa.resourcesManager.clearAddResourceEventResource()
    dialogLoading.value = false
  }
})

watch(open, async (isOpen: boolean) => {
  if (!isOpen) {
    return
  }
  const event = addResourceEvent.value!
  query.value = ''
  detailName.value = undefined
  activeChip.value = 0
  resetDetail()
  loadingComponents.value = true
  loadError.value = false
  try {
    displayData.value = await createDisplayData(event)
  }
  catch (error) {
    displayData.value = undefined
    loadError.value = true
    logger.error('[CWA] Could not load the available components', error)
  }
  finally {
    loadingComponents.value = false
  }
  await nextTick()
  combobox.value?.focus()
}, { immediate: true })
</script>

<template>
  <CwaUiDialog
    v-if="open"
    ref="dialog"
    title="Add a component"
    flush
    :loading="loadingComponents || dialogLoading"
    @close="close"
  >
    <div
      v-if="loadError"
      class="cwa:p-6"
    >
      <CwaUiAlert
        tone="danger"
        title="Could not load the available components"
        data-testid="add-component-error"
      />
    </div>
    <CwaUiSubView
      v-else-if="displayData"
      :open="!!detail"
      :title="detail?.label"
      back-label="Components"
      :initial-focus="initialFocus"
      :return-focus="returnFocus"
      @back="back"
    >
      <template #main>
        <CwaUiCombobox
          ref="combobox"
          v-model:query="query"
          label="Search components"
          :sections="sections"
          :noun="['component', 'components']"
          :none-text="noneText"
          :up-leaves="quickShown"
          @choose="openDetail"
          @leave-top="focusChip(activeChip)"
        >
          <template #header>
            <p
              class="cwa:m-0 cwa:mb-3 cwa:text-fg-muted"
              data-testid="add-component-target"
            >
              To <b class="cwa:font-semibold cwa:text-fg">{{ displayData.groupName }}</b>{{ placeSuffix }}
            </p>
          </template>
          <template #before>
            <div
              v-if="quickShown"
              role="group"
              aria-labelledby="add-component-quick-heading"
              data-testid="add-component-quick"
              class="cwa:mx-3 cwa:px-4 cwa:pb-3 cwa:shadow-[inset_0_-1px_0_var(--cwa-color-line)] cwa:max-sm:mx-1"
            >
              <div
                id="add-component-quick-heading"
                class="cwa:pt-1 cwa:pb-2 cwa:text-helper cwa:text-fg-muted"
              >
                Already in this group
              </div>
              <div class="cwa:flex cwa:flex-wrap cwa:gap-2">
                <button
                  v-for="(chip, index) in list.quick"
                  :key="chip.name"
                  type="button"
                  :tabindex="index === activeChip ? 0 : -1"
                  :aria-describedby="`add-component-chip-${chip.name}`"
                  data-testid="add-component-chip"
                  :data-value="chip.name"
                  class="cwa:inline-flex cwa:h-control cwa:cursor-pointer cwa:items-center cwa:gap-2 cwa:bg-button cwa:ps-3 cwa:pe-3.5 cwa:text-label cwa:text-fg cwa:outline-none cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:hover:bg-field-hover cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:pointer-coarse:h-hit"
                  @click="openDetail(chip.name, $event.currentTarget as HTMLElement)"
                  @focus="activeChip = index"
                  @keydown="onChipKeydown($event, index)"
                >
                  <AddComponentLead
                    :name="chip.name"
                    chip
                  />
                  {{ chip.label }}
                  <span
                    :id="`add-component-chip-${chip.name}`"
                    class="cwa:sr-only"
                  >{{ chip.count }} here</span>
                </button>
              </div>
            </div>
          </template>
          <template #lead="{ option }">
            <AddComponentLead
              :name="option.value"
              :dynamic="option.value === DYNAMIC_COMPONENT"
            />
          </template>
          <template #empty>
            <div
              class="cwa:flex cwa:min-h-hit cwa:flex-wrap cwa:items-center cwa:gap-x-4 cwa:gap-y-1 cwa:px-4 cwa:py-2 cwa:text-fg-muted"
              data-testid="add-component-none"
            >
              <span v-if="list.blocked"><b class="cwa:font-medium cwa:text-fg">{{ list.blocked.label }}</b> isn't allowed in <b class="cwa:font-medium cwa:text-fg">{{ displayData.groupName }}</b></span>
              <span v-else>No component called <b class="cwa:font-medium cwa:text-fg">{{ term }}</b></span>
              <CwaUiButton
                label="Clear search"
                size="sm"
                data-testid="add-component-clear"
                @click="query = ''; combobox?.focus()"
              />
            </div>
          </template>
        </CwaUiCombobox>
      </template>
      <div
        v-if="detail"
        class="cwa:flex cwa:flex-col cwa:gap-4 cwa:px-6 cwa:pt-5 cwa:pb-6 cwa:max-sm:px-4"
        data-testid="add-component-detail"
      >
        <img
          v-if="detailImage"
          :src="detailImage"
          :alt="`Preview of ${detail.label}`"
          data-testid="add-component-image"
          class="cwa:block cwa:aspect-video cwa:w-full cwa:max-w-72 cwa:object-cover cwa:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--cwa-color-fg)_12%,transparent)]"
        >
        <p
          v-if="detail.description"
          class="cwa:m-0"
          data-testid="add-component-description"
        >
          {{ detail.description }}
        </p>
        <p
          class="cwa:m-0 cwa:text-fg-muted"
          data-testid="add-component-adding-to"
        >
          Adding to <b class="cwa:font-semibold cwa:text-fg">{{ displayData.groupName }}</b>{{ placeSuffix }}
        </p>
        <template v-if="isDynamic">
          <CwaUiSelect
            :model-value="selectedDynamicType"
            label="Data type"
            width="full"
            placeholder="Choose a data type"
            :options="dynamicTypeOptions"
            data-testid="add-component-data-type"
            @update:model-value="onDynamicTypeChange"
          />
          <CwaUiSelect
            v-model="selectedDynamicProperty"
            label="Field"
            width="full"
            placeholder="Choose a field"
            :options="dynamicPropertyOptions"
            :disabled="!selectedDynamicType"
            disabled-reason="Choose a data type first."
            description="The page data property that holds the component."
            data-testid="add-component-field"
          />
        </template>
        <AddComponentUiChoices
          v-else
          v-model:ui-component="uiComponent"
          v-model:ui-class-names="uiClassNames"
          :name="detail.name"
          :ui="(detailConfig?.ui ?? []) as string[]"
        />
      </div>
    </CwaUiSubView>
    <template #footer>
      <div class="cwa:grid cwa:grid-cols-2 cwa:gap-actions cwa:max-sm:w-full cwa:sm:flex">
        <CwaUiButton
          label="Cancel"
          data-testid="add-component-cancel"
          @click="dialog?.requestClose()"
        />
        <span
          class="cwa:contents"
          @click="onAddClick"
        >
          <CwaUiButton
            variant="solid"
            :label="instantAdd ? 'Add now' : 'Add'"
            :disabled="!!addReason"
            :disabled-reason="addReason"
            data-testid="add-component-add"
          />
        </span>
      </div>
    </template>
  </CwaUiDialog>
</template>
