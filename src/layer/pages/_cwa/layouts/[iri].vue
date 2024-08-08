<template>
  <ResourceModal v-model="referenceModel" @close="$emit('close')" @save="saveReference">
    <ResourceModalTabs :tabs="tabs">
      <template #details>
        <div class="cwa-flex cwa-flex-col cwa-space-y-2">
          <div>
            <ModalSelect v-model="layoutUiModel" label="Layout UI" :options="layoutComponentOptions" />
          </div>
          <div v-if="layoutStyleOptions.length">
            <ModalSelect v-model="styleClassModel" label="Style" :options="layoutStyleOptions" />
          </div>
          <div class="cwa-flex cwa-justify-end cwa-pt-2">
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
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useCwa } from '#imports'
import ResourceModal from '#cwa/runtime/templates/components/core/admin/ResourceModal.vue'
import ResourceModalTabs, { type ResourceModalTab } from '#cwa/runtime/templates/components/core/admin/ResourceModalTabs.vue'
import ModalSelect from '#cwa/runtime/templates/components/core/admin/form/ModalSelect.vue'
import { componentNames } from '#components'

const route = useRoute()
const $cwa = useCwa()
const endpoint = route.params.iri

const emit = defineEmits(['close'])

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

function loadLayoutResource () {
  return $cwa.fetcher.fetchResource({
    path: route.params.iri
  })
}

onMounted(async () => {
  await loadLayoutResource()
  if (!resource.value || resource.value['@type'] !== 'Layout') {
    emit('close')
  }
})

const resource = computed(() => $cwa.resources.getResource(endpoint).value?.data)

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
  const options = [
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

async function saveReference () {
  await $cwa.resourcesManager.updateResource({
    endpoint,
    data: {
      reference: referenceModel.value
    }
  })
}

const referenceModel = ref(resource.value?.reference)
const layoutUiModel = ref(resource.value?.uiComponent)
const styleClassModel = ref(layoutStyleOptions.value[0].value)
</script>
