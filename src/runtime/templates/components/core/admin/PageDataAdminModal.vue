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
        <CwaLink
          v-if="resource"
          :to="getInternalResourceLink(resource['@id'])"
        >
          <CwaUiIconEyeIcon class="cwa:w-9" />
        </CwaLink>
      </div>
    </template>
    <div
      v-if="depthChain.length > 1"
      class="cwa:mb-4"
    >
      <ModalSelect
        v-model="displayIri"
        label="Viewing"
        :options="depthChain"
      />
    </div>
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
            <ModalRadioTabs
              v-model="parentType"
              :options="parentTypeOptions"
            />
          </div>
          <div v-if="parentType === 'page'">
            <ModalSelect
              v-model="localResourceData.parentPage"
              label="Parent Page"
              :options="parentPageOptions"
            />
          </div>
          <template v-if="parentType === 'data'">
            <div>
              <ModalSelect
                v-model="selectedParentDataType"
                label="Parent Data Type"
                :options="dataTypeOptions"
              />
            </div>
            <div v-if="selectedParentDataType">
              <ModalSelect
                v-model="localResourceData.parentPageData"
                label="Parent Data"
                :options="dataInstanceOptions"
              />
            </div>
          </template>
          <div>
            <ModalSelect
              v-model="localResourceData.page"
              label="Dynamic Page"
              :options="pageOptions"
            />
          </div>
          <div class="">
            <button
              type="button"
              class="cwa:flex cwa:gap-x-2 cwa:text-xs cwa:cursor-pointer cwa:disabled:opacity-50 cwa:disabled:cursor-not-allowed cwa:opacity-70 cwa:hover:opacity-100 cwa:transition"
              :disabled="!localResourceData?.page"
              @click="goToTemplate"
            >
              <CwaUiIconEyeIcon class="cwa:w-4" />
              <span>
                go to template page
              </span>
            </button>
          </div>
          <div v-if="pageDataConfig?.metaFields">
            <ModalSelect
              v-for="field of pageDataConfig.metaFields"
              :key="`field-${field.field}`"
              v-model="localResourceData[field.field]"
              :label="field.label"
              :options="field.options || []"
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
import { useDataType } from '#cwa-layer/pages/_cwa/index/composables/useDataType'
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import { navigateTo, useCwa } from '#imports'
import { useParentPageLoader } from '#cwa-layer/pages/_cwa/index/composables/useParentPageLoader'
import { useParentPageDataLoader } from '#cwa-layer/pages/_cwa/index/composables/useParentPageDataLoader'
import ResourceModal from '#cwa/templates/components/core/admin/ResourceModal.vue'
import ResourceModalTabs from '#cwa/templates/components/core/admin/ResourceModalTabs.vue'
import type { ResourceModalTab } from '#cwa/templates/components/core/admin/ResourceModalTabs.vue'
import ModalInfo from '#cwa/templates/components/core/admin/form/ModalInfo.vue'
import ModalInput from '#cwa/templates/components/core/admin/form/ModalInput.vue'
import { useItemPage } from '#cwa-layer/pages/_cwa/index/composables/useItemPage'
import type { SelectOption } from '#cwa/composables/cwa-select-input'
import ModalSelect from '#cwa/templates/components/core/admin/form/ModalSelect.vue'
import ModalRadioTabs from '#cwa/templates/components/core/admin/form/ModalRadioTabs.vue'
import type { CwaResource } from '#cwa/resources/resource-utils'
import RoutesTab from '#cwa/templates/components/core/admin/RoutesTab.vue'
import { useDynamicPageLoader } from '#cwa-layer/pages/_cwa/index/composables/useDynamicPageLoader'
import { useDataList } from '#cwa-layer/pages/_cwa/index/composables/useDataList'

const $cwa = useCwa()
const { parentPages, loadParentPageOptions } = useParentPageLoader()
const { dataTypes, dataInstances, loadDataTypes, loadDataInstances } = useParentPageDataLoader()

function getResourceData(iri: string) {
  return $cwa.resources.getResource(iri).value
}

const parentTypeOptions = [
  { label: 'None', value: null },
  { label: 'Page', value: 'page' },
  { label: 'Data', value: 'data' },
]

const selectedParentDataType = ref<string | null>(null)

const parentType = ref<string | null>(null)

const parentPageOptions = computed<SelectOption[]>(() => {
  const options: SelectOption[] = [{ label: 'None', value: null }]
  for (const page of parentPages.value ?? []) {
    options.push({ label: page.reference, value: page['@id'] })
  }
  return options
})

const dataTypeOptions = computed<SelectOption[]>(() => {
  const options: SelectOption[] = [{ label: 'Select type…', value: null }]
  for (const type of dataTypes.value ?? []) {
    const key = fqcnToEntrypointKey(type.resourceClass)
    if (key) {
      options.push({ label: type.resourceClass.split('\\').pop() ?? key, value: key })
    }
  }
  return options
})

const dataInstanceOptions = computed<SelectOption[]>(() => {
  const options: SelectOption[] = [{ label: 'Select…', value: null }]
  for (const instance of dataInstances.value ?? []) {
    options.push({ label: instance.title || instance['@id'], value: instance['@id'] })
  }
  return options
})

const emit = defineEmits<{
  close: []
  reload: []
}>()
const props = defineProps<{ iri?: string, hideViewLink?: boolean, resourceType: string }>()

const displayIri = ref(props.iri)

const depthChain = computed(() => {
  const chain: SelectOption[] = []
  let iri: string | null | undefined = props.iri
  while (iri) {
    const res = getResourceData(iri)
    chain.unshift({
      label: res?.data?.title || res?.data?.reference || iri,
      value: iri,
    })
    iri = res?.data?.parentPage || res?.data?.parentPageData || null
  }
  return chain
})

const createEndpoint = ref('')
const { isAdding, isLoading, isUpdating, localResourceData, resource, formatDate, deleteResource, saveResource, saveTitle, loadResource, getInternalResourceLink } = useItemPage({
  createEndpoint,
  emit,
  resourceType: props.resourceType,
  defaultResource: {
  },
  endpoint: displayIri,
  routeHashAfterAdd: computed(() => ('#routes')),
})

const { dynamicPages, loadDynamicPageOptions } = useDynamicPageLoader()
const { fqcnToEntrypointKey } = useDataList()
const { pageDataConfig } = useDataType(computed(() => resource.value?.['@type']))

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

async function goToTemplate() {
  if (!localResourceData.value?.page) {
    return
  }

  emit('close')
  await navigateTo({
    ...getInternalResourceLink(localResourceData.value.page),
    query: {
      cwa_force: 'true',
    },
  })
  $cwa.admin.toggleEdit(false)
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

watch(selectedParentDataType, (key) => {
  if (localResourceData.value) localResourceData.value.parentPageData = null
  if (key) loadDataInstances(key)
})

watch(localResourceData, (data) => {
  if (data?.parentPage) parentType.value = 'page'
  else if (data?.parentPageData) parentType.value = 'data'
  else parentType.value = null
}, { immediate: true })

watch(parentType, (value) => {
  if (!localResourceData.value) return
  if (value !== 'page') localResourceData.value.parentPage = null
  if (value !== 'data') {
    localResourceData.value.parentPageData = null
    selectedParentDataType.value = null
  }
})

onMounted(async () => {
  await Promise.all([loadParentPageOptions(), loadDynamicPageOptions(), loadDataTypes()])
  if (!dynamicPages.value?.length) {
    emit('close')
    return
  }
  if (isAdding.value && localResourceData.value && !localResourceData.value.page) {
    localResourceData.value.page = pageOptions.value[0]?.value
  }
  const pdIri = localResourceData.value?.parentPageData
  if (pdIri) {
    const pdResource = $cwa.resources.getResource(pdIri).value
    const pdType = pdResource?.data?.['@type']
    if (pdType) {
      const key = fqcnToEntrypointKey(pdType)
      if (key) {
        selectedParentDataType.value = key
        await loadDataInstances(key)
      }
    }
  }
})
</script>
