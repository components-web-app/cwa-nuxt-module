<template>
  <ResourceModalOverlayTemplate
    v-if="overlay"
    :show="!!route.params.iri"
  >
    <NuxtPage
      v-if="route.params.iri"
      @click.stop
      @close="hideModal"
      @reload="$emit('reload')"
    />
  </ResourceModalOverlayTemplate>
  <NuxtPage
    v-else-if="route.params.iri"
    @close="hideModal"
    @reload="$emit('reload')"
  />
</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router'
import ResourceModalOverlayTemplate from '#cwa/templates/components/core/admin/ResourceModalOverlayTemplate.vue'

withDefaults(defineProps<{
  overlay?: boolean
}>(), {
  overlay: true,
})

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
    name: route.name.toString().replace(/-iri$/, ''),
    query: route.query,
  })
}
</script>
