<template>
  <ResourceModal v-if="localResourceData" v-model="localResourceData.reference" :is-loading="isLoading" @close="$emit('close')" @save="saveResource">
    <ResourceModalTabs :tabs="tabs">
      <template #details>
        <div class="cwa-flex cwa-flex-col cwa-space-y-2">
          <div>
            <ModalSelect v-model="localResourceData.uiComponent" label="Layout UI" :options="layoutComponentOptions" />
          </div>
          <div v-if="layoutStyleOptions.length">
            <ModalSelect v-model="localResourceData.uiClassNames" label="Style" :options="layoutStyleOptions" />
          </div>
          <div class="cwa-flex cwa-justify-end cwa-pt-2">
            <div>
              <CwaUiFormButton color="blue" :disabled="isUpdating" @click="saveResource">
                Save
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
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { type SelectOption, useCwa } from '#imports'
import ResourceModal from '#cwa/runtime/templates/components/core/admin/ResourceModal.vue'
import ResourceModalTabs, { type ResourceModalTab } from '#cwa/runtime/templates/components/core/admin/ResourceModalTabs.vue'
import ModalSelect from '#cwa/runtime/templates/components/core/admin/form/ModalSelect.vue'
import { componentNames } from '#components'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import ModalInfo from '#cwa/runtime/templates/components/core/admin/form/ModalInfo.vue'

const route = useRoute()
const $cwa = useCwa()
const endpoint = Array.isArray(route.params.iri) ? route.params.iri[0] : route.params.iri
const isLoading = ref(true)
const isUpdating = ref(false)

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
  return $cwa.fetchResource({
    path: endpoint
  })
}

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
  if (!localResourceData.value?.uiComponent) {
    return []
  }
  const configuredClasses = $cwa.layoutsConfig?.[localResourceData.value?.uiComponent]?.classes
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

async function saveResource () {
  isUpdating.value = true
  await $cwa.resourcesManager.updateResource({
    endpoint,
    data: {
      reference: localResourceData.value?.reference,
      uiComponent: localResourceData.value?.uiComponent,
      uiClassNames: localResourceData.value?.uiClassNames
    }
  })
  isUpdating.value = false
}

function deleteResource () {

}

function formatDate (dateStr:string) {
  return dayjs(dateStr).format('DD/MM/YY @ HH:mm UTCZ')
}

const localResourceData = ref<CwaResource>()

watch(resource, (newResource) => {
  newResource && (localResourceData.value = newResource)
})

onMounted(async () => {
  await loadLayoutResource()
  if (!resource.value || resource.value['@type'] !== 'Layout') {
    emit('close')
    return
  }
  localResourceData.value = resource.value
  isLoading.value = false
})
</script>
