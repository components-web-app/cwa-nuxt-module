<template>
  <ResourceModal v-model="title" @close="$emit('close')">
    <ResourceModalTabs :tabs="tabs">
      <template #details>
        <div>
          <div>
            Content
          </div>
          <div class="cwa-flex cwa-justify-end cwa-mt-6">
            <div>
              <CwaUiFormButton color="blue">
                Save
              </CwaUiFormButton>
            </div>
          </div>
        </div>
      </template>
    </ResourceModalTabs>
  </ResourceModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ResourceModal from '#cwa/runtime/templates/components/core/admin/ResourceModal.vue'
import ResourceModalTabs, { type ResourceModalTab } from '#cwa/runtime/templates/components/core/admin/ResourceModalTabs.vue'
const title = ref('My Layout Title')
defineEmits(['close'])

const tabs: ResourceModalTab[] = [
  {
    label: 'Details',
    id: 'details'
  },
  {
    label: 'Info',
    id: 'info'
  }
]
</script>
