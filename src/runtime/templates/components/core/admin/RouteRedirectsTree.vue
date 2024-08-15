<template>
  <div>
    <ul class="relative cwa-flex cwa-flex-col cwa-space-y-0.5 cwa-pl-3">
      <li
        v-for="(redirectRoute, index) of redirects"
        :key="redirectRoute['@id']"
        class="relative"
      >
        <div class="cwa-flex cwa-flex-col cwa-space-y-0.5">
          <div class="relative cwa-flex cwa-items-center before:cwa-absolute before:cwa-w-3 before:cwa-border-b before:cwa-top-1/2 before:cwa-right-full before:cwa-border-stone-400 hover:cwa-bg-stone-800 cwa-px-2 cwa-py-1.5">
            <div class="cwa-grow cwa-min-w-0 cwa-truncate">
              {{ redirectRoute.path }}
            </div>
            <div>
              <button class="cwa-opacity-60 hover:cwa-opacity-80 cwa-translate-y-0.5" @click="deleteRoute(redirectRoute['@id'])">
                <CwaUiIconBinIcon class="cwa-w-3.5" />
              </button>
            </div>
            <div class="cwa-absolute cwa-top-0 -cwa-left-3 cwa-h-1/2 cwa-border-l cwa-border-stone-400" />
            <div v-if="index < redirects.length - 1" class="cwa-absolute cwa-top-1/2 -cwa-left-3 cwa-h-[calc(50%+.75rem)] cwa-border-l cwa-border-stone-400" />
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
