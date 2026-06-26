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
import { useCwaComponent } from '#imports'

const props = defineProps<IriProp>()
const { exposeMeta } = useCwaComponent(props)
defineExpose(exposeMeta)
</script>
