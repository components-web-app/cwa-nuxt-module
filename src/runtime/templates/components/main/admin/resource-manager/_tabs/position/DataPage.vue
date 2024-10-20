<script lang="ts" setup>
import { computed, ref } from 'vue'
import { navigateTo } from '#app'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'

const loadingDynamicMetadata = ref(false)

const { exposeMeta, resource, $cwa, iri } = useCwaResourceManagerTab({
  name: 'Data Placeholder',
  order: DEFAULT_TAB_ORDER,
})

defineExpose(exposeMeta)

async function goToTemplate() {
  if (!$cwa.resources.pageIri.value) {
    return
  }
  await navigateTo(`${$cwa.resources.pageIri.value}?cwa_force=true`)
  $cwa.admin.toggleEdit(false)
}

const hasDynamicComponent = computed(() => {
  if (!resource.value?.data?.component) {
    return false
  }
  if (!resource.value?.data?._metadata.staticComponent) {
    return true
  }
  return resource.value?.data?.component !== resource.value?.data?._metadata.staticComponent
})

const availablePropsToComponentNames = computed<{ [prop: string]: string }>(() => {
  const pageData = $cwa.resources.pageData?.value
  if (!pageData) {
    return {}
  }
  return pageData?.data?._metadata.pageDataMetadata.properties.reduce(
    (obj: { [prop: string]: string }, item: { property: string, componentShortName: string }) => {
      obj[item.property] = item.componentShortName
      return obj
    },
    {},
  ) || {}
})

const pageDataProperty = computed(() => {
  return resource.value?.data?.pageDataProperty
})

const componentName = computed<string | undefined>(() => {
  if (!pageDataProperty.value) {
    return
  }
  return availablePropsToComponentNames.value?.[pageDataProperty.value]
})

const resourceConfig = computed(() => {
  if (!componentName.value) {
    return
  }
  return $cwa.resourcesConfig[componentName.value]
})

const dynamicComponentName = computed(() => {
  return resourceConfig.value?.name || componentName.value
})

const instantAdd = computed(() => (!!resourceConfig.value?.instantAdd))

async function getApiMetadata() {
  if (!componentName.value) {
    throw new Error('Cannot get API Metadata when componentName is not set')
  }
  const apiComponents = await $cwa.getComponentMetadata(false, false)
  if (!apiComponents) {
    throw new Error('Could not retrieve component metadata from the API')
  }
  return apiComponents[componentName.value]
}

async function addDynamicComponent() {
  loadingDynamicMetadata.value = true
  try {
    const apiMetadata = await getApiMetadata()
    if (!componentName.value || !apiMetadata || !iri.value || !pageDataProperty.value) {
      return
    }
    await $cwa.resourcesManager.initAddResource(iri.value, null, $cwa.admin.resourceStackManager.resourceStack.value, pageDataProperty.value)
    // need to add the addResourceEvent
    await $cwa.resourcesManager.setAddResourceEventResource(componentName.value, apiMetadata.endpoint, apiMetadata.isPublishable, instantAdd.value)
  }
  finally {
    loadingDynamicMetadata.value = false
  }
}

function selectComponent() {
  const componentIri = resource.value?.data?.component
  if (!componentIri) {
    return
  }
  $cwa.admin.eventBus.emit('selectResource', componentIri)
}
</script>

<template>
  <div>
    <div class="cwa-flex cwa-space-x-4 cwa-items-center">
      <div v-if="!!resource?.data?._metadata.isDynamicPosition">
        <CwaUiFormButton
          v-if="hasDynamicComponent"
          @click="selectComponent"
        >
          Select Component
        </CwaUiFormButton>
        <CwaUiFormButton
          v-else-if="dynamicComponentName"
          :disabled="loadingDynamicMetadata"
          @click="addDynamicComponent"
        >
          Add {{ dynamicComponentName }}
        </CwaUiFormButton>
      </div>
      <div class="cwa-text-sm">
        <span class="cwa-text-stone-400">Edit this position or fallback component?</span>
        <a
          href="#"
          @click.prevent="goToTemplate"
        >
          Go to page dynamic page
        </a>
      </div>
    </div>
  </div>
</template>
