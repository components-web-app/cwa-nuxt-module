<template>
  <DialogBox v-model="open" title="Add Component" :buttons="buttons">
    <Spinner v-if="loadingComponents" :show="true" />
    <template v-else-if="displayData">
      <div class="cwa-flex cwa-space-x-4">
        <div class="cwa-flex cwa-flex-col cwa-w-[30%] cwa-space-y-3 cwa-min-h-64">
          <button v-for="(component, name) of displayData.availableComponents" :key="`add-${name}`" class="w-full cwa-rounded-lg cwa-py-3 cwa-px-4 cwa-text-white cwa-bg-stone-700 cwa-opacity-70 hover:cwa-opacity-100 cwa-transition">
            {{ getComponentName(component) }}
          </button>
        </div>
        <div class="cwa-flex-grow">
          SELECTED ITEM HERE
        </div>
      </div>
    </template>
  </DialogBox>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DialogBox, { type ActionButton } from '#cwa/runtime/templates/components/core/DialogBox.vue'
import { useCwa } from '#imports'
import type { AddResourceEvent } from '#cwa/runtime/admin/resource-manager'
import type {
  ApiDocumentationComponentMetadataCollection
} from '#cwa/runtime/api/api-documentation'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import type { CwaResourceMeta } from '#cwa/module'

const $cwa = useCwa()
const loadingComponents = ref(true)

interface MergedComponentMetadata {
  apiMetadata: ApiDocumentationComponentMetadataCollection
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

const addResourceEvent = computed(() => $cwa.admin.resourceManager.addResourceEvent.value)

const open = computed({
  get () {
    return !!addResourceEvent.value
  },
  set (value: boolean) {
    if (!value) {
      $cwa.admin.resourceManager.clearAddResource()
    }
  }
})

const buttons = computed<ActionButton[]>(() => {
  return [
    {
      label: 'Add',
      color: 'blue',
      buttonClass: 'cwa-min-w-[120px]',
      callbackFn: handleAdd
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

async function createDisplayData (): Promise<undefined|DisplayDataI> {
  const event = addResourceEvent.value
  if (!event) {
    return
  }

  const allowedComponents = findAllowedComponents(event.closest.group)
  const availableComponents = await findAvailableComponents(allowedComponents)
  const enableDynamicPosition = !$cwa.admin.resourceManager.isEditingLayout.value && $cwa.resources.isDynamicPage.value

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
  open.value = false
}

// We do not want the modal content to disappear as soon as the add event is gone, so we populate and cache the data which determines the display
watch(open, async (isOpen: boolean) => {
  if (!isOpen) {
    return
  }
  displayData.value = await createDisplayData()
  loadingComponents.value = false
})
</script>
