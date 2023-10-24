<script lang="ts" setup>
import { computed, reactive } from 'vue'
import {
  useCwaResourceManagerTab
} from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import type { CwaResourceMeta } from '#cwa/runtime/composables/cwa-resource'

const { exposeMeta, $cwa, iri } = useCwaResourceManagerTab({
  name: 'UI',
  order: DEFAULT_TAB_ORDER
})
const uiComponentRefs = reactive<{ [key: string]: CwaResourceMeta }>({})
const current = computed(() => $cwa.admin.componentManager.currentStackItem.value)

defineExpose(exposeMeta)
</script>

<template>
  <div>
    <component
      :is="uiComponent"
      v-for="(uiComponent, index) of (current?.ui)"
      :key="`uiComponentAdmin_${uiComponent}_${index}`"
      :ref="(el: CwaResourceMeta) => (uiComponentRefs[uiComponent] = el)"
      :iri="iri"
      class="cwa-hidden"
    />
    <select class="cwa-text-dark">
      <option value="" selected>
        Default
      </option>
      <option v-for="(meta, componentName) of uiComponentRefs" :key="`select-option-ui-${componentName}`" :value="componentName">
        {{ meta.cwaResource.name || componentName }}
      </option>
    </select>
    <select class="cwa-text-dark">
      <option value="" selected>
        Default
      </option>
      <option v-for="(styles, styleName) of current?.styles?.classes" :key="`select-option-style-${styleName}`" :value="styles">
        {{ styleName }}
      </option>
    </select>
  </div>
</template>
