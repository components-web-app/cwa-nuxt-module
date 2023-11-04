<script lang="ts" setup>
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'

const { exposeMeta, iri } = useCwaResourceManagerTab({
  name: 'Info',
  order: DEFAULT_TAB_ORDER + 1
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    {{ iri }}
  </div>
</template>
