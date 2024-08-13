<template>
  <ResourceModal
    v-if="localResourceData"
    v-model="localResourceData.reference"
    title-placeholder="No Reference"
    :is-loading="isLoading"
    @close="$emit('close')"
    @save="saveTitle"
  >
    <ResourceModalTabs :tabs="tabs">
      <template #details>
        <div class="cwa-flex cwa-flex-col cwa-space-y-2">
          <div>
            <ModalInput v-model="localResourceData.title" label="Page Title" />
          </div>
          <div class="cwa-flex cwa-justify-end cwa-pt-2 cwa-space-x-2">
            <div v-if="!isAdding">
              <CwaUiFormButton color="dark" :disabled="isUpdating" @click="saveResource(true)">
                Save & Close
              </CwaUiFormButton>
            </div>
            <div>
              <CwaUiFormButton color="blue" :disabled="isUpdating" @click="() => saveResource(false)">
                {{ isAdding ? 'Add Now' : 'Save' }}
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
import ResourceModal from '#cwa/runtime/templates/components/core/admin/ResourceModal.vue'
import ResourceModalTabs, { type ResourceModalTab } from '#cwa/runtime/templates/components/core/admin/ResourceModalTabs.vue'
import ModalInfo from '#cwa/runtime/templates/components/core/admin/form/ModalInfo.vue'
import ModalInput from '#cwa/runtime/templates/components/core/admin/form/ModalInput.vue'
import { useItemPage } from '#cwa/layer/pages/_cwa/composables/useItemPage'

const emit = defineEmits<{
  close: [],
  reload: []
}>()

const { isAdding, isLoading, isUpdating, localResourceData, formatDate, deleteResource, saveResource, saveTitle } = useItemPage({
  createEndpoint: '/_/pages',
  emit,
  resourceType: 'Page',
  defaultResource: {}
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
</script>
