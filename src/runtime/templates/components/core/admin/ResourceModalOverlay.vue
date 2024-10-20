<template>
  <ResourceModalOverlayTemplate :show="!!route.params.iri">
    <NuxtPage
      v-if="route.params.iri"
      @click.stop
      @close="hideModal"
      @reload="$emit('reload')"
    />
  </ResourceModalOverlayTemplate>
</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router'
import ResourceModalOverlayTemplate from '#cwa/runtime/templates/components/core/admin/ResourceModalOverlayTemplate.vue'

defineEmits<{
  reload: []
}>()

const route = useRoute()
const router = useRouter()
function hideModal() {
  if (!route.name) {
    return
  }
  router.push({
    name: route.name.toString().replace('-iri', ''),
    query: route.query,
  })
}
</script>
