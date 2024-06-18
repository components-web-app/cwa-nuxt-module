<script lang="ts" setup>
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'

const { exposeMeta, createComputedState } = useCwaResourceManagerTab({
  name: 'Order',
  order: DEFAULT_TAB_ORDER
})

defineExpose(exposeMeta)
const reordering = createComputedState<boolean>('reordering', false)
</script>

<template>
  <div>
    <CwaUiFormToggle v-model="reordering" label="Enable reordering" />
  </div>
</template>
