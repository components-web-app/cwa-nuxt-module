<template>
  <ResourceModal v-if="localResourceData" v-model="localResourceData.reference" :is-loading="isLoading" @close="$emit('close')" @save="saveTitle">
    <ResourceModalTabs :tabs="tabs">
      <template #details>
        <div class="cwa-flex cwa-flex-col cwa-space-y-2">
          <div>
            <ModalSelect v-model="localResourceData.uiComponent" label="Layout UI" :options="layoutComponentOptions" />
          </div>
          <div v-if="layoutStyleOptions.length">
            <ModalSelect v-model="localResourceData.uiClassNames" label="Style" :options="layoutStyleOptions" />
          </div>
          <div class="cwa-flex cwa-justify-end cwa-pt-2 cwa-space-x-2">
            <div>
              <CwaUiFormButton color="dark" :disabled="isUpdating" @click="saveResource(!isAdding)">
                {{ isAdding ? 'Add Now' : 'Save & Close' }}
              </CwaUiFormButton>
            </div>
            <div>
              <CwaUiFormButton color="blue" :disabled="isUpdating" @click="() => saveResource(isAdding)">
                {{ isAdding ? 'Add & Close' : 'Save' }}
              </CwaUiFormButton>
            </div>
          </div>
        </div>
      </template>
      <template #info>
        <div class="cwa-flex cwa-flex-col cwa-space-y-2">
          <div>
            <ModalInfo label="Created" :content="formatDate(localResourceData.createdAt)" />
          </div>
          <div>
            <ModalInfo label="Updated" :content="formatDate(localResourceData.updatedAt)" />
          </div>
          <div>
            <ModalInfo label="ID" :content="localResourceData['@id']" />
          </div>
          <div class="cwa-flex cwa-justify-start cwa-pt-6">
            <div>
              <CwaUiFormButton :disabled="isUpdating" @click="deleteResource">
                Delete
              </CwaUiFormButton>
            </div>
          </div>
        </div>
      </template>
    </ResourceModalTabs>
  </ResourceModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useItemPage } from '../composables/useItemPage'
import { type SelectOption, useCwa } from '#imports'
import ResourceModal from '#cwa/runtime/templates/components/core/admin/ResourceModal.vue'
import ResourceModalTabs, { type ResourceModalTab } from '#cwa/runtime/templates/components/core/admin/ResourceModalTabs.vue'
import ModalSelect from '#cwa/runtime/templates/components/core/admin/form/ModalSelect.vue'
import { componentNames } from '#components'
import ModalInfo from '#cwa/runtime/templates/components/core/admin/form/ModalInfo.vue'

const emit = defineEmits<{
  close: [],
  reload: []
}>()

const layoutComponentNames = computed(() => {
  return componentNames.filter(n => n.startsWith('CwaLayout'))
})

function cleanUiName (componentName: string) {
  return componentName.replace(/^CwaLayout/, '')
}

const layoutComponentOptions = computed(() => {
  const options = []
  for (const componentName of layoutComponentNames.value) {
    const cleanName = cleanUiName(componentName)
    options.push({
      label: $cwa.layoutsConfig?.[cleanName]?.name || cleanName,
      value: componentName
    })
  }
  return options
})

const layoutStyleOptions = computed(() => {
  if (!localResourceData.value?.uiComponent) {
    return []
  }
  const cleanName = cleanUiName(localResourceData.value?.uiComponent)
  const configuredClasses = $cwa.layoutsConfig?.[cleanName]?.classes
  if (!configuredClasses) {
    return []
  }
  const options: SelectOption[] = [
    {
      label: 'Default',
      value: null
    }
  ]
  for (const [label, value] of Object.entries(configuredClasses)) {
    options.push({
      label,
      value
    })
  }
  return options
})

const tabs = computed<ResourceModalTab[]>(() => {
  const t: ResourceModalTab[] = [
    {
      label: 'Details',
      id: 'details'
    }
  ]
  if (!isAdding.value) {
    t.push({
      label: 'Info',
      id: 'info'
    })
  }
  return t
})

const $cwa = useCwa()

const { isAdding, isLoading, isUpdating, localResourceData, formatDate, deleteResource, saveResource, saveTitle } = useItemPage({
  createEndpoint: '/_/layouts',
  emit,
  resourceType: 'Layout',
  defaultResource: {
    reference: null,
    uiComponent: layoutComponentOptions.value[0].value
  }
})
</script>
