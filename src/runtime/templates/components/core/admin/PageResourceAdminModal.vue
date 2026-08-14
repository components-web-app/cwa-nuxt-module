<template>
  <ResourceModal
    v-if="localResourceData"
    v-model="titleModel"
    :title-placeholder="isDisplayingPage ? 'No Reference' : 'No Title'"
    :is-loading="isLoading"
    :border-color-class="borderColorClass"
    @close="$emit('close')"
    @save="saveTitle"
  >
    <template
      v-if="isDisplayingPage"
      #title
    >
      <PageTypeSelect v-model="localResourceData.isTemplate" />
    </template>
    <template
      v-if="!hideViewLink && !isAdding"
      #icons
    >
      <div>
        <NuxtLink :to="getInternalResourceLink(localResourceData['@id'])">
          <CwaUiIconEyeIcon class="cwa:w-9" />
        </NuxtLink>
      </div>
    </template>
    <template
      v-if="depthChain.length > 1"
      #subheader
    >
      <div class="cwa:flex cwa:gap-x-1 cwa:justify-center cwa:flex-wrap">
        <button
          v-for="option in depthChain"
          :key="String(option.value)"
          type="button"
          class="cwa:py-1 cwa:px-3 cwa:text-sm cwa:rounded cwa:transition cwa:cursor-pointer"
          :class="displayIri === option.value
            ? 'cwa:text-stone-100 cwa:bg-stone-700/80'
            : 'cwa:text-stone-400 cwa:hover:text-stone-300'"
          @click="displayIri = option.value as string"
        >
          {{ option.label }}
        </button>
      </div>
    </template>
    <ResourceModalTabs :tabs="tabs">
      <template #details>
        <div class="cwa:flex cwa:flex-col cwa:gap-y-2">
          <div class="cwa:flex cwa:flex-col cwa:gap-y-2 cwa:pb-2 cwa:border-b cwa:border-stone-500">
            <span class="cwa:text-xs cwa:text-stone-400 cwa:uppercase cwa:tracking-wide cwa:px-1">Parent page</span>
            <ModalRadioTabs
              v-model="parentType"
              :options="parentTypeOptions"
            />
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
          </div>
          <template v-if="isDisplayingPage">
            <div>
              <ModalInput
                v-model="localResourceData.title"
                label="SEO Page Title"
              />
            </div>
          </template>
          <div>
            <ModalInput
              v-model="localResourceData.metaDescription"
              label="SEO Meta Description"
            />
          </div>
          <template v-if="isDisplayingPage">
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
          </template>
          <template v-if="!isDisplayingPage">
            <div>
              <ModalSelect
                v-model="localResourceData.page"
                label="Dynamic Page"
                :options="pageOptions"
              />
            </div>
            <div class="cwa:flex cwa:items-center cwa:gap-x-1.5 cwa:text-xs">
              <CwaUiIconEyeIcon
                class="cwa:w-4 cwa:flex-none"
                :class="localResourceData?.page ? 'cwa:text-yellow' : 'cwa:text-stone-500'"
              />
              <button
                v-if="localResourceData?.page"
                type="button"
                class="cwa:cursor-pointer cwa:text-yellow cwa:transition cwa:hover:opacity-80"
                @click="goToTemplate"
              >
                Go to dynamic template
              </button>
              <span
                v-else
                class="cwa:text-stone-500"
              >No template selected</span>
            </div>
            <div v-if="pageDataConfig?.metaFields">
              <template
                v-for="field of pageDataConfig.metaFields"
                :key="`field-${field.field}`"
              >
                <ModalInput
                  v-if="field.type === 'input'"
                  v-model="localResourceData[field.field]"
                  :label="field.label"
                />
                <ModalSelect
                  v-else
                  v-model="localResourceData[field.field]"
                  :label="field.label"
                  :options="field.options || []"
                />
              </template>
            </div>
          </template>
          <div class="cwa:flex cwa:justify-end cwa:pt-2 cwa:gap-x-2">
            <div>
              <CwaUiFormButton
                color="dark"
                :disabled="isUpdating"
                @click="saveResource(true)"
              >
                Save &amp; Close
              </CwaUiFormButton>
            </div>
            <div>
              <CwaUiFormButton
                color="blue"
                :disabled="isUpdating"
                @click="() => saveResource(false)"
              >
                Save
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
import { computed, onMounted, ref, watch } from 'vue'
import { navigateTo, useCwa } from '#imports'
import { componentNames } from '#components'
import ResourceModal from '#cwa/templates/components/core/admin/ResourceModal.vue'
import ResourceModalTabs from '#cwa/templates/components/core/admin/ResourceModalTabs.vue'
import type { ResourceModalTab } from '#cwa/templates/components/core/admin/ResourceModalTabs.vue'
import ModalInfo from '#cwa/templates/components/core/admin/form/ModalInfo.vue'
import ModalInput from '#cwa/templates/components/core/admin/form/ModalInput.vue'
import ModalSelect from '#cwa/templates/components/core/admin/form/ModalSelect.vue'
import ModalRadioTabs from '#cwa/templates/components/core/admin/form/ModalRadioTabs.vue'
import PageTypeSelect from '#cwa/templates/components/core/admin/form/PageTypeSelect.vue'
import RoutesTab from '#cwa/templates/components/core/admin/RoutesTab.vue'
import type { SelectOption } from '#cwa/composables/cwa-select-input'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { useItemPage } from '#cwa-layer/pages/_cwa/index/composables/useItemPage'
import { useParentPageLoader } from '#cwa-layer/pages/_cwa/index/composables/useParentPageLoader'
import { useParentPageDataLoader } from '#cwa-layer/pages/_cwa/index/composables/useParentPageDataLoader'
import { useDynamicPageLoader } from '#cwa-layer/pages/_cwa/index/composables/useDynamicPageLoader'
import { useDataType } from '#cwa-layer/pages/_cwa/index/composables/useDataType'

const emit = defineEmits<{
  close: []
  reload: []
}>()
const props = defineProps<{ iri?: string, hideViewLink?: boolean, resourceType: string }>()

const $cwa = useCwa()
const { parentPages, loadParentPageOptions } = useParentPageLoader()
const { dataTypes, dataInstances, loadDataTypes, loadDataInstances, fqcnToEntrypointKey } = useParentPageDataLoader()
const { dynamicPages, loadDynamicPageOptions } = useDynamicPageLoader()

const displayIri = ref(props.iri)

const isDisplayingPage = computed(() => getResourceTypeFromIri(displayIri.value ?? '') === CwaResourceTypes.PAGE)

function getResourceData(iri: string) {
  return $cwa.resources.getResource(iri).value
}

const depthChain = computed(() => {
  const chain: SelectOption[] = []
  let iri: string | null | undefined = props.iri
  while (iri) {
    const res = getResourceData(iri)
    chain.unshift({
      label: res?.data?.reference || res?.data?.title || iri,
      value: iri,
    })
    iri = res?.data?.parentPage || res?.data?.parentPageData || null
  }
  return chain
})

const parentTypeOptions = [
  { label: 'None', value: null },
  { label: 'Page', value: 'page' },
  { label: 'Data', value: 'data' },
]

const selectedParentDataType = ref<string | null>(null)
const parentType = ref<string | null>(null)

function isDescendantOfCurrentPage(candidateIri: string): boolean {
  const allPages = parentPages.value ?? []
  const byId = Object.fromEntries(allPages.map(p => [p['@id'], p]))
  const visited = new Set<string>()
  let current: string | null | undefined = byId[candidateIri]?.parentPage
  while (current) {
    if (visited.has(current)) break
    visited.add(current)
    if (current === props.iri) return true
    current = byId[current]?.parentPage
  }
  return false
}

const parentPageOptions = computed<SelectOption[]>(() => {
  const options: SelectOption[] = [{ label: 'None', value: null }]
  for (const page of parentPages.value ?? []) {
    if (page['@id'] !== props.iri && !isDescendantOfCurrentPage(page['@id'])) {
      options.push({ label: page.reference, value: page['@id'] })
    }
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

const { isAdding, isLoading, isUpdating, localResourceData, resource, formatDate, deleteResource, saveResource: _saveResource, saveTitle: _saveTitle, loadResource, getInternalResourceLink } = useItemPage({
  createEndpoint: '/_/pages',
  emit,
  resourceType: props.resourceType,
  defaultResource: {},
  endpoint: displayIri,
  excludeFields: ['componentGroups'],
})

const titleModel = computed({
  get: () => isDisplayingPage.value ? localResourceData.value?.reference : localResourceData.value?.title,
  set: (val: string) => {
    if (!localResourceData.value) return
    if (isDisplayingPage.value) {
      localResourceData.value.reference = val
    }
    else {
      localResourceData.value.title = val
    }
  },
})

const borderColorClass = computed(() => {
  if (isDisplayingPage.value) {
    return localResourceData.value?.isTemplate ? 'cwa:border-b-yellow' : 'cwa:border-b-blue-600'
  }
  return resource.value?.route ? 'cwa:border-b-green' : 'cwa:border-b-orange'
})

function saveResource(close = false) {
  if (localResourceData.value) {
    if (parentType.value !== 'page') localResourceData.value.parentPage = null
    if (parentType.value !== 'data') localResourceData.value.parentPageData = null
  }
  return _saveResource(close)
}

function saveTitle() {
  if (isAdding.value) return
  return saveResource()
}

// Are we editing the settings of the page currently on screen? (rather than viewing this modal from
// an admin listing, where the route already takes care of where to go next)
const isDeletingDisplayedPage = computed(() => !!props.iri && props.iri === $cwa.resources.displayPageIri.value)

// Where to send the user once the page they are on no longer exists.
const adminListingLink = computed(() => {
  if (isDisplayingPage.value) {
    return { name: '_cwa-pages', query: { cwa_force: 'true' } }
  }
  const key = resource.value?.['@type'] ? fqcnToEntrypointKey(resource.value['@type']) : undefined
  return key
    ? { name: '_cwa-data-type', params: { type: key }, query: { cwa_force: 'true' } }
    : { name: '_cwa-data', query: { cwa_force: 'true' } }
})

function handleDeleteClick() {
  if (!isDeletingDisplayedPage.value) {
    return deleteResource()
  }
  // We must leave BEFORE the resource is removed from the store, otherwise the user is left on a
  // page that no longer exists. `requestCompleteFn` runs after the API request but before
  // `removeResource` — `saveCompleteFn` (which emits `reload`) runs after it, which is too late.
  const destination = adminListingLink.value
  return deleteResource(undefined, async () => {
    await navigateTo(destination)
  })
}

async function goToTemplate() {
  if (!localResourceData.value?.page) return
  emit('close')
  await navigateTo({
    ...getInternalResourceLink(localResourceData.value.page),
    query: { cwa_force: 'true' },
  })
  $cwa.admin.toggleEdit(false)
}

// Page-specific: layouts
const currentRequestId = ref(0)
const layouts = ref<CwaResource[]>()

async function loadLayoutOptions() {
  const thisRequestId = currentRequestId.value + 1
  currentRequestId.value = thisRequestId
  const { response } = $cwa.fetch({ path: '/_/layouts', noQuery: true })
  const { _data: data } = await response
  if (thisRequestId === currentRequestId.value) {
    data && (layouts.value = data['member'])
  }
}

const layoutOptions = computed(() => {
  if (!layouts.value) return []
  return layouts.value.map(layout => ({
    label: layout.reference,
    value: layout['@id'],
  }))
})

const pageComponentNames = computed(() => componentNames.filter(n => n.startsWith('CwaPage')))

function cleanUiName(componentName: string) {
  return componentName.replace(/^CwaPage/, '')
}

const pageComponentOptions = computed(() => {
  return pageComponentNames.value.map((componentName) => {
    const cleanName = cleanUiName(componentName)
    return {
      label: $cwa.pagesConfig?.[cleanName]?.name || cleanName,
      value: cleanName,
    }
  })
})

const pageStyleOptions = computed(() => {
  if (!localResourceData.value?.uiComponent) return []
  const cleanName = cleanUiName(localResourceData.value.uiComponent)
  const configuredClasses = $cwa.pagesConfig?.[cleanName]?.classes
  if (!configuredClasses) return []
  const options: SelectOption[] = [{ label: 'Default', value: null }]
  for (const [label, value] of Object.entries(configuredClasses)) {
    options.push({ label, value })
  }
  return options
})

// PageData-specific: dynamic pages and pageDataConfig
const pageOptions = computed<SelectOption[]>(() => {
  if (!dynamicPages.value) return []
  return dynamicPages.value.map(page => ({
    label: page.reference,
    value: page['@id'],
  }))
})

const { pageDataConfig } = useDataType(computed(() => resource.value?.['@type']))

const tabs = computed<ResourceModalTab[]>(() => {
  const t: ResourceModalTab[] = [{ label: 'Details', id: 'details' }]
  if (!isAdding.value) {
    t.push({ label: 'Routes', id: 'routes' })
    t.push({ label: 'Info', id: 'info' })
  }
  return t
})

watch(() => localResourceData.value?.isTemplate, (isTemplate, oldIsTemplate) => {
  if (!isDisplayingPage.value) return
  !isAdding.value && isTemplate !== undefined && oldIsTemplate !== undefined && saveResource(false)
})

watch(selectedParentDataType, (key, oldKey) => {
  if (oldKey && localResourceData.value) localResourceData.value.parentPageData = null
  if (key) loadDataInstances(key)
})

watch(localResourceData, (data, oldData) => {
  if (data?.parentPage) parentType.value = 'page'
  else if (data?.parentPageData) parentType.value = 'data'
  else parentType.value = null

  if (data && !oldData && data.parentPageData) {
    const pdResource = $cwa.resources.getResource(data.parentPageData).value
    const pdType = pdResource?.data?.['@type']
    if (pdType) {
      const key = fqcnToEntrypointKey(pdType)
      if (key) selectedParentDataType.value = key
    }
  }
}, { immediate: true })

onMounted(async () => {
  await Promise.all([loadLayoutOptions(), loadDynamicPageOptions(), loadParentPageOptions(), loadDataTypes()])
})
</script>
