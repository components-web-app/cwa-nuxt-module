<script lang="ts" setup>
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/resolve-tabs'

const { exposeMeta } = useCwaResourceManagerTab({
  name: 'Position',
  order: DEFAULT_TAB_ORDER
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    Position
  </div>
</template>
