<template>
  <div>
    <CwaComponentGroup
      reference="ui-inner"
      :location="props.iri"
    />
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import {
  useCwaResource,
} from '#imports'

const props = defineProps<IriProp>()

const { exposeMeta } = useCwaResource(toRef(props, 'iri'))

defineExpose(exposeMeta)
</script>
