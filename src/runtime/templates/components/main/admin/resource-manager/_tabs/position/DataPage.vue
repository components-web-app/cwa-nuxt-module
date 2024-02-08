<script lang="ts" setup>
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'

const { exposeMeta } = useCwaResourceManagerTab({
  name: 'Data Placeholder',
  order: DEFAULT_TAB_ORDER
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    BUTTON TO SELECT COMPONENT OR ADD COMPONENT IF HAS PAGE DATA PROPERTY +

    LINK TO DYNAMIC TEMPLATE PAGE
  </div>
</template>
