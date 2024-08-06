<template>
  <ResourceModal v-model="title" @close="$emit('close')">
    <ResourceModalTabs :tabs="tabs">
      <template #details>
        <div>
          <div>
            <ModalSelect v-model="sel1Value" :options="sel1Ops" />
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
import ModalSelect from '#cwa/runtime/templates/components/core/admin/form/ModalSelect.vue'

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

const sel1Ops = [
  {
    label: 'New - Old',
    value: { createdAt: 'desc' }
  },
  {
    label: 'Old - New',
    value: { createdAt: 'asc' }
  },
  {
    label: 'A - Z',
    value: { reference: 'asc' }
  },
  {
    label: 'Z - A',
    value: { reference: 'desc' }
  }
]

const title = ref('My Layout Title')
const sel1Value = ref(sel1Ops[0].value)
</script>
