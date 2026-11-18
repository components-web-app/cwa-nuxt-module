<template>
  <CwaUiDialog
    v-if="localResourceData"
    :title="dialogTitle"
    :tabs="tabs"
    :form="form"
    :loading="isLoading"
    noun="layout"
    :create-noun="isAdding ? 'layout' : undefined"
    data-testid="layout-dialog"
    @close="$emit('close')"
    @save="saveResource()"
  >
    <template #details>
      <CwaUiFormSection>
        <CwaUiInput
          field="reference"
          label="Reference"
          description="Only admins see this. It names the layout in lists."
        />
      </CwaUiFormSection>
      <CwaUiFormSection
        title="Appearance"
        :columns="2"
      >
        <CwaUiSelect
          field="uiComponent"
          label="Layout UI"
          :options="layoutUiOptions"
        />
        <CwaUiSelect
          v-if="layoutStyleOptions.length"
          :model="layoutStyleModel"
          label="Style"
          :options="layoutStyleOptions"
          nullable
          none-label="Default"
        />
      </CwaUiFormSection>
      <CwaUiAlert
        v-if="unresolvableUiComponent"
        tone="warning"
        title="This layout's UI can't be found."
        data-testid="layout-unresolvable"
      >
        <p class="cwa:m-0">
          The component '{{ unresolvableUiComponent }}' for resource '{{ localResourceData['@id'] }}' cannot be resolved. Pages using it show the default layout until another is chosen.
        </p>
      </CwaUiAlert>
    </template>
    <template #info>
      <CwaUiFormSection>
        <dl class="cwa:m-0">
          <dt class="cwa:text-label cwa:text-fg">
            ID
          </dt>
          <dd
            class="cwa:m-0 cwa:mt-1.5 cwa:break-all cwa:font-mono cwa:text-control cwa:text-fg-secondary"
            data-testid="layout-id"
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
        title="Delete this layout"
        :description="deleteSentence"
        data-testid="layout-delete-section"
      >
        <div>
          <CwaUiButton
            tone="danger"
            label="Delete layout"
            :loading="isUpdating"
            data-testid="layout-delete"
            @click="handleDeleteClick"
          />
        </div>
      </CwaUiFormSection>
    </template>
  </CwaUiDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useItemPage } from '#cwa-layer/_composables/useItemPage'
import { definePageMeta, useCwa } from '#imports'
import { componentNames } from '#components'
import CwaUiDialog from '#cwa/templates/components/ui/Dialog.vue'
import CwaUiFormSection from '#cwa/templates/components/ui/FormSection.vue'
import CwaUiInput from '#cwa/templates/components/ui/Input.vue'
import CwaUiSelect from '#cwa/templates/components/ui/Select.vue'
import CwaUiAlert from '#cwa/templates/components/ui/Alert.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import type { MenuEntry } from '#cwa/templates/components/core/ui/menu-entries'
import type { DialogTab } from '#cwa/templates/components/core/ui/dialog-form'
import { useCwaConfirm } from '#cwa/composables/cwa-confirm'
import { deriveSelectedStyles, mergeSelectedStyles } from '#cwa/composables/cwa-styles'
import type { StyleClasses } from '#cwa/composables/cwa-styles'

definePageMeta({
  name: '_cwa-layouts-iri',
})

const emit = defineEmits<{
  close: []
  reload: []
}>()

const $cwa = useCwa()
const confirm = useCwaConfirm()

const layoutComponentNames = computed(() => componentNames.filter(n => n.startsWith('CwaLayout')))

function cleanUiName(componentName: string) {
  return componentName.replace(/^CwaLayout/, '')
}

const layoutComponentOptions = computed<MenuEntry[]>(() => layoutComponentNames.value.map((componentName) => {
  const cleanName = cleanUiName(componentName)
  return {
    label: $cwa.layoutsConfig?.[cleanName]?.name || cleanName,
    value: componentName,
  }
}))

const { isAdding, isLoading, isUpdating, localResourceData, resource, formatDate, deleteResource, saveResource: _saveResource, form } = useItemPage({
  createEndpoint: '/_/layouts',
  emit,
  resourceType: 'Layout',
  defaultResource: () => ({
    reference: null,
    uiComponent: layoutComponentNames.value[0],
  }),
  dismissStoredErrors: true,
})

const unresolvableUiComponent = computed<string | undefined>(() => {
  const storedUiComponent = localResourceData.value?.uiComponent
  if (!storedUiComponent || layoutComponentNames.value.includes(storedUiComponent)) {
    return undefined
  }
  return storedUiComponent
})

const layoutUiOptions = computed<MenuEntry[]>(() => {
  if (!unresolvableUiComponent.value) {
    return layoutComponentOptions.value
  }
  return [
    ...layoutComponentOptions.value,
    {
      label: `${cleanUiName(unresolvableUiComponent.value)} (component not found)`,
      value: unresolvableUiComponent.value,
    },
  ]
})

const layoutStyleClasses = computed<StyleClasses>(() => {
  const uiComponent = localResourceData.value?.uiComponent
  return (uiComponent && $cwa.layoutsConfig?.[cleanUiName(uiComponent)]?.classes) || {}
})

const layoutStyleOptions = computed<MenuEntry[]>(() => Object.keys(layoutStyleClasses.value).map(name => ({ label: name, value: name })))

const layoutStyleModel = {
  ...form.model<string[] | null>('uiClassNames'),
  model: computed({
    get: () => deriveSelectedStyles(localResourceData.value?.uiClassNames, layoutStyleClasses.value)[0] ?? null,
    set: (name: string | null | undefined) => {
      if (!localResourceData.value) {
        return
      }
      const merged = mergeSelectedStyles(name ? [name] : [], layoutStyleClasses.value)
      localResourceData.value.uiClassNames = merged.length ? merged : null
    },
  }),
} as unknown as ReturnType<typeof form.model<string>>

const layoutName = computed(() => (resource.value?.reference as string | undefined) || '')

const dialogTitle = computed(() => isAdding.value ? 'New layout' : (layoutName.value || 'Untitled layout'))

const tabs = computed<DialogTab[]>(() => isAdding.value
  ? [{ label: 'Details', key: 'details' }]
  : [{ label: 'Details', key: 'details' }, { label: 'Info', key: 'info' }])

const pageCount = computed(() => Array.isArray(resource.value?.pages) ? resource.value.pages.length : undefined)

const deleteSentence = computed(() => {
  const count = pageCount.value
  if (!count) {
    return undefined
  }
  return `${count} ${count === 1 ? 'page uses' : 'pages use'} this layout.`
})

const history = computed(() => [
  { label: 'Created', value: localResourceData.value?.createdAt ? formatDate(localResourceData.value.createdAt) : '—' },
  { label: 'Updated', value: (localResourceData.value?.modifiedAt || localResourceData.value?.updatedAt) ? formatDate(localResourceData.value.modifiedAt || localResourceData.value.updatedAt) : '—' },
])

function saveResource() {
  return _saveResource(false)
}

async function handleDeleteClick() {
  const confirmed = await confirm({
    title: `Delete “${layoutName.value || dialogTitle.value}”?`,
    lines: [
      ...(deleteSentence.value ? [{ text: deleteSentence.value, emphasis: 'strong' as const }] : []),
      ...(form.unsavedFields.length ? [{ text: `Your ${form.unsavedFields.length} unsaved ${form.unsavedFields.length === 1 ? 'change is' : 'changes are'} discarded too.` }] : []),
      { text: 'This can\'t be undone.' },
    ],
    keep: 'Don\'t delete',
    go: 'Delete layout',
    typed: layoutName.value.trim() ? { noun: 'layout name', value: layoutName.value } : undefined,
  })
  if (!confirmed) {
    return
  }
  return deleteResource(undefined, () => form.discard(), true)
}
</script>
