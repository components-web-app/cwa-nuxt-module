<template>
  <div class="cwa-flex cwa-justify-center cwa-border cwa-border-dashed cwa-border-gray-300 cwa-p-5 cwa-text-medium">
    <ComponentIcon />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import ComponentIcon from './assets/IconComponents.vue'
import { IriProp } from '#cwa/runtime/composables/cwa-resource'
import { useCwa } from '#imports'

const props = defineProps<IriProp>()

const $cwa = useCwa()
onMounted(() => {
  $cwa.admin.eventBus.emit('componentMounted', props.iri + '_placeholder')
})
</script>
