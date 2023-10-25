<script lang="ts" setup>
import { computed, ref } from 'vue'
import {
  useCwaResourceManagerTab
} from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'
import type { CwaResourceMeta } from '#cwa/runtime/composables/cwa-resource'
import ComponentMetaResolver from '#cwa/runtime/templates/components/core/ComponentMetaResolver.vue'

const { exposeMeta, $cwa, iri } = useCwaResourceManagerTab({
  name: 'UI',
  order: DEFAULT_TAB_ORDER
})
const current = computed(() => $cwa.admin.componentManager.currentStackItem.value)

const componentMeta = ref<CwaResourceMeta[]>([])

defineExpose(exposeMeta)
</script>

<template>
  <div>
    <ComponentMetaResolver v-model="componentMeta" :components="current?.ui" :props="{ iri }" />
    <select class="cwa-text-dark">
      <option value="" selected>
        Default
      </option>
      <option v-for="(meta, index) of componentMeta" :key="`select-option-ui-${current?.ui?.[index]}`" :value="current?.ui?.[index]">
        {{ meta.cwaResource.name || current?.ui?.[index] }}
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
