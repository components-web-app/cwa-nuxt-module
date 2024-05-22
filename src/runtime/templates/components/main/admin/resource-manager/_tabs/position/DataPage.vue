<script lang="ts" setup>
import { computed } from 'vue'
import { navigateTo } from '#app'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'

const { exposeMeta, resource, $cwa } = useCwaResourceManagerTab({
  name: 'Data Placeholder',
  order: DEFAULT_TAB_ORDER
})

defineExpose(exposeMeta)

async function goToTemplate () {
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

const availablePropsToComponentNames = computed<{ [prop:string]: string }>(() => {
  const pageData = $cwa.resources.pageData?.value
  if (!pageData) {
    return {}
  }
  return pageData?.data?._metadata.pageDataMetadata.properties.reduce(
    (obj: { [prop:string]: string }, item: { property: string, componentShortName: string }) => {
      obj[item.property] = item.componentShortName
      return obj
    },
    {}
  ) || {}
})

const dynamicComponentName = computed(() => {
  const positionPropertyConfigured = resource.value?.data?.pageDataProperty
  if (!positionPropertyConfigured) {
    return
  }
  const componentName = availablePropsToComponentNames.value?.[positionPropertyConfigured]
  if (!componentName) {
    return
  }
  return $cwa.resourcesConfig[componentName]?.name || componentName
})

function selectComponent () {
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
          :disabled="true"
        >
          Add {{ dynamicComponentName }}
        </CwaUiFormButton>
      </div>
      <div class="cwa-text-sm">
        <span class="cwa-text-stone-400">Edit this position or fallback component?</span>
        <a href="#" @click.prevent="goToTemplate">
          Go to page dynamic page
        </a>
      </div>
    </div>
  </div>
</template>
