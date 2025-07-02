<template>
  <ResourceModal
    v-if="localResourceData"
    v-model="localResourceData.title"
    title-placeholder="No Title"
    :is-loading="isLoading"
    :border-color-class="resource?.route ? 'cwa:border-b-green': 'cwa:border-b-orange'"
    @close="$emit('close')"
    @save="saveTitle"
  >
    <template
      v-if="!hideViewLink && !isAdding"
      #icons
    >
      <div>
        <NuxtLink
          v-if="resource"
          :to="getInternalResourceLink(resource['@id'])"
        >
          <CwaUiIconEyeIcon class="cwa:w-9" />
        </NuxtLink>
      </div>
    </template>
    <ResourceModalTabs :tabs="tabs">
      <template #details>
        <div class="cwa:flex cwa:flex-col cwa:gap-y-2">
          <div>
            <ModalInput
              v-model="localResourceData.metaDescription"
              label="SEO Meta Description"
            />
          </div>
          <div>
            <ModalSelect
              v-model="localResourceData.page"
              label="Dynamic Page"
              :options="pageOptions"
            />
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
import { computed, onMounted, ref, toRef, watch, watchEffect } from 'vue'
import { navigateTo } from '#app'
import ResourceModal from '#cwa/runtime/templates/components/core/admin/ResourceModal.vue'
import ResourceModalTabs from '#cwa/runtime/templates/components/core/admin/ResourceModalTabs.vue'
import type { ResourceModalTab } from '#cwa/runtime/templates/components/core/admin/ResourceModalTabs.vue'
import ModalInfo from '#cwa/runtime/templates/components/core/admin/form/ModalInfo.vue'
import ModalInput from '#cwa/runtime/templates/components/core/admin/form/ModalInput.vue'
import { useItemPage } from '#cwa/layer/pages/_cwa/index/composables/useItemPage'
import type { SelectOption } from '#cwa/runtime/composables/cwa-select-input'
import ModalSelect from '#cwa/runtime/templates/components/core/admin/form/ModalSelect.vue'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import RoutesTab from '#cwa/runtime/templates/components/core/admin/RoutesTab.vue'
import { useDynamicPageLoader } from '#cwa/layer/pages/_cwa/index/composables/useDynamicPageLoader'
import { useDataList } from '#cwa/layer/pages/_cwa/index/composables/useDataList'
import { useCwa } from '#imports'

const $cwa = useCwa()

const emit = defineEmits<{
  close: []
  reload: []
}>()
const props = defineProps<{ iri?: string, hideViewLink?: boolean, resourceType: string }>()

const iriRef = toRef(props, 'iri')
const createEndpoint = ref('')
const { isAdding, isLoading, isUpdating, localResourceData, resource, formatDate, deleteResource, saveResource, saveTitle, loadResource, getInternalResourceLink } = useItemPage({
  createEndpoint,
  emit,
  resourceType: props.resourceType,
  defaultResource: {
  },
  endpoint: iriRef,
  routeHashAfterAdd: computed(() => ('#routes')),
})

const { dynamicPages, loadDynamicPageOptions } = useDynamicPageLoader()
const { fqcnToEntrypointKey } = useDataList()

const pageDataTypeNuxtLinkParams = computed(() => {
  // should do to the individual type when deleting the data from the admin pages, not just when the current page is page data loaded....
  // save the type from the resource and have it cached locally in the component before the resource is deleted
  const type = $cwa.resources.pageData?.value?.data?.['@type']
  if (!type) {
    return { name: '_cwa-data' }
  }
  return { name: '_cwa-data-type', params: { type: fqcnToEntrypointKey(type) } }
})

function handleDeleteClick() {
  deleteResource(undefined, async () => {
    await navigateTo(pageDataTypeNuxtLinkParams.value)
  })
}

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

const pageOptions = computed<SelectOption[]>(() => {
  if (!dynamicPages.value) {
    return []
  }
  const options: SelectOption[] = []
  for (const page of dynamicPages.value) {
    options.push({
      label: page.reference,
      value: page['@id'],
    })
  }
  return options
})

watch(() => localResourceData.value?.isTemplate, (isTemplate: undefined | boolean, oldIsTemplate: undefined | boolean) => {
  !isAdding.value && isTemplate !== undefined && oldIsTemplate !== undefined && saveResource(false)
})

watchEffect(async () => {
  const docs = await $cwa.getApiDocumentation()
  if (props.resourceType) {
    createEndpoint.value = docs?.entrypoint?.[fqcnToEntrypointKey(props.resourceType) || ''] || ''
  }
})

onMounted(async () => {
  await loadDynamicPageOptions()
  if (!dynamicPages.value?.length) {
    emit('close')
    return
  }
  if (isAdding.value && localResourceData.value && !localResourceData.value.page) {
    localResourceData.value.page = pageOptions.value[0].value
  }
})
</script>
