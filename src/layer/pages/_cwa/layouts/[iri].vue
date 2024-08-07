<template>
  <ResourceModal v-model="title" @close="$emit('close')">
    <ResourceModalTabs :tabs="tabs">
      <template #details>
        <div class="cwa-flex cwa-flex-col cwa-space-y-4">
          <div>
            <ModalSelect v-model="layoutUiModel" label="UI Component" :options="layoutComponentOptions" />
          </div>
          <div>
            <ModalSelect v-model="sel2Value" label="UI Style Classes" :options="layoutStyleOptions" />
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
import { computed, ref } from 'vue'
import { useCwa } from '#imports'
import ResourceModal from '#cwa/runtime/templates/components/core/admin/ResourceModal.vue'
import ResourceModalTabs, { type ResourceModalTab } from '#cwa/runtime/templates/components/core/admin/ResourceModalTabs.vue'
import ModalSelect from '#cwa/runtime/templates/components/core/admin/form/ModalSelect.vue'
import { componentNames } from '#components'

const $cwa = useCwa()

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

const layoutComponentNames = computed(() => {
  return componentNames.filter(n => n.startsWith('CwaLayout'))
})

const layoutComponentOptions = computed(() => {
  const options = []
  for (const componentName of layoutComponentNames.value) {
    options.push({
      label: $cwa.layoutsConfig?.[componentName]?.name || componentName,
      value: componentName
    })
  }
  return options
})

const layoutStyleOptions = computed(() => {
  const configuredClasses = $cwa.layoutsConfig?.[layoutUiModel.value]?.classes
  if (!configuredClasses) {
    return []
  }
  const options = []
  for (const [label, value] of Object.entries(configuredClasses)) {
    options.push({
      label,
      value
    })
  }
  return options
})

const title = ref('My Layout Title')
const layoutUiModel = ref(layoutComponentOptions.value[0].value)
const sel2Value = ref(layoutStyleOptions.value[0].value)
</script>
