<template>
  <Transition
    enter-from-class="cwa-transform cwa-opacity-0"
    enter-active-class="cwa-duration-200"
    enter-to-class="cwa-opacity-100"
    leave-from-class="cwa-opacity-100"
    leave-active-class="cwa-duration-200"
    leave-to-class="cwa-transform cwa-opacity-0"
  >
    <div v-if="route.params.iri" class="cwa-fixed cwa-z-dialog cwa-bg-dark/80 cwa-backdrop-blur-sm cwa-top-0 cwa-left-0 cwa-w-full cwa-h-full cwa-px-6 cwa-py-10 cwa-text-light cwa-flex cwa-justify-center cwa-items-center" @click="hideModal">
      <NuxtPage v-if="route.params.iri" @click.stop @close="hideModal" />
    </div>
  </Transition>
</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
function hideModal () {
  if (!route.name) {
    return
  }
  router.push({
    name: route.name.toString().replace('-iri', ''),
    query: route.query
  })
}
</script>
