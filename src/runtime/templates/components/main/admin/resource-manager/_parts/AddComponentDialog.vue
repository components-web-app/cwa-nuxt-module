<template>
  <DialogBox
    v-model="open"
    title="Add Component"
    :buttons="buttons"
    :is-loading="dialogLoading"
  >
    <Spinner
      v-if="loadingComponents"
      :show="true"
    />
    <template v-else-if="displayData">
      <div class="cwa:flex cwa:gap-x-4">
        <div class="cwa:flex cwa:flex-col cwa:w-4/12 cwa:gap-y-3 cwa:min-h-64">
          <button
            v-for="(component, name) of displayData.displayAvailableComponents"
            :key="`add-${name}`"
            :class="buttonClass"
            :aria-selected="selectedComponent === name"
            @click="selectComponent(name as string)"
          >
            {{ getComponentName(component) }}
          </button>
          <div v-if="displayData.enableDynamicPosition">
            <button
              :class="buttonClass"
              class="cwa:border-yellow cwa:border-2 cwa:cursor-pointer"
              :aria-selected="selectedComponent === 'ComponentPosition'"
              @click="selectComponent('ComponentPosition')"
            >
              Dynamic
            </button>
          </div>
        </div>
        <div class="cwa:grow cwa:w-8/12">
          <div
            class="cwa:mb-6 cwa:gap-y-4"
            v-html="resourceDescription"
          />
          <template v-if="selectedComponent === 'ComponentPosition'">
            <div class="cwa:flex cwa:flex-col cwa:gap-y-3">
              <ModalSelect
                :model-value="selectedDynamicType"
                label="Data type"
                :options="dynamicTypeOptions"
                @update:model-value="onDynamicTypeChange"
              />
              <ModalSelect
                v-if="selectedDynamicType"
                :model-value="selectedDynamicProperty"
                label="Field"
                :options="dynamicPropertyOptions"
                @update:model-value="val => selectedDynamicProperty = val"
              />
            </div>
          </template>
        </div>
      </div>
    </template>
  </DialogBox>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import DialogBox from '#cwa/templates/components/core/DialogBox.vue'
import type { ActionButton } from '#cwa/templates/components/core/DialogBox.vue'
import { useCwa } from '#imports'
import type { AddResourceEvent } from '#cwa/admin/resource-stack-manager'
import type {
  ApiDocumentationComponentMetadata,
} from '#cwa/api/api-documentation'
import Spinner from '#cwa/templates/components/utils/Spinner.vue'
import type { CwaResourceMeta } from '#cwa/types'
import {
  useDynamicPositionSelectOptions,
} from '#cwa/templates/components/main/admin/_common/useDynamicPositionSelectOptions'
import ModalSelect from '#cwa/templates/components/core/admin/form/ModalSelect.vue'
import { ResourceTypeFromIri } from '#cwa/resources/resource-utils'

interface MergedComponentMetadata {
  apiMetadata: ApiDocumentationComponentMetadata
  config: CwaResourceMeta
}

interface ComponentMetadataCollection {
  [key: string]: MergedComponentMetadata
}

interface DisplayDataI {
  event: AddResourceEvent
  availableComponents: ComponentMetadataCollection
  displayAvailableComponents: ComponentMetadataCollection
  enableDynamicPosition: boolean
}
const buttonClass = 'w-full cwa:rounded-lg cwa:py-3 cwa:px-4 cwa:text-white/70 cwa:bg-stone-800 cwa:hover:bg-stone-700 cwa:aria-selected:bg-stone-700 cwa:hover:text-white cwa:aria-selected:text-white cwa:transition cwa:border cwa:border-solid cwa:border-stone-700 cwa:hover:border-opacity-100 cwa:cursor-pointer'

const $cwa = useCwa()
const { getTypeOptions, getPropertyOptions } = useDynamicPositionSelectOptions($cwa)

const loadingComponents = ref(true)
// We want as a local variable for when we close the dialog and the add event is cleared immediately - so it doesn't flicker etc.
const displayData = ref<DisplayDataI>()
const selectedComponent = ref<string | undefined>()
const dialogLoading = ref(false)

const selectedDynamicType = ref<string | null>(null)
const selectedDynamicProperty = ref<string | null>(null)
const dynamicTypeOptions = ref<{ label: string, value: string }[]>([])
const dynamicPropertyOptions = ref<{ label: string, value: string }[]>([])

const addResourceEvent = computed(() => $cwa.resourcesManager.addResourceEvent.value)
const isInstantAddResourceSaved = computed(() => {
  return !!$cwa.resources.newResource.value?.data?._metadata.adding?.instantAdd
})

const open = computed({
  get() {
    // the event will not have a group in the stack if we are on a dynamic data page, but we may be adding a component pre-configured which will not require this dialog
    return !!addResourceEvent.value && !!addResourceEvent.value?.closest.group && (!$cwa.resources.newResource.value || isInstantAddResourceSaved.value)
  },
  set(value: boolean) {
    if (!value) {
      $cwa.resourcesManager.clearAddResource()
    }
  },
})

const instantAdd = computed(() => (!!selectedResourceMeta.value?.instantAdd))

const buttons = computed<ActionButton[]>(() => {
  return [
    {
      label: instantAdd.value ? 'Add Now' : 'Insert',
      color: 'blue',
      buttonClass: 'cwa:min-w-[120px]',
      callbackFn: handleAdd,
      disabled: !selectedComponent.value,
    },
    {
      label: 'Cancel',
      color: 'grey',
    },
  ]
})

function getComponentName(metadata: MergedComponentMetadata) {
  return metadata.config.name || metadata.apiMetadata.resourceName
}

function selectComponent(name?: string) {
  selectedComponent.value = name
}

async function findAvailableComponents(allowedComponents: undefined | string[], includePosition = false): Promise<ComponentMetadataCollection> {
  const apiComponents = await $cwa.getComponentMetadata(true, includePosition)
  if (!apiComponents) {
    throw new Error('Could not retrieve component metadata from the API')
  }

  const asEntries = Object.entries(apiComponents)
  const prefix = ResourceTypeFromIri.getPathPrefix()
  const normalizedAllowed = prefix
    ? allowedComponents?.map(iri => iri.startsWith(prefix) ? iri.slice(prefix.length) : iri)
    : allowedComponents
  const filteredAllowed = normalizedAllowed
    ? asEntries.filter(
        ([_, value]) => (normalizedAllowed.includes(value.endpoint)),
      )
    : asEntries
  // if no config, the front-end component does not exist to add
  const filteredHasResourceConfig = filteredAllowed.filter(([name]) => $cwa.resourcesConfig?.[name])
  const mapped = filteredHasResourceConfig.map(([name, apiMetadata]) => ([name, { apiMetadata, config: $cwa.resourcesConfig[name] }]))
  return Object.fromEntries(mapped)
}

const selectedResourceMeta = computed(() => {
  if (!selectedComponent.value) {
    return
  }
  return $cwa.resourcesConfig?.[selectedComponent.value]
})

const selectedResourceDescription = computed(() => {
  if (!selectedResourceMeta.value) {
    return
  }
  return selectedResourceMeta.value?.description
})

const resourceDescription = computed(() => {
  return selectedResourceDescription.value || (selectedComponent.value ? '<p>No Description</p>' : '<p>Please select a resource to add</p>')
})

const defaultComponentData = computed<{ [key: string]: any }>(() => {
  const defaultData = selectedResourceMeta.value?.defaultData || {}
  if (selectedComponent.value !== 'ComponentPosition') {
    return defaultData
  }
  return {
    ...defaultData,
    pageDataClass: selectedDynamicType.value ?? null,
    pageDataProperty: selectedDynamicProperty.value ?? null,
  }
})

async function createDisplayData(): Promise<undefined | DisplayDataI> {
  const event = addResourceEvent.value
  if (!event) {
    return
  }

  const allowedComponents = event.closest.group ? findAllowedComponents(event.closest.group) : undefined
  const enableDynamicPosition = !$cwa.admin.resourceStackManager.isEditingLayout.value && $cwa.resources.isDynamicPage.value
  const availableComponents = await findAvailableComponents(allowedComponents, enableDynamicPosition)
  const displayAvailableComponents = { ...availableComponents }
  delete displayAvailableComponents.ComponentPosition

  return {
    event,
    availableComponents,
    enableDynamicPosition,
    displayAvailableComponents,
  }
}

function findAllowedComponents(groupIri: string): undefined | string[] {
  return $cwa.resources.getResource(groupIri).value?.data?.allowedComponents
}

function handleAdd() {
  if (!selectedComponent.value) {
    return
  }
  const meta = displayData.value?.availableComponents[selectedComponent.value]
  if (!meta) {
    return
  }
  $cwa.resourcesManager.setAddResourceEventResource(selectedComponent.value, meta.apiMetadata.endpoint, meta.apiMetadata.isPublishable, instantAdd.value, defaultComponentData.value)
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
  const allowedComponents = groupIri ? findAllowedComponents(groupIri) ?? null : null
  dynamicPropertyOptions.value = [{ label: 'Loading...', value: '' }]
  dynamicPropertyOptions.value = await getPropertyOptions(selectedDynamicType.value, allowedComponents) as { label: string, value: string }[]
}

function onDynamicTypeChange(value: string | null) {
  selectedDynamicType.value = value
  selectedDynamicProperty.value = null
  loadDynamicPropertyOptions()
}

onMounted(() => {
  loadDynamicTypeOptions()
})

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

// We do not want the modal content to disappear as soon as the add event is gone, so we populate and cache the data which determines the display
watch(open, async (isOpen: boolean) => {
  if (!isOpen) {
    return
  }
  selectComponent()
  displayData.value = await createDisplayData()
  loadingComponents.value = false
})
</script>
