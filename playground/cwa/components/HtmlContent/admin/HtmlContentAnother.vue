<script lang="ts" setup>
import { defineExpose } from 'vue'
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'

const { exposeMeta } = useCwaResourceManagerTab({
  name: 'Tab 2'
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    Tab content again
  </div>
</template>
