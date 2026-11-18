<template>
  <EditPlaceholder
    :label="name || 'Empty position'"
    :info="name ? `This page data has no ${name} component yet, so visitors see nothing here.` : 'No component is placed here yet, so visitors see nothing here.'"
  >
    <ComponentIcon class="cwa:text-fg-muted" />
  </EditPlaceholder>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import ComponentIcon from './assets/IconComponents.vue'
import EditPlaceholder from '../ui/EditPlaceholder.vue'
import type { IriProp } from '#cwa/composables/cwa-resource'
import { useCwa } from '#cwa/composables/cwa'

const props = defineProps<IriProp & {
  name?: string
}>()

const $cwa = useCwa()
onMounted(() => {
  $cwa.admin.eventBus.emit('componentMounted', props.iri + '_placeholder')
})
</script>
