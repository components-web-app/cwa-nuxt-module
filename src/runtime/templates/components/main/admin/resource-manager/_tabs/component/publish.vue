<script lang="ts" setup>
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'

const { exposeMeta } = useCwaResourceManagerTab({
  name: 'Publish',
  order: DEFAULT_TAB_ORDER
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    Publish
  </div>
</template>
