<template>
  <div>
    <ul class="relative cwa:flex cwa:flex-col cwa:gap-y-0.5 cwa:pl-3">
      <li
        v-for="(redirectRoute, index) of redirects"
        :key="redirectRoute['@id']"
        class="relative"
      >
        <div class="cwa:flex cwa:flex-col cwa:gap-y-0.5">
          <div class="cwa:flex cwa:items-center cwa:before:absolute cwa:before:w-3 cwa:before:border-b cwa:before:top-1/2 cwa:before:right-full cwa:before:border-stone-400 cwa:hover:bg-stone-800 cwa:px-2 cwa:py-1.5">
            <div class="cwa:grow cwa:min-w-0 cwa:truncate">
              {{ redirectRoute.path }}
            </div>
            <div>
              <button
                class="cwa:opacity-60 cwa:hover:opacity-80 cwa:translate-y-0.5 cwa:cursor-pointer"
                @click="deleteRoute(redirectRoute)"
              >
                <CwaUiIconBinIcon class="cwa:w-3.5" />
              </button>
            </div>
            <div class="cwa:absolute cwa:top-0 cwa:-left-3 cwa:h-1/2 cwa:border-l cwa:border-stone-400" />
            <div
              v-if="index < redirects.length - 1"
              class="cwa:absolute cwa:top-1/2 cwa:-left-3 cwa:h-[calc(50%+.75rem)] cwa:border-l cwa:border-stone-400"
            />
          </div>
          <RouteRedirectsTree
            v-if="redirectRoute.redirectedFrom"
            :redirects="redirectRoute.redirectedFrom"
            @delete="onDelete"
          />
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
  deleted: [resource: CwaResource]
}>()
defineProps<{
  redirects: CwaResource[]
}>()

function onDelete(resource: CwaResource) {
  emit('deleted', resource)
}

async function deleteRoute(resource: CwaResource) {
  await $cwa.resourcesManager.deleteResource({
    endpoint: resource['@id'],
  })
  onDelete(resource)
}
</script>
