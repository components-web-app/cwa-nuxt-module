<template>
  <EditPlaceholder :label="name || 'Empty position'">
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
