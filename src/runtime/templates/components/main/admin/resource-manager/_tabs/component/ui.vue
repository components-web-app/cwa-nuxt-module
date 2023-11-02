<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import {
  useCwaResourceManagerTab
} from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import type { CwaResourceMeta } from '#cwa/runtime/composables/cwa-resource'
import ComponentMetaResolver from '#cwa/runtime/templates/components/core/ComponentMetaResolver.vue'
import { useCwaResourceModel } from '#cwa/runtime/composables/cwa-resource-model'

const { exposeMeta, $cwa, iri } = useCwaResourceManagerTab({
  name: 'UI',
  order: DEFAULT_TAB_ORDER
})
const current = computed(() => $cwa.admin.componentManager.currentStackItem.value)

const componentMeta = ref<CwaResourceMeta[]>([])

const disabled = exposeMeta.disabled
disabled.value = !current.value?.styles?.classes.length && !current.value?.ui?.length

const uiComponentModel = useCwaResourceModel(iri, 'uiComponent')
const uiClassNamesModel = useCwaResourceModel(iri, 'uiClassNames')

// reset the class names if we are changing the UI
watch(uiComponentModel.model, () => {
  uiClassNamesModel.model.value = null
})

defineExpose(exposeMeta)

// todo: on UI change, check if matching class value still available and clear if not
</script>

<template>
  <div>
    <ComponentMetaResolver v-model="componentMeta" :components="current?.ui" :props="{ iri }" />
    <select v-model="uiComponentModel.model.value" class="cwa-text-dark">
      <option :value="null">
        Default
      </option>
      <option v-for="(meta, index) of componentMeta" :key="`select-option-ui-${current?.ui?.[index]}`" :value="current?.ui?.[index]">
        {{ meta.cwaResource.name || current?.ui?.[index] }}
      </option>
    </select>
    <select v-model="uiClassNamesModel.model.value" class="cwa-text-dark">
      <option :value="null">
        Default
      </option>
      <option v-for="(styles, styleName) of current?.styles?.classes" :key="`select-option-style-${styleName}`" :value="styles">
        {{ styleName }}
      </option>
    </select>
  </div>
</template>
