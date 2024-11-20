<template>
  <div class="resource-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm ">
    <div
      v-for="(resource, index) of $cwa.resources.currentResources"
      :key="`resource-grid-${index}`"
      class="resource-grid-item bg-slate-100 relative"
    >
      <div
        class="resource-title px-2 py-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis transition duration-300"
        :class="[{ 'bg-lime-200': resource.apiState.status === 1 }, { 'bg-red-200': resource.apiState.status === -1 }]"
      >
        {{ index }}
      </div>
      <div class="path-header px-2 py-1 bg-slate-200">
        {{ resource.apiState.status === CwaResourceApiStatuses.ERROR ? '--' : resource.apiState?.headers?.path }}
      </div>
      <pre class="resource-code text-xs p-3 h-56 overflow-auto">{{ resource.data }}</pre>
      <div
        v-if="resource.apiState.status === CwaResourceApiStatuses.ERROR && resource.apiState.error?.message"
        class="resource-error absolute top-16 bottom-2 left-2 right-2 bg-red-200/95 p-3 overflow-auto"
      >
        <b>Status code:</b> {{ resource.apiState.error.statusCode || 'Unknown' }}<br>
        <b>Message:</b><br>{{ resource.apiState.error.primaryMessage }}<br>
        <b>Request:</b><br>{{ resource.apiState.error.request }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCwa } from '#imports'
import { CwaResourceApiStatuses } from '#cwa/runtime/storage/stores/resources/state'

const $cwa = useCwa()
</script>
