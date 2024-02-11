<template>
  <DialogBox v-model="open" title="Add Component" :buttons="buttons">
    <Spinner v-if="loadingComponents" :show="true" />
    <template v-else-if="displayData">
      <div class="cwa-flex cwa-space-x-4">
        <div class="cwa-flex cwa-flex-col cwa-w-4/12 cwa-space-y-3 cwa-min-h-64">
          <button
            v-for="(component, name) of displayData.availableComponents"
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
              class="cwa-border-yellow cwa-border-2"
              :aria-selected="selectedComponent === 'ComponentPosition'"
              @click="selectComponent('ComponentPosition')"
            >
              Dynamic
            </button>
          </div>
        </div>
        <div class="cwa-flex-grow cwa-w-8/12">
          <div class="cwa-mb-6 cwa-space-y-4" v-html="resourceDescription" />
          <template v-if="selectedComponent === 'ComponentPosition'">
            <p>[ADD INPUT FOR SELECTING THE COMPONENT DATA REFERENCE]</p>
          </template>
        </div>
      </div>
    </template>
  </DialogBox>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DialogBox, { type ActionButton } from '#cwa/runtime/templates/components/core/DialogBox.vue'
import { useCwa } from '#imports'
import type { AddResourceEvent } from '#cwa/runtime/admin/resource-stack-manager'
import type {
  ApiDocumentationComponentMetadata
} from '#cwa/runtime/api/api-documentation'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import type { CwaResourceMeta } from '#cwa/module'

const $cwa = useCwa()
const loadingComponents = ref(true)

const buttonClass = 'w-full cwa-rounded-lg cwa-py-3 cwa-px-4 cwa-text-white/70 cwa-bg-stone-800 hover:cwa-bg-stone-700 aria-selected:cwa-bg-stone-700 hover:cwa-text-white aria-selected:cwa-text-white cwa-transition cwa-border cwa-border-solid cwa-border-stone-700 cwa-border-opacity-50 hover:cwa-border-opacity-100 aria-selected:cwa-border-opacity-100'

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
  enableDynamicPosition: boolean
}

// We want as a local variable for when we close the dialog and the add event is cleared immediately - so it doesn't flicker etc.
const displayData = ref<DisplayDataI>()
const selectedComponent = ref<string|undefined>()

const addResourceEvent = computed(() => $cwa.admin.resourceStackManager.addResourceEvent.value)

const open = computed({
  get () {
    return !!addResourceEvent.value && !$cwa.resources.newResource.value
  },
  set (value: boolean) {
    if (!value) {
      $cwa.admin.resourceStackManager.clearAddResource()
    }
  }
})

const instantAdd = computed(() => (selectedComponent.value === 'position' || selectedResourceMeta.value?.instantAdd))

const buttons = computed<ActionButton[]>(() => {
  return [
    {
      label: instantAdd.value ? 'Add' : 'Insert',
      color: 'blue',
      buttonClass: 'cwa-min-w-[120px]',
      callbackFn: handleAdd,
      disabled: !selectedComponent.value
    },
    {
      label: 'Cancel',
      color: 'grey'
    }
  ]
})

function getComponentName (metadata: MergedComponentMetadata) {
  return metadata.config.name || metadata.apiMetadata.resourceName
}

function selectComponent (name?: string) {
  selectedComponent.value = name
}

async function findAvailableComponents (allowedComponents: undefined|string[]): Promise<ComponentMetadataCollection> {
  const apiComponents = await $cwa.getComponentMetadata()
  if (!apiComponents) {
    throw new Error('Could not retrieve component metadata from the API')
  }

  const asEntries = Object.entries(apiComponents)
  const filtered = allowedComponents
    ? asEntries.filter(
      ([_, value]) => (allowedComponents.includes(value.endpoint))
    )
    : asEntries
  const mapped = filtered.map(([name, apiMetadata]) => ([name, { apiMetadata, config: $cwa.resourcesConfig?.[name] }]))
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

async function createDisplayData (): Promise<undefined|DisplayDataI> {
  const event = addResourceEvent.value
  if (!event) {
    return
  }

  const allowedComponents = findAllowedComponents(event.closest.group)
  const availableComponents = await findAvailableComponents(allowedComponents)
  const enableDynamicPosition = !$cwa.admin.resourceStackManager.isEditingLayout.value && $cwa.resources.isDynamicPage.value

  return {
    event,
    availableComponents,
    enableDynamicPosition
  }
}

function findAllowedComponents (groupIri: string): undefined|string[] {
  return $cwa.resources.getResource(groupIri).value?.data?.allowedComponents
}

function handleAdd () {
  if (!selectedComponent.value) {
    return
  }
  const meta = displayData.value?.availableComponents[selectedComponent.value]
  if (!meta) {
    return
  }
  $cwa.admin.resourceStackManager.setAddResourceEventResource(selectedComponent.value, meta.apiMetadata.endpoint, meta.apiMetadata.isPublishable, instantAdd.value)
}

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
