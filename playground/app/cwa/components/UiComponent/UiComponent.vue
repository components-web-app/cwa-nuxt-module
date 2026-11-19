<template>
  <div>
    <CwaComponentGroup
      reference="ui-inner"
      :location="props.iri"
    />
  </div>
</template>

<script setup lang="ts">
import type { IriProp } from '#cwa/composables/cwa-resource'
import { useCwaComponent, defineCwaConfig } from '#imports'

defineCwaConfig({
  description: 'A box holding its own group of components',
  icon: 'card-grid',
  group: 'Layout',
})

const props = defineProps<IriProp>()
const { exposeMeta } = useCwaComponent(props)
defineExpose(exposeMeta)
</script>
