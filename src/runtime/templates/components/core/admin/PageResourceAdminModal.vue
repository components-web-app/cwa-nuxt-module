<template>
  <CwaUiDialog
    v-if="localResourceData"
    ref="dialog"
    :title="dialogTitle"
    :tabs="tabs"
    :form="form"
    :loading="isLoading"
    noun="page"
    data-testid="page-dialog"
    @close="$emit('close')"
    @save="saveResource()"
    @update:tab="onTab"
  >
    <template
      v-if="!hideViewLink && !isAdding"
      #header-actions
    >
      <CwaUiButton
        variant="ghost"
        icon-only
        :icon="EyeGlyph"
        label="View page on site"
        data-testid="page-view-on-site"
        @click="viewOnSite"
      />
    </template>
    <template #details>
      <CwaUiFormSection v-if="depthChain.length > 1">
        <CwaUiSegmented
          v-model="displayIriModel"
          label="Editing"
          :options="depthOptions"
        />
      </CwaUiFormSection>
      <CwaUiFormSection>
        <CwaUiInput
          v-if="isDisplayingPage"
          field="reference"
          label="Reference"
          description="Only admins see this. It names the page in lists."
        />
        <CwaUiInput
          v-else
          field="title"
          label="Title"
        />
        <CwaUiSegmented
          v-if="isDisplayingPage"
          :model="pageTypeModel"
          label="Page type"
          :options="pageTypeOptions"
        />
      </CwaUiFormSection>
      <CwaUiFormSection
        v-if="isDisplayingPage"
        title="Appearance"
        :columns="2"
      >
        <CwaUiSelect
          field="layout"
          label="Layout"
          :options="layoutOptions"
        />
        <CwaUiSelect
          :model="pageUiModel"
          label="Page UI"
          :options="pageComponentOptions"
        />
        <CwaUiSelect
          v-if="pageStyleOptions.length"
          field="uiClassNames"
          label="Style"
          :options="pageStyleOptions"
          nullable
          none-label="Default"
        />
      </CwaUiFormSection>
      <CwaUiFormSection
        title="Search engines"
        description="What people see in search results."
      >
        <CwaUiInput
          v-if="isDisplayingPage"
          field="title"
          label="SEO page title"
          optional
        />
        <CwaUiTextarea
          field="metaDescription"
          label="SEO meta description"
          optional
          counter
        />
      </CwaUiFormSection>
      <CwaUiFormSection
        v-if="!isDisplayingPage"
        title="Template"
      >
        <CwaUiSelect
          field="page"
          label="Dynamic page"
          :options="pageOptions"
        />
        <div v-if="localResourceData.page">
          <CwaUiButton
            label="Go to dynamic template"
            data-testid="go-to-template"
            @click="goToTemplate"
          />
        </div>
        <template
          v-for="metaField of pageDataConfig?.metaFields ?? []"
          :key="`field-${metaField.field}`"
        >
          <CwaUiInput
            v-if="metaField.type === 'input'"
            :field="metaField.field"
            :label="metaField.label"
          />
          <CwaUiSelect
            v-else
            :field="metaField.field"
            :label="metaField.label"
            :options="metaFieldOptions(metaField.options)"
            nullable
          />
        </template>
      </CwaUiFormSection>
      <CwaUiFormSection title="Nesting">
        <CwaUiSegmented
          v-model="parentTypeModel"
          label="Nested under"
          :options="parentTypeOptions"
        />
        <CwaUiSelect
          v-if="parentType === 'page'"
          field="parentPage"
          label="Parent page"
          :options="parentPageOptions"
          nullable
        />
        <template v-if="parentType === 'data'">
          <CwaUiSelect
            v-model="selectedParentDataType"
            label="Parent data type"
            :options="dataTypeOptions"
          />
          <CwaUiSelect
            v-if="selectedParentDataType"
            field="parentPageData"
            label="Parent data"
            :options="dataInstanceOptions"
            nullable
          />
        </template>
        <CwaUiToggle
          field="isReachableWithoutRoute"
          label="Public without a route"
          :disabled="!!resource?.route"
          :description="resource?.route ? 'Has no effect while this page has a route.' : 'Visitors can reach it through a nested page, even when it has no route of its own. Any parent page must be live too.'"
        />
      </CwaUiFormSection>
    </template>
    <template #routes>
      <RoutesTab
        v-if="resource && resource.hasOwnProperty('@id')"
        :page-resource="resource as CwaResource"
        @reload="loadResource"
      />
    </template>
    <template #info>
      <CwaUiFormSection>
        <dl class="cwa:m-0">
          <dt class="cwa:text-label cwa:text-fg">
            ID
          </dt>
          <dd
            class="cwa:m-0 cwa:mt-1.5 cwa:break-all cwa:font-mono cwa:text-control cwa:text-fg-secondary"
            data-testid="page-id"
          >
            {{ localResourceData['@id'] }}
          </dd>
        </dl>
      </CwaUiFormSection>
      <CwaUiFormSection
        title="History"
        :columns="2"
      >
        <dl
          v-for="entry in history"
          :key="entry.label"
          class="cwa:m-0"
        >
          <dt class="cwa:text-label cwa:text-fg">
            {{ entry.label }}
          </dt>
          <dd class="cwa:m-0 cwa:mt-1.5 cwa:text-control cwa:text-fg-secondary">
            {{ entry.value }}
          </dd>
        </dl>
      </CwaUiFormSection>
      <CwaUiFormSection
        v-if="isDisplayedPage"
        title="Cache"
        description="Visitors may see a cached copy for a while after a change."
      >
        <PagePurgeCache />
      </CwaUiFormSection>
      <CwaUiFormSection
        title="Delete this page"
        :description="deleteSentence"
        data-testid="page-delete-section"
      >
        <div>
          <CwaUiButton
            tone="danger"
            :label="checkingDelete ? 'Checking' : 'Delete page'"
            :loading="checkingDelete || isUpdating"
            data-testid="page-delete"
            @click="handleDeleteClick"
          />
        </div>
      </CwaUiFormSection>
    </template>
  </CwaUiDialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { navigateTo, useCwa } from '#imports'
import { componentNames } from '#components'
import CwaUiDialog from '#cwa/templates/components/ui/Dialog.vue'
import CwaUiFormSection from '#cwa/templates/components/ui/FormSection.vue'
import CwaUiInput from '#cwa/templates/components/ui/Input.vue'
import CwaUiTextarea from '#cwa/templates/components/ui/Textarea.vue'
import CwaUiSelect from '#cwa/templates/components/ui/Select.vue'
import CwaUiSegmented from '#cwa/templates/components/ui/Segmented.vue'
import CwaUiToggle from '#cwa/templates/components/ui/Toggle.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import EyeGlyph from '#cwa/templates/components/ui/icon/EyeIcon.vue'
import RoutesTab from '#cwa/templates/components/core/admin/RoutesTab.vue'
import PagePurgeCache from '#cwa/templates/components/core/admin/PagePurgeCache.vue'
import type { MenuEntry } from '#cwa/templates/components/core/ui/menu-entries'
import type { DialogTab } from '#cwa/templates/components/core/ui/dialog-form'
import type { SelectOption } from '#cwa/composables/cwa-select-input'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { useCwaConfirm } from '#cwa/composables/cwa-confirm'
import { fetchTemplateCounts, pageDeleteConfirmLines, pageDeleteLines } from '#cwa/admin/page-delete'
import type { PageDeleteFacts } from '#cwa/admin/page-delete'
import { useItemPage } from '#cwa-layer/_composables/useItemPage'
import { useParentPageLoader } from '#cwa-layer/_composables/useParentPageLoader'
import { useParentPageDataLoader } from '#cwa-layer/_composables/useParentPageDataLoader'
import { useDynamicPageLoader } from '#cwa-layer/_composables/useDynamicPageLoader'
import { useDataType } from '#cwa-layer/_composables/useDataType'

const emit = defineEmits<{
  close: []
  reload: []
}>()
const props = defineProps<{ iri?: string, hideViewLink?: boolean, resourceType?: string }>()

const $cwa = useCwa()
const confirm = useCwaConfirm()
const dialog = useTemplateRef<InstanceType<typeof CwaUiDialog>>('dialog')
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

const depthOptions = computed(() => depthChain.value.map(option => ({ label: option.label, value: String(option.value) })))

const displayIriModel = computed({
  get: () => displayIri.value,
  set: (iri: string | null | undefined) => {
    iri && (displayIri.value = iri)
  },
})

const parentTypeOptions = [
  { label: 'Nothing', value: 'none' },
  { label: 'A page', value: 'page' },
  { label: 'A data page', value: 'data' },
]

const selectedParentDataType = ref<string | null>(null)
const parentType = ref<string | null>(null)

const parentTypeModel = computed({
  get: () => parentType.value ?? 'none',
  set: (type: string | null | undefined) => {
    parentType.value = type === 'none' || !type ? null : type
    if (!localResourceData.value) {
      return
    }
    if (parentType.value !== 'page' && localResourceData.value.parentPage) {
      localResourceData.value.parentPage = null
    }
    if (parentType.value !== 'data' && localResourceData.value.parentPageData) {
      localResourceData.value.parentPageData = null
    }
  },
})

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

const parentPageOptions = computed<MenuEntry[]>(() => {
  const options: MenuEntry[] = []
  for (const page of parentPages.value ?? []) {
    if (page['@id'] !== props.iri && !isDescendantOfCurrentPage(page['@id'])) {
      options.push({ label: page.reference, value: page['@id'] })
    }
  }
  return options
})

const dataTypeOptions = computed<MenuEntry[]>(() => {
  const options: MenuEntry[] = []
  for (const type of dataTypes.value ?? []) {
    const key = fqcnToEntrypointKey(type.resourceClass)
    if (key) {
      options.push({ label: type.resourceClass.split('\\').pop() ?? key, value: key })
    }
  }
  return options
})

const dataInstanceOptions = computed<MenuEntry[]>(() => (dataInstances.value ?? []).map(instance => ({ label: instance.title || instance['@id'], value: instance['@id'] })))

const { isAdding, isLoading, isUpdating, localResourceData, resource, formatDate, deleteResource, saveResource: _saveResource, loadResource, getInternalResourceLink, form } = useItemPage({
  createEndpoint: '/_/pages',
  emit,
  resourceType: props.resourceType,
  defaultResource: {},
  endpoint: displayIri,
  excludeFields: ['componentGroups'],
})

const dialogTitle = computed(() => {
  const stored = resource.value
  const name = isDisplayingPage.value ? stored?.reference : stored?.title
  return name || (isDisplayingPage.value ? 'Untitled page' : 'Untitled')
})

const pageName = computed(() => (isDisplayingPage.value ? resource.value?.reference : resource.value?.title) || '')

const pageTypeOptions = [
  { label: 'Static', value: 'static' },
  { label: 'Template', value: 'template' },
]

const pageTypeModel = {
  ...form.model<boolean>('isTemplate'),
  model: computed({
    get: () => localResourceData.value?.isTemplate ? 'template' : 'static',
    set: (type: string | null | undefined) => {
      localResourceData.value && (localResourceData.value.isTemplate = type === 'template')
    },
  }),
} as ReturnType<typeof form.model<string>>

function saveResource(close = false) {
  return _saveResource(close)
}

const isDisplayedPage = computed(() => !!props.iri && props.iri === $cwa.resources.displayPageIri.value)

const adminListingLink = computed(() => {
  if (isDisplayingPage.value) {
    return { name: '_cwa-pages', query: { cwa_force: 'true' } }
  }
  const key = resource.value?.['@type'] ? fqcnToEntrypointKey(resource.value['@type']) : undefined
  return key
    ? { name: '_cwa-data-type', params: { type: key }, query: { cwa_force: 'true' } }
    : { name: '_cwa-data', query: { cwa_force: 'true' } }
})

const counts = ref<Pick<PageDeleteFacts, 'templatePages' | 'addresses'>>({})
const checkingDelete = ref(false)

const deleteFacts = computed<PageDeleteFacts>(() => {
  const route = resource.value?.route as string | undefined
  return {
    template: !!resource.value?.isTemplate,
    ...counts.value,
    hasRoute: !!route,
    routePath: route ? $cwa.resources.getResource(route).value?.data?.path : undefined,
    nested: (parentPages.value ?? []).filter(page => page.parentPage === resource.value?.['@id']).length,
  }
})

const deleteSentence = computed(() => pageDeleteLines(deleteFacts.value).map(line => line.text).join(' ') || undefined)

async function dataEndpoints() {
  const docs = await $cwa.getApiDocumentation()
  return (dataTypes.value ?? [])
    .map(type => fqcnToEntrypointKey(type.resourceClass))
    .map(key => key ? docs?.entrypoint?.[key] : undefined)
    .filter((endpoint): endpoint is string => !!endpoint)
}

async function refreshCounts() {
  const iri = resource.value?.['@id']
  if (!iri || !resource.value?.isTemplate) {
    counts.value = {}
    return
  }
  counts.value = await fetchTemplateCounts($cwa, iri, await dataEndpoints().catch(() => []))
}

async function handleDeleteClick() {
  if (checkingDelete.value) {
    return
  }
  checkingDelete.value = true
  await refreshCounts()
  checkingDelete.value = false
  const confirmed = await confirm({
    title: `Delete “${pageName.value || dialogTitle.value}”?`,
    lines: pageDeleteConfirmLines(deleteFacts.value, form.unsavedFields.length),
    keep: 'Don\'t delete',
    go: 'Delete page',
    typed: pageName.value.trim() ? { noun: 'page name', value: pageName.value } : undefined,
  })
  if (!confirmed) {
    return
  }
  const destination = adminListingLink.value
  const onDeleted = isDisplayedPage.value
    ? async () => {
      form.discard()
      await navigateTo(destination)
    }
    : () => form.discard()
  return deleteResource(undefined, onDeleted, true)
}

async function viewOnSite() {
  const iri = resource.value?.['@id']
  if (!iri || !await dialog.value?.requestClose()) {
    return
  }
  await navigateTo({ ...getInternalResourceLink(iri), query: { cwa_force: 'true' } })
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

const history = computed(() => [
  { label: 'Created', value: localResourceData.value?.createdAt ? formatDate(localResourceData.value.createdAt) : '—' },
  { label: 'Updated', value: (localResourceData.value?.modifiedAt || localResourceData.value?.updatedAt) ? formatDate(localResourceData.value.modifiedAt || localResourceData.value.updatedAt) : '—' },
])

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

const layoutOptions = computed<MenuEntry[]>(() => (layouts.value ?? []).map(layout => ({
  label: layout.reference,
  value: layout['@id'],
})))

const pageComponentNames = computed(() => componentNames.filter(n => n.startsWith('CwaPage')))

function cleanUiName(componentName: string) {
  return componentName.replace(/^CwaPage/, '')
}

function fullPageUiName(uiComponent: string | null | undefined) {
  return uiComponent ? 'CwaPage' + cleanUiName(uiComponent) : uiComponent
}

const pageComponentOptions = computed<MenuEntry[]>(() => pageComponentNames.value.map((componentName) => {
  const cleanName = cleanUiName(componentName)
  return {
    label: $cwa.pagesConfig?.[cleanName]?.name || cleanName,
    value: componentName,
  }
}))

const pageUiModel = {
  ...form.model<string>('uiComponent'),
  model: computed({
    get: () => fullPageUiName(localResourceData.value?.uiComponent),
    set: (value: string | null | undefined) => {
      localResourceData.value && (localResourceData.value.uiComponent = value)
    },
  }),
} as ReturnType<typeof form.model<string>>

const pageStyleOptions = computed<MenuEntry[]>(() => {
  if (!localResourceData.value?.uiComponent) return []
  const cleanName = cleanUiName(localResourceData.value.uiComponent)
  const configuredClasses = $cwa.pagesConfig?.[cleanName]?.classes
  if (!configuredClasses) return []
  return Object.entries(configuredClasses).map(([label, value]) => ({ label, value: String(value) }))
})

const pageOptions = computed<MenuEntry[]>(() => (dynamicPages.value ?? []).map(page => ({
  label: page.reference,
  value: page['@id'],
})))

function metaFieldOptions(options: SelectOption[] | undefined) {
  return (options ?? []).map(option => ({ label: option.label, value: option.value === null || option.value === undefined ? null : String(option.value) }))
}

const { pageDataConfig } = useDataType(computed(() => resource.value?.['@type']))

const tabs = computed<DialogTab[]>(() => {
  const t: DialogTab[] = [{ label: 'Details', key: 'details' }]
  if (!isAdding.value) {
    t.push({ label: 'Routes', key: 'routes' })
    t.push({ label: 'Info', key: 'info' })
  }
  return t
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

function onTab(tab: string) {
  tab === 'info' && refreshCounts()
}

onMounted(async () => {
  await Promise.all([loadLayoutOptions(), loadDynamicPageOptions(), loadParentPageOptions(), loadDataTypes()])
})
</script>
