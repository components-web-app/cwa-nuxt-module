<template>
  <CwaUiDialog
    v-if="localResourceData"
    ref="dialog"
    v-model:tab="tab"
    :title="dialogTitle"
    :tabs="tabs"
    :form="form"
    :loading="isLoading"
    :kind="kind"
    noun="page"
    :create-noun="isAdding ? createNoun : undefined"
    data-testid="page-dialog"
    @close="$emit('close')"
    @save="saveResource()"
  >
    <template #header-actions>
      <CwaUiSelect
        v-if="isDisplayingPage"
        :model="pageTypeModel"
        label="Page type"
        label-hidden
        width="xs"
        :options="pageTypeOptions"
        data-testid="page-type"
      />
      <CwaUiButton
        v-if="!hideViewLink && !isAdding"
        variant="ghost"
        icon-only
        :icon="EyeGlyph"
        label="View page on site"
        data-testid="page-view-on-site"
        @click="viewOnSite"
      />
    </template>
    <template
      v-if="depthChain.length > 1"
      #subheader
    >
      <div
        class="cwa:shrink-0 cwa:overflow-x-auto cwa:px-6 cwa:pt-3 cwa:max-sm:px-4"
        data-testid="page-depths"
      >
        <CwaUiSegmented
          v-model="displayIriModel"
          label="Editing"
          label-hidden
          :options="depthOptions"
        />
      </div>
    </template>
    <template #details>
      <CwaUiAlert
        v-if="missing"
        :title="missing.title"
        data-testid="page-missing-prerequisite"
      >
        {{ missing.text }}
        <template #actions>
          <CwaUiButton
            :label="missing.action"
            data-testid="page-missing-prerequisite-link"
            @click="goToCreate(missing.to)"
          />
        </template>
      </CwaUiAlert>
      <template v-else>
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
            :model="pageStyleModel"
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
              :icon="EyeGlyph"
              data-testid="go-to-template"
              @click="goToTemplate"
            />
          </div>
          <p
            v-else
            class="cwa:m-0 cwa:text-helper cwa:text-fg-muted"
            data-testid="no-template"
          >
            No template selected
          </p>
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
              :model="metaSelects[metaField.field]!.model"
              :label="metaField.label"
              :options="metaSelects[metaField.field]!.options"
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
        </CwaUiFormSection>
      </template>
    </template>
    <template #routes>
      <RoutesTab
        v-if="resource && resource.hasOwnProperty('@id')"
        :page-resource="resource as CwaResource"
        @reload="loadResource"
        @open-page="openPage"
        @go-to="goToPath"
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
import { pageDataNoun } from './page-data-noun'
import { computed, onMounted, ref, useTemplateRef, watch, watchEffect } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import isEqual from 'lodash-es/isEqual'
import { consola } from 'consola'
import { useRoute } from 'vue-router'
import { navigateTo, useCwa } from '#imports'
import { componentNames } from '#components'
import CwaUiDialog from '#cwa/templates/components/ui/Dialog.vue'
import CwaUiFormSection from '#cwa/templates/components/ui/FormSection.vue'
import CwaUiInput from '#cwa/templates/components/ui/Input.vue'
import CwaUiTextarea from '#cwa/templates/components/ui/Textarea.vue'
import CwaUiSelect from '#cwa/templates/components/ui/Select.vue'
import CwaUiSegmented from '#cwa/templates/components/ui/Segmented.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import CwaUiAlert from '#cwa/templates/components/ui/Alert.vue'
import EyeGlyph from '#cwa/templates/components/ui/icon/EyeIcon.vue'
import RoutesTab from '#cwa/templates/components/core/admin/RoutesTab.vue'
import PagePurgeCache from '#cwa/templates/components/core/admin/PagePurgeCache.vue'
import type { MenuEntry } from '#cwa/templates/components/core/ui/menu-entries'
import type { DialogTab } from '#cwa/templates/components/core/ui/dialog-form'
import type { SelectOption } from '#cwa/composables/cwa-select-input'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { CwaResourceTypes, getResourceTypeFromIri } from '#cwa/resources/resource-utils'
import { useCwaConfirm } from '#cwa/composables/cwa-confirm'
import { deriveSelectedStyles, mergeSelectedStyles } from '#cwa/composables/cwa-styles'
import type { StyleClasses } from '#cwa/composables/cwa-styles'
import { fetchTemplateCounts, pageDeleteConfirmLines, pageDeleteLines } from '#cwa/admin/page-delete'
import type { PageDeleteFacts } from '#cwa/admin/page-delete'
import { useItemPage } from '#cwa-layer/_composables/useItemPage'
import { useParentPageLoader } from '#cwa-layer/_composables/useParentPageLoader'
import { useParentPageDataLoader } from '#cwa-layer/_composables/useParentPageDataLoader'
import { useDynamicPageLoader } from '#cwa-layer/_composables/useDynamicPageLoader'
import { useDataType } from '#cwa-layer/_composables/useDataType'
import { fetchAllMembers } from '#cwa-layer/_composables/fetchAllMembers'

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

const route = useRoute()
const rootIri = computed(() => {
  const param = route.params.iri
  return props.iri ?? ((Array.isArray(param) ? param[0] : param) || undefined)
})
const displayIri = ref(rootIri.value)

watch(rootIri, (iri) => {
  displayIri.value = iri
})

const isDisplayingPage = computed(() => displayIri.value === 'add' ? props.resourceType === 'Page' : getResourceTypeFromIri(displayIri.value ?? '') === CwaResourceTypes.PAGE)

function getResourceData(iri: string) {
  return $cwa.resources.getResource(iri).value
}

const depthChain = computed(() => {
  const chain: SelectOption[] = []
  let iri: string | null | undefined = rootIri.value
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
  set: async (iri: string | null | undefined) => {
    if (!iri || iri === displayIri.value || (dialog.value && !await dialog.value.confirmDiscard())) {
      return
    }
    displayIri.value = iri
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
    if (current === rootIri.value) return true
    current = byId[current]?.parentPage
  }
  return false
}

const parentPageOptions = computed<MenuEntry[]>(() => {
  const options: MenuEntry[] = []
  for (const page of parentPages.value ?? []) {
    if (page['@id'] !== rootIri.value && !isDescendantOfCurrentPage(page['@id'])) {
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

const createEndpoint = ref(props.resourceType === 'Page' ? '/_/pages' : '')

const linkDefaults = Object.fromEntries(
  ([['parentPage', 'parentPage'], ['parentPageData', 'parentPageData'], ['template', 'page']] as const)
    .flatMap(([queryKey, field]) => typeof route.query[queryKey] === 'string' ? [[field, route.query[queryKey]]] : []),
)

const { isAdding, isLoading, isUpdating, localResourceData, resource, formatDate, deleteResource, saveResource: _saveResource, loadResource, getInternalResourceLink, form } = useItemPage({
  createEndpoint,
  emit,
  resourceType: props.resourceType,
  defaultResource: () => props.resourceType === 'Page'
    ? { isTemplate: false, uiComponent: pageComponentNames.value[0], layout: layouts.value?.[0]?.['@id'] }
    : { ...linkDefaults, page: linkDefaults.page ?? dynamicPages.value?.[0]?.['@id'] },
  endpoint: displayIri,
  routeHashAfterAdd: computed(() => (localResourceData.value?.isTemplate ? '#details' : '#routes')),
  excludeFields: ['componentGroups'],
  dismissStoredErrors: true,
})

const createNoun = computed(() => isDisplayingPage.value ? 'page' : pageDataNoun(props.resourceType))

const dialogTitle = computed(() => {
  if (isAdding.value) {
    return `New ${createNoun.value}`
  }
  const stored = resource.value
  const name = isDisplayingPage.value ? stored?.reference : stored?.title
  return name || (isDisplayingPage.value ? 'Untitled page' : 'Untitled')
})

const pageName = computed(() => (isDisplayingPage.value ? resource.value?.reference : resource.value?.title) || '')

const pageTypeOptions: MenuEntry[] = [
  { label: 'Static', value: 'static', dot: 'cwa:bg-type-static' },
  { label: 'Dynamic', value: 'template', dot: 'cwa:bg-type-dynamic' },
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

const kind = computed(() => {
  if (isDisplayingPage.value) {
    return { tone: localResourceData.value?.isTemplate ? 'dynamic' as const : 'static' as const }
  }
  return resource.value?.route || localResourceData.value?.isReachableWithoutRoute
    ? { tone: 'success' as const, label: 'Reachable' }
    : { tone: 'warning' as const, label: 'Not reachable' }
})

function saveResource(close = false) {
  return _saveResource(close)
}

const isDisplayedPage = computed(() => !!rootIri.value && rootIri.value === $cwa.resources.displayPageIri.value)

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
  counts.value = await fetchTemplateCounts($cwa, iri, dataEndpoints())
}

async function handleDeleteClick() {
  if (checkingDelete.value) {
    return
  }
  checkingDelete.value = true
  const iri = resource.value?.['@id']
  const [notice] = await Promise.all([
    iri ? import('#cwa/admin/resource-confirm').then(({ editingNotice }) => editingNotice($cwa, iri)) : undefined,
    refreshCounts(),
  ])
  checkingDelete.value = false
  const confirmed = await confirm({
    title: `Delete “${pageName.value || dialogTitle.value}”?`,
    lines: [...(notice ? [{ text: notice }] : []), ...pageDeleteConfirmLines(deleteFacts.value, form.unsavedFields.length)],
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

async function openPage(iri: string) {
  if (depthChain.value.some(option => option.value === iri)) {
    displayIriModel.value = iri
    return
  }
  if (!await dialog.value?.requestClose()) {
    return
  }
  await navigateTo({ name: '_cwa-routes-iri', params: { iri }, query: { cwa_force: 'true' } })
}

async function goToPath(path: string) {
  if (!await dialog.value?.requestClose()) {
    return
  }
  await navigateTo({ path, query: { cwa_force: 'true' } })
}

async function goToTemplate() {
  if (!localResourceData.value?.page || !await dialog.value?.requestClose()) return
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

const layouts = ref<CwaResource[]>()

async function loadLayoutOptions() {
  layouts.value = await fetchAllMembers($cwa, '/_/layouts')
}

const missing = computed<{ title: string, text: string, action: string, to: RouteLocationRaw } | undefined>(() => {
  if (!isAdding.value) {
    return undefined
  }
  if (isDisplayingPage.value) {
    return layouts.value?.length === 0
      ? { title: 'Create a layout first', text: 'A page is shown inside a layout, and there are none yet.', action: 'Create a layout', to: { name: '_cwa-layouts-iri', params: { iri: 'add' }, query: { cwa_force: 'true' } } }
      : undefined
  }
  return dynamicPages.value?.length === 0
    ? { title: 'Create a template page first', text: `A ${createNoun.value} is built from a template page, and there are none yet.`, action: 'Create a template page', to: { name: '_cwa-pages-iri', params: { iri: 'add' }, query: { cwa_force: 'true' } } }
    : undefined
})

async function goToCreate(to: RouteLocationRaw) {
  if (!await dialog.value?.requestClose()) {
    return
  }
  await navigateTo(to)
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

const pageStyleClasses = computed<StyleClasses>(() => {
  const uiComponent = localResourceData.value?.uiComponent
  return (uiComponent && $cwa.pagesConfig?.[cleanUiName(uiComponent)]?.classes) || {}
})

const pageStyleOptions = computed<MenuEntry[]>(() => Object.keys(pageStyleClasses.value).map(name => ({ label: name, value: name })))

const pageStyleModel = {
  ...form.model<string[] | null>('uiClassNames'),
  model: computed({
    get: () => deriveSelectedStyles(localResourceData.value?.uiClassNames, pageStyleClasses.value)[0] ?? null,
    set: (name: string | null | undefined) => {
      if (!localResourceData.value) {
        return
      }
      const merged = mergeSelectedStyles(name ? [name] : [], pageStyleClasses.value)
      localResourceData.value.uiClassNames = merged.length ? merged : null
    },
  }),
} as unknown as ReturnType<typeof form.model<string>>

const pageOptions = computed<MenuEntry[]>(() => (dynamicPages.value ?? []).map(page => ({
  label: page.reference,
  value: page['@id'],
})))

const { pageDataConfig } = useDataType(computed(() => resource.value?.['@type']))

function metaSelect(field: string, options: SelectOption[] | undefined) {
  const values = new Map<string, unknown>()
  const entries = (options ?? []).map((option, index) => {
    if (option.value === null || option.value === undefined) {
      return { label: option.label, value: null }
    }
    const key = String(index)
    values.set(key, option.value)
    return { label: option.label, value: key }
  })
  const model = {
    ...form.model(field),
    model: computed({
      get: () => {
        const stored = localResourceData.value?.[field]
        return [...values.entries()].find(([, value]) => isEqual(value, stored))?.[0] ?? null
      },
      set: (key: string | null | undefined) => {
        localResourceData.value && (localResourceData.value[field] = key ? values.get(key) : null)
      },
    }),
  } as unknown as ReturnType<typeof form.model<string>>
  return { options: entries, model }
}

const metaSelects = computed(() => Object.fromEntries((pageDataConfig.value?.metaFields ?? [])
  .filter(metaField => metaField.type !== 'input')
  .map(metaField => [metaField.field, metaSelect(metaField.field, metaField.options)])))

const tabs = computed<DialogTab[]>(() => {
  if (isAdding.value) {
    return [
      { label: 'Details', key: 'details' },
      { label: 'Routes', key: 'routes', disabled: `Routes open once the ${createNoun.value} is created. Create the ${createNoun.value} and this tab lets you add its address.` },
    ]
  }
  return [
    { label: 'Details', key: 'details' },
    { label: 'Routes', key: 'routes' },
    { label: 'Info', key: 'info' },
  ]
})

function tabFromHash(hash: string) {
  const key = hash.replace(/^#/, '')
  return tabs.value.some(item => item.key === key && !item.disabled) ? key : 'details'
}

const tab = ref(tabFromHash(route.hash ?? ''))

watch(() => route.hash, (hash) => {
  tab.value = tabFromHash(hash ?? '')
})

watch(tab, key => key === 'info' && refreshCounts())

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

watchEffect(async () => {
  if (!props.resourceType || props.resourceType === 'Page') {
    return
  }
  const docs = await $cwa.getApiDocumentation()
  createEndpoint.value = docs?.entrypoint?.[fqcnToEntrypointKey(props.resourceType) || ''] || ''
})

function logFailure(what: string) {
  return (error: unknown) => {
    consola.error(`[CWA] Could not load the ${what}`, error)
  }
}

onMounted(async () => {
  await Promise.all([
    loadLayoutOptions().catch(logFailure('layouts')),
    loadDynamicPageOptions().catch(logFailure('template pages')),
    loadParentPageOptions().catch(logFailure('parent pages')),
    loadDataTypes().catch(logFailure('page data types')),
  ])
  if (!isAdding.value || !localResourceData.value) {
    return
  }
  if (isDisplayingPage.value) {
    localResourceData.value.layout ||= layouts.value?.[0]?.['@id']
    return
  }
  localResourceData.value.page ||= dynamicPages.value?.[0]?.['@id']
})
</script>
