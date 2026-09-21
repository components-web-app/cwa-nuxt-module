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
import type { IriProp } from '#cwa/composables/cwa-resource'
import { useCwaComponent } from '#imports'

const props = defineProps<IriProp>()
const { exposeMeta } = useCwaComponent(props, undefined, { name: 'Journal Page' })
defineExpose(exposeMeta)
</script>
