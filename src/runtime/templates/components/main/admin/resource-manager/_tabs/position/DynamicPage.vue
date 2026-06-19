<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/admin/manager-tabs-resolver'
import {
  useDynamicPositionSelectOptions,
} from '#cwa/templates/components/main/admin/_common/useDynamicPositionSelectOptions'
import ModalSelect from '#cwa/templates/components/core/admin/form/ModalSelect.vue'

const { exposeMeta, iri, $cwa, resource } = useCwaResourceManagerTab({
  name: 'Dynamic Component',
  order: DEFAULT_TAB_ORDER,
})

const { getTypeOptions, getPropertyOptions } = useDynamicPositionSelectOptions($cwa)

const selectedType = ref<string | null>(null)
const selectedProperty = ref<string | null>(null)
const typeOptions = ref<{ label: string, value: string }[]>([])
const propertyOptions = ref<{ label: string, value: string }[]>([])

const storedClass = computed(() => resource.value?.data?.pageDataClass ?? null)
const storedProperty = computed(() => resource.value?.data?.pageDataProperty ?? null)

const isDirtyIncomplete = computed(() => selectedType.value !== null && !selectedProperty.value)

const componentGroupIri = computed(() => resource.value?.data?.componentGroup)
const allowedComponents = computed<string[] | null>(() =>
  $cwa.resources.getResource(componentGroupIri.value).value?.data?.allowedComponents ?? null,
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
  propertyOptions.value = [{ label: 'Loading...', value: '' }]
  propertyOptions.value = await getPropertyOptions(selectedType.value, allowedComponents.value) as { label: string, value: string }[]
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

function onTypeChange(value: string | null) {
  selectedType.value = value
  selectedProperty.value = null
  loadPropertyOptions()
}

function onPropertyChange(value: string | null) {
  selectedProperty.value = value
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
  <div class="cwa:flex cwa:flex-col cwa:gap-y-3">
    <ModalSelect
      :model-value="selectedType"
      label="Data type"
      :options="typeOptions"
      @update:model-value="onTypeChange"
    />
    <ModalSelect
      v-if="selectedType"
      :model-value="selectedProperty"
      label="Field"
      :options="propertyOptions"
      @update:model-value="onPropertyChange"
    />
    <div
      v-if="isDirtyIncomplete"
      class="cwa:flex cwa:items-center cwa:justify-between cwa:gap-x-4"
    >
      <p class="cwa:text-sm cwa:text-yellow">
        Select a field to complete the configuration.
      </p>
      <CwaUiFormButton
        color="dark"
        @click="cancelChanges"
      >
        Cancel
      </CwaUiFormButton>
    </div>
    <div
      v-if="canMakeStatic && !isDirtyIncomplete"
      class="cwa:pt-1"
    >
      <CwaUiFormButton
        color="error"
        @click="makeStatic"
      >
        Make static
      </CwaUiFormButton>
    </div>
    <div v-if="!resource?.data?.component && !isDirtyIncomplete">
      <CwaUiFormButton @click="addFallbackComponent">
        Add Fallback Component
      </CwaUiFormButton>
    </div>
  </div>
</template>
