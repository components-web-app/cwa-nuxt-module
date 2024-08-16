<template>
  <ResourceModal
    v-if="localResourceData"
    v-model="localResourceData.title"
    title-placeholder="No Title"
    :is-loading="isLoading"
    border-color-class="cwa-border-b-green"
    @close="$emit('close')"
    @save="saveTitle"
  >
    <template v-if="!hideViewLink && !isAdding" #icons>
      <div>
        <NuxtLink :to="localResourceData['@id']">
          <CwaUiIconEyeIcon class="cwa-w-9" />
        </NuxtLink>
      </div>
    </template>
    <ResourceModalTabs :tabs="tabs">
      <template #details>
        <div class="cwa-flex cwa-flex-col cwa-space-y-2">
          <div>
            <ModalInput v-model="localResourceData.metaDescription" label="SEO Meta Description" />
          </div>
          <div>
            <ModalSelect v-model="localResourceData.page" label="Dynamic Page" :options="pageOptions" />
          </div>
          <div class="cwa-flex cwa-justify-end cwa-pt-2 cwa-space-x-2">
            <div>
              <CwaUiFormButton color="dark" :disabled="isUpdating" @click="saveResource(true)">
                {{ isAdding ? 'Add' : 'Save' }} & Close
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
      <template #routes>
        <RoutesTab v-if="resource && resource.hasOwnProperty('@id')" :page-resource="resource as CwaResource" />
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
import { computed, onMounted, ref, toRef, watch } from 'vue'
import ResourceModal from '#cwa/runtime/templates/components/core/admin/ResourceModal.vue'
import ResourceModalTabs, { type ResourceModalTab } from '#cwa/runtime/templates/components/core/admin/ResourceModalTabs.vue'
import ModalInfo from '#cwa/runtime/templates/components/core/admin/form/ModalInfo.vue'
import ModalInput from '#cwa/runtime/templates/components/core/admin/form/ModalInput.vue'
import { useItemPage } from '#cwa/layer/pages/_cwa/composables/useItemPage'
import type { SelectOption } from '#cwa/runtime/composables/cwa-select-input'
import { useCwa } from '#imports'
import ModalSelect from '#cwa/runtime/templates/components/core/admin/form/ModalSelect.vue'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import RoutesTab from '#cwa/runtime/templates/components/core/admin/RoutesTab.vue'

const emit = defineEmits<{
  close: [],
  reload: []
}>()
const props = defineProps<{ iri?: string, hideViewLink?: boolean, resourceType: string }>()

const $cwa = useCwa()
const iriRef = toRef(props, 'iri')
const { isAdding, isLoading, isUpdating, localResourceData, resource, formatDate, deleteResource, saveResource, saveTitle } = useItemPage({
  createEndpoint: '/_/pages',
  emit,
  resourceType: props.resourceType,
  defaultResource: {
  },
  endpoint: iriRef
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
      label: 'Routes',
      id: 'routes'
    })
    t.push({
      label: 'Info',
      id: 'info'
    })
  }
  return t
})

const pageOptions = computed<SelectOption[]>(() => {
  if (!dynamicPages.value) {
    return []
  }
  const options: SelectOption[] = []
  for (const page of dynamicPages.value) {
    options.push({
      label: page.reference,
      value: page['@id']
    })
  }
  return options
})

const currentRequestId = ref(0)
const dynamicPages = ref<CwaResource[]>()

async function loadDynamicPageOptions () {
  const thisRequestId = currentRequestId.value + 1
  currentRequestId.value = thisRequestId
  isLoading.value = true
  const { response } = $cwa.fetch({ path: '/_/pages?isTemplate=true', noQuery: true })
  const { _data: data } = await response
  if (thisRequestId === currentRequestId.value) {
    data && (dynamicPages.value = data['hydra:member'])
    isLoading.value = false
  }
  if (!dynamicPages.value?.length) {
    emit('close')
    return
  }

  if (isAdding.value && localResourceData.value && !localResourceData.value.layout) {
    localResourceData.value.layout = pageOptions.value[0].value
  }
}

watch(() => localResourceData.value?.isTemplate, (isTemplate: undefined|boolean, oldIsTemplate: undefined|boolean) => {
  !isAdding.value && isTemplate !== undefined && oldIsTemplate !== undefined && saveResource(false)
})

onMounted(() => {
  loadDynamicPageOptions()
})
</script>
