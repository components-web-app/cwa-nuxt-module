<script lang="ts" setup>
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'

const { exposeMeta } = useCwaResourceManagerTab({
  name: 'Info'
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    Info
  </div>
</template>
