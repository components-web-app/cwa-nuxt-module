<template>
  <div
    itemscope
    itemtype="http://schema.org/BlogPosting"
    class="mt-10"
  >
    <div class="flex justify-center">
      <div class="w-full max-w-[1350px] lg:px-20">
        <CwaComponentGroup
          reference="ui-inner"
          :location="props.iri"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import { useCwaResource } from '#imports'

// Setup the resource
const props = defineProps<IriProp>()
const iriRef = toRef(props, 'iri')
const { exposeMeta } = useCwaResource(iriRef, { name: 'Journal Page' })
defineExpose(exposeMeta)
</script>
