<template>
  <div class="cwa:flex cwa:flex-col cwa:border cwa:border-dashed cwa:border-gray-300 cwa:p-5 cwa:text-medium">
    <div class="cwa:flex cwa:justify-center">
      <ComponentIcon />
    </div>
    <div
      v-if="name"
      class="cwa:flex cwa:justify-center cwa:mt-2"
    >
      <span class="cwa:text-xs cwa:py-0.5 cwa:px-3 cwa:bg-stone-200/10 cwa:rounded-full cwa:font-bold cwa:tracking-wide">{{ name }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import ComponentIcon from './assets/IconComponents.vue'
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import { useCwa } from '#imports'

const props = defineProps<IriProp & {
  name?: string
}>()

const $cwa = useCwa()
onMounted(() => {
  $cwa.admin.eventBus.emit('componentMounted', props.iri + '_placeholder')
})
</script>
