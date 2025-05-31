<template>
  <ResourceModal
    v-if="localResourceData"
    v-model="localResourceData.reference"
    title-placeholder="No Reference"
    :is-loading="isLoading"
    :border-color-class="localResourceData.isTemplate ? 'cwa:border-b-yellow' : 'cwa:border-b-blue-600'"
    @close="$emit('close')"
    @save="saveTitle"
  >
    <template #title>
      <PageTypeSelect v-model="localResourceData.isTemplate" />
    </template>
    <template
      v-if="!hideViewLink && !isAdding"
      #icons
    >
      <div>
        <NuxtLink :to="localResourceData['@id']">
          <CwaUiIconEyeIcon class="cwa:w-9" />
        </NuxtLink>
      </div>
    </template>
    <ResourceModalTabs :tabs="tabs">
      <template #details>
        <div class="cwa:flex cwa:flex-col cwa:gap-y-2">
          <div>
            <ModalInput
              v-model="localResourceData.title"
              label="SEO Page Title"
            />
          </div>
          <div>
            <ModalInput
              v-model="localResourceData.metaDescription"
              label="SEO Meta Description"
            />
          </div>
          <div>
            <ModalSelect
              v-model="localResourceData.layout"
              label="Layout"
              :options="layoutOptions"
            />
          </div>
          <div class="cwa:flex cwa:gap-x-2">
            <div class="cwa:grow">
              <ModalSelect
                v-model="localResourceData.uiComponent"
                label="Page UI"
                :options="pageComponentOptions"
              />
            </div>
            <div
              v-if="pageStyleOptions.length"
              class="cwa:w-1/2"
            >
              <ModalSelect
                v-model="localResourceData.uiClassNames"
                label="Style"
                :options="pageStyleOptions"
              />
            </div>
          </div>
          <div class="cwa:flex cwa:justify-end cwa:pt-2 cwa:gap-x-2">
            <div>
              <CwaUiFormButton
                color="dark"
                :disabled="isUpdating"
                @click="saveResource(true)"
              >
                {{ isAdding ? 'Add' : 'Save' }} & Close
              </CwaUiFormButton>
            </div>
            <div>
              <CwaUiFormButton
                color="blue"
                :disabled="isUpdating"
                @click="() => saveResource(false)"
              >
                {{ isAdding ? 'Add Now' : 'Save' }}
              </CwaUiFormButton>
            </div>
          </div>
        </div>
      </template>
      <template #routes>
        <RoutesTab
          v-if="resource && resource.hasOwnProperty('@id')"
          :page-resource="resource as CwaResource"
          @reload="loadResource"
        />
      </template>
      <template #info>
        <div class="cwa:flex cwa:flex-col cwa:gap-y-2">
          <div>
            <ModalInfo
              label="Created"
              :content="formatDate(localResourceData.createdAt)"
            />
          </div>
          <div>
            <ModalInfo
              label="Updated"
              :content="formatDate(localResourceData.updatedAt)"
            />
          </div>
          <div>
            <ModalInfo
              label="ID"
              :content="localResourceData['@id']"
            />
          </div>
          <div class="cwa:flex cwa:justify-start cwa:pt-6">
            <div>
              <CwaUiFormButton
                :disabled="isUpdating"
                @click="handleDeleteClick"
              >
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
import { computed, onMounted, ref, toRef, watch } from 'vue'
import ResourceModal from '#cwa/runtime/templates/components/core/admin/ResourceModal.vue'
import ResourceModalTabs, { type ResourceModalTab } from '#cwa/runtime/templates/components/core/admin/ResourceModalTabs.vue'
import ModalInfo from '#cwa/runtime/templates/components/core/admin/form/ModalInfo.vue'
import ModalInput from '#cwa/runtime/templates/components/core/admin/form/ModalInput.vue'
import { useItemPage } from '#cwa/layer/pages/_cwa/composables/useItemPage'
import { componentNames } from '#components'
import type { SelectOption } from '#cwa/runtime/composables/cwa-select-input'
import { useCwa } from '#imports'
import ModalSelect from '#cwa/runtime/templates/components/core/admin/form/ModalSelect.vue'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import PageTypeSelect from '#cwa/runtime/templates/components/core/admin/form/PageTypeSelect.vue'
import RoutesTab from '#cwa/runtime/templates/components/core/admin/RoutesTab.vue'

const emit = defineEmits<{
  close: []
  reload: []
}>()
const props = defineProps<{ iri?: string, hideViewLink?: boolean }>()

const $cwa = useCwa()
const pageComponentNames = computed(() => {
  return componentNames.filter(n => n.startsWith('CwaPage'))
})

function cleanUiName(componentName: string) {
  return componentName.replace(/^CwaPage/, '')
}

const pageComponentOptions = computed(() => {
  const options = []
  for (const componentName of pageComponentNames.value) {
    const cleanName = cleanUiName(componentName)
    options.push({
      label: $cwa.pagesConfig?.[cleanName]?.name || cleanName,
      value: cleanName,
    })
  }
  return options
})

const pageStyleOptions = computed(() => {
  if (!localResourceData.value?.uiComponent) {
    return []
  }
  const cleanName = cleanUiName(localResourceData.value?.uiComponent)
  const configuredClasses = $cwa.pagesConfig?.[cleanName]?.classes
  if (!configuredClasses) {
    return []
  }
  const options: SelectOption[] = [
    {
      label: 'Default',
      value: null,
    },
  ]
  for (const [label, value] of Object.entries(configuredClasses)) {
    options.push({
      label,
      value,
    })
  }
  return options
})

const layoutOptions = computed(() => {
  if (!layouts.value) {
    return []
  }
  const options: SelectOption[] = []
  for (const layout of layouts.value) {
    options.push({
      label: layout.reference,
      value: layout['@id'],
    })
  }
  return options
})

const { isAdding, isLoading, isUpdating, localResourceData, resource, formatDate, deleteResource, saveResource, saveTitle, loadResource } = useItemPage({
  createEndpoint: '/_/pages',
  emit,
  resourceType: 'Page',
  defaultResource: {
    isTemplate: false,
    uiComponent: pageComponentOptions.value[0].value,
  },
  endpoint: toRef(props, 'iri'),
  routeHashAfterAdd: computed(() => (localResourceData.value?.isTemplate ? '#data' : '#routes')),
})

const tabs = computed<ResourceModalTab[]>(() => {
  const t: ResourceModalTab[] = [
    {
      label: 'Details',
      id: 'details',
    },
  ]
  if (!isAdding.value) {
    t.push({
      label: 'Routes',
      id: 'routes',
    })
    t.push({
      label: 'Info',
      id: 'info',
    })
  }
  return t
})

const currentRequestId = ref(0)
const layouts = ref<CwaResource[]>()

function handleDeleteClick() {
  deleteResource()
}

async function loadLayoutOptions() {
  const thisRequestId = currentRequestId.value + 1
  currentRequestId.value = thisRequestId
  isLoading.value = true
  const { response } = $cwa.fetch({ path: '/_/layouts', noQuery: true })
  const { _data: data } = await response
  if (thisRequestId === currentRequestId.value) {
    data && (layouts.value = data['hydra:member'])
    isLoading.value = false
  }
  if (!layouts.value?.length) {
    emit('close')
    return
  }

  if (isAdding.value && localResourceData.value && !localResourceData.value.layout) {
    localResourceData.value.layout = layoutOptions.value[0].value
  }
}

watch(() => localResourceData.value?.isTemplate, (isTemplate: undefined | boolean, oldIsTemplate: undefined | boolean) => {
  !isAdding.value && isTemplate !== undefined && oldIsTemplate !== undefined && saveResource(false)
})

onMounted(() => {
  loadLayoutOptions()
})
</script>
