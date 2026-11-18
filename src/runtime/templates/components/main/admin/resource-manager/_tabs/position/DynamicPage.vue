<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import {
  useDynamicPositionSelectOptions,
} from '#cwa/templates/components/main/admin/_common/useDynamicPositionSelectOptions'
import CwaUiBadge from '#cwa/templates/components/ui/Badge.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import CwaUiManagerRowDivider from '#cwa/templates/components/ui/ManagerRowDivider.vue'
import CwaUiManagerTab from '#cwa/templates/components/ui/ManagerTab.vue'
import CwaUiSelect from '#cwa/templates/components/ui/Select.vue'

const { exposeMeta, iri, $cwa, resource } = useCwaResourceManagerTab({
  name: 'Dynamic Component',
  order: DEFAULT_TAB_ORDER,
})

const { getTypeOptions, getPropertyOptions } = useDynamicPositionSelectOptions($cwa)

const selectedType = ref<string | null>(null)
const selectedProperty = ref<string | null>(null)
const typeOptions = ref<{ label: string, value: string }[]>([])
const propertyOptions = ref<{ label: string, value: string }[]>([])
const loadingProperties = ref(false)

const storedClass = computed(() => resource.value?.data?.pageDataClass ?? null)
const storedProperty = computed(() => resource.value?.data?.pageDataProperty ?? null)

const isDirtyIncomplete = computed(() => selectedType.value !== null && !selectedProperty.value)

const componentGroupIri = computed(() => resource.value?.data?.componentGroup)
const allowedComponents = computed<string[] | null>(() =>
  componentGroupIri.value
    ? $cwa.resources.getResource(componentGroupIri.value).value?.data?.allowedComponents ?? null
    : null,
)

const canMakeStatic = computed(() =>
  !!resource.value?.data?.component && !!resource.value?.data?.pageDataProperty,
)

async function loadTypeOptions() {
  typeOptions.value = await getTypeOptions() as { label: string, value: string }[]
}

async function loadPropertyOptions() {
  if (!selectedType.value) {
    propertyOptions.value = []
    return
  }
  propertyOptions.value = []
  loadingProperties.value = true
  try {
    propertyOptions.value = await getPropertyOptions(selectedType.value, allowedComponents.value) as { label: string, value: string }[]
  }
  finally {
    loadingProperties.value = false
  }
}

async function save() {
  if (!iri.value) return
  await $cwa.resourcesManager.updateResource({
    endpoint: iri.value,
    data: {
      pageDataProperty: selectedProperty.value ?? null,
      pageDataClass: selectedType.value ?? null,
    },
  })
}

onMounted(async () => {
  selectedType.value = storedClass.value
  selectedProperty.value = storedProperty.value
  await loadTypeOptions()
  await loadPropertyOptions()
})

function onTypeChange(value: string | null | undefined) {
  selectedType.value = value ?? null
  selectedProperty.value = null
  loadPropertyOptions()
}

function onPropertyChange(value: string | null | undefined) {
  selectedProperty.value = value ?? null
  if (selectedType.value && value) {
    save()
  }
}

function cancelChanges() {
  selectedType.value = storedClass.value
  selectedProperty.value = storedProperty.value
  loadPropertyOptions()
}

async function makeStatic() {
  if (!iri.value) return
  await $cwa.resourcesManager.updateResource({
    endpoint: iri.value,
    data: { pageDataProperty: null, pageDataClass: null },
  })
  selectedType.value = null
  selectedProperty.value = null
  propertyOptions.value = []
}

async function addFallbackComponent() {
  if (!iri.value) return
  await $cwa.resourcesManager.initAddResource(iri.value, null, $cwa.admin.resourceStackManager.resourceStack.value)
}

defineExpose(exposeMeta)
</script>

<template>
  <CwaUiManagerTab>
    <CwaUiSelect
      :model-value="selectedType"
      label="Data type"
      :options="typeOptions"
      @update:model-value="onTypeChange"
    />
    <CwaUiSelect
      v-if="selectedType"
      :model-value="selectedProperty"
      label="Field"
      :options="propertyOptions"
      :disabled="loadingProperties"
      :placeholder="loadingProperties ? 'Loading…' : undefined"
      @update:model-value="onPropertyChange"
    />
    <template v-if="isDirtyIncomplete">
      <CwaUiBadge
        tone="warning"
        data-testid="dynamic-incomplete"
      >
        Select a field to complete the configuration.
      </CwaUiBadge>
      <CwaUiButton
        label="Cancel"
        @click="cancelChanges"
      />
    </template>
    <template v-else-if="canMakeStatic || !resource?.data?.component">
      <CwaUiManagerRowDivider />
      <CwaUiButton
        v-if="canMakeStatic"
        label="Make static"
        tone="danger"
        @click="makeStatic"
      />
      <CwaUiButton
        v-if="!resource?.data?.component"
        label="Add fallback component"
        @click="addFallbackComponent"
      />
    </template>
  </CwaUiManagerTab>
</template>
