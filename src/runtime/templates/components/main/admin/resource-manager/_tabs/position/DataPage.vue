<script lang="ts" setup>
import { useCwaResourceManagerTab } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { DEFAULT_TAB_ORDER } from '#cwa/runtime/admin/manager-tabs-resolver'

const { exposeMeta } = useCwaResourceManagerTab({
  name: 'Dynamic Component',
  order: DEFAULT_TAB_ORDER
})

defineExpose(exposeMeta)
</script>

<template>
  <div>
    Position On Data Page - quick link back to template, the component on this page could be data loaded, data empty, or fallback,
    if data loaded, this will be helpful as quick link back, if fallback component, the component will also have a link..
    LINK TO ADD THE DATA COMPONENT HERE... E.g. Add HTML
  </div>
</template>
