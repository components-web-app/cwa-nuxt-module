<template>
  <div>
    <ul class="relative cwa-flex cwa-flex-col cwa-space-y-3 cwa-pl-3">
      <li
        v-for="(redirectRoute, index) of redirects"
        :key="redirectRoute['@id']"
        class="relative before:cwa-absolute before:cwa-w-2 before:cwa-mr-1 before:cwa-border-b before:cwa-top-1/2 before:cwa-right-full before:cwa-border-stone-400"
      >
        <div class="cwa-absolute cwa-top-0 -cwa-left-3 cwa-h-1/2 cwa-border-l cwa-border-stone-400" />
        <div v-if="index < redirects.length - 1" class="cwa-absolute cwa-top-1/2 -cwa-left-3 cwa-h-[calc(50%+.75rem)] cwa-border-l cwa-border-stone-400" />
        <div class="cwa-flex cwa-space-x-4">
          <div class="cwa-grow cwa-min-w-0 cwa-truncate">
            {{ redirectRoute.path }}
          </div>
          <div>
            <button @click="deleteRoute(redirectRoute['@id'])">
              <CwaUiIconBinIcon class="cwa-w-4" />
            </button>
          </div>
          <RouteRedirectsTree v-if="redirectRoute.redirectedFrom" :redirects="redirectRoute.redirectedFrom" @reload="$emit('reload')" />
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import { useCwa } from '#imports'

const $cwa = useCwa()
const emit = defineEmits<{
  reload: []
}>()
defineProps<{
  redirects: CwaResource[]
}>()

async function deleteRoute (iri: string) {
  await $cwa.resourcesManager.deleteResource({
    endpoint: iri
  })
  emit('reload')
}
</script>
